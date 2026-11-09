# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Generated rooms and long spaces (gap G16): stereo impulse responses with a set reverberation time per octave.

The decay comes from the room's own physics. Eyring's formula, T60 = 0.161 V / (-S ln(1 - a) + 4 m V)
(Eyring 1930; Kuttruff, Room Acoustics), with V the volume, S the surface, a the mean absorption coefficient
of the surfaces in each octave band, and m the air's intensity attenuation from ISO 9613-1 (propagate.py,
m = alpha_dB / (10 log10 e)). A Space may also take its T60 per band directly.

The impulse response has three parts:
- the direct sound at r / c, falling as 1 / r;
- early reflections from the first- and second-order image sources of the shoebox, each delayed by its path,
  scaled by 1 / r and by sqrt(1 - a) per wall bounce (a broadband mean of the bands);
- a diffuse tail: seeded Gaussian noise whose short-time spectrum is multiplied, bin by bin, by
  exp(-6.9078 t / T60(f)) with T60(f) interpolated in log frequency between the band centres. Left and right
  tails come from two noise streams mixed to the set interaural correlation, which is what makes a space sound
  wide. The tail starts at the mixing time sqrt(V) ms (a common estimate) and is level-matched to the
  reflection energy there.
Space has the same impulse_responses(fs, rng) interface as room.Room, so it drops into an Arrangement or a
Track. The tests measure T60 per octave back from the response by Schroeder backward integration.
"""
import math
from dataclasses import dataclass, field
from itertools import product

import numpy as np

from .propagate import iso9613_alpha

BANDS = (125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0)
C = 343.0
# mean absorption per band, from memory (low confidence in exact values; the shapes are the textbook ones):
SURFACES = {"plaster": (0.02, 0.03, 0.04, 0.05, 0.05, 0.05, 0.05),
            "stone": (0.02, 0.02, 0.03, 0.04, 0.05, 0.05, 0.05),
            "wood": (0.15, 0.11, 0.10, 0.07, 0.06, 0.07, 0.07),
            "furnished": (0.20, 0.30, 0.40, 0.45, 0.50, 0.55, 0.55),
            "soft": (0.30, 0.45, 0.60, 0.70, 0.70, 0.70, 0.70)}


def eyring_t60(dims, absorption, celsius=20.0, rh=50.0):
    lx, ly, lz = dims
    v, s = lx * ly * lz, 2 * (lx * ly + lx * lz + ly * lz)
    out = []
    for f, a in zip(BANDS, absorption):
        m = iso9613_alpha(np.array([f]), celsius, rh)[0] / (10 * math.log10(math.e))   # 1/m, intensity
        out.append(0.161 * v / (-s * math.log(1 - a) + 4 * m * v))
    return tuple(out)


@dataclass(frozen=True)
class Space:
    dims: tuple = (12.0, 8.0, 5.0)
    surface: str = "plaster"
    t60: tuple = None                  # per band in BANDS; None means Eyring from dims and surface
    source: tuple = (3.0, 3.0, 1.5)
    mic: tuple = (8.0, 4.5, 1.6)
    spacing: float = 0.4               # m between the two microphones
    correlation: float = 0.2           # interaural correlation of the tail: 1 is narrow, 0 is widest
    early: bool = True
    name: str = field(default="space", compare=False)

    def band_t60(self):
        return tuple(self.t60) if self.t60 else eyring_t60(self.dims, SURFACES[self.surface])

    def _early(self, n, fs, dy):
        h = np.zeros(n)
        mic = np.array(self.mic) + np.array([0.0, dy, 0.0])
        a = float(np.mean(SURFACES.get(self.surface, SURFACES["plaster"])))
        for ix, iy, iz in product(range(-2, 3), repeat=3):
            order = abs(ix) + abs(iy) + abs(iz)
            if order > 2 or not self.early and order > 0:
                continue
            img = np.array([_image(k, p, L) for k, p, L in zip((ix, iy, iz), self.source, self.dims)])
            r = float(np.linalg.norm(img - mic))
            i = int(round(r / C * fs))
            if i < n:
                h[i] += (1 - a) ** (order / 2) / max(r, 0.1)
        return h

    def impulse_responses(self, fs, rng, seconds=None):
        """Left and right impulse responses, normalised so the louder has peak 1."""
        t60 = np.array(self.band_t60())
        seconds = seconds or float(min(12.0, 1.3 * t60.max() + 0.2))
        n = int(seconds * fs)
        v = float(np.prod(self.dims))
        mix_t = math.sqrt(v) / 1000.0
        seed = int(rng.integers(2 ** 32))
        sub = np.random.default_rng(seed)
        noise = sub.standard_normal((2, n))
        c = self.correlation
        tails = [noise[0], c * noise[0] + math.sqrt(max(0.0, 1 - c * c)) * noise[1]]
        out = []
        for side, dy in enumerate((-self.spacing / 2, self.spacing / 2)):
            early = self._early(n, fs, dy)
            tail = _decay(tails[side], fs, t60)
            onset = int(mix_t * fs)
            tail[:onset] *= np.linspace(0, 1, onset) ** 2 if onset else 1
            e_ref = np.sum(early[: max(onset * 2, 1)] ** 2) / max(onset * 2, 1)
            t_ref = np.sum(tail[onset: onset * 2 + 1] ** 2) / max(onset + 1, 1)
            tail *= math.sqrt(e_ref / max(t_ref, 1e-30)) if e_ref > 0 else 1.0
            out.append(early + tail)
        peak = max(np.abs(out[0]).max(), np.abs(out[1]).max())
        return out[0] / peak, out[1] / peak


def _image(k, p, L):
    """Coordinate of image k along one axis for a source at p in a box of length L."""
    return k * L + (p if k % 2 == 0 else L - p)


def _decay(noise, fs, t60):
    """Split the noise into octave bands with complementary raised-cosine masks in log frequency (they sum to 1
    at every frequency), give each band its own exponential decay in time, and sum."""
    n = len(noise)
    spec = np.fft.rfft(noise)
    f = np.maximum(np.fft.rfftfreq(n, 1.0 / fs), 1.0)
    x = np.log2(f / BANDS[0])                                  # band k sits at x = k
    t = np.arange(n) / fs
    y = np.zeros(n)
    for k, tb in enumerate(t60):
        d = x - k
        w = np.where(np.abs(d) < 1, 0.5 * (1 + np.cos(math.pi * d)), 0.0)
        if k == 0:
            w[d <= 0] = 1.0
        if k == len(t60) - 1:
            w[d >= 0] = 1.0
        y += np.fft.irfft(spec * w, n) * np.exp(-6.9078 * t / tb)
    return y


def measure_t60(h, fs, band, lo_db=-5.0, hi_db=-35.0, width=1.0):
    """T60 in a band of `width` octaves around `band` by Schroeder backward integration, fitted from lo_db to
    hi_db (T30). The generated decay holds the set T60 exactly at each band centre and blends between centres,
    so a third-octave reading (width 1/3) is the sharp check and an octave reading includes the blend."""
    from scipy.signal import butter, sosfiltfilt
    e2 = 2 ** (width / 2)
    sos = butter(8, (band / e2, min(band * e2, 0.45 * fs)), "bandpass", fs=fs, output="sos")
    y = sosfiltfilt(sos, h)
    e = np.cumsum((y ** 2)[::-1])[::-1]
    edc = 10 * np.log10(e / e[0] + 1e-300)
    i0, i1 = np.argmax(edc <= lo_db), np.argmax(edc <= hi_db)
    t = np.arange(len(edc)) / fs
    slope = np.polyfit(t[i0:i1], edc[i0:i1], 1)[0]
    return -60.0 / slope

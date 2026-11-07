# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Re-render a layer from its notes and its timbre profile, two ways.

Timbre profile (measured from the layer at its own notes): the mean level of harmonics 1 to 16 relative to the
fundamental, the attack time (10 to 90% of the note's peak), the decay rate after the peak (dB per second), and the
noise floor's spectral envelope in 24 bands relative to the harmonic level.

1. Spectral model, sample free: each note is the sum of its harmonics at the measured relative levels, shaped by the
   measured attack and decay, plus noise through the measured band envelope. Seeded, so it repeats.
2. Physical model through the DAW (packages/daw): the instrument whose own harmonic profile is nearest the measured
   one is chosen from a waveguide piano (three strings, felt hammer), a plucked waveguide string, a struck aluminium
   bar, and a breath-driven air column (modal); each note is tuned to its pitch and rendered at its velocity.
The waveguide loops run through remastering.accel, which the tests hold bit-identical to daw.waveguide.string.
"""
import math

import numpy as np
from scipy.signal import oaconvolve

from daw import materials as M
from daw.modes import tune
from daw.shapes_1d import Bar, Tube
from daw.synth import render as modal_render
from daw.waveguide import hammer, loop_params

from . import accel
from .stft import stft
from .transcribe import hz

NH = 16
BANDS = np.geomspace(60, 18000, 25)


def profile(y, fs, notes):
    """Measured timbre profile of a layer at its notes."""
    m = np.atleast_2d(y).mean(0)
    n_fft, hop = 4096, 512
    S = np.abs(stft(m, n_fft, hop))
    f = np.fft.rfftfreq(n_fft, 1 / fs)
    harm, att, dec, noise = [], [], [], []
    for s, d, p, _ in notes[:400]:
        i0, i1 = int(s * fs / hop), int((s + d) * fs / hop) + 1
        if i1 - i0 < 3 or i1 > S.shape[1]:
            continue
        f0 = hz(p)
        bins = [int(round(h * f0 * n_fft / fs)) for h in range(1, NH + 1)]
        seg = S[:, i0:i1]
        lv = np.array([seg[max(0, b - 1):b + 2].max() if b < len(f) - 2 else 1e-9 for b in bins])
        harm.append(20 * np.log10(np.maximum(lv, 1e-9) / max(lv[0], 1e-9)))
        e = seg[max(0, bins[0] - 1):bins[0] + 2].max(0)
        k = int(np.argmax(e))
        lo, hi = 0.1 * e[k], 0.9 * e[k]
        att.append((np.argmax(e >= hi) - np.argmax(e >= lo)) * hop / fs)
        if len(e) - k > 4:
            tail = 20 * np.log10(np.maximum(e[k:k + max(4, int(0.7 * (len(e) - k)))], 1e-9))
            dec.append(float(np.polyfit(np.arange(len(tail)) * hop / fs, tail, 1)[0]))
        hmask = np.zeros(len(f), bool)
        for b in bins:
            hmask[max(0, b - 2):b + 3] = True
        spec = seg.mean(1)
        nb = [spec[(f >= a) & (f < b) & ~hmask].mean() if ((f >= a) & (f < b) & ~hmask).any() else 1e-9
              for a, b in zip(BANDS[:-1], BANDS[1:])]
        noise.append(20 * np.log10(np.maximum(nb, 1e-9) / max(lv[0], 1e-9)))
    if not harm:
        return None
    return {"harmonics_db": np.median(harm, 0).round(2).tolist(), "attack_s": float(np.median(att)),
            "decay_db_per_s": float(np.median(dec)) if dec else -6.0, "noise_db": np.median(noise, 0).round(2).tolist()}


def _env(n, fs, attack, decay_db_s, dur_n):
    t = np.arange(n) / fs
    a = np.minimum(1.0, t / max(attack, 1e-3))
    d = 10 ** (np.minimum(0.0, decay_db_s) * np.maximum(t - attack, 0) / 20)
    rel = np.clip((dur_n + 0.05 * fs - np.arange(n)) / (0.05 * fs), 0, 1)
    return a * d * rel


def spectral_model(notes, prof, fs, n, seed=0):
    """Sample-free render of the notes with the profile."""
    rng = np.random.default_rng(seed)
    out = np.zeros(n)
    hl = 10 ** (np.array(prof["harmonics_db"]) / 20)
    nl = 10 ** (np.array(prof["noise_db"]) / 20)
    for s, d, p, v in notes:
        i0 = int(s * fs)
        dur_n = int(d * fs)
        m = min(n - i0, dur_n + int(0.06 * fs))
        if m <= 0:
            continue
        t = np.arange(m) / fs
        f0 = hz(p)
        k = np.arange(1, NH + 1)
        ok = k * f0 < 0.45 * fs
        y = (hl[ok, None] * np.sin(2 * math.pi * f0 * np.outer(k[ok], t))).sum(0)
        w = rng.standard_normal(m)
        W = np.fft.rfft(w)
        ff = np.fft.rfftfreq(m, 1 / fs)
        W *= np.interp(ff, np.sqrt(BANDS[:-1] * BANDS[1:]), nl, left=nl[0], right=0.0) * math.sqrt(2.0)
        y += np.fft.irfft(W, m)
        out[i0:i0 + m] += v * y * _env(m, fs, prof["attack_s"], prof["decay_db_per_s"], dur_n)
    return out


def _piano(f0, seconds, fs):
    h = hammer(fs)
    tot = int(seconds * fs)
    return sum(accel.waveguide(h, tot, *loop_params(f0 * 2 ** (c / 1200), fs, 6.0)) for c in (-0.8, 0.0, 0.9)) / 3


def _pluck(f0, seconds, fs, rng):
    n, a, g = loop_params(f0, fs, 2.0)
    m = int(fs / f0)
    tri = np.minimum(np.arange(m) / (0.2 * m), (m - np.arange(m)) / (0.8 * m))
    return accel.waveguide(rng.uniform(-1, 1, m) * 0.3 + tri, int(seconds * fs), n, a, g)


def _bar(f0, seconds, fs):
    bar = tune(Bar(M.material("aluminium"), 0.3, 0.012), f0)
    return modal_render(bar.modes(), fs, seconds, (0.5,), (0.02,), "strike", tau=1e-3)


def _tube(f0, seconds, fs, rng):
    tube = tune(Tube(0.6, 0.01, "open-open", M.air_speed()), f0)
    return modal_render(tube.modes(), fs, seconds, (0.3,), (0.7,), "breath", rng=rng, hold=seconds * 0.85)


INSTRUMENTS = {"piano": lambda f, s, fs, r: _piano(f, s, fs), "pluck": _pluck,
               "bar": lambda f, s, fs, r: _bar(f, s, fs), "air-column": _tube}


def instrument_profile(name, fs, f0=262.0, seconds=1.0, seed=0):
    y = INSTRUMENTS[name](f0, seconds, fs, np.random.default_rng(seed))
    return profile(y[None, :], fs, [[0.0, seconds * 0.9, 60, 1.0]])


def choose_instrument(prof, fs):
    """The DAW instrument whose own harmonic profile is nearest the measured one (RMS dB over 8 harmonics)."""
    best = None
    for name in INSTRUMENTS:
        ip = instrument_profile(name, fs)
        if ip is None:
            continue
        d = float(np.sqrt(np.mean((np.array(ip["harmonics_db"][:8]) - np.array(prof["harmonics_db"][:8])) ** 2)))
        if best is None or d < best[1]:
            best = (name, d)
    return best


def physical_model(notes, prof, fs, n, seed=0, instrument=None):
    rng = np.random.default_rng(seed)
    name = instrument or choose_instrument(prof, fs)[0]
    out = np.zeros(n)
    for s, d, p, v in notes:
        i0 = int(s * fs)
        sec = min(d + 0.3, (n - i0) / fs)
        if sec <= 0.01:
            continue
        y = INSTRUMENTS[name](float(hz(p)), sec, fs, rng)
        y = y / (np.abs(y).max() + 1e-12)
        y *= np.clip((d * fs + 0.05 * fs - np.arange(len(y))) / (0.05 * fs), 0, 1)
        out[i0:i0 + len(y)] += v * y[: n - i0]
    return out, name

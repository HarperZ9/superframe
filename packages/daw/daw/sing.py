# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""An expressive voice from the physical tract: a pitch line with vibrato, jitter and shimmer, effort that changes
the glottal pulse, aspiration, and vowels that glide from one measured tract shape to the next.

The tract is the lossy chain of `tract.py` (lip radiation, optional yielding walls), here vectorised across
frequency so a new transfer can be computed for every frame. The shapes are the area functions of the Dresden
Vocal Tract Dataset (printed MRI tracts, `packages/measured`), each trimmed of its lip cap and resampled to the
same number of sections along its own length, so two shapes can be mixed section by section and a vowel glide is
a straight line between area functions (lengths mixed too). The source is a Rosenberg pulse laid cycle by cycle:
each period is 1 / f0 at its start, times (1 + jitter noise), and each pulse is scaled by (1 + shimmer noise),
both from the seeded generator. A Gaussian period perturbation of sd s gives a local jitter (mean absolute
difference of consecutive periods over the mean period) of 2 s / sqrt(pi), so the jitter control is the local
jitter itself. Effort sets the open quotient (0.8 soft to 0.45 pressed) and the pulse skew (1.5 to 3.5): a pressed
voice has a shorter open phase and a sharper closure, so its first harmonic drops against the second (H1 - H2,
Holmberg et al. 1995, from memory, moderate confidence). Vibrato is a sinusoid in cents after an onset delay and a
fade-in. The tract filters the flow frame by frame (STFT, 43 ms frames, 11 ms hop), and the lips differentiate it.
"""
import math

import numpy as np

from . import spectral as S
from . import tract as T

SECTIONS = 44


def transfer(freqs, areas, lengths, c, rho=1.14, walls=False):
    """U_lips / U_glottis as `tract.transfer` with lips on, for all frequencies at once."""
    f = np.asarray(freqs, float)
    w = 2 * math.pi * f
    k = w / c
    K = np.broadcast_to(np.eye(2, dtype=complex), (len(f), 2, 2)).copy()
    for A, l in zip(areas, lengths):
        z = rho * c / A
        cs, sn = np.cos(k * l), np.sin(k * l)
        M = np.stack([np.stack([cs, 1j * z * sn], -1), np.stack([1j * sn / z, cs], -1)], -2)
        K = K @ M
        if walls:
            y = 2 * math.sqrt(math.pi * A) * l / (T.WALL_R + 1j * w * T.WALL_M)
            K = K @ np.stack([np.stack([np.ones_like(y), np.zeros_like(y)], -1), np.stack([y, np.ones_like(y)], -1)], -2)
    a = math.sqrt(areas[-1] / math.pi)
    zr = rho * c / areas[-1] * ((k * a) ** 2 / 2 + 1j * 8 * k * a / (3 * math.pi))
    return 1.0 / (K[:, 1, 0] * zr + K[:, 1, 1])


def shape(area_m2, section_m, sections=SECTIONS):
    """(areas, total length) of a measured area function on `sections` equal sections."""
    a = np.maximum(T.trim_lip_cap(area_m2), 1e-6)
    x = (np.arange(len(a)) + 0.5) / len(a)
    u = (np.arange(sections) + 0.5) / sections
    return np.interp(u, x, a), len(a) * section_m


def vowels(speaker=1):
    """The tense vowels and schwa of one DVTD speaker as {sound: (areas, length)}."""
    from measured import load
    out = {}
    for r in load("vocal_tract_areas_dvtd")["rows"]:
        sound = r["model"].split("-", 3)[3]
        if r["model"].startswith(f"s{speaker}-") and (sound.startswith("tense-") or sound == "schwa"):
            out[sound.replace("tense-", "")] = shape(r["area_m2"], r["section_m"])
    return out


def path_at(path, t):
    """Area function at time t on a path [(time, (areas, length)), ...]: hold the ends, mix linearly between."""
    times = [p[0] for p in path]
    if t <= times[0]:
        return path[0][1]
    if t >= times[-1]:
        return path[-1][1]
    i = int(np.searchsorted(times, t)) - 1
    a = (t - times[i]) / (times[i + 1] - times[i])
    (A0, L0), (A1, L1) = path[i][1], path[i + 1][1]
    return (1 - a) * A0 + a * A1, (1 - a) * L0 + a * L1


def pitch_line(points, seconds, fs, vibrato=None):
    """f0 per sample: log-linear between (time, Hz) points; vibrato = (rate Hz, depth cents, onset s, fade s)."""
    t = np.arange(int(seconds * fs)) / fs
    pt = np.array(points, float)
    f0 = np.exp(np.interp(t, pt[:, 0], np.log(pt[:, 1])))
    if vibrato:
        rate, depth, onset, fade = vibrato
        ramp = np.clip((t - onset) / max(fade, 1e-9), 0.0, 1.0)
        f0 = f0 * 2.0 ** (depth / 1200.0 * ramp * np.sin(2 * math.pi * rate * np.maximum(t - onset, 0.0)))
    return f0


def effort_pulse(effort):
    e = float(np.clip(effort, 0.0, 1.0))
    return 0.8 - 0.35 * e, 1.5 + 2.0 * e


def source(f0, fs, effort=0.5, jitter=0.0, shimmer=0.0, aspiration=0.0, rng=None):
    """Glottal flow laid cycle by cycle; returns (flow, list of period lengths in samples)."""
    if (jitter or shimmer or aspiration) and rng is None:
        raise ValueError("jitter, shimmer and aspiration need the seeded generator")
    oq, speed = effort_pulse(effort)
    tp, tn = oq * speed / (1 + speed), oq / (1 + speed)
    n, g, periods, t = len(f0), np.zeros(len(f0)), [], 0.0
    sd = jitter * math.sqrt(math.pi) / 2
    while t < n - 1:
        P = fs / f0[int(t)] * (1 + (sd * rng.standard_normal() if jitter else 0.0))
        amp = 1 + (shimmer * rng.standard_normal() if shimmer else 0.0)
        s = np.arange(math.ceil(t), min(n, math.ceil(t + P)))
        ph = (s - t) / P
        g[s] = amp * np.where(ph < tp, 0.5 * (1 - np.cos(math.pi * ph / tp)),
                              np.where(ph < tp + tn, np.cos(math.pi * (ph - tp) / (2 * tn)), 0.0))
        if aspiration:
            g[s] += aspiration * amp * rng.standard_normal(len(s)) * (ph < tp + tn)
        periods.append(P)
        t += P
    return g, periods


def through_tract(flow, fs, path, c=352.0, walls=True, scale=1.0):
    """Flow filtered by the tract shape of each frame, then differentiated at the lips."""
    X = S.stft(flow)
    fr = np.fft.rfftfreq(S.N_FFT, 1.0 / fs)
    fr[0] = 1.0
    cache = {}
    for i in range(len(X)):
        A, L = path_at(path, i * S.HOP / fs)
        key = (A.tobytes(), L)
        if key not in cache:
            cache[key] = transfer(fr, A, np.full(len(A), L * scale / len(A)), c, walls=walls)
        X[i] *= cache[key]
    y = S.istft(X, len(flow))
    return np.diff(y, prepend=0.0)


def sing(path, points, seconds, fs, vibrato=(5.5, 50.0, 0.3, 0.4), effort=0.5, jitter=0.005, shimmer=0.03,
         aspiration=0.0, seed=0, c=352.0, walls=True, scale=1.0, envelope=(0.05, 0.12)):
    """One voice. path: [(time, (areas, length))]; points: [(time, Hz)]; returns (audio at peak 1, info)."""
    rng = np.random.default_rng(seed)
    f0 = pitch_line(points, seconds, fs, vibrato)
    flow, periods = source(f0, fs, effort, jitter, shimmer, aspiration, rng)
    y = through_tract(flow, fs, path, c, walls, scale)
    att, rel = (int(v * fs) for v in envelope)
    env = np.ones(len(y))
    env[:att] = np.linspace(0, 1, att)
    env[len(y) - rel:] = np.linspace(1, 0, rel)
    y = y * env
    return y / (np.max(np.abs(y)) + 1e-12), {"f0": f0, "flow": flow, "periods": periods}

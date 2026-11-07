# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Dynamics: a feed-forward compressor, a multiband compressor on linear-phase crossovers, and a true-peak limiter.

Compressor: the level is the stereo-linked mean square through a 5 ms one-pole, in dB. Static curve with a soft
knee of width W around threshold T and ratio R (Giannoulis, Massberg and Reiss 2012):
    below T - W/2: no change; above T + W/2: T + (x - T) / R; between: x + (1/R - 1)(x - T + W/2)^2 / (2W).
The gain reduction is smoothed by an attack/release follower in dB, then makeup gain is added.

Multiband: complementary linear-phase crossovers. The low band is the input through a symmetric lowpass FIR; the
next band is what is left of the input (delayed by the FIR's half length) through the next lowpass, and so on, so
the bands always sum to the delayed input exactly. With every ratio at 1 the output equals the input.

True-peak limiter: the signal is oversampled 4x, the gain each oversampled sample needs to stay under the ceiling
is taken, reduced back to the base rate by its minimum over each group, and handed to the DAW's lookahead limiter
gain law (packages/daw/daw/mixer.py: hold over the lookahead window, one-pole release, never above the hold). The
result is measured at 4x again and a second pass trims any remainder.
"""
import math

import numpy as np
from scipy.signal import firwin, lfilter

from daw.mixer import limit as daw_limit

from . import accel
from .eq import apply_fir
from .resample import oversample


def static_curve(level_db, threshold, ratio, knee):
    x = np.asarray(level_db, float)
    out = x.copy()
    lo, hi = threshold - knee / 2, threshold + knee / 2
    over = x > hi
    out[over] = threshold + (x[over] - threshold) / ratio
    mid = (x > lo) & ~over
    if knee > 0:
        out[mid] = x[mid] + (1 / ratio - 1) * (x[mid] - lo) ** 2 / (2 * knee)
    return out


def compress(y, fs, threshold=-18.0, ratio=2.0, knee=6.0, attack=0.01, release=0.15, makeup=0.0, detector=0.005,
             decim=16):
    """Stereo-linked compressor; returns (out, gain_db curve). The detector and the gain law run on 16-sample
    block means of the squared signal (0.33 ms at 48 kHz, well under the 5 ms detector), and the gain is
    interpolated back to every sample."""
    y = np.atleast_2d(np.asarray(y, np.float64))
    n = y.shape[1]
    nb = -(-n // decim)
    sq = np.zeros(nb * decim)
    sq[:n] = (y * y).mean(0)
    sq = sq.reshape(nb, decim).mean(1)
    fsd = fs / decim
    a = math.exp(-1 / (detector * fsd))
    ms = lfilter([1 - a], [1, -a], sq)
    lvl = 10 * np.log10(np.maximum(ms, 1e-20))
    gr = lvl - static_curve(lvl, threshold, ratio, knee)          # >= 0 dB of reduction
    a_att, a_rel = math.exp(-1 / (attack * fsd)), math.exp(-1 / (release * fsd))
    gr_s = accel.follow(gr, a_att, a_rel)
    g_db = makeup - np.interp(np.arange(n), (np.arange(nb) + 0.5) * decim - 0.5, gr_s)
    return y * (10 ** (g_db / 20))[None, :], g_db


def crossover_filters(freqs, fs, taps=2047):
    """Symmetric lowpass FIRs, one per crossover frequency, ascending."""
    return [firwin(taps, f, window=("kaiser", 10.0), fs=fs) for f in sorted(freqs)]


def split_bands(y, freqs, fs, taps=2047):
    """Complementary bands that sum exactly to the input (all filters are zero-delay after alignment)."""
    rest = np.atleast_2d(np.asarray(y, np.float64))
    bands = []
    for h in crossover_filters(freqs, fs, taps):
        low = apply_fir(rest, h)
        bands.append(low)
        rest = rest - low
    bands.append(rest)
    return bands


def multiband(y, fs, crossovers=(120.0, 1000.0, 6000.0), settings=None, taps=2047):
    """settings: one dict of compress() keywords per band (len(crossovers) + 1). Returns (out, per-band gain curves)."""
    bands = split_bands(y, crossovers, fs, taps)
    settings = settings or [{}] * len(bands)
    out, curves = np.zeros_like(bands[0]), []
    for b, s in zip(bands, settings):
        if not s or s.get("ratio", 1.0) == 1.0 and s.get("makeup", 0.0) == 0.0:
            out += b
            curves.append(None)
            continue
        c, g = compress(b, fs, **s)
        out += c
        curves.append(g)
    return out, curves


def _daw_gain_law(need, fs, lookahead, release):
    """The DAW limiter's gain law, called on a buffer whose peak is 1 / need, so it returns exactly that law's gain."""
    _, gain = daw_limit((1.0 / np.maximum(need, 1e-12))[:, None], 1.0, fs, lookahead, release)
    return gain


def peak_envelope(y, factor=4):
    """Per base-rate sample, the largest |value| among its `factor` oversampled neighbours (all channels)."""
    from .kernels import peak_env
    from .resample import _os_filter
    g = peak_env(y, _os_filter(int(factor)), factor)
    if g is not None:
        return g
    up = oversample(np.atleast_2d(y), factor)
    n = np.atleast_2d(y).shape[1]
    return np.abs(up).max(0)[: n * factor].reshape(-1, factor).max(1)


def limit_gain(pk, gain_lin, fs, ceiling_db=-1.0, lookahead=0.005, release=0.08):
    """The limiter's gain curve for input gain `gain_lin`, from a precomputed peak envelope (no new oversampling)."""
    ceiling = 10 ** (ceiling_db / 20)
    need = np.minimum(1.0, ceiling / np.maximum(pk * gain_lin, 1e-12))
    return _daw_gain_law(need, fs, lookahead, release)


def true_peak_limit(y, fs, ceiling_db=-1.0, lookahead=0.005, release=0.08, factor=4, passes=3, pk=None):
    """Limit so the 4x-oversampled peak stays at or under the ceiling; returns (out, gain curve). Each further pass
    re-measures the result and trims what the slowly varying gain let through."""
    y = np.atleast_2d(np.asarray(y, np.float64))
    ceiling = 10 ** (ceiling_db / 20)
    total = np.ones(y.shape[1])
    out = y
    for i in range(passes):
        p = pk if (i == 0 and pk is not None) else peak_envelope(out, factor)
        if p.max() <= ceiling * (1 + 1e-6):
            break
        g = limit_gain(p, 1.0, fs, ceiling_db, lookahead, release)
        out = out * g[None, :]
        total *= g
    return out, total

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Mid/side and width. M = (L + R) / 2, S = (L - R) / 2; width scales S (0 mono, 1 unchanged, above 1 wider).
`mono_below` folds the side signal below a frequency to mono with a linear-phase lowpass, so bass stays centred."""
import numpy as np
from scipy.signal import firwin

from .eq import apply_fir


def to_ms(y):
    y = np.asarray(y, np.float64)
    return np.stack([(y[0] + y[1]) / 2, (y[0] - y[1]) / 2])


def from_ms(ms):
    return np.stack([ms[0] + ms[1], ms[0] - ms[1]])


def width(y, amount=1.0, mono_below=None, fs=48000, taps=2047):
    ms = to_ms(y)
    s = ms[1] * amount
    if mono_below:
        s = s - apply_fir(s, firwin(taps, mono_below, window=("kaiser", 10.0), fs=fs))
    return from_ms(np.stack([ms[0], s]))


def correlation(y):
    """Inter-channel correlation in [-1, 1]; 1 is mono."""
    a, b = np.asarray(y[0], float), np.asarray(y[1], float)
    d = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / d) if d > 0 else 1.0


def side_ratio_db(y):
    ms = to_ms(y)
    return float(10 * np.log10(((ms[1] ** 2).sum() + 1e-20) / ((ms[0] ** 2).sum() + 1e-20)))

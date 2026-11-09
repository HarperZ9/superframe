# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Saturation, bit and rate reduction (gap G12): inserts with known answers.

Curves, each a memoryless map of the drive-scaled input:

- `tanh`: symmetric soft clip. An odd function, so a sine gains odd harmonics only.
- `diode`: one-sided clip, e^u - 1 on the negative half (a diode to ground, toward -1) and linear above, with
  unit slope at zero and small-signal gain 1. Asymmetric, so even harmonics appear.
- `tube`: a biased tanh, tanh(g x + b) - tanh(b): the operating point sits off centre, as a triode's does, so
  at moderate drive the second harmonic leads (drive 1, bias 0.3, a 0.8 sine: H2 -20.6 dB, H3 -28.6 dB);
  driven harder the odd harmonics overtake it (drive 3: H2 -20.0 dB, H3 -14.5 dB).

Nonlinear curves run oversampled (4x by default, polyphase FIR from scipy) so harmonics above Nyquist are
filtered before they fold back; `oversample=1` turns that off, and the tests measure the difference.

`crush(x, bits)` rounds to 2^bits levels over [-1, 1]; `hold(x, fs, rate)` is a sample-and-hold at `rate`,
which leaves images at rate - f. Both are read back from the output in the tests.

`insert(kind, **kw)` returns a callable f(mono, fs) for `Track.inserts`.
"""
import math

import numpy as np
from scipy.signal import resample_poly


def _tanh(v, drive, bias):
    return np.tanh(drive * v) / math.tanh(drive)


def _diode(v, drive, bias):
    u = drive * v
    return np.where(u >= 0, u, np.expm1(np.minimum(u, 0.0))) / drive


def _tube(v, drive, bias):
    return (np.tanh(drive * v + bias) - math.tanh(bias)) / (math.tanh(drive + bias) - math.tanh(bias))


CURVES = {"tanh": _tanh, "diode": _diode, "tube": _tube}


def saturate(x, curve="tanh", drive=2.0, bias=0.3, oversample=4):
    """Apply a curve to x (mono, float), oversampled by an integer factor; returns the same length."""
    fn = CURVES[curve]
    x = np.asarray(x, float)
    if oversample <= 1:
        return fn(x, drive, bias)
    up = resample_poly(x, oversample, 1)
    return resample_poly(fn(up, drive, bias), 1, oversample)[: len(x)]


def crush(x, bits):
    """Quantise to 2^bits levels over [-1, 1] (mid-tread step 2 / 2^bits), clipped to the range."""
    step = 2.0 / (1 << int(bits))
    return np.clip(np.round(np.asarray(x, float) / step) * step, -1.0, 1.0)


def hold(x, fs, rate):
    """Sample-and-hold at `rate` Hz on the fs grid: each output sample repeats the last held input."""
    x = np.asarray(x, float)
    idx = np.floor(np.floor(np.arange(len(x)) * rate / fs) * fs / rate).astype(int)
    return x[np.minimum(idx, len(x) - 1)]


def insert(kind, **kw):
    """An insert for Track.inserts: kind is a curve name, 'crush' (bits=) or 'hold' (rate=)."""
    if kind == "crush":
        return lambda mono, fs: crush(mono, kw.get("bits", 8))
    if kind == "hold":
        return lambda mono, fs: hold(mono, fs, kw.get("rate", 11025.0))
    if kind not in CURVES:
        raise ValueError(kind)
    return lambda mono, fs: saturate(mono, kind, **kw)


def harmonics(y, fs, f0, count=6):
    """Level of harmonics 1..count in dB relative to the first, from a Blackman-windowed spectrum."""
    n = len(y)
    spec = np.abs(np.fft.rfft(y * np.blackman(n)))
    bins = [int(round(k * f0 * n / fs)) for k in range(1, count + 1)]
    amp = np.array([spec[max(b - 2, 0):b + 3].max() for b in bins])
    return 20 * np.log10(np.maximum(amp, 1e-300) / amp[0])

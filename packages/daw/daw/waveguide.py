# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Digital waveguide strings: a travelling wave in a delay loop (Karplus and Strong 1983; Jaffe and Smith 1983).

The loop holds N samples, a two-point average (half a sample of delay, gain cos(pi f / fs) at f) and a
first-order allpass for the fractional rest of the period, so the loop delay is exactly fs / f0 at the
fundamental. A per-period gain g sets the fundamental's decay: the level falls by g cos(pi f0 / fs) each
period, so g = 10^(-3 / (T60 f0)) / cos(pi f0 / fs) gives the requested T60 at f0.
A piano note is three such strings at slightly different tunings struck by one felt hammer, here a
raised-cosine force pulse whose length sets the brightness; the strings beat at their frequency
differences. String dispersion (the piano's stretched partials) is in dispersion.py; piano(..., b=B) uses it.
"""
import math

import numpy as np
from scipy.signal import lfilter


def loop_params(f0, fs, t60):
    period = fs / f0
    n = int(math.floor(period - 0.5))
    if n < 2:
        raise ValueError("f0 too high for this sample rate")
    d = period - 0.5 - n                     # fractional delay left for the allpass, in [0, 1)
    if d < 0.1:                              # keep the allpass delay away from 0, where it is least accurate
        n -= 1
        d += 1.0
    a = (1 - d) / (1 + d)
    g = 10 ** (-3 / (t60 * f0)) / math.cos(math.pi * f0 / fs)
    return n, a, min(g, 0.99999)


def string(f0, seconds, fs, excitation, t60=2.0, fast=False):
    """Run a waveguide string for `seconds`, driven by `excitation` as an input added into the loop: one
    period of shaped noise is a pluck, a short pulse is a hammer strike. fast=True runs the same loop as one
    linear recursive filter (string_filter), equal to the sample loop to rounding."""
    if fast:
        return string_filter(f0, seconds, fs, excitation, t60)
    n, a, g = loop_params(f0, fs, t60)
    total = int(seconds * fs)
    buf = np.zeros(n)                          # the delay line: a value written at step i is read at i + n
    x = np.zeros(total)
    x[:min(total, len(excitation))] = excitation[:total]
    y = np.zeros(total)
    ap_x = ap_y = prev = 0.0
    for i in range(total):
        out = buf[i % n]
        avg = 0.5 * (out + prev)
        prev = out
        ap = a * avg + ap_x - a * ap_y          # first-order allpass, fractional delay
        ap_x, ap_y = avg, ap
        v = g * ap + x[i]
        buf[i % n] = v
        y[i] = v
    return y


def string_filter(f0, seconds, fs, excitation, t60=2.0):
    """The loop in string() is linear and time-invariant: v = x + g A(z) (1 + z^-1) / 2 z^-n v, with the
    allpass A(z) = (a + z^-1) / (1 + a z^-1). Clearing the allpass denominator gives one recursive filter,
    V (1 + a z^-1 - g / 2 (a + z^-1)(1 + z^-1) z^-n) = X (1 + a z^-1), run here by scipy's lfilter."""
    n, a, g = loop_params(f0, fs, t60)
    total = int(seconds * fs)
    x = np.zeros(total)
    x[:min(total, len(excitation))] = excitation[:total]
    den = np.zeros(n + 3)
    den[0], den[1] = 1.0, a
    den[n] -= 0.5 * g * a
    den[n + 1] -= 0.5 * g * (a + 1.0)
    den[n + 2] -= 0.5 * g
    return lfilter([1.0, a], den, x)


def pluck(f0, fs, rng, position=0.2):
    """A pluck: one period of seeded noise shaped by a triangle peaking at the plucking position."""
    m = int(fs / f0)
    tri = np.minimum(np.arange(m) / (position * m), (m - np.arange(m)) / ((1 - position) * m))
    return rng.uniform(-1, 1, m) * 0.3 + tri


def hammer(fs, contact=2e-3):
    """Felt hammer force: a raised cosine of the contact time (shorter is harder and brighter)."""
    m = max(2, int(contact * fs))
    return 0.5 * (1 - np.cos(2 * math.pi * np.arange(m) / m))


def piano(f0, seconds, fs, detune_cents=(-0.8, 0.0, 0.9), t60=6.0, contact=2e-3, fast=False, b=0.0):
    """Three unison strings, one hammer; returns the sum. b > 0 makes each string stiff, with inharmonicity
    coefficient b (dispersion.stiff_string, gap G19)."""
    h = hammer(fs, contact)
    if b > 0:
        from .dispersion import stiff_string
        return sum(stiff_string(f0 * 2 ** (c / 1200), seconds, fs, h, t60, b) for c in detune_cents) / len(detune_cents)
    return sum(string(f0 * 2 ** (c / 1200), seconds, fs, h, t60, fast) for c in detune_cents) / len(detune_cents)

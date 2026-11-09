# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A subtractive voice for pads (gap G14): band-limited oscillators, a state-variable filter, envelopes, unison.

Oscillators. Saw and pulse with polyBLEP correction (Valimaki and Huovilainen 2007): the naive waveform's step
is replaced by a two-sample polynomial band-limited step, which removes most of the aliasing. A sine is exact.
Filter. The topology-preserving state-variable filter (Zavalishin, "The Art of VA Filter Design", 2012): the
analogue integrators are trapezoidal, with the cutoff prewarped by g = tan(pi fc / fs), so the lowpass is -3 dB
at fc for the Butterworth damping k = sqrt(2) at any rate, and with k = 0 the loop is lossless and rings at
exactly fc. Cutoff may move per sample (an envelope or a slow LFO), which the TPT form tolerates.
Envelopes: linear attack, exponential decay to sustain, exponential release, in seconds.
Unison: several detuned oscillators (cents spread evenly across +/- detune), each with its own seeded start
phase, summed; slow beating between them is the "float" of a pad.
"""
import math

import numpy as np


def _blep(t, dt):
    """polyBLEP residual at phase t (0..1) for phase increment dt."""
    out = np.zeros_like(t)
    a = t < dt
    x = t[a] / dt[a]
    out[a] = x + x - x * x - 1.0
    b = t > 1.0 - dt
    x = (t[b] - 1.0) / dt[b]
    out[b] = x * x + x + x + 1.0
    return out


def oscillator(freq, fs, shape="saw", phase0=0.0, width=0.5):
    """freq: array of Hz per sample (or a scalar). Returns the waveform in [-1, 1]."""
    freq = np.broadcast_to(np.asarray(freq, float), np.shape(freq) if np.ndim(freq) else (1,))
    dt = freq / fs
    ph = (phase0 + np.cumsum(dt) - dt[0]) % 1.0
    if shape == "sine":
        return np.sin(2 * math.pi * ph)
    if shape == "saw":
        return 2.0 * ph - 1.0 - _blep(ph, dt)
    if shape == "pulse":
        y = np.where(ph < width, 1.0, -1.0)
        return y + _blep(ph, dt) - _blep((ph + 1.0 - width) % 1.0, dt)
    raise ValueError(f"shape {shape!r}: sine, saw or pulse")


def svf(x, fs, cutoff, k=math.sqrt(2.0), mode="low"):
    """TPT state-variable filter. cutoff: Hz, scalar or per sample; k = 1 / Q is the damping (sqrt 2 is
    Butterworth; 0 is self-oscillation). Returns the low, band or high output."""
    n = len(x)
    fc = np.broadcast_to(np.asarray(cutoff, float), (n,)) if np.ndim(cutoff) else np.full(n, float(cutoff))
    g = np.tan(math.pi * np.minimum(fc, 0.49 * fs) / fs)
    a1 = 1.0 / (1.0 + g * (g + k))
    ic1 = ic2 = 0.0
    lp, bp, hp = np.empty(n), np.empty(n), np.empty(n)
    for i in range(n):                      # the integrator states must run sample by sample
        gi, ai = g[i], a1[i]
        v3 = x[i] - ic2
        v1 = ai * ic1 + gi * ai * v3
        v2 = ic2 + gi * v1
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        lp[i], bp[i] = v2, v1
        hp[i] = x[i] - k * v1 - v2
    return {"low": lp, "band": bp, "high": hp}[mode]


def adsr(n, fs, attack, decay, sustain, release, hold):
    """Envelope of n samples: attack to 1, decay toward sustain, release from wherever it is at `hold` s."""
    t = np.arange(n) / fs
    a = max(attack, 1.0 / fs)
    env = np.where(t < a, t / a, sustain + (1 - sustain) * np.exp(-(t - a) / max(decay, 1e-4)))
    h = int(hold * fs)
    if h < n:
        env[h:] = env[h] * np.exp(-(t[h:] - t[h]) / max(release / 6.9078, 1e-4))
    return env


def pad(f0, seconds, fs, rng, hold, voices=5, detune=12.0, shape="saw", cutoff=1800.0, env_amount=600.0,
        k=1.2, attack=1.5, decay=2.0, sustain=0.8, release=3.0, drift=0.15, drift_rate=0.13):
    """A unison pad note. The filter cutoff follows the amplitude envelope (cutoff + env_amount * env) and drifts
    slowly (drift as a fraction of the cutoff, at drift_rate Hz, seeded phase)."""
    n = int(seconds * fs)
    env = adsr(n, fs, attack, decay, sustain, release, hold)
    cents = np.linspace(-detune, detune, voices) if voices > 1 else np.zeros(1)
    t = np.arange(n) / fs
    y = np.zeros(n)
    for c in cents:
        y += oscillator(np.full(n, f0 * 2 ** (c / 1200)), fs, shape, rng.uniform())
    y /= voices
    lfo = 1.0 + drift * np.sin(2 * math.pi * drift_rate * t + rng.uniform(0, 2 * math.pi))
    y = svf(y, fs, (cutoff + env_amount * env) * lfo, k)
    return y * env

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Modal synthesis: a set of modes, an excitation at one point, a pickup at another, rendered offline.

Each mode is a damped oscillator of unit modal mass. Its velocity response at the pickup to a unit
impulse of force at the excitation point is phi_k(x_in) phi_k(x_out) cos(omega_k t) exp(-alpha_k t).
Excitations (all physical, none sampled):
  strike  a half-sine contact force of duration tau (a mallet; shorter tau is a harder mallet, which
          reaches higher modes), convolved with the impulse response;
  pluck   a point displaced and released: modal displacement phi_k(x_in) / omega_k^2, so the velocity
          amplitude is phi_in phi_out / omega_k, with phase sin;
  breath  a band of noise from the seeded stream, shaped by an attack and release, as the force on an
          air column (a first model of blowing; the reed or jet nonlinearity is on the roadmap).
The output is normalised to peak 1 per note, times the velocity; loudness between instruments is set in
the mixer. Closed-form sums run in blocks; modes at or above 0.45 fs are dropped (no aliasing).
"""
import math

import numpy as np
from scipy.signal import oaconvolve

BLOCK = 4096
NYQUIST_GUARD = 0.45


def mode_sum(freqs, amps, alphas, n, fs, phase="cos"):
    """Sum of A_k trig(omega_k t) exp(-alpha_k t) over modes, n samples at fs, in time blocks."""
    out = np.zeros(n)
    w = 2 * math.pi * np.asarray(freqs, float)
    trig = np.cos if phase == "cos" else np.sin
    for s in range(0, n, BLOCK):
        t = np.arange(s, min(s + BLOCK, n)) / fs
        env = np.exp(-np.outer(alphas, t))
        out[s:s + len(t)] = (amps[:, None] * env * trig(np.outer(w, t))).sum(0)
    return out


def half_sine(tau, fs):
    m = max(1, int(round(tau * fs)))
    return np.sin(math.pi * (np.arange(m) + 0.5) / m)


def breath_force(seconds, fs, rng, attack=0.08, release=0.15):
    """Noise from the seeded generator, with a linear attack and release envelope."""
    n = int(seconds * fs)
    env = np.minimum(1.0, np.arange(n) / max(1, attack * fs))
    env *= np.minimum(1.0, (n - np.arange(n)) / max(1, release * fs))
    return rng.standard_normal(n) * env


def render(modes, fs, seconds, x_in, x_out, kind="strike", tau=1e-3, rng=None, velocity=1.0, hold=None):
    """Render one note. modes: a Modes set; x_in, x_out: points in the shape's normalised coordinates."""
    keep = np.asarray(modes.freqs) < NYQUIST_GUARD * fs
    f = np.asarray(modes.freqs)[keep]
    a = (np.asarray(modes.shape(x_in)) * np.asarray(modes.shape(x_out)))[keep]
    alpha = modes.decay()[keep]
    n = int(round(seconds * fs))
    if kind == "strike":
        y = oaconvolve(mode_sum(f, a, alpha, n, fs, "cos"), half_sine(tau, fs))[:n]
    elif kind == "pluck":
        y = mode_sum(f, a / (2 * math.pi * f), alpha, n, fs, "sin")
    elif kind == "breath":
        if rng is None:
            raise ValueError("breath needs the seeded generator")
        force = breath_force(hold if hold else seconds * 0.7, fs, rng)
        y = oaconvolve(mode_sum(f, a, alpha, n, fs, "cos"), force)[:n]
    else:
        raise NotImplementedError(f"excitation {kind!r}: bowing is on the roadmap (DESIGN.md)")
    peak = np.max(np.abs(y))
    return y * (velocity / peak) if peak > 0 else y

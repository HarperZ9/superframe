# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A voice from the shape of a body: the vocal tract as a chain of tubes, and a glottal source.

The tract is an area function (areas in m^2 and lengths in m, glottis first). Each section is a lossless
transmission line, [p, U]_in = [[cos kl, j Z sin kl], [j sin kl / Z, cos kl]] [p, U]_out with Z = rho c / A.
With the lips open to a pressure release (p = 0) and the glottis a volume-velocity source, the transfer
U_lips / U_glottis is 1 / D, D the lower-right entry of the chain product; formants are the zeros of D.
A uniform tube of length L closed at the glottis gives (2n - 1) c / 4L. The air inside the tract is warm,
so the default sound speed is dry air at 37 C; another gas (heliox, helium) changes c and so every formant
in proportion. Lip radiation, wall vibration and loss are on the roadmap (DESIGN.md).
The source is a Rosenberg glottal pulse train (Rosenberg 1971, shape from memory, high confidence) with
explicit controls for pitch, open quotient, and breath noise; a self-oscillating two-mass fold model and the
oesophageal source come next.
"""
import math

import numpy as np
from scipy.optimize import brentq

from . import materials as M


def chain_d(freqs, areas, lengths, c, rho=1.14):
    """D entry of the chain matrix at each frequency (real for a lossless tract). rho in kg/m^3 only scales Z."""
    out = np.empty(len(freqs))
    for i, f in enumerate(np.atleast_1d(freqs)):
        k = 2 * math.pi * f / c
        K = np.eye(2, dtype=complex)
        for A, l in zip(areas, lengths):
            z = rho * c / A
            K = K @ np.array([[math.cos(k * l), 1j * z * math.sin(k * l)], [1j * math.sin(k * l) / z, math.cos(k * l)]])
        out[i] = K[1, 1].real
    return out


def formants(areas, lengths, c=None, fmax=5000.0, step=5.0):
    """Formant frequencies (Hz) below fmax: sign changes of D on a grid, refined by Brent's method."""
    c = c if c else M.air_speed(37.0)
    f = np.arange(step, fmax, step)
    d = chain_d(f, areas, lengths, c)
    g = lambda x: chain_d([x], areas, lengths, c)[0]
    return np.array([brentq(g, f[i], f[i + 1]) for i in range(len(f) - 1) if d[i] * d[i + 1] < 0])


def uniform_tract(length=0.175, area=3e-4, sections=20):
    return np.full(sections, area), np.full(sections, length / sections)


def response(freqs, areas, lengths, c=None):
    """|U_lips / U_glottis| at each frequency."""
    c = c if c else M.air_speed(37.0)
    return 1.0 / np.maximum(np.abs(chain_d(freqs, areas, lengths, c)), 1e-9)


def rosenberg_pulses(f0, seconds, fs, open_quotient=0.6, speed=2.0, breath=0.0, rng=None):
    """Glottal flow: a rising half-cosine for tp, a falling quarter-cosine for tn, closed for the rest.
    open_quotient = (tp + tn) / T0; speed = tp / tn (higher is a more skewed, pressed pulse); breath adds noise
    from the seeded generator during the open phase (breathy voice)."""
    n, T0 = int(seconds * fs), fs / f0
    tp = open_quotient * T0 * speed / (1 + speed)
    tn = open_quotient * T0 / (1 + speed)
    ph = np.mod(np.arange(n), T0)
    g = np.where(ph < tp, 0.5 * (1 - np.cos(math.pi * ph / tp)),
                 np.where(ph < tp + tn, np.cos(math.pi * (ph - tp) / (2 * tn)), 0.0))
    if breath > 0:
        if rng is None:
            raise ValueError("breath noise needs the seeded generator")
        g = g + breath * rng.standard_normal(n) * (ph < tp + tn)
    return g


def vowel(areas, lengths, f0, seconds, fs, c=None, **source):
    """Glottal flow filtered by the tract's transfer function (lossless, so peaks are clipped by the grid),
    differentiated once for lip radiation (pressure in front of the lips goes as dU/dt)."""
    g = rosenberg_pulses(f0, seconds, fs, **source)
    spec = np.fft.rfft(g)
    fr = np.fft.rfftfreq(len(g), 1.0 / fs)
    h = np.minimum(response(np.maximum(fr, 1.0), areas, lengths, c), 1e3)
    y = np.diff(np.fft.irfft(spec * h, len(g)), prepend=0.0)
    return y / np.max(np.abs(y))

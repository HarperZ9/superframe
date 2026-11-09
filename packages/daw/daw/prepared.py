# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Prepared piano (gap G17): a mass (a bolt, a screw) or a damping wedge (rubber, felt) at one point of a string.

A point mass M at x = a on a string of length L, tension T and linear density mu, fixed at both ends. Each side
is a sine that vanishes at its end; displacement is continuous at a, and the jump in slope there accelerates
the mass, T (y'(a+) - y'(a-)) = -M w^2 y(a). With k = w / c and c^2 = T / mu that gives

    cot(k a) + cot(k (L - a)) = (M / mu) k                                      (1)

whose roots k_n are the partials, f_n = c k_n / (2 pi). With M = 0 the roots are n pi / L, the harmonic string;
a mass at a node of mode n (a = L / 2 for even n) leaves that mode where it was. Both are checked in the tests,
and (1) is held to an independent finite-difference eigen-solve of the loaded string.

The mode shape is sin(k x) / sin(k a) left of the mass and sin(k (L - x)) / sin(k (L - a)) right of it. A wedge
adds loss in proportion to the mode's energy at the wedge point, shape(a)^2 over the mode's mean square, so modes
with a node at the wedge ring on and the rest are damped: the muted, wooden sound of a rubber preparation.

The string's own stiffness is applied after, as a stretch sqrt(1 + B n^2) of each partial (Fletcher 1964); this
treats stiffness and the mass as independent, an approximation stated here and not tested.
"""
import math

import numpy as np
from scipy.optimize import brentq
from scipy.signal import oaconvolve

from .synth import half_sine, mode_sum, NYQUIST_GUARD


def loaded_roots(a, mass_ratio, n):
    """The first n roots k_n L of (1), for the mass at a (fraction of L) and mass_ratio = M / (mu L)."""
    a = float(a)
    b = 1.0 - a

    def g(q):                 # q = k L; (1) times sin(q a) sin(q b) to remove the poles
        return math.sin(q * b) * math.cos(q * a) + math.cos(q * b) * math.sin(q * a) \
            - mass_ratio * q * math.sin(q * a) * math.sin(q * b)

    roots, q, step = [], 1e-6, math.pi / 64
    f_prev = g(q)
    while len(roots) < n:
        q_next = q + step
        f_next = g(q_next)
        if f_prev == 0.0:
            roots.append(q)
        elif f_prev * f_next < 0:
            roots.append(brentq(g, q, q_next, xtol=1e-14))
        q, f_prev = q_next, f_next
    return np.array(roots[:n])


def mode_shape(q, a, x):
    """Mode shape at x (fraction of L) for root q = k L, unit displacement at the mass."""
    x = np.asarray(x, float)
    sa, sb = math.sin(q * a), math.sin(q * (1 - a))
    if abs(sa) < 1e-9 or abs(sb) < 1e-9:      # the mass sits on a node: the free-string shape
        return np.sin(q * x)
    return np.where(x <= a, np.sin(q * x) / sa, np.sin(q * (1 - x)) / sb)


def prepared(f0, seconds, fs, a=0.12, mass_ratio=0.0, wedge=0.0, strike=0.12, pickup=0.03, b=0.0,
             eta=3e-4, alpha0=0.6, contact=2e-3, modes=48, velocity=1.0):
    """One prepared note. f0: the unprepared string's fundamental; a: preparation point (fraction of L);
    mass_ratio: M / (string mass); wedge: added decay (1/s) at full modal energy at a; strike, pickup: hammer and
    bridge points. Returns (signal, partial frequencies)."""
    q = loaded_roots(a, mass_ratio, modes)
    n = np.arange(1, modes + 1)
    f = f0 * q / math.pi * np.sqrt(1.0 + b * n * n)
    xs = np.linspace(0.0, 1.0, 2001)
    shapes = np.array([mode_shape(qq, a, xs) for qq in q])
    norm = np.sqrt(np.mean(shapes ** 2, axis=1))
    at_wedge = np.array([float(mode_shape(qq, a, a)) for qq in q]) / norm
    amp = np.array([float(mode_shape(qq, a, strike)) * float(mode_shape(qq, a, pickup)) for qq in q]) / norm ** 2
    alpha = math.pi * f * eta + alpha0 + wedge * at_wedge ** 2
    keep = f < NYQUIST_GUARD * fs
    nsamp = int(round(seconds * fs))
    y = mode_sum(f[keep], amp[keep], alpha[keep], nsamp, fs, "cos")
    y = oaconvolve(y, half_sine(contact, fs))[:nsamp]
    peak = np.max(np.abs(y))
    return (velocity * y / peak if peak > 0 else y), f

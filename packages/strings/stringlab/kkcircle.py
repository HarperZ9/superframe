# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""One periodic dimension, three ladders: Kaluza-Klein masses, Kaluza-Klein charges, string harmonics.

Coordinates (x^mu, theta) with theta on a circle of radius R; the metric does not depend on theta. A massless 5D
field phi(x, theta) = sum_n phi_n(x) exp(i n theta / R) gives 4D fields of mass m_n = |n| / R (each |n| >= 1
twice). Re-choosing the seam, theta -> theta + eps(x), multiplies mode n by exp(-i n eps / R) and shifts the 4D
vector B_mu = g_{mu theta} / g_{theta theta} by d_mu eps: a U(1) gauge transformation, under which mode n carries
charge proportional to n and the field strength of B is unchanged. With the Kaluza-Klein normalisation the unit
charge is e = sqrt(16 pi G) / R (Heaviside-Lorentz, hbar = c = 1), so alpha = e^2 / 4 pi = 4 G / R^2 and the observed
alpha fixes R = 2 l_P / sqrt(alpha), about 23.4 Planck lengths, and the first rung 1/R = sqrt(alpha) E_P / 2, about
5.2e17 GeV (Bailin and Love 1987; the numbers Behiel quotes). A closed string on the same circle adds winding:
its w = 0 states are the Kaluza-Klein ladder, and stringlab.tduality supplies the rest.
"""
import importlib.util
import math
import sys
from pathlib import Path

import numpy as np

from . import tduality


def _measured():
    name = "measured_generated_constants"
    if name not in sys.modules:
        path = Path(__file__).resolve().parents[2] / "measured" / "generated" / "constants.py"
        spec = importlib.util.spec_from_file_location(name, path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        sys.modules[name] = mod
    return sys.modules[name]


_K = _measured()
G_NEWTON = 6.67430e-11       # CODATA 2022; the measured table does not carry G
ALPHA = _K.e ** 2 / (4 * math.pi * _K.eps0 * _K.hbar * _K.c)
L_PLANCK = math.sqrt(_K.hbar * G_NEWTON / _K.c ** 3)                       # m
E_PLANCK_GEV = math.sqrt(_K.hbar * _K.c ** 5 / G_NEWTON) / _K.e / 1e9     # GeV


def radius_from_charge(alpha=ALPHA):
    """R in Planck lengths from alpha = 4 G / R^2."""
    return 2 / math.sqrt(alpha)


def first_rung_gev(alpha=ALPHA):
    return E_PLANCK_GEV / radius_from_charge(alpha)


def mass_ladder(N, R=1.0, count=6):
    """Finite-difference eigenvalues of -d^2/dtheta^2 on N points of a circle of radius R: sqrt gives masses.
    Returns the lowest `count` distinct masses with their multiplicities, sorted."""
    h = 2 * math.pi * R / N
    lam = (2 - 2 * np.cos(2 * math.pi * np.arange(N) / N)) / h ** 2
    m = np.sqrt(np.sort(lam))
    vals, mult = [], []
    for v in m:
        if vals and abs(v - vals[-1]) < 1e-9 * max(1, v):
            mult[-1] += 1
        else:
            vals.append(v)
            mult.append(1)
    return np.array(vals[:count]), mult[:count]


def charge_ladder(R=1.0, N=64, eps=0.37, nmax=5):
    """Shift the seam by eps, read the phase each Fourier mode picks up, and return phase / (-eps / R) per mode n."""
    th = 2 * math.pi * R * np.arange(N) / N
    rng = np.random.default_rng(0)
    coef = rng.normal(size=2 * nmax + 1) + 1j * rng.normal(size=2 * nmax + 1)
    ns = np.arange(-nmax, nmax + 1)
    field = lambda t: (coef[None, :] * np.exp(1j * np.outer(t, ns) / R)).sum(1)  # noqa: E731
    a = np.fft.fft(field(th)) / N
    b = np.fft.fft(field(th + eps)) / N
    out = {}
    for n in range(1, nmax + 1):
        out[n] = float(np.angle(b[n] / a[n]) / (eps / R))
        out[-n] = float(np.angle(b[-n] / a[-n]) / (eps / R))
    return out


def seam_change(B, eps, dx):
    """B_mu on a 2D slice (2, n, n) of 4D space; a seam change eps(x) adds grad eps. Returns (B', F, F')."""
    g1 = (np.roll(eps, -1, axis=0) - eps) / dx
    g2 = (np.roll(eps, -1, axis=1) - eps) / dx
    Bp = B + np.stack([g1, g2])
    curl = lambda b: (np.roll(b[1], -1, axis=0) - b[1]) / dx - (np.roll(b[0], -1, axis=1) - b[0]) / dx  # noqa: E731
    return Bp, curl(B), curl(Bp)


def string_kk_match(R, alpha_p=1.0, m2_max=8.0):
    """Largest difference between the closed-string w = 0, N = Nt = 1 masses alpha' M^2 = alpha' n^2 / R^2 and the
    Kaluza-Klein ladder alpha' (n / R)^2, over all n inside the cutoff; and the count of matched states."""
    spec = tduality.spectrum(R, alpha_p, m2_max)
    worst, count = 0.0, 0
    for m2, deg, n, w, N, Nt in spec:
        if w == 0 and N == 1 and Nt == 1:
            worst = max(worst, abs(m2 - alpha_p * (n / R) ** 2))
            count += 1
    return worst, count

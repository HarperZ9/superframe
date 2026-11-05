# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Zero-point sums and the light-cone critical dimension.

The sum over oscillator frequencies sum_{n>=0} (n + a) diverges. With a smooth regulator f(eps x) the sum
is C/eps^2 + zeta(-1, a) + O(eps^2), and the finite part is the Hurwitz value zeta(-1, a) = -B_2(a)/2 for
every regulator with f(0) = 1, f'(0) = 0 or the exponential (Euler-Maclaurin). Two regulators are used here,
summed numerically and extrapolated in eps^2, so the finite part is measured, not typed in.

Light cone: an open bosonic string has intercept a = (D - 2)/2 * zeta(-1, 1). The first excited state
alpha_{-1}^i |0> carries D - 2 components, so it is a massless vector only if a = -1, which fixes D.
The NS superstring adds fermion modes on half-integers with the opposite sign; its level-1/2 vector is
massless only if a_NS = -1/2. The Ramond sector's bosons and fermions share integer modes, so its zero-point
energy cancels in every dimension.
"""
import math

import numpy as np


def _exp_sum(a, eps):
    n = np.arange(0, int(60.0 / eps) + 2, dtype=np.float64) + a
    return math.fsum(n * np.exp(-eps * n))


def _gauss_sum(a, eps):
    n = np.arange(0, int(9.0 / eps) + 2, dtype=np.float64) + a
    return math.fsum(n * np.exp(-(eps * n) ** 2))


REGULATORS = {
    "exp": (_exp_sum, lambda eps: 1.0 / eps ** 2),            # integral of x e^{-eps x}
    "gauss": (_gauss_sum, lambda eps: 0.5 / eps ** 2),        # integral of x e^{-(eps x)^2}
}


def finite_part(a, regulator="exp", eps_ladder=(0.08, 0.04, 0.02, 0.01)):
    """Finite part of sum_{n>=0} (n + a) regulated, Richardson-extrapolated to eps -> 0 in powers of eps^2.

    Returns (value, table) where table holds the subtracted sums per eps.
    """
    fn, div = REGULATORS[regulator]
    eps = np.asarray(eps_ladder, dtype=np.float64)
    vals = np.array([fn(a, e) - div(e) for e in eps])
    # Neville extrapolation in h = eps^2 to h = 0
    h = eps ** 2
    p = vals.copy()
    for k in range(1, len(h)):
        p[: len(h) - k] = (h[k:] * p[: len(h) - k] - h[: len(h) - k] * p[1: len(h) - k + 1]) / (h[k:] - h[: len(h) - k])
    return float(p[0]), {"eps": eps.tolist(), "subtracted": vals.tolist()}


def truncated_part(a, n_max):
    """The naive control: the bare partial sum up to n_max with no regulator, which has no finite limit."""
    n = np.arange(0, n_max + 1, dtype=np.float64) + a
    return float(n.sum())


def hurwitz_closed(a):
    """zeta(-1, a) = -B_2(a)/2 with B_2(a) = a^2 - a + 1/6; an independent closed form for the checks."""
    return -(a * a - a + 1.0 / 6.0) / 2.0


def bosonic_dimension(z_int, massless_level=1):
    """Solve (D - 2)/2 * z_int = -massless_level for D."""
    return 2.0 - 2.0 * massless_level / z_int


def ns_dimension(z_int, z_half, massless_level=0.5):
    """Solve (D - 2)/2 * (z_int - z_half) = -massless_level for D (fermion modes enter with a minus sign)."""
    return 2.0 - 2.0 * massless_level / (z_int - z_half)


def ramond_zero_point(z_int, d):
    return (d - 2) / 2.0 * (z_int - z_int)


def critical_dimensions(regulator="exp", eps_ladder=(0.08, 0.04, 0.02, 0.01)):
    z1, t1 = finite_part(1.0, regulator, eps_ladder)
    zh, th = finite_part(0.5, regulator, eps_ladder)
    return {"zeta_int": z1, "zeta_half": zh, "D_bosonic": bosonic_dimension(z1), "D_super": ns_dimension(z1, zh),
            "a_bosonic_at_D": (bosonic_dimension(z1) - 2) / 2 * z1, "regulator": regulator,
            "ramond_zero_point_D10": ramond_zero_point(z1, 10), "tables": {"int": t1, "half": th}}

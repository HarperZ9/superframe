# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The exact periodic force of a point mass with a uniform neutralising background, by Ewald summation
(Hernquist, Bouchet and Suto 1991, ApJS 75, 231). The reference a particle-mesh force is scored against.

F(r) = -sum_n r_n / |r_n|^3 [erfc(alpha |r_n|) + 2 alpha |r_n| / sqrt(pi) exp(-alpha^2 |r_n|^2)]
       - (4 pi / L^3) sum_{k != 0} k / k^2 exp(-k^2 / (4 alpha^2)) sin(k . r)
for G m = 1, with r_n = r - n L and k = 2 pi h / L over integer vectors n and h.
"""
import itertools

import numpy as np
from scipy.special import erfc


def ewald_force(r, box, alpha=None, nreal=3, nrecip=6):
    """Force per unit G m at displacements r (shape (M, 3)) from a mass at the origin."""
    r = np.atleast_2d(np.asarray(r, dtype=float))
    alpha = alpha or 2.0 / box
    out = np.zeros_like(r)
    rng = range(-nreal, nreal + 1)
    for n in itertools.product(rng, rng, rng):
        rn = r - box * np.asarray(n, dtype=float)
        d = np.linalg.norm(rn, axis=1)
        d = np.where(d > 0, d, np.inf)
        fac = (erfc(alpha * d) + 2 * alpha * d / np.sqrt(np.pi) * np.exp(-(alpha * d) ** 2)) / d ** 3
        out -= rn * fac[:, None]
    hr = range(-nrecip, nrecip + 1)
    for h in itertools.product(hr, hr, hr):
        if h == (0, 0, 0):
            continue
        k = 2 * np.pi * np.asarray(h, dtype=float) / box
        k2 = k @ k
        out -= (4 * np.pi / box ** 3) * (k / k2) * (np.exp(-k2 / (4 * alpha ** 2)) * np.sin(r @ k))[:, None]
    return out

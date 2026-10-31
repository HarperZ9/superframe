# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Circle packing with unequal sizes: the Apollonian gasket by the Descartes circle theorem.

Four mutually tangent circles with curvatures k_i satisfy (sum k)^2 = 2 sum k^2; with centres z_i
as complex numbers, (sum k z)^2 = 2 sum (k z)^2 (Lagarias, Mallows and Wilks 2002). Replacing one
circle of a Descartes quadruple gives k' = 2(k1 + k2 + k3) - k, and k'z' = 2(k1z1 + k2z2 + k3z3) - kz.
The root quadruple (-1, 2, 2, 3) generates only integer curvatures.
"""
import math
import sys

sys.dont_write_bytecode = True


def root():
    """(-1, 2, 2, 3): outer unit circle, two of radius 1/2, one of radius 1/3 above the axis."""
    return [(-1.0, 0j), (2.0, 0.5 + 0j), (2.0, -0.5 + 0j), (3.0, 2j / 3)]


def _swap(q, i):
    others = [q[j] for j in range(4) if j != i]
    k = 2 * sum(c[0] for c in others) - q[i][0]
    kz = 2 * sum(c[0] * c[1] for c in others) - q[i][0] * q[i][1]
    return (k, kz / k)


def gasket(k_max=1000.0):
    """All circles with curvature <= k_max, as (k, z), by swaps from the root quadruple."""
    q0 = tuple(root())
    out = list(q0)
    stack = [(q0, -1)]
    while stack:
        q, newest = stack.pop()
        for i in range(4):
            if i == newest:
                continue
            c = _swap(q, i)
            if c[0] > k_max:
                continue
            out.append(c)
            nq = list(q)
            nq[i] = c
            stack.append((tuple(nq), i))
    return out


def descartes_residual(q):
    ks = [c[0] for c in q]
    return sum(ks) ** 2 - 2 * sum(k * k for k in ks)


def covered_fraction(circles):
    """Area of the inner circles over the area of the outer one (the gasket's packing density)."""
    inner = [c for c in circles if c[0] > 0]
    return sum(math.pi / (k * k) for k, _ in inner) / math.pi


def dimension_fit(circles, lo=100.0, hi=None):
    """Slope of log N(k <= K) against log K: the residual set's Hausdorff dimension (Boyd 1982)."""
    import numpy as np
    ks = np.sort([c[0] for c in circles if c[0] > 0])
    hi = hi or ks[-1]
    K = np.geomspace(lo, hi, 20)
    N = np.searchsorted(ks, K, side="right")
    slope, _ = np.polyfit(np.log(K), np.log(N), 1)
    return float(slope)

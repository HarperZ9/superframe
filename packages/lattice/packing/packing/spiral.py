# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Spiral packing: Vogel's phyllotaxis model (Vogel 1979), r = c sqrt(n), theta = n * alpha.

r ~ sqrt(n) makes the areal density uniform on average; the divergence angle alpha decides whether
the points spread evenly or line up in spokes. The golden angle 360 (2 - phi) = 137.5078 degrees is
the angle whose rotation number has the worst rational approximations, so no spoke family forms.
"""
import math
import sys
from collections import Counter

import numpy as np
from scipy.spatial import cKDTree

sys.dont_write_bytecode = True

PHI = (1 + math.sqrt(5)) / 2
GOLDEN_DEG = 360.0 * (2 - PHI)


def vogel(N, alpha_deg=GOLDEN_DEG, unit_disc=True, offset=0.5):
    """N points; with unit_disc the outermost lies at radius sqrt((N - 0.5) / N) < 1."""
    n = np.arange(N) + offset
    r = np.sqrt(n / N) if unit_disc else np.sqrt(n)
    t = np.radians(alpha_deg) * np.arange(N)
    return np.column_stack([r * np.cos(t), r * np.sin(t)])


def parastichies(P, bands=((0.15, 0.3), (0.3, 0.5), (0.5, 0.7), (0.7, 0.9)), k=4):
    """Most common index differences between each point and its k nearest neighbours, per radius band.

    Point index equals its order along the generative spiral, so the differences count the
    visible spiral families (parastichies)."""
    tree = cKDTree(P)
    _, nn = tree.query(P, k + 1)
    r = np.linalg.norm(P, axis=1)
    out = []
    for lo, hi in bands:
        idx = np.where((r >= lo) & (r < hi))[0]
        c = Counter()
        for i in idx:
            for j in nn[i, 1:]:
                c[abs(int(j) - int(i))] += 1
        out.append({"band": [lo, hi], "top": [d for d, _ in c.most_common(3)]})
    return out


def uniformity(P, r_max=0.9):
    """Nearest-neighbour statistics for interior points of a unit-disc set.

    cv: coefficient of variation of nearest-neighbour distance (0 for a perfect lattice).
    dmin_ratio: smallest nearest-neighbour distance over the hexagonal spacing at the same density.
    """
    N = len(P)
    d, _ = cKDTree(P).query(P, 2)
    d = d[:, 1]
    r = np.linalg.norm(P, axis=1)
    di = d[r < r_max]
    a_hex = math.sqrt(2 * math.pi / (math.sqrt(3) * N))
    return {"cv": float(di.std() / di.mean()), "dmin_ratio": float(di.min() / a_hex),
            "mean_ratio": float(di.mean() / a_hex)}


def angle_sweep(N=1000, lo=130.0, hi=145.0, step=0.01):
    alphas = np.arange(lo, hi + 1e-9, step)
    rows = []
    for a in alphas:
        u = uniformity(vogel(N, a))
        rows.append((float(a), u["cv"], u["dmin_ratio"]))
    return rows


def fibonacci(n):
    a, b = 1, 1
    out = []
    while a <= n:
        out.append(a)
        a, b = b, a + b
    return out

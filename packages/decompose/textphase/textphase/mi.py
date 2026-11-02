# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Mutual information between symbols at distance d, with its finite-sample floor.

I(d) = H(X) + H(Y) - H(X, Y) over the pairs (s[i], s[i+d]), plug-in with the Miller-Madow correction
on each of the three entropies, in bits. Bias left after the correction is measured, not assumed:
floor() returns I(d) on frequency-preserving shuffles of the same sequence, whose true MI is 0.
Lin and Tegmark (2017) report power-law decay of this quantity in natural text; the estimator here is
the plain plug-in version, so the measurable range ends where I(d) meets the shuffle floor.
"""
import math

import numpy as np

LN2 = math.log(2)


def log_grid(d_max=1000, per_decade=12):
    """Integer distances 1..d_max, roughly log-spaced, no repeats."""
    n = int(per_decade * math.log10(d_max)) + 1
    return np.unique(np.round(np.logspace(0, math.log10(d_max), n)).astype(int))


def _h(counts):
    c = counts[counts > 0]
    N = c.sum()
    p = c / N
    return (-(p * np.log(p)).sum() + (len(c) - 1) / (2 * N)) / LN2


def mi_at(s, d, k):
    x, y = s[:-d], s[d:]
    joint = np.bincount(x * k + y, minlength=k * k)
    return _h(np.bincount(x, minlength=k)) + _h(np.bincount(y, minlength=k)) - _h(joint)


def mi_curve(seq, ds, k=None):
    s = np.asarray(seq, dtype=np.int64)
    k = int(s.max()) + 1 if k is None else k
    return np.array([mi_at(s, int(d), k) if d < len(s) else np.nan for d in ds])


def floor(seq, ds, rng, n_shuffle=5, k=None):
    """Mean and sd of I(d) over n_shuffle frequency-preserving shuffles."""
    s = np.asarray(seq, dtype=np.int64)
    curves = np.array([mi_curve(rng.permutation(s), ds, k) for _ in range(n_shuffle)])
    return curves.mean(axis=0), curves.std(axis=0, ddof=1) if n_shuffle > 1 else np.zeros(len(ds))


def above_floor(ds, mi, fl_mean, fl_sd, z=3.0):
    """Distances where I(d) clears the floor by z sd (sd floored at 1e-6 bits), up to the first miss."""
    thr = fl_mean + z * np.maximum(fl_sd, 1e-6)
    keep = []
    for d, v, t in zip(ds, mi, thr):
        if not (v > t):
            break
        keep.append(d)
    return np.array(keep, dtype=int)


def match_excess(seq, ds):
    """P(s[i] == s[i+d]) - sum p^2, scaled by 1 - sum p^2: 1 for a perfect period, 0 for no order."""
    s = np.asarray(seq, dtype=np.int64)
    p = np.bincount(s) / len(s)
    base = float((p ** 2).sum())
    return np.array([((s[:-d] == s[d:]).mean() - base) / (1 - base) if d < len(s) else np.nan
                     for d in ds])

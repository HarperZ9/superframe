# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Periodicity and repetition: the crystal order parameters.

periodicity(seq)    strongest recurrence of the match excess m(d) (mi.match_excess): the largest rise
                    m(d) - min(m(1..d-1)), so a monotone decay (a liquid) scores 0 and an exact period
                    scores 1. period = the smallest d whose rise is within 5% of the largest.
repeat_share(seq)   share of positions that start an n-gram already seen earlier in the text.
comb_score(ds, y, L) detrended mean of y at multiples of L minus its mean at half-way offsets: a
                    peak train at period L (H4: rhyme and meter at the line length).
"""
import numpy as np

from .mi import match_excess


def periodicity(seq, d_max=2000):
    ds = np.arange(1, min(d_max, len(seq) // 2) + 1)
    if len(ds) < 3:
        return {"peak": float("nan"), "period": None}
    m = match_excess(seq, ds)
    run_min = np.minimum.accumulate(m)
    rise = np.r_[0.0, m[1:] - run_min[:-1]]
    top = float(rise.max())
    if top <= 0:
        return {"peak": 0.0, "period": None}
    i = int(np.argmax(rise >= 0.95 * top))
    return {"peak": top, "period": int(ds[i])}


def repeat_share(seq, n=20):
    s = np.asarray(seq, dtype=np.int64)
    if len(s) <= n:
        return float("nan")
    h = np.zeros(len(s) - n + 1, dtype=np.uint64)
    for j in range(n):
        h = h * np.uint64(1000003) + s[j: len(s) - n + 1 + j].astype(np.uint64)
    _, first = np.unique(h, return_index=True)
    return float(1 - len(first) / len(h))


def detrend(y, win):
    """y minus its running median over a window of win points (edges use the available points)."""
    y = np.asarray(y, float)
    h = max(1, win // 2)
    med = np.array([np.median(y[max(0, i - h): i + h + 1]) for i in range(len(y))])
    return y - med


def comb_score(ds, y, L, n_teeth=4, win=None):
    """ds must be the dense grid 1..D. Returns the on-tooth minus off-tooth mean of detrended y."""
    ds = np.asarray(ds)
    r = detrend(y, win or max(3, int(L // 2)))
    on, off = [], []
    for m in range(1, n_teeth + 1):
        for target, bucket in ((m * L, on), ((m + 0.5) * L, off)):
            i = int(round(target)) - int(ds[0])
            if 1 <= i < len(r) - 1:
                bucket.append(r[i - 1: i + 2].max())  # same statistic on and off tooth
    if not on or not off:
        return float("nan")
    return float(np.mean(on) - np.mean(off))

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Entropy-rate estimators and a susceptibility-like fluctuation, all in bits per symbol.

lz_rate      LZMA (an LZ77-family coder) on the symbol bytes, header cost subtracted by coding an
             empty stream; an upper bound that converges slowly on short texts.
ppm_rate     adaptive PPM with escape method C, no exclusion, orders max_order down to -1. Returns
             the mean code length after a burn-in, and the per-symbol code lengths.
block_rate   plug-in block entropies H_n with the Miller-Madow correction, conditional increments
             h_n = H_n - H_(n-1), extrapolated with h_n = h + c / n over well-sampled n, floored at 0.
             A secondary estimate: on texts of 1e5 symbols only n <= 3 or 4 is well sampled.
susceptibility  w * Var(mean code length in non-overlapping windows of w symbols). For independent
             surprisals it stays near Var(single surprisal) at every w; correlated texts grow with w.
"""
import lzma
import math

import numpy as np

LN2 = math.log(2)


def lz_rate(seq):
    b = bytes(np.asarray(seq, dtype=np.uint8))
    if not b:
        return float("nan")
    f = dict(format=lzma.FORMAT_RAW, filters=[{"id": lzma.FILTER_LZMA2, "preset": 9 | lzma.PRESET_EXTREME}])
    empty = len(lzma.compress(b"", **f))
    return 8.0 * (len(lzma.compress(b, **f)) - empty) / len(b)


def ppm_codelengths(seq, alphabet, max_order=4, tables=None):
    """Per-symbol code lengths in bits under adaptive PPM-C (no exclusion).

    tables: counts from ppm_prime() to start from (copied, not changed); None starts empty."""
    s = [int(x) for x in seq]
    if tables is None:
        tables = [dict() for _ in range(max_order + 1)]  # order k: context int -> {symbol: count}
    else:
        tables = [{c: dict(t) for c, t in tab.items()} for tab in tables]
    out = np.empty(len(s))
    base = alphabet + 1
    for i, x in enumerate(s):
        p_esc = 1.0
        hit = None
        ctxs = []
        for k in range(max_order, -1, -1):
            if i < k:
                continue
            c = 0
            for j in range(i - k, i):
                c = c * base + s[j] + 1
            ctxs.append((k, c))
            t = tables[k].get(c)
            if hit is None and t:
                n, u = sum(t.values()), len(t)
                if x in t:
                    hit = p_esc * t[x] / (n + u)
                else:
                    p_esc *= u / (n + u)
        p = hit if hit is not None else p_esc / alphabet
        out[i] = -math.log2(p)
        for k, c in ctxs:
            t = tables[k].setdefault(c, {})
            t[x] = t.get(x, 0) + 1
    return out


def ppm_prime(seq, alphabet, max_order=4):
    """Counts after reading seq, for priming ppm_codelengths (a reference model of the language)."""
    s = [int(x) for x in seq]
    base = alphabet + 1
    tables = [dict() for _ in range(max_order + 1)]
    for i, x in enumerate(s):
        for k in range(0, min(max_order, i) + 1):
            c = 0
            for j in range(i - k, i):
                c = c * base + s[j] + 1
            t = tables[k].setdefault(c, {})
            t[x] = t.get(x, 0) + 1
    return tables


def ppm_rate(seq, alphabet, max_order=4, burn=0.2):
    cl = ppm_codelengths(seq, alphabet, max_order)
    start = int(len(cl) * burn)
    return float(cl[start:].mean()), cl


def block_entropy(seq, n):
    """Miller-Madow corrected plug-in entropy of n-blocks, bits."""
    s = np.asarray(seq, dtype=np.int64)
    if len(s) < n:
        return float("nan"), 0
    k = int(s.max()) + 1
    code = np.zeros(len(s) - n + 1, dtype=np.int64)
    for j in range(n):
        code = code * k + s[j: len(s) - n + 1 + j]
    _, counts = np.unique(code, return_counts=True)
    N = counts.sum()
    p = counts / N
    h = -(p * np.log(p)).sum() + (len(counts) - 1) / (2 * N)
    return h / LN2, len(counts)


def block_rate(seq, n_max=10, undersample=0.02):
    """Extrapolated entropy rate from block entropies; also returns the increments used.

    Only n with fewer than undersample * N distinct blocks are used (beyond that the plug-in
    increments fall fast from undersampling). Fit h_n = h + c / n over n >= 2; with fewer than three
    usable increments the last increment is returned, an upper bound."""
    N = len(seq)
    H = [0.0]
    for n in range(1, n_max + 1):
        h, distinct = block_entropy(seq, n)
        if distinct > undersample * N:
            break
        H.append(h)
    hn = np.diff(H)
    if len(hn) < 4:
        return (float(hn[-1]) if len(hn) else float("nan")), hn.tolist()
    ns = np.arange(2, len(hn) + 1)
    X = np.c_[np.ones(len(ns)), 1.0 / ns]
    coef, *_ = np.linalg.lstsq(X, hn[1:], rcond=None)
    return float(max(coef[0], 0.0)), hn.tolist()


def susceptibility(codelengths, w):
    """w * variance of window-mean code length over non-overlapping windows; nan if < 4 windows."""
    cl = np.asarray(codelengths, float)
    m = len(cl) // w
    if m < 4:
        return float("nan")
    means = cl[: m * w].reshape(m, w).mean(axis=1)
    return float(w * means.var(ddof=1))

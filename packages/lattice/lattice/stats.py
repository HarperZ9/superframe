# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Bootstrap intervals, one-sided bootstrap p values and Benjamini-Hochberg."""
import numpy as np


def boot_mean(x, rng, n=2000):
    x = np.asarray(x, float)
    idx = rng.integers(0, len(x), (n, len(x)))
    return x[idx].mean(1)


def summary(x, rng, n=2000, side="greater"):
    """Mean, 95% percentile CI and one-sided p (H1: mean > 0 for 'greater', < 0 for 'less')."""
    x = np.asarray(x, float)
    d = boot_mean(x, rng, n)
    p = (np.sum(d <= 0) + 1) / (n + 1) if side == "greater" else (np.sum(d >= 0) + 1) / (n + 1)
    return {"est": float(x.mean()), "lo": float(np.quantile(d, .025)), "hi": float(np.quantile(d, .975)),
            "p": float(p), "n": int(len(x))}


def spearman(a, b):
    from scipy.stats import rankdata
    ra, rb = rankdata(a), rankdata(b)
    return float(np.corrcoef(ra, rb)[0, 1])


def spearman_boot(a, b, rng, n=2000, side="less"):
    a, b = np.asarray(a, float), np.asarray(b, float)
    obs = spearman(a, b)
    d = np.empty(n)
    for i in range(n):
        j = rng.integers(0, len(a), len(a))
        d[i] = spearman(a[j], b[j]) if np.ptp(a[j]) > 0 and np.ptp(b[j]) > 0 else 0.0
    p = (np.sum(d >= 0) + 1) / (n + 1) if side == "less" else (np.sum(d <= 0) + 1) / (n + 1)
    return {"est": obs, "lo": float(np.nanquantile(d, .025)), "hi": float(np.nanquantile(d, .975)), "p": float(p)}


def bh(pvals, q=0.05):
    """Benjamini-Hochberg: adjusted p values and a reject flag per test (dict in, dict out)."""
    names = list(pvals)
    p = np.array([pvals[k] for k in names], float)
    m = len(p)
    o = np.argsort(p)
    adj = np.empty(m)
    run = 1.0
    for rank, i in reversed(list(enumerate(o, start=1))):
        run = min(run, p[i] * m / rank)
        adj[i] = run
    return {k: {"p": float(p[i]), "p_bh": float(adj[i]), "reject": bool(adj[i] <= q)} for i, k in enumerate(names)}

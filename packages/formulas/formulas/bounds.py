# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Did any arm beat its ceiling? A multiplicity-corrected bound-violation rule.

Each test is an arm that scored k successes in n trials against a ceiling (a bound it should not exceed).
The p-value is exact: P(X >= k) for X ~ Binomial(n, bound), the worst case for a true ceiling. Holm's
step-down keeps the chance of any false flag across the family at alpha (the default). Bonferroni gives
the same guarantee with less power; Benjamini-Hochberg controls the false discovery rate instead.

Source: formula round 1 (2026-10-29), candidate C5, replacing F79's per-test Wald rule, which flags about
18 of 756 tests by chance when every arm sits exactly at its bound (F80).
"""
import numpy as np
from scipy.stats import binom


def exact_p(k, n, bound):
    """One-sided exact binomial p that the true rate is above bound; 1 where the bound is 1 or more."""
    k = np.asarray(k)
    bound = np.asarray(bound, float)
    return np.where(bound >= 1, 1.0, binom.sf(k - 1, n, np.minimum(bound, 1 - 1e-12)))


def holm(p, alpha=0.05):
    p = np.asarray(p, float)
    m = len(p)
    rej = np.zeros(m, bool)
    for rank, i in enumerate(np.argsort(p, kind="stable")):
        if p[i] * (m - rank) > alpha:
            break
        rej[i] = True
    return rej


def bonferroni(p, alpha=0.05):
    p = np.asarray(p, float)
    return p * len(p) <= alpha


def bh(p, q=0.05):
    p = np.asarray(p, float)
    m = len(p)
    order = np.argsort(p, kind="stable")
    ok = p[order] <= q * np.arange(1, m + 1) / m
    rej = np.zeros(m, bool)
    if ok.any():
        rej[order[: np.where(ok)[0].max() + 1]] = True
    return rej


RULES = {"holm": holm, "bonferroni": bonferroni, "bh": bh}


def violations(k, n, bound, alpha=0.05, method="holm"):
    """Flags (bool array) and exact p-values for arms that beat their bound, corrected across the family.

    k: successes per arm; n: trials (scalar or per arm); bound: ceiling per arm, in [0, 1].
    """
    if method not in RULES:
        raise ValueError(f"method must be one of {sorted(RULES)}, got {method!r}")
    k = np.asarray(k, int)
    if np.any(k < 0) or np.any(k > np.asarray(n)):
        raise ValueError("k must lie in [0, n]")
    p = exact_p(k, n, bound)
    return RULES[method](p, alpha), p


def wald_flags(k, n, bound):
    """The uncorrected rule F79 used, kept for comparison only: Wald 95% lower limit above the bound."""
    a = np.asarray(k, float) / n
    lo = a - 1.96 * np.sqrt(np.maximum(a * (1 - a), 1e-12) / n)
    return lo > np.asarray(bound, float) + 1e-12

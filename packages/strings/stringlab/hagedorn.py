# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Exact level degeneracies and the Hagedorn temperature.

Open bosonic string: d(N) = coefficient of prod (1 - q^n)^-24, alpha' M^2 = N - 1.
Open superstring (light cone, NS + R after GSO): d(N) = 16 x coefficient of prod ((1 + q^n)/(1 - q^n))^8,
alpha' M^2 = N. Cardy's formula gives log d(N) ~ 2 pi sqrt(c N / 6) with c = 24 (bosonic) and 12 (super),
so with M = sqrt(N / alpha') the density grows as exp(beta_H M) with beta_H = 4 pi sqrt(alpha') (bosonic) and
2 pi sqrt(2 alpha') (super). The fit below reads beta_H from the exact integers; the closed forms are only the
planted truth it is scored against. The power-law prefactor exponent is fitted as well (bosonic -27/4,
super -11/4, from the saddle point of the same product).
"""
import math

import numpy as np

from .tduality import partitions_power


def super_degeneracies(n_max):
    """16 x coefficients of prod ((1+q^n)/(1-q^n))^8, exact integers."""
    # log of the product: 8 sum_n [log(1+q^n) - log(1-q^n)] = 8 sum_n sum_k (1 - (-1)^k) q^{nk}/k
    #                    = 16 sum_{m odd divisor structure}; use N a_N = sum_j s(j) a_{N-j}, s(j) = 8 sum_{d|j} d (1-(-1)^{j/d})
    s = [0] * (n_max + 1)
    for d in range(1, n_max + 1):
        for j in range(d, n_max + 1, d):
            if (j // d) % 2 == 1:
                s[j] += 16 * d
    a = [1] + [0] * n_max
    for n in range(1, n_max + 1):
        a[n] = sum(s[j] * a[n - j] for j in range(1, n + 1)) // n
    return [16 * x for x in a]


def bosonic_degeneracies(n_max):
    return partitions_power(24, n_max)


def log_degeneracy(d):
    """Natural logs of big integers without float overflow."""
    out = []
    for x in d:
        if x <= 0:
            out.append(float("nan"))
            continue
        b = x.bit_length()
        sh = max(0, b - 900)
        out.append(math.log(x >> sh) + sh * math.log(2))
    return np.array(out)


def fit_growth(d, n_lo, n_hi):
    """Least squares log d(N) = A sqrt(N) + B log N + C + D / sqrt(N) on n_lo..n_hi."""
    N = np.arange(n_lo, n_hi + 1, dtype=np.float64)
    y = log_degeneracy(d[n_lo:n_hi + 1])
    X = np.column_stack([np.sqrt(N), np.log(N), np.ones_like(N), 1 / np.sqrt(N)])
    coef, *_ = np.linalg.lstsq(X, y, rcond=None)
    return {"A": float(coef[0]), "B": float(coef[1]), "C": float(coef[2]), "D": float(coef[3])}


def hagedorn(kind="bosonic", n_max=2000, window=(400, 2000), alpha_p=1.0):
    """beta_H sqrt(alpha') from the fitted exponent: log d ~ A sqrt(N) and M = sqrt(N/alpha') (+ shift)."""
    d = bosonic_degeneracies(n_max) if kind == "bosonic" else super_degeneracies(n_max)
    f = fit_growth(d, *window)
    beta = f["A"] * math.sqrt(alpha_p)
    truth = 4 * math.pi * math.sqrt(alpha_p) if kind == "bosonic" else 2 * math.pi * math.sqrt(2 * alpha_p)
    return {"kind": kind, "beta_H": beta, "T_H": 1 / beta, "fit": f, "beta_truth": truth,
            "rel_err": abs(beta - truth) / truth, "window": list(window)}


def ratio_convergence(kind="bosonic", n_max=2000):
    """The local exponent 2 sqrt(N) log(d(N+1)/d(N)) tends to A; an independent read of the same slope."""
    d = bosonic_degeneracies(n_max) if kind == "bosonic" else super_degeneracies(n_max)
    ld = log_degeneracy(d)
    N = np.arange(1, n_max)
    return N, 2 * np.sqrt(N + 0.5) * (ld[2:] - ld[1:-1])

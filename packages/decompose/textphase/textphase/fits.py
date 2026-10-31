# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Fit decay laws to a measured correlation curve and pick one.

Models on log y (y is I(d) minus the shuffle floor, at distances above the floor):
  flat      log y = a                          (no decay: a crystal keeps all its order)
  power     log y = a - alpha log d            (critical: no single scale)
  exp       log y = a - d / xi                 (a liquid or a finite-memory source: one scale xi)
  powexp    log y = a - alpha log d - d / xi   (power law cut off at xi)
Selection is by AIC with Gaussian residuals on log y among flat, power and exp (the three phase laws);
powexp is fitted and reported as a diagnostic but does not take part in the choice. A held-out score (fit on even points, squared
error on odd points) is reported beside it. A fit needs at least min_pts points.
"""
import math

import numpy as np


def _design(name, d):
    ld = np.log(d)
    one = np.ones(len(d))
    return {"flat": np.c_[one], "power": np.c_[one, -ld], "exp": np.c_[one, -d],
            "powexp": np.c_[one, -ld, -d]}[name]


MODELS = ("flat", "power", "exp", "powexp")
PHASE_MODELS = ("flat", "power", "exp")


def _fit(name, d, ly):
    X = _design(name, d)
    coef, *_ = np.linalg.lstsq(X, ly, rcond=None)
    rss = float(((X @ coef - ly) ** 2).sum())
    return coef, rss


def fit_all(d, y, min_pts=6):
    d, y = np.asarray(d, float), np.asarray(y, float)
    ok = y > 0
    d, y = d[ok], y[ok]
    n = len(d)
    if n < min_pts:
        return {"n": n, "testable": False}
    ly = np.log(y)
    out = {"n": n, "testable": True, "d_max": float(d.max()), "models": {}}
    ev, od = np.arange(n) % 2 == 0, np.arange(n) % 2 == 1
    for m in MODELS:
        coef, rss = _fit(m, d, ly)
        k = len(coef) + 1
        aic = n * math.log(max(rss, 1e-300) / n) + 2 * k
        c2, _ = _fit(m, d[ev], ly[ev])
        held = float(((_design(m, d[od]) @ c2 - ly[od]) ** 2).mean()) if od.any() else float("nan")
        row = {"aic": aic, "rss": rss, "held_mse": held}
        if m == "power":
            row["alpha"] = float(coef[1])
        if m == "exp":
            row["xi"] = float(1 / coef[1]) if coef[1] != 0 else float("inf")
        if m == "powexp":
            row["alpha"], row["inv_xi"] = float(coef[1]), float(coef[2])
        out["models"][m] = row
    out["best"] = min(PHASE_MODELS, key=lambda m: out["models"][m]["aic"])
    out["daic_exp_minus_power"] = out["models"]["exp"]["aic"] - out["models"]["power"]["aic"]
    return out


def corr_length(d, y):
    """Distance where y falls to 1/e of its first value, by log-linear interpolation; d_max if never."""
    d, y = np.asarray(d, float), np.asarray(y, float)
    if len(y) == 0 or y[0] <= 0:
        return float("nan")
    t = y[0] / math.e
    for i in range(1, len(y)):
        if y[i] <= t:
            a, b = math.log(max(y[i - 1], 1e-300)), math.log(max(y[i], 1e-300))
            f = (math.log(t) - a) / (b - a) if b != a else 0.0
            return float(math.exp(math.log(d[i - 1]) + f * (math.log(d[i]) - math.log(d[i - 1]))))
    return float(d[-1])

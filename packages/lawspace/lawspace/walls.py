# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Wall finder: locate the knob value where a qualitative behaviour changes.

find_wall(observe, lo, hi) takes observe(eps, rng) -> bool and a bracket whose ends behave
differently. Stage 1 bisects on the majority vote of `reps` replicates. Stage 2 samples a local grid
around the estimate. A logistic curve p(eps) = 1 / (1 + exp(-(eps - eps*) / w)) is fitted by maximum
likelihood to every replicate outcome; eps* is the wall and w its width (sharpness = 1 / w). The CI
comes from a parametric bootstrap of the outcomes. A deterministic step gives w at the resolution floor
and a CI no wider than the final bracket.
"""
import numpy as np


def _frac(observe, eps, reps, rng):
    return [bool(observe(eps, rng)) for _ in range(reps)]


def _fit(x, y, floor, mid=None, half=None):
    """Maximum-likelihood logistic on a grid of widths and centres (centres dense near the bisection)."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    if y.min() == y.max():
        return float("nan"), float("nan"), 1.0
    sign = 1.0 if np.corrcoef(x, y)[0, 1] >= 0 else -1.0
    best = (np.inf, 0.0, 0.0)
    span = x.max() - x.min()
    cs = np.linspace(x.min(), x.max(), 101)
    if mid is not None:
        cs = np.union1d(cs, np.linspace(mid - 2 * half, mid + 2 * half, 401))
    for w in np.geomspace(max(floor, 1e-12), span, 60):
        z = np.clip(sign * (x[None, :] - cs[:, None]) / w, -50, 50)
        p = np.clip(1 / (1 + np.exp(-z)), 1e-12, 1 - 1e-12)
        nll = -(y * np.log(p) + (1 - y) * np.log(1 - p)).sum(axis=1)
        i = int(np.argmin(nll))
        if nll[i] < best[0] - 1e-12:
            best = (nll[i], cs[i], w)
    return float(best[1]), float(best[2]), sign


def find_wall(observe, lo, hi, rng, reps=5, tol=None, max_iter=30, grid=11, n_boot=200):
    tol = tol if tol is not None else abs(hi - lo) / 2 ** 12
    xs, ys = [], []

    def record(e):
        out = _frac(observe, e, reps, rng)
        xs.extend([e] * reps)
        ys.extend(out)
        return np.mean(out) >= 0.5

    a, b = lo, hi
    fa, fb = record(a), record(b)
    if fa == fb:
        return {"ok": False, "why": "bracket ends behave the same", "lo": lo, "hi": hi}
    for _ in range(max_iter):
        if abs(b - a) <= tol:
            break
        m = 0.5 * (a + b)
        if record(m) == fa:
            a = m
        else:
            b = m
    mid, half = 0.5 * (a + b), max(abs(b - a) * 4, tol * 4)
    for e in np.linspace(mid - half, mid + half, grid):
        record(e)
    c, w, sign = _fit(xs, ys, tol / 4, mid, half)
    boots = []
    x_arr, p_hat = np.array(xs), np.array(ys, float)
    p_fit = 1 / (1 + np.exp(-np.clip(sign * (x_arr - c) / w, -50, 50))) if np.isfinite(c) else p_hat
    for _ in range(n_boot if np.isfinite(c) else 0):
        yb = rng.random(len(x_arr)) < p_fit
        cb, _, _ = _fit(x_arr, yb, tol / 4, mid, half)
        if np.isfinite(cb):
            boots.append(cb)
    ci = [float(np.quantile(boots, 0.025)), float(np.quantile(boots, 0.975))] if boots else [a, b]
    ci = [min(ci[0], a), max(ci[1], b)] if w <= tol else ci
    if np.isfinite(c) and not (min(lo, hi) <= c <= max(lo, hi)):
        # the outcome was not a one-sided step (true on both sides of a point): report the bisection bracket
        c, ci, w = 0.5 * (a + b), [min(a, b), max(a, b)], abs(b - a)
    return {"ok": True, "eps_star": c, "ci": ci, "width": w, "sharpness": 1.0 / w if w > 0 else float("inf"),
            "bracket": [a, b], "evaluations": len(xs), "rising": sign > 0}

# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Iteration helper: damped least squares on a stated goal, kept inside the manufacturability rules, with a cost ledger.

Variables: curvature of each powered surface, every thickness, with the last thickness as back focus. The stop semi-diameter
follows the variables so that the f-number stays at the goal. Residuals: polychromatic transverse errors, MTF shortfalls at
the goal frequencies (geometric model), distortion, EFL, and hinge penalties for rule limits. Forward differences.
"""
import copy

import numpy as np

from . import design, optics, rules
from .trace import entrance_pupil, paraxial

DEFAULT_GOAL = dict(freqs=[10, 20], mtf_weight=4.0, spot_weight=0.02, dist_max_pct=1.5, dist_weight=2.0, efl_weight=5.0, ri_floor=None, min_et=1.0, min_ct_ratio=15.0, min_air=0.1,
                    max_aspect=20.0, N=14)


def variables(d, free_planes=False):
    """Index lists for curvature and thickness. Plane surfaces stay plane unless asked: flats are cheap, and cemented planes are in the patent."""
    cv = [i for i, s in enumerate(d["surfaces"]) if s["r"] is not None and not s.get("stop")]
    if free_planes:
        cv = [i for i, s in enumerate(d["surfaces"]) if not s.get("stop")]
    tv = list(range(len(d["surfaces"]) - 1))   # image distance follows best focus, set at the end
    return cv, tv


def to_vec(lens, cv, tv):
    return np.concatenate([lens.c[cv] * 100.0, lens.t[tv] / 10.0])


def from_vec(base, x, cv, tv, epd):
    L = base.copy()
    L.c, L.t = L.c.copy(), L.t.copy()
    L.c[cv] = x[: len(cv)] / 100.0
    L.t[tv] = np.maximum(x[len(cv):] * 10.0, _floors(base, tv))   # hard floors: the second lock showed a hinge alone let an air gap reach zero
    _, mag = entrance_pupil(L)
    L.semi = L.semi.copy()
    L.semi[L.stop] = abs(float(np.real(mag))) * epd / 2
    return L


def _floors(base, tv, min_air=0.1):
    """Lower bound per thickness: an air gap keeps min_air unless it starts at zero or borders the stop; glass keeps a positive thickness."""
    out = []
    glassy = base.n[base.primary, 1:] != 1.0
    for i in tv:
        if glassy[i]:
            out.append(0.2)
        elif base.t[i] == 0 or i == base.stop or i + 1 == base.stop:
            out.append(0.0)
        else:
            out.append(min(min_air, base.t[i]))
    return np.array(out)


def hill_climb(fun, x0, evals, rng, sigma=0.01):
    """Derivative-free polish. In the locked control this reached a lower cost than damped least squares on this merit."""
    x = np.array(x0, float)
    r = fun(x)
    if r is None:
        return x, np.inf
    best = float(r @ r)
    for _ in range(evals):
        y = x * (1 + sigma * rng.normal(size=len(x)))
        r = fun(y)
        if r is None:
            continue
        c = float(r @ r)
        if c < best:
            x, best, sigma = y, c, min(sigma * 1.3, 0.05)
        else:
            sigma = max(sigma * 0.99, 2e-4)
    return x, best


def hinge(v):
    return max(v, 0.0)


def _sag(c, h):
    a = 1 - c * c * h * h
    return c * h * h / (1 + np.sqrt(a)) if a > 0 else float("nan")


def rule_penalties(L, d, goal):
    """Hinge terms. Rule limits: edge, centre thickness, aspect, air gap at the rim. Weights are large so that feasibility is reached."""
    out = []
    glassy = [s.get("material") not in (None, "air") for s in d["surfaces"]]
    for i in range(len(L.c) - 1):
        h = max(L.semi[i], L.semi[i + 1])
        hs = min(L.semi[i], L.semi[i + 1])
        if glassy[i]:
            sa, sb = _sag(L.c[i], h), _sag(L.c[i + 1], h)
            if np.isnan(sa + sb):
                out.append(50.0)
                continue
            et = L.t[i] - sa + sb
            out.append(40 * hinge(goal["min_et"] - et))
            if L.t[i] > 0:
                out.append(4 * hinge(2 * h / L.t[i] - max(goal["max_aspect"], 2 * h / d["surfaces"][i]["t"])))
            out.append(40 * hinge(min(h / goal["min_ct_ratio"], d["surfaces"][i]["t"]) - L.t[i]))
        else:
            sa, sb = _sag(L.c[i], hs), _sag(L.c[i + 1], hs)
            if np.isnan(sa + sb):
                out.append(50.0)
                continue
            out.append(40 * hinge(goal["min_air"] - (L.t[i] - sa + sb)))
            out.append(40 * hinge(goal["min_air"] - L.t[i]) if not d["surfaces"][i].get("stop") and not d["surfaces"][i + 1].get("stop") else 0.0)
    return np.array(out)


def merit_parts(L, intent, goal):
    """Residual vector, plus readable parts. Invalid designs return None."""
    fields = intent["half_field_deg"]
    wts = np.array(intent.get("field_weights", [1.0] * len(fields)), float)
    try:
        shift = optics.best_focus(L, fields, N=goal["N"], weights=wts)
    except (ValueError, ZeroDivisionError, FloatingPointError):
        return None
    if not np.isfinite(shift):
        return None
    res, mtfv = [], []
    for f, q in zip(fields, wts):
        rs = optics.field_rays(L, f, goal["N"], image_shift=shift)
        if rs[L.primary]["live"].sum() < 6:
            return None
        ms, mt = optics.mtf_geom(rs, L, goal["freqs"])
        mtfv.append((ms + mt) / 2)
        res.append(np.sqrt(q) * goal["mtf_weight"] * (1 - ms))
        res.append(np.sqrt(q) * goal["mtf_weight"] * (1 - mt))
        spot = optics.spot_rms(rs, L)
        res.append(np.array([np.sqrt(q) * goal["spot_weight"] * spot * 1e3 * 0.1]))
    dist = max(abs(optics.distortion_pct(L, f)) for f in fields if f != 0)
    res.append(np.array([goal["dist_weight"] * hinge(dist - goal["dist_max_pct"])]))
    if goal.get("ri_floor") is not None:
        res.append(np.array([20 * hinge(goal["ri_floor"] - optics.relative_illumination(L, [0.0, fields[-1]], 24)[1])]))
    return np.concatenate(res), np.array(mtfv), dist, shift


def residuals(x, base, intent, goal, cv, tv, epd, target_efl, d):
    L = from_vec(base, x, cv, tv, epd)
    parts = merit_parts(L, intent, goal)
    if parts is None:
        return None
    efl = float(np.real(paraxial(L)[0]))
    return np.concatenate([parts[0], [goal["efl_weight"] * (efl - target_efl) / target_efl * 100], rule_penalties(L, d, goal)])


def dls(fun, x0, iters=40, lam=1e-2, h=1e-5, budget=None):
    x = np.array(x0, float)
    r = fun(x)
    evals = 1
    if r is None:
        return x, np.inf, evals, []
    cost = float(r @ r)
    hist = [cost]
    for _ in range(iters):
        J = np.zeros((len(r), len(x)))
        ok = True
        for j in range(len(x)):
            e = x.copy()
            e[j] += h
            rj = fun(e)
            evals += 1
            if rj is None:
                ok = False
                break
            J[:, j] = (rj - r) / h
        if not ok:
            break
        A, g = J.T @ J, J.T @ r
        D = np.diag(np.maximum(np.diag(A), 1e-10))
        better = False
        for _ in range(8):
            step = np.linalg.solve(A + lam * D, -g)
            rn = fun(x + step)
            evals += 1
            if rn is not None and float(rn @ rn) < cost:
                x, r, cost, better = x + step, rn, float(rn @ rn), True
                lam = max(lam * 0.4, 1e-8)
                break
            lam *= 3
        hist.append(cost)
        if not better or (len(hist) > 4 and hist[-4] - cost < 1e-4 * cost):
            break
        if budget and evals > budget:
            break
    return x, cost, evals, hist


def to_design(d, L, cv, tv):
    out = copy.deepcopy(d)
    for i in cv:
        out["surfaces"][i]["r"] = None if L.c[i] == 0 else float(1 / L.c[i])
    for i in tv:
        out["surfaces"][i]["t"] = float(L.t[i])
    out["surfaces"][L.stop]["semi"] = float(L.semi[L.stop])
    L2 = L.copy()
    L2.t = L2.t.copy()
    L2.t[-1] = float(np.real(paraxial(L2)[1]))
    shift = optics.best_focus(L2, d["intent"]["half_field_deg"], N=32, weights=d["intent"].get("field_weights"))
    out["surfaces"][-1]["t"] = float(L2.t[-1] + shift)
    return out


def improve(d, goal=None, iters=40, x_start=None, budget=None, polish_evals=0, seed=0):
    """One optimisation run from a design: damped least squares, then an optional hill-climb polish. Returns design, record, lens."""
    goal = {**DEFAULT_GOAL, **(goal or {})}
    base = design.to_lens(d)
    cv, tv = variables(d)
    target_efl = d["intent"].get("efl", float(np.real(paraxial(base)[0])))
    epd = target_efl / d["intent"]["fno"]
    x0 = to_vec(base, cv, tv) if x_start is None else x_start
    fun = lambda x: residuals(x, base, d["intent"], goal, cv, tv, epd, target_efl, d)
    x, cost, evals, hist = dls(fun, x0, iters=iters, budget=budget)
    if polish_evals:
        x, cost = hill_climb(fun, x, polish_evals, np.random.default_rng(seed))
        evals += polish_evals
    L = from_vec(base, x, cv, tv, epd)
    nd = to_design(d, L, cv, tv)
    return nd, dict(cost=cost, start_cost=hist[0] if hist else None, evals=evals, iterations=len(hist) - 1, feasible_violation=float(np.abs(rule_penalties(L, d, goal)).sum())), L


def ledger(before, after, intent=None, N=48):
    """What each change bought and cost. Revert one variable at a time from the final design; read off the merit and its rule state."""
    from .tolerance import score
    it = intent or after["intent"]
    Lb = design.to_lens(after)
    base = score(Lb, it, N)[0]
    rows = []
    for i, (a, b) in enumerate(zip(before["surfaces"], after["surfaces"])):
        for key in ("r", "t"):
            if a[key] == b[key] or a[key] is None or b[key] is None:
                continue
            trial = copy.deepcopy(after)
            trial["surfaces"][i][key] = a[key]
            s = score(design.to_lens(trial), it, N)[0]
            viol = [r["rule"] for r in rules.blockers(rules.geometry_rules(after))]
            rows.append(dict(surface=i + 1, field=key, before=a[key], after=b[key], change_pct=float(100 * (b[key] - a[key]) / a[key]) if a[key] else None,
                             score_gain_of_change=float(base - s), new_test_plate_likely=bool(key == "r"), rule_blockers_after=viol))
    rows.sort(key=lambda r: -abs(r["score_gain_of_change"]))
    return rows

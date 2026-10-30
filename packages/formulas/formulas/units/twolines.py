"""Two-lines test for U shapes (Simonsohn 2018), following statuser's twolines.R step by step.

Deviation, declared in PREREG.txt: no mgcv here. The flexible fit is cell means when x has 6 or
fewer unique values, else an unpenalised restricted (natural) cubic spline. numpy only.
"""
import math

import numpy as np


def _p_two_sided(z):
    return math.erfc(abs(z) / math.sqrt(2.0))


def ols(X, y):
    """Coefficients, classical covariance and HC3 covariance (HC1 when a leverage reaches 1)."""
    XtX_inv = np.linalg.pinv(X.T @ X)
    b = XtX_inv @ X.T @ y
    e = y - X @ b
    n, k = X.shape
    s2 = float(e @ e) / max(n - k, 1)
    h = np.einsum("ij,jk,ik->i", X, XtX_inv, X)
    if np.all(h < 1 - 1e-10):
        w = (e / (1 - h)) ** 2
    else:
        w = e ** 2 * n / max(n - k, 1)
    hc = XtX_inv @ (X.T * w) @ X @ XtX_inv
    return b, s2 * XtX_inv, hc


def _design(cols, covars):
    X = np.column_stack([np.ones(len(cols[0]))] + list(cols))
    return X if covars is None else np.column_stack([X, covars])


def _rcs_basis(x, knots):
    """Harrell's restricted cubic spline: linear term plus k-2 nonlinear terms."""
    t = knots
    k = len(t)
    cols = [x]
    norm = (t[-1] - t[0]) ** 2
    p3 = lambda u: np.maximum(u, 0.0) ** 3
    for j in range(k - 2):
        c = (p3(x - t[j]) - p3(x - t[k - 2]) * (t[k - 1] - t[j]) / (t[k - 1] - t[k - 2])
             + p3(x - t[k - 1]) * (t[k - 2] - t[j]) / (t[k - 1] - t[k - 2]))
        cols.append(c / norm)
    return cols


def flexible(x, y, covars, ux):
    """Fitted value and SE at each unique x, covariates held at their means."""
    cm = None if covars is None else covars.mean(axis=0)
    if len(ux) <= 6:
        D = [(x == u).astype(float) for u in ux[1:]]
        X = _design(D, covars)
        rows = [_design([np.array([float(u == v)]) for v in ux[1:]], None if cm is None else cm[None, :])[0]
                for u in ux]
    else:
        knots = np.quantile(ux, np.linspace(0, 1, min(5, len(ux))))
        X = _design(_rcs_basis(x, knots), covars)
        rows = [_design([c for c in _rcs_basis(np.array([u]), knots)],
                        None if cm is None else cm[None, :])[0] for u in ux]
    b, cov, _ = ols(X, y)
    R = np.array(rows)
    yhat = R @ b
    se = np.sqrt(np.maximum(np.einsum("ij,jk,ik->i", R, cov, R), 0.0))
    return yhat, se


def reg2(x, y, xc, covars=None):
    """Two interrupted regressions at xc; xc in the low line (model 1) or the high line (model 2)."""
    xlow1 = np.where(x <= xc, x - xc, 0.0)
    xhigh1 = np.where(x > xc, x - xc, 0.0)
    high1 = (x > xc).astype(float)
    xlow2 = np.where(x < xc, x - xc, 0.0)
    xhigh2 = np.where(x >= xc, x - xc, 0.0)
    high2 = (x >= xc).astype(float)
    b1v, _, hc1 = ols(_design([xlow1, xhigh1, high1], covars), y)
    b2v, _, hc2 = ols(_design([xlow2, xhigh2, high2], covars), y)
    se1, se2 = math.sqrt(max(hc1[1, 1], 0)), math.sqrt(max(hc2[2, 2], 0))
    z1 = b1v[1] / se1 if se1 > 0 else (0.0 if b1v[1] == 0 else math.copysign(1e9, b1v[1]))
    z2 = b2v[2] / se2 if se2 > 0 else (0.0 if b2v[2] == 0 else math.copysign(1e9, b2v[2]))
    return {"xc": float(xc), "b1": float(b1v[1]), "z1": float(z1), "p1": _p_two_sided(z1),
            "b2": float(b2v[2]), "z2": float(z2), "p2": _p_two_sided(z2)}


def quadratic(x, y, covars=None):
    b, _, hc = ols(_design([x, x ** 2], covars), y)
    z = b[2] / math.sqrt(hc[2, 2]) if hc[2, 2] > 0 else 0.0
    return {"b_lin": float(b[1]), "b_quad": float(b[2]), "z_quad": float(z), "p_quad": _p_two_sided(z),
            "slope_at_min": float(b[1] + 2 * b[2] * x.min())}


def two_lines(x, y, covars=None, alpha=0.05):
    x, y = np.asarray(x, float), np.asarray(y, float)
    ux = np.unique(x)
    out = {"n": int(len(x)), "unique_x": int(len(ux)), "testable": False}
    if len(ux) < 4:
        out["why"] = "fewer than 4 unique x"
        return out
    q = quadratic(x, y, covars)
    out["quadratic"] = q
    inv = q["slope_at_min"] > 0
    out["shape_sought"] = "inverted-U" if inv else "U"
    yhat, se = flexible(x, y, covars, ux)
    x10, x90 = np.quantile(x, 0.1), np.quantile(x, 0.9)
    mid = (ux > x10) & (ux < x90)
    if not mid.any():
        out["why"] = "no unique x inside the middle 80%"
        return out
    ym, sm, xm = yhat[mid], se[mid], ux[mid]
    flat = (ym + sm >= ym.max()) if inv else (ym - sm <= ym.min())
    xflat = xm[flat]
    rmid = reg2(x, y, float(np.median(xflat)), covars)
    z1, z2 = abs(rmid["z1"]), abs(rmid["z2"])
    share = 0.5 if z1 + z2 == 0 else z2 / (z1 + z2)
    xc = float(np.quantile(xflat, share))
    if (ux <= xc).sum() < 2 or (ux >= xc).sum() < 2:
        out["why"] = f"breakpoint {xc:g} leaves fewer than 2 unique x on a side"
        return out
    r = reg2(x, y, xc, covars)
    opposite = (r["b1"] > 0 > r["b2"]) or (r["b1"] < 0 < r["b2"])
    sig1, sig2 = r["p1"] < alpha, r["p2"] < alpha
    out.update(testable=True, xflat=[float(v) for v in xflat], midpoint=rmid, robin_hood=r,
               u=bool(opposite and sig1 and sig2),
               lines_significant=int(sig1) + int(sig2),
               direction=("rise" if r["b1"] > 0 else "fall") + "-" + ("rise" if r["b2"] > 0 else "fall"),
               quadratic_significant=bool(q["p_quad"] < alpha))
    return out

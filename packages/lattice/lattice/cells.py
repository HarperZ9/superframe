# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Piecewise fields on Voronoi cells: one constant, or one first-order (linear) field, per cell.

This is the Hexel ingredient taken off the image plane. Sites are lattice points (or sphere
grid points); each evaluation point belongs to its nearest site. Fit on one point set, score on
another (held out). Parameters per cell: 1 (constant) or 1 + d (first order, d = local dimension).
"""
import numpy as np
from scipy.spatial import cKDTree


def lattice_sites_periodic(G, box=1.0):
    """All points of lattice G inside the periodic box [0, box)^d (G should tile the box)."""
    d = G.shape[0]
    Ginv = np.linalg.inv(G)
    corners = np.array(np.meshgrid(*[[0, box]] * d, indexing="ij")).reshape(d, -1).T
    nc = corners @ Ginv.T
    lo, hi = np.floor(nc.min(0)) - 1, np.ceil(nc.max(0)) + 1
    grids = np.meshgrid(*[np.arange(l, h + 1) for l, h in zip(lo, hi)], indexing="ij")
    P = np.stack([g.ravel() for g in grids], 1) @ G.T
    P = P[np.all((P >= -1e-9) & (P < box - 1e-9), axis=1)]
    return np.unique(np.round(P, 9), axis=0)


def fit_cells(sites, Xfit, yfit, Xev, field, tangent=None, boxsize=None):
    """Predict yev from per-cell fits. tangent(site_index, offsets) maps offsets to local coords."""
    tree = cKDTree(sites, boxsize=boxsize)
    _, lf = tree.query(Xfit)
    _, le = tree.query(Xev)
    n = len(sites)

    def offsets(X, lab):
        D = X - sites[lab]
        if boxsize is not None:
            D = D - boxsize * np.round(D / boxsize)
        return tangent(lab, D) if tangent is not None else D

    if field == "const":
        s = np.bincount(lf, yfit, minlength=n)
        c = np.bincount(lf, minlength=n)
        mean = np.where(c > 0, s / np.maximum(c, 1), yfit.mean())
        return mean[le]
    Df, De = offsets(Xfit, lf), offsets(Xev, le)
    k = Df.shape[1] + 1
    Af = np.hstack([np.ones((len(Xfit), 1)), Df])
    # per-cell normal equations, batched with a small ridge on the slope terms
    M = np.zeros((n, k, k))
    v = np.zeros((n, k))
    np.add.at(M, lf, Af[:, :, None] * Af[:, None, :])
    np.add.at(v, lf, Af * yfit[:, None])
    reg = np.eye(k) * 1e-9
    reg[0, 0] = 0
    M = M + reg[None] * np.maximum(M[:, :1, :1], 1.0)
    empty = M[:, 0, 0] == 0
    M[empty] = np.eye(k)
    v[empty] = 0
    v[empty, 0] = yfit.mean()
    coef = np.linalg.solve(M, v[:, :, None])[:, :, 0]
    Ae = np.hstack([np.ones((len(Xev), 1)), De])
    return np.sum(Ae * coef[le], axis=1)


def sphere_tangent(sites_xyz):
    """Local 2-D coordinates on the tangent plane at each site."""
    z = np.array([0.0, 0.0, 1.0])
    e1 = np.cross(sites_xyz, z)
    bad = np.linalg.norm(e1, axis=1) < 1e-8
    e1[bad] = np.array([1.0, 0.0, 0.0])
    e1 /= np.linalg.norm(e1, axis=1, keepdims=True)
    e2 = np.cross(sites_xyz, e1)

    def f(lab, D):
        return np.stack([np.sum(D * e1[lab], 1), np.sum(D * e2[lab], 1)], 1)
    return f


def rel_mse(y, yhat):
    return float(np.mean((y - yhat) ** 2) / np.var(y))


def matched_param_error(counts, errs, params_per_cell, budget):
    """Error at a parameter budget, by log-log interpolation over a count sweep."""
    P = np.log(np.asarray(counts, float) * params_per_cell)
    E = np.log(np.asarray(errs, float))
    o = np.argsort(P)
    return float(np.exp(np.interp(np.log(budget), P[o], E[o], left=np.nan, right=np.nan)))

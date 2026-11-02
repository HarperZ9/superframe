# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Band-limited fields on a lattice's periodic supercell, sampled and rebuilt exactly.

Set-up. Sampling lattice G (d x d). The domain is the supercell G [0, M)^d, periodic. A field on
it is a finite Fourier sum f(x) = sum_m c_m exp(2 pi i k_m . x) with k_m = G^-T m / M. At a
sample x_n = G n the phase is m . n / M, so modes whose m agree mod M are aliases of each other.

The lattice's ideal low-pass rebuild keeps, for each alias class, the member with the shortest k
(the Voronoi cell of the reciprocal lattice G^-T) and gives it the summed coefficient of the
class. Its error is exact by Parseval: per class, sum over non-kept members |c|^2 plus
|sum over non-kept members c|^2. Nothing is approximated; the only randomness is the field draw.
"""
import itertools

import numpy as np

from .lattices import reciprocal


def closest_point(B, k):
    """Closest point of the lattice with generator B to each row of k (Babai plus a +-1 search)."""
    d = B.shape[0]
    Binv = np.linalg.inv(B)
    base = np.round(k @ Binv.T)
    best = None
    bestd = None
    for off in itertools.product((-1, 0, 1), repeat=d):
        cand = base + np.array(off, float)
        pt = cand @ B.T
        dist = np.sum((k - pt) ** 2, axis=1)
        if best is None:
            best, bestd = pt, dist
        else:
            take = dist < bestd - 1e-12
            best[take], bestd[take] = pt[take], dist[take]
    return best


def modes(G, M, kmax):
    """Integer mode indices m (rows) with |k_m| <= kmax, and their k (cycles per unit)."""
    G = np.asarray(G, float)
    d = G.shape[0]
    R = reciprocal(G) / M
    bound = np.ceil(M * np.linalg.norm(G, axis=0) * kmax).astype(int) + 1
    grids = np.meshgrid(*[np.arange(-b, b + 1) for b in bound], indexing="ij")
    m = np.stack([g.ravel() for g in grids], 1)
    k = m @ R.T
    keep = np.linalg.norm(k, axis=1) <= kmax
    return m[keep], k[keep]


def spectrum(kind, knorm, scale):
    """Isotropic power per mode. 'disc': flat inside radius `scale`; 'gauss': exp(-k^2 / 2 s^2)."""
    if kind == "disc":
        return (knorm <= scale).astype(float)
    if kind == "gauss":
        return np.exp(-0.5 * (knorm / scale) ** 2)
    raise ValueError(kind)


def setup(G, M, kind, scale, reach=4.5):
    kmax = scale if kind == "disc" else reach * scale
    m, k = modes(G, M, kmax)
    P = spectrum(kind, np.linalg.norm(k, axis=1), scale)
    rep = np.linalg.norm(closest_point(reciprocal(G), k), axis=1) < 1e-9   # kept by the low-pass
    cls = np.mod(m, M) @ (M ** np.arange(G.shape[0]))                      # alias class id
    return {"m": m, "k": k, "P": P, "rep": rep, "cls": cls, "M": M, "G": np.asarray(G, float)}


def expected_error(S):
    """E[relative MSE] for random coefficients: 2 * (power not kept) / total power."""
    return float(2 * S["P"][~S["rep"]].sum() / S["P"].sum())


def draw(S, rng):
    n = len(S["P"])
    return (rng.normal(size=n) + 1j * rng.normal(size=n)) * np.sqrt(S["P"] / 2)


def fold_error(S, c):
    """Relative MSE of the ideal low-pass rebuild for coefficients c (exact)."""
    lost = ~S["rep"]
    ncls = S["cls"].max() + 1
    alias = np.zeros(ncls, complex)
    np.add.at(alias, S["cls"][lost], c[lost])
    err = np.sum(np.abs(c[lost]) ** 2) + np.sum(np.abs(alias) ** 2)
    return float(err / np.sum(np.abs(c) ** 2))


def sample_points(S, jitter=0.0, rng=None):
    G, M = S["G"], S["M"]
    d = G.shape[0]
    n = np.stack([g.ravel() for g in np.meshgrid(*[np.arange(M)] * d, indexing="ij")], 1).astype(float)
    if jitter:
        n = n + rng.normal(0, jitter, n.shape)
    return n @ G.T


def representatives(S):
    """One k per alias class: the shortest member (the low-pass passband), M^d of them."""
    G, M = S["G"], S["M"]
    d = G.shape[0]
    r = np.stack([g.ravel() for g in np.meshgrid(*[np.arange(M)] * d, indexing="ij")], 1).astype(float)
    k = r @ (reciprocal(G) / M).T
    return k - closest_point(reciprocal(G), k)


def ls_error(S, c, x):
    """Relative MSE of a least-squares rebuild in the passband from samples at points x."""
    y = np.exp(2j * np.pi * x @ S["k"].T) @ c
    kr = representatives(S)
    A = np.exp(2j * np.pi * x @ kr.T)
    chat, *_ = np.linalg.lstsq(A, y, rcond=None)
    # match passband modes to drawn modes
    key = lambda kk: [tuple(v) for v in np.round(kk * 1e6).astype(np.int64)]
    idx = {t: i for i, t in enumerate(key(kr))}
    truth = np.zeros(len(kr), complex)
    outside = 0.0
    for t, cv in zip(key(S["k"]), c):
        if t in idx:
            truth[idx[t]] = cv
        else:
            outside += abs(cv) ** 2
    err = np.sum(np.abs(chat - truth) ** 2) + outside
    return float(err / np.sum(np.abs(c) ** 2)), float(np.linalg.cond(A))


def sample_k(d, kind, scale, n, rng):
    """k drawn with density proportional to the isotropic power spectrum (continuum limit)."""
    if kind == "gauss":
        return rng.normal(0, scale, (n, d))
    u = rng.normal(size=(n, d))
    u /= np.linalg.norm(u, axis=1, keepdims=True)
    return u * scale * rng.random((n, 1)) ** (1.0 / d)


def continuum_error(G, kind, scale, n, rng):
    """E[relative MSE] of the ideal low-pass rebuild with no k discretisation: 2 P(k outside V*).

    Returns (estimate, standard error) from n Monte Carlo draws of k.
    """
    k = sample_k(G.shape[0], kind, scale, n, rng)
    out = np.linalg.norm(closest_point(reciprocal(G), k), axis=1) > 1e-12
    p = out.mean()
    return float(2 * p), float(2 * np.sqrt(p * (1 - p) / n))


def strict_density(G1, K=1.0, n_dir=20000, rng=None, steps=60):
    """Least density at which a flat ball of radius K fits inside the reciprocal Voronoi cell.

    G1 is the unit-density generator; bisection on density with n_dir boundary directions.
    """
    rng = rng or np.random.default_rng(0)
    d = G1.shape[0]
    u = rng.normal(size=(n_dir, d))
    u /= np.linalg.norm(u, axis=1, keepdims=True)
    lo, hi = 0.1, 100.0
    for _ in range(steps):
        mid = np.sqrt(lo * hi)
        G = G1 * mid ** (-1.0 / d)
        inside = np.linalg.norm(closest_point(reciprocal(G), K * u * (1 - 1e-12)), axis=1) < 1e-12
        lo, hi = (lo, mid) if inside.all() else (mid, hi)
    return float(hi)

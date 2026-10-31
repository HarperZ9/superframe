# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""One Laplacian eigenbasis serving heat, room sound, diffuse light and distance (study 2026-10-31-sdf-sh, H1).

The domain is an L-shaped room (10 m square, top-right quadrant removed) on a cell-centred grid. The
operator is the graph Laplacian of the cells with no-flux (Neumann) walls. One decomposition L = Phi Lam Phi^T
(K smallest modes) is computed once. Each physics is then a spectral filter h(lambda) on the same coefficients:
    heat            u(t)   = sum exp(-kappa lambda t) <u0, phi> phi
    sound (Helmholtz)  p(w) = sum <s, phi> phi / (c^2 lambda - w^2 + i w eta)
    diffuse light   phi_L  = sum <S, phi> phi / (D lambda + sigma_a)      (diffusion approximation in fog)
    distance        d^2 = -4 t ln(4 pi t k_t(x, s))                      (Varadhan, from the heat kernel)
Baselines are full-rank solves on the same operator (scipy expm_multiply, sparse LU). Controls are Galerkin
projections onto a random subspace and onto the square room's cosine modes, at the same K.

    python -I modal_basis.py OUT.json [n]
"""
import json
import sys
import time

import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla

SIDE, C_AIR, ETA = 10.0, 343.0, 13.8 / 0.5          # metres, m/s, damping for T60 = 0.5 s
KAPPA_T = [0.01, 0.1, 1.0]                            # kappa * t in m^2
FOG = dict(D=1.0 / 3.0 / 1.01, sigma_a=0.01)          # sigma_s' = 1 /m, sigma_a = 0.01 /m
KS = [25, 50, 100, 200, 400]
SRC, RCV = (2.0, 2.0), (8.5, 2.5)                     # source near one corner, receiver in the far arm


def room(n, l_shape=True):
    """Cell mask of the L room (or the full square), the Neumann graph Laplacian on it, cell centres and spacing."""
    h = SIDE / n
    xs = (np.arange(n) + 0.5) * h
    X, Y = np.meshgrid(xs, xs, indexing="ij")
    mask = ~((X > SIDE / 2) & (Y > SIDE / 2)) if l_shape else np.ones_like(X, bool)
    idx = -np.ones((n, n), int)
    idx[mask] = np.arange(mask.sum())
    rows, cols = [], []
    for di, dj in ((1, 0), (0, 1)):
        a = idx[: n - di, : n - dj]
        b = idx[di:, dj:]
        ok = (a >= 0) & (b >= 0)
        rows += [a[ok], b[ok]]
        cols += [b[ok], a[ok]]
    r, c = np.concatenate(rows), np.concatenate(cols)
    A = sp.csr_matrix((np.ones(r.size), (r, c)), shape=(mask.sum(),) * 2)
    L = (sp.diags(np.asarray(A.sum(1)).ravel()) - A) / h**2
    return L.tocsc(), np.c_[X[mask], Y[mask]], h


def gauss(P, at, w, h):
    """A normalised Gaussian source (integral 1 over the room) of width w at point `at`."""
    g = np.exp(-((P - np.asarray(at)) ** 2).sum(1) / (2 * w**2))
    return g / (g.sum() * h**2)


def nearest(P, at):
    return int(np.argmin(((P - np.asarray(at)) ** 2).sum(1)))


def rel(a, b):
    return float(np.linalg.norm(a - b) / np.linalg.norm(b))


def eigbasis(L, K):
    t0 = time.perf_counter()
    lam, phi = spla.eigsh(L, k=K, sigma=-1e-3, which="LM")
    o = np.argsort(lam)
    return lam[o], phi[:, o], time.perf_counter() - t0


def galerkin(L, Q):
    """Reduced eigenbasis of L restricted to span(Q): the fair way to use any K-dimensional basis."""
    Q, _ = np.linalg.qr(Q)
    lam, V = np.linalg.eigh(Q.T @ (L @ Q))
    return lam, Q @ V


def filters(h):
    kap = KAPPA_T
    return {
        **{f"heat_kt{k}": (lambda lam, k=k: np.exp(-lam * k)) for k in kap},
        "light": lambda lam: 1.0 / (FOG["D"] * lam + FOG["sigma_a"]),
    }


def references(L, P, h):
    """Full-rank answers on the same operator, with their times."""
    n = L.shape[0]
    u0 = gauss(P, SRC, 0.25, h)
    out, times = {}, {}
    for k in KAPPA_T:
        t0 = time.perf_counter()
        out[f"heat_kt{k}"] = spla.expm_multiply(-k * L, u0)
        times[f"heat_kt{k}"] = time.perf_counter() - t0
    S = gauss(P, SRC, 0.2, h)
    t0 = time.perf_counter()
    lu = spla.splu((FOG["D"] * L + FOG["sigma_a"] * sp.identity(n)).tocsc())
    times["light_factor"] = time.perf_counter() - t0
    t0 = time.perf_counter()
    out["light"] = lu.solve(S)
    times["light_solve"] = time.perf_counter() - t0
    return u0, S, out, times


def helmholtz_ref(L, s, freqs, r):
    n, I, p, t0 = L.shape[0], sp.identity(L.shape[0], format="csc"), [], time.perf_counter()
    for f in freqs:
        w = 2 * np.pi * f
        p.append(spla.spsolve((C_AIR**2 * L - (w**2 - 1j * w * ETA) * I).tocsc(), s.astype(complex))[r])
    return np.array(p), (time.perf_counter() - t0) / len(freqs)


def helmholtz_modal(lam, phi, s, freqs, r):
    a = phi.T @ s
    w = 2 * np.pi * np.asarray(freqs)[:, None]
    return ((a * phi[r])[None, :] / (C_AIR**2 * lam[None, :] - w**2 + 1j * w * ETA)).sum(1)


def apply_filter(lam, phi, h_fn, x, h):
    """The modal answer: Phi h(Lam) Phi^T x, with the grid's inner product (the cells are equal area)."""
    return phi @ (h_fn(lam) * (phi.T @ x))


def far(P, at, r):
    return ((P - np.asarray(at)) ** 2).sum(1) > r * r


def geodesic(P, s):
    """Exact distance in the L room: straight if the segment misses the removed quadrant, else via its corner."""
    c, s = np.array([SIDE / 2, SIDE / 2]), np.asarray(s)
    t = np.linspace(0, 1, 400)[None, :, None]
    seg = s[None, None, :] + t * (P[:, None, :] - s[None, None, :])
    blocked = ((seg[..., 0] > c[0]) & (seg[..., 1] > c[1])).any(1)
    d = np.linalg.norm(P - s, axis=1)
    via = np.linalg.norm(s - c) + np.linalg.norm(P - c, axis=1)
    return np.where(blocked, via, d)


def varadhan(kt, s_idx, h, t):
    """Distance from a heat kernel column (unit point mass at s), d = sqrt(max(0, -4 t ln(4 pi t k)))."""
    k = np.maximum(kt, 1e-300)
    return np.sqrt(np.maximum(0.0, -4 * t * np.log(4 * np.pi * t * k)))

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Ricci-flat metrics on the Fermat quintic by Donaldson's algorithm, and its topological numbers.

X = {p = z0^5 + ... + z4^5 = 0} in P^4 (psi = 0 member of the Dwork family p - 5 psi z0 z1 z2 z3 z4).
Points: random lines through two Gaussian points of C^5 meet X in five points; the points follow the
Fubini-Study volume form on X (Shiffman-Zelditch), so the weight |Omega|^2 / det g_FS turns them into the
Calabi-Yau measure. Sections of O(k): degree-k monomials, without those divisible by z0^5 once k >= 5.
Balanced metric: H^-1 = (N_k / Vol) int s s^dagger / (s^dagger H s) dmu_Omega, iterated to its fixed point.
Error measure (Douglas, Karp, Lukic, Reinbacher 2006, eq. 27): sigma_k = < |eta/<eta> - 1| >_Omega with
eta = det g_k / |Omega|^2 on the tangent space of X; it falls as about 3.1/k^2 - 4.2/k^3 for their quintic.
Topology by exact algebra: chi = int c_3 = -200 from c(X) = (1+H)^5/(1+5H), h^{2,1} = 126 - rank(z_i d_j p) = 101.
"""
from fractions import Fraction
from itertools import combinations_with_replacement

import numpy as np

DIM = 5


def fermat(z, psi=0.0):
    return (z ** 5).sum(-1) - 5 * psi * z.prod(-1)


def fermat_grad(z, psi=0.0):
    g = 5 * z ** 4
    if psi:
        pr = z.prod(-1, keepdims=True)
        g = g - 5 * psi * pr / z
    return g


def sample_points(rng, n_lines, psi=0.0):
    """5 n_lines points on X from random lines; returns complex (n, 5)."""
    a = rng.normal(size=(n_lines, DIM)) + 1j * rng.normal(size=(n_lines, DIM))
    b = rng.normal(size=(n_lines, DIM)) + 1j * rng.normal(size=(n_lines, DIM))
    pts = []
    for i in range(n_lines):
        # p(a + t b) as a polynomial in t, built from five sample values (exact for degree 5)
        ts = np.exp(2j * np.pi * np.arange(6) / 6)
        vals = fermat(a[i][None, :] + ts[:, None] * b[i][None, :], psi)
        coef = np.fft.fft(vals) / 6  # coefficients c_k of t^k with t on the 6th roots of unity
        roots = np.roots(coef[::-1])
        for t in roots:
            pts.append(a[i] + t * b[i])
    z = np.array(pts)
    return z / z[np.arange(len(z)), np.abs(z).argmax(1)][:, None]  # patch: largest coordinate set to 1


def monomials(k):
    """Exponent vectors of a basis of H^0(X, O(k)) (Fermat relation removes z0^5 multiples)."""
    out = []
    for combo in combinations_with_replacement(range(DIM), k):
        e = np.bincount(np.array(combo, dtype=int), minlength=DIM)
        if e[0] >= 5:
            continue
        out.append(e)
    return np.array(out, dtype=int).reshape(-1, DIM)


def sections(z, exps, derivatives=True):
    """s (n, N) and ds/dz_a (n, 5, N); ds is None when derivatives=False."""
    if not derivatives:
        return np.concatenate([(z[i:i + 5000, None, :] ** exps[None, :, :]).prod(-1)
                               for i in range(0, z.shape[0], 5000)]), None
    s = (z[:, None, :] ** exps[None, :, :]).prod(-1)
    ds = np.empty((z.shape[0], DIM, exps.shape[0]), dtype=complex)
    for a in range(DIM):
        e = exps.copy()
        fac = e[:, a].astype(float)
        e[:, a] = np.maximum(e[:, a] - 1, 0)
        ds[:, a, :] = fac[None, :] * (z[:, None, :] ** e[None, :, :]).prod(-1)
    return s, ds


def tangent_frame(z, psi=0.0):
    """Jacobian J (n, 5, 3) of the embedding in local coordinates, and |Omega|^2 = 1/|dp/dz_dep|^2."""
    n = z.shape[0]
    grad = fermat_grad(z, psi)
    fixed = np.abs(z).argmax(1)
    g2 = np.abs(grad).copy()
    g2[np.arange(n), fixed] = -1
    dep = g2.argmax(1)
    J = np.zeros((n, DIM, 3), dtype=complex)
    for i in range(n):
        free = [c for c in range(DIM) if c != fixed[i] and c != dep[i]]
        for col, c in enumerate(free):
            J[i, c, col] = 1.0
            J[i, dep[i], col] = -grad[i, c] / grad[i, dep[i]]
    omega2 = 1.0 / np.abs(grad[np.arange(n), dep]) ** 2
    return J, omega2


def metric_det(z, J, exps, H, k):
    """det of the pulled-back metric g = (1/(k pi)) d dbar log(s^dagger H s) on the tangent space."""
    s, ds = sections(z, exps)
    Hs = s @ H.T                                    # (H s)_alpha per point: sum_beta H[alpha,beta] s_beta
    K = np.einsum("na,na->n", s.conj(), Hs).real    # s^dagger H s
    Hds = np.einsum("ab,nib->nia", H, ds)            # H ds_i
    A = np.einsum("nja,nia->nij", ds.conj(), Hds)    # A_ij = conj(ds_j) H ds_i  -> d_i dbar_j K
    v = np.einsum("na,nia->ni", s.conj(), Hds)      # d_i K
    g = A / K[:, None, None] - v[:, :, None] * v.conj()[:, None, :] / K[:, None, None] ** 2
    g = g / (k * np.pi)
    gp = np.einsum("nia,nij,njb->nab", J, g, J.conj())
    return np.linalg.det(gp).real


def fs_weights(z, J, omega2):
    """Omega-measure weights for line-sampled points: |Omega|^2 / det g_FS."""
    det_fs = metric_det(z, J, monomials(1), np.eye(DIM, dtype=complex), 1)
    return omega2 / det_fs


def t_operator(s, w, H):
    K = np.einsum("na,ab,nb->n", s.conj(), H, s).real
    q = (w / K)[:, None] * s
    T = (q.T @ s.conj()) / w.sum() * s.shape[1]      # T_ab = N <s_a conj(s_b) / K>
    return T


def balanced(z, w, k, iters=12, H0=None):
    """Iterate H <- T(H)^-1 from the identity (or H0); returns H and the change per step."""
    exps = monomials(k)
    s, _ = sections(z, exps, derivatives=False)
    H = np.eye(exps.shape[0], dtype=complex) if H0 is None else H0
    steps = []
    for _ in range(iters):
        Hn = np.linalg.inv(t_operator(s, w, H))
        Hn = 0.5 * (Hn + Hn.conj().T)
        Hn = Hn / np.trace(Hn).real * exps.shape[0]
        steps.append(float(np.abs(Hn - H).max() / np.abs(H).max()))
        H = Hn
    return H, steps


def sigma(z, J, omega2, w, exps, H, k, chunk=4000):
    """sigma = <|eta/<eta> - 1|>_Omega and the mean eta (the Kahler volume ratio) on a point set."""
    eta = np.concatenate([metric_det(z[i:i + chunk], J[i:i + chunk], exps, H, k)
                          for i in range(0, z.shape[0], chunk)]) / omega2
    mean = np.average(eta, weights=w)
    return float(np.average(np.abs(eta / mean - 1), weights=w)), float(mean)


def euler_characteristic():
    """chi = int_X c_3(X) with c(X) = (1+H)^5 / (1+5H) and int_X H^3 = 5, exact."""
    c = [Fraction(0)] * 4
    num = [1, 5, 10, 10]                       # (1+H)^5 to H^3
    inv = [Fraction((-5) ** j) for j in range(4)]  # 1/(1+5H) to H^3
    for i in range(4):
        for j in range(4 - i):
            c[i + j] += num[i] * inv[j]
    return int(c[3] * 5), [int(x) for x in c]


def hodge_21(rng=None, psi=0.0, random_quintic=False):
    """h^{2,1}: degree-5 monomials (126) minus the rank of {z_i dp/dz_j} (the GL(5) orbit)."""
    exps5 = monomials_all(5)
    index = {tuple(e): r for r, e in enumerate(exps5)}
    if random_quintic:
        coeff = {tuple(e): complex(*rng.normal(size=2)) for e in exps5}
    else:
        coeff = {tuple(e): 0j for e in exps5}
        for a in range(DIM):
            e = [0] * DIM
            e[a] = 5
            coeff[tuple(e)] = 1.0
        if psi:
            coeff[(1, 1, 1, 1, 1)] = -5 * psi
    rows = []
    for i in range(DIM):
        for j in range(DIM):
            v = np.zeros(len(exps5), dtype=complex)
            for e, c in coeff.items():
                if c == 0 or e[j] == 0:
                    continue
                f = list(e)
                f[j] -= 1
                f[i] += 1
                v[index[tuple(f)]] += c * e[j]
            rows.append(v)
    rank = np.linalg.matrix_rank(np.array(rows), tol=1e-9)
    return len(exps5) - rank, int(rank), len(exps5)


def monomials_all(k):
    return np.array([np.bincount(np.array(c, dtype=int), minlength=DIM)
                     for c in combinations_with_replacement(range(DIM), k)], dtype=int)

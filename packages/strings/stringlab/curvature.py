# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Chern classes from the curvature of a Kahler metric, integrated by Monte Carlo.

For the holomorphic tangent bundle with Hermitian metric G_{a b} = g_{a bbar} in local coordinates w,
the Chern connection is theta = dG G^-1 and the curvature Theta = dbar theta, so with
M_{kl} = -dbar_l (d_k G G^-1) = -(d_k dbar_l G) G^-1 + d_k G G^-1 dbar_l G G^-1
the top Chern form is c_n = (i / 2 pi)^n det(Theta), Theta = sum M_{kl} dz^k ^ dzbar^l. Expanding the
determinant of a matrix of commuting 2-forms,
    c_n / (omega^n / n!) = X / ((2 pi)^n det g),   X = sum_sigma sgn(sigma) sum_{k,l perms} eps_k eps_l prod_a M_{k_a l_a}[a, sigma(a)],
with omega = i g_{k lbar} dz^k ^ dzbar^l. So chi = int c_n = Vol x mean over volume-distributed points of
X / ((2 pi)^n det g). The sign and normalisation are fixed by the test on CP^3 (chi = 4).

Derivatives of G come from central finite differences in the 2n real coordinates.
"""
import itertools
import math

import numpy as np

from . import calabiyau as cy


def _perm_sign(p):
    s, p = 1, list(p)
    for i in range(len(p)):
        while p[i] != i:
            j = p[i]
            p[i], p[j] = p[j], p[i]
            s = -s
    return s


def top_form_ratio(M, G):
    """X / ((2 pi)^n det G) per point. M: (npts, n, n, n, n) indexed [k, l, a, b]; G: (npts, n, n)."""
    n = G.shape[-1]
    perms = list(itertools.permutations(range(n)))
    signs = [_perm_sign(p) for p in perms]
    X = np.zeros(G.shape[0], dtype=complex)
    for sg, sig in zip(signs, perms):            # endomorphism permutation (determinant)
        for sk, kp in zip(signs, perms):         # holomorphic form indices
            for sl, lp in zip(signs, perms):     # antiholomorphic form indices
                term = sg * sk * sl * np.ones(G.shape[0], dtype=complex)
                for a in range(n):
                    term = term * M[:, kp[a], lp[a], a, sig[a]]
                X += term
    return (X / ((2 * math.pi) ** n * np.linalg.det(G))).real, (X.imag / np.abs(X.real).max())


def trace_cube_ratio(M, G):
    """The tr(Theta^3) / 3 part of the top Chern form, as the same ratio to omega^n / n! (n = 3).
    For a Ricci-flat metric tr Theta = 0 and c3 = tr(Theta^3) / 3 (times (i/2pi)^3), so the two agree."""
    n = G.shape[-1]
    perms = list(itertools.permutations(range(n)))
    signs = [_perm_sign(p) for p in perms]
    X = np.zeros(G.shape[0], dtype=complex)
    for sk, kp in zip(signs, perms):
        for sl, lp in zip(signs, perms):
            prod = M[:, kp[0], lp[0]] @ M[:, kp[1], lp[1]] @ M[:, kp[2], lp[2]]
            X += sk * sl * np.trace(prod, axis1=1, axis2=2)
    return (X / 3 / ((2 * math.pi) ** n * np.linalg.det(G))).real


def curvature_M(Gfun, w, h=1e-4):
    """M_{kl} at points w (npts, n) complex, by central differences of Gfun (npts, n) -> (npts, n, n)."""
    n = w.shape[1]
    G0 = Gfun(w)
    dirs = [(k, 1.0) for k in range(n)] + [(k, 1j) for k in range(n)]   # real coordinate directions
    m = len(dirs)

    def shift(*pairs):
        dw = np.zeros_like(w)
        for (k, u), s in pairs:
            dw[:, k] += s * h * u
        return Gfun(w + dw)
    plus = [shift((d, 1)) for d in dirs]
    minus = [shift((d, -1)) for d in dirs]
    D1 = [(p - q) / (2 * h) for p, q in zip(plus, minus)]
    D2 = {}
    for i in range(m):
        D2[i, i] = (plus[i] - 2 * G0 + minus[i]) / h ** 2
        for j in range(i + 1, m):
            v = (shift((dirs[i], 1), (dirs[j], 1)) - shift((dirs[i], 1), (dirs[j], -1))
                 - shift((dirs[i], -1), (dirs[j], 1)) + shift((dirs[i], -1), (dirs[j], -1))) / (4 * h * h)
            D2[i, j] = D2[j, i] = v
    dk = [0.5 * (D1[k] - 1j * D1[n + k]) for k in range(n)]           # d/dw_k
    dlb = [0.5 * (D1[l] + 1j * D1[n + l]) for l in range(n)]          # d/dwbar_l
    Ginv = np.linalg.inv(G0)
    M = np.empty((w.shape[0], n, n, n, n), dtype=complex)
    for k in range(n):
        for l in range(n):
            ddb = 0.25 * (D2[k, l] + 1j * D2[k, n + l] - 1j * D2[n + k, l] + D2[n + k, n + l])
            M[:, k, l] = -ddb @ Ginv + dk[k] @ Ginv @ dlb[l] @ Ginv
    return M, G0


# ---- CP^n with the Fubini-Study metric (the normalisation test) -----------------------------------
def fs_metric(w):
    """g = (1/pi) d dbar log(1 + |w|^2) in the affine chart, (npts, n, n)."""
    s = 1 + np.sum(np.abs(w) ** 2, axis=1)
    n = w.shape[1]
    return (np.eye(n)[None] / s[:, None, None] - w.conj()[:, :, None] * w[:, None, :] / s[:, None, None] ** 2) / math.pi


def euler_cpn(rng, n=3, npts=2000, h=1e-4):
    """chi(CP^n) = (n+1) by Monte Carlo: FS-uniform points, Vol = 2^n / n! in these units."""
    z = rng.normal(size=(npts, n + 1)) + 1j * rng.normal(size=(npts, n + 1))
    big = np.abs(z).argmax(1)                       # chart where the largest coordinate is 1, so |w| <= 1
    keep = np.ones_like(z, dtype=bool)
    keep[np.arange(npts), big] = False
    w = z[keep].reshape(npts, n) / z[np.arange(npts), big][:, None]
    M, G = curvature_M(fs_metric, w, h)
    r, imag = top_form_ratio(M, G)
    vol = 2 ** n / math.factorial(n)
    return vol * r.mean(), vol * r.std() / math.sqrt(npts), imag


# ---- the quintic: metric in a fixed chart, then the same machinery -----------------------------------
def quintic_chart_metric(base, fixed, dep, exps, H, k, psi=0.0):
    """Gfun(w) for one chart: w are the three free coordinates (the base point sets z_fixed = 1);
    z_dep is solved from p = 0 by Newton from the base value; returns the pulled-back metric."""
    free = [[c for c in range(5) if c != f and c != d] for f, d in zip(fixed, dep)]
    free = np.array(free)
    rows = np.arange(base.shape[0])

    def Gfun(w):
        z = base.copy()
        z[rows[:, None], free] = w
        for _ in range(8):
            pval = cy.fermat(z, psi)
            gd = cy.fermat_grad(z, psi)[rows, dep]
            z[rows, dep] = z[rows, dep] - pval / gd
        grad = cy.fermat_grad(z, psi)
        J = np.zeros((z.shape[0], 5, 3), dtype=complex)
        for col in range(3):
            J[rows, free[:, col], col] = 1.0
            J[rows, dep, col] = -grad[rows, free[:, col]] / grad[rows, dep]
        return cy.metric_pullback(z, J, exps, H, k)
    w0 = base[rows[:, None], free]
    return Gfun, w0


def euler_quintic(z, exps, H, k, h=1e-4, chunk=2000, psi=0.0, per_point=False):
    """chi = (20/3) mean[X / ((2 pi)^3 det g_FS)] over FS-distributed points z on the quintic.
    The ratio uses the curvature of the metric (exps, H, k) and the FS volume density g_1 at each point.
    per_point=True returns the per-point estimates of chi from the full c3 and from tr(Theta^3)/3."""
    out, out3, imag = [], [], 0.0
    for i in range(0, z.shape[0], chunk):
        zc = z[i:i + chunk]
        fixed = np.abs(zc).argmax(1)
        g2 = np.abs(cy.fermat_grad(zc, psi))
        g2[np.arange(zc.shape[0]), fixed] = -1
        dep = g2.argmax(1)
        Gfun, w0 = quintic_chart_metric(zc, fixed, dep, exps, H, k, psi)
        M, G = curvature_M(Gfun, w0, h)
        r, im = top_form_ratio(M, G)                       # c3 / (omega_g^3 / 3!)
        G1fun, _ = quintic_chart_metric(zc, fixed, dep, cy.monomials(1), np.eye(5, dtype=complex), 1, psi)
        det_ratio = np.linalg.det(G).real / np.linalg.det(G1fun(w0)).real
        out.append(r * det_ratio)                          # c3 / (omega_1^3 / 3!)
        out3.append(trace_cube_ratio(M, G) * det_ratio)
        imag = max(imag, float(np.abs(im).max()))
    vals, v3 = np.concatenate(out), np.concatenate(out3)
    vol = 20.0 / 3.0
    if per_point:
        return vol * vals, vol * v3
    return vol * vals.mean(), vol * vals.std() / math.sqrt(vals.size), imag

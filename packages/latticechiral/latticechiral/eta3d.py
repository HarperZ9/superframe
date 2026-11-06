# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A direct spectral eta invariant in three dimensions, for loops of flat U(1) connections on a 2D torus.

The space is the mapping torus T^2 x S^1_beta. The gauge field is flat in space and moves around a loop in time:
A = (a1(t), a2(t), 0). Each spatial momentum k (antiperiodic, k in (2 pi / L)(Z + 1/2)^2) decouples into a 1D operator
    H_k = sigma3 (-i d/dt) + sigma1 (k1 + q a1(t)) + sigma2 (k2 + q a2(t)),
written in a truncated Fourier basis in t. The regulated invariant is eta_Lambda = sum over all eigenvalues of
sign(lambda) exp(-(lambda / Lambda)^2). A loop of constant a has a symmetric spectrum and eta = 0.

Known answers. The chiral determinant of a 2D Weyl fermion is a section of a line bundle over the space of flat
connections with constant curvature q^2 L^2 / (2 pi) (one unit of flux per cell of side 2 pi / (q L)), so its Berry
phase around a loop enclosing area S is q^2 L^2 S / (2 pi). In the adiabatic limit (beta large), pi eta of the 3D
operator on the mapping torus reproduces that holonomy (Bismut-Freed; Witten 1985), up to the orientation convention.
"""
import math

import numpy as np


def holonomy_closed_form(q, L, area):
    return q * q * L * L * area / (2 * math.pi)


def _circle_modes(rho):
    """Fourier coefficients of a1 = rho cos(2 pi t / beta), a2 = rho sin(2 pi t / beta): c_{+1}, c_{-1}."""
    return {"a1": {1: rho / 2, -1: rho / 2}, "a2": {1: rho / 2j, -1: -rho / 2j}}


def h_k(k, q, a0, rho, beta, nt, theta=0.5):
    """H_k in the basis (n, spin), n = -nt..nt, time frequencies 2 pi (n + theta) / beta."""
    n = np.arange(-nt, nt + 1)
    d = n.size
    w = 2 * math.pi * (n + theta) / beta
    s1 = np.array([[0, 1], [1, 0]], dtype=complex)
    s2 = np.array([[0, -1j], [1j, 0]])
    s3 = np.diag([1.0, -1.0]).astype(complex)
    H = np.kron(np.diag(w), s3).astype(complex)
    H += np.kron(np.eye(d), (k[0] + q * a0[0]) * s1 + (k[1] + q * a0[1]) * s2)
    m = _circle_modes(rho)
    for shift in (1, -1):
        S = np.eye(d, k=-shift)          # (S)_{m, n} = 1 when m = n + shift
        H += np.kron(S, q * (m["a1"][shift] * s1 + m["a2"][shift] * s2))
    return H


def eta(q, L, a0, rho, beta, lam, nt=None, kmax_factor=4.0, theta=0.5):
    """Regulated eta of the mapping-torus operator for a circular loop of radius rho around a0 in (a1, a2)."""
    if nt is None:
        nt = int(math.ceil(kmax_factor * lam * beta / (2 * math.pi))) + 4
    kmax = kmax_factor * lam + abs(q) * (abs(a0[0]) + abs(a0[1]) + rho)
    ns = np.arange(-int(kmax * L / (2 * math.pi)) - 2, int(kmax * L / (2 * math.pi)) + 2)
    ks = 2 * math.pi * (ns + 0.5) / L
    total = 0.0
    for k1 in ks:
        for k2 in ks:
            if math.hypot(k1 + q * a0[0], k2 + q * a0[1]) > kmax:
                continue
            ev = np.linalg.eigvalsh(h_k((k1, k2), q, a0, rho, beta, nt, theta))
            total += float(np.sum(np.sign(ev) * np.exp(-(ev / lam) ** 2)))
    return total


def holonomy_field(q, B1, B2, L):
    """Closed form for the loop A(theta) = cos(theta) B1 + sin(theta) B2 of general (curved) U(1) fields: the determinant
    bundle has curvature (q^2 / 2 pi) int dA1 ^ dA2, so the holonomy is (q^2 / 2) int (B1_x B2_y - B1_y B2_x) d^2x."""
    M = B1.shape[-1]
    return q * q / 2 * float(np.sum(B1[0] * B2[1] - B1[1] * B2[0]) * (L / M) ** 2)


def eta_field(q, B1, B2, L, beta, lam, N, nt, theta=0.5, tol=1e-12):
    """Regulated eta on T^2 x S^1_beta for A(x, t) = cos(2 pi t / beta) B1(x) + sin(2 pi t / beta) B2(x), B on an
    M x M grid. Plane waves k = 2 pi (m + 1/2) / L, m in [-N, N), times frequencies 2 pi (n + theta) / beta, |n| <= nt.
    Spatial modes of B are kept where the coefficient exceeds tol; the matrix is dense of size 2 (2N)^2 (2 nt + 1)."""
    M = B1.shape[-1]
    ms = np.arange(-N, N)
    ns = np.arange(-nt, nt + 1)
    nk, nw = ms.size, ns.size
    dim = nk * nk * nw
    idx = lambda a, b, c: ((a + N) * nk + (b + N)) * nw + (c + nt)  # noqa: E731
    s1 = np.array([[0, 1], [1, 0]], dtype=complex)
    s2 = np.array([[0, -1j], [1j, 0]])
    s3 = np.diag([1.0, -1.0]).astype(complex)
    H = np.zeros((2 * dim, 2 * dim), dtype=complex)
    A, B, C = np.meshgrid(ms, ms, ns, indexing="ij")
    k1 = 2 * math.pi * (A.ravel() + 0.5) / L
    k2 = 2 * math.pi * (B.ravel() + 0.5) / L
    w = 2 * math.pi * (C.ravel() + theta) / beta
    for i in range(dim):
        H[2 * i:2 * i + 2, 2 * i:2 * i + 2] = k1[i] * s1 + k2[i] * s2 + w[i] * s3
    # time modes: A_{+1} = (B1 - i B2) / 2 multiplies e^{+i nu t}, A_{-1} = (B1 + i B2) / 2
    c1 = [np.fft.fft2(B1[mu]) / M ** 2 for mu in range(2)]
    c2 = [np.fft.fft2(B2[mu]) / M ** 2 for mu in range(2)]
    freq = np.fft.fftfreq(M, d=1.0 / M).astype(int)
    for dn, sgn in ((1, -1j), (-1, 1j)):
        coef = [(c1[mu] + sgn * c2[mu]) / 2 for mu in range(2)]
        for p1 in range(M):
            for p2 in range(M):
                a = (coef[0][p1, p2], coef[1][p1, p2])
                if abs(a[0]) < tol and abs(a[1]) < tol:
                    continue
                d1, d2 = freq[p1], freq[p2]
                blk = q * (a[0] * s1 + a[1] * s2)
                for a1 in ms:
                    b1 = a1 + d1
                    if b1 < -N or b1 >= N:
                        continue
                    for a2 in ms:
                        b2 = a2 + d2
                        if b2 < -N or b2 >= N:
                            continue
                        for c in ns:
                            c2_ = c + dn
                            if c2_ < -nt or c2_ > nt:
                                continue
                            i, j = idx(a1, a2, c), idx(b1, b2, c2_)
                            H[2 * j:2 * j + 2, 2 * i:2 * i + 2] += blk
    ev = np.linalg.eigvalsh(H)
    return float(np.sum(np.sign(ev) * np.exp(-(ev / lam) ** 2)))


def _fprime(x, lam):
    return -(2.0 / lam ** 2) * np.abs(x) * np.exp(-(x / lam) ** 2)


def _fsecond(x, lam):
    return -(2.0 / lam ** 2) * np.sign(x) * np.exp(-(x / lam) ** 2) * (1 - 2 * (x / lam) ** 2)


def eta_field_pert(q, B1, B2, L, beta, lam, N, nt, theta=0.5, tol=1e-12):
    """Second-order perturbation theory for the same regulated eta as `eta_field`, with no matrix diagonalised.

    At A = 0 the operator is diagonal in plane waves, with eigenvalues +-sqrt(k^2 + omega^2) and known spinors, and
    eta = 0. The loop field V couples (k, n) to (k + p, n +- 1) only, so the first-order term vanishes, and
    eta = 1/2 sum_{a, b} |V_ba|^2 (f'(l_a) - f'(l_b)) / (l_a - l_b) + O(V^3), f(x) = sign(x) exp(-(x / lam)^2).
    The cost is linear in the number of modes, so boxes of millions of modes are cheap. Same box as eta_field:
    k = 2 pi (m + 1/2) / L, m in [-N, N); |n| <= nt."""
    M = B1.shape[-1]
    ms = np.arange(-N, N)
    ns = np.arange(-nt, nt + 1)
    K1, K2, NN = np.meshgrid(2 * math.pi * (ms + 0.5) / L, 2 * math.pi * (ms + 0.5) / L, 2 * math.pi * (ns + theta) / beta,
                             indexing="ij")
    E = np.sqrt(K1 ** 2 + K2 ** 2 + NN ** 2)
    kc = K1 - 1j * K2

    def spinor(lmb):
        u = np.stack([kc, lmb - NN])                     # (2, ...) eigenvector of [[w, k1 - i k2], [k1 + i k2, -w]]
        return u / np.sqrt(np.sum(np.abs(u) ** 2, axis=0))
    bands = [(E, spinor(E)), (-E, spinor(-E))]
    s1 = np.array([[0, 1], [1, 0]], dtype=complex)
    s2 = np.array([[0, -1j], [1j, 0]])
    c1 = [np.fft.fft2(B1[mu]) / M ** 2 for mu in range(2)]
    c2 = [np.fft.fft2(B2[mu]) / M ** 2 for mu in range(2)]
    freq = np.fft.fftfreq(M, d=1.0 / M).astype(int)
    total = 0.0
    n1, n3 = ms.size, ns.size
    for dn, sgn in ((1, -1j), (-1, 1j)):
        coef = [(c1[mu] + sgn * c2[mu]) / 2 for mu in range(2)]
        for p1 in range(M):
            for p2 in range(M):
                a = (coef[0][p1, p2], coef[1][p1, p2])
                if abs(a[0]) < tol and abs(a[1]) < tol:
                    continue
                d1, d2 = freq[p1], freq[p2]
                Mx = q * (a[0] * s1 + a[1] * s2)
                # source slice and target slice inside the box
                src = (slice(max(0, -d1), n1 - max(0, d1)), slice(max(0, -d2), n1 - max(0, d2)), slice(max(0, -dn), n3 - max(0, dn)))
                dst = (slice(max(0, d1), n1 - max(0, -d1)), slice(max(0, d2), n1 - max(0, -d2)), slice(max(0, dn), n3 - max(0, -dn)))
                for la, ua in bands:
                    for lb, ub in bands:
                        ls, us = la[src], ua[(slice(None),) + src]
                        lt, ut = lb[dst], ub[(slice(None),) + dst]
                        Mu = np.einsum("ij,j...->i...", Mx, us)
                        amp = np.abs(np.sum(np.conj(ut) * Mu, axis=0)) ** 2
                        diff = ls - lt
                        same = np.abs(diff) < 1e-12
                        F = np.where(same, _fsecond(ls, lam), (_fprime(ls, lam) - _fprime(lt, lam)) / np.where(same, 1.0, diff))
                        total += 0.5 * float(np.sum(amp * F))
    return total

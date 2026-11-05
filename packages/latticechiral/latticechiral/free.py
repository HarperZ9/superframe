# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Free lattice Dirac operators in momentum space: doubling, its cures, and the Nielsen-Ninomiya count.

Naive operator D(p) = i sum_mu gamma_mu sin p_mu (lattice spacing 1). Its zeros sit at p in {0, pi}^d, 2^d of them,
and the chirality of the zero at p0 is the sign of det(d sin p_mu / d p_nu) = prod_mu cos p0_mu; the chiralities sum
to zero (Nielsen-Ninomiya: a local, translation-invariant, chirally symmetric operator has equal numbers of each).
Wilson adds r sum_mu (1 - cos p_mu): every doubler with n momenta at pi gets mass 2 r n. The overlap operator
D = 1 + A / sqrt(A^dagger A), A = D_W - 1, keeps one massless mode, gives the doublers D = 2, and obeys the
Ginsparg-Wilson relation gamma5 D + D gamma5 = D gamma5 D exactly. The SLAC derivative i gamma.p (p in (-pi, pi])
has one zero and no doublers, and pays with a non-local kernel that falls only as 1/x.
"""
import itertools
import math

import numpy as np


def gammas(d):
    """Euclidean Hermitian gamma matrices for d = 2 or 4, and gamma5."""
    s1 = np.array([[0, 1], [1, 0]], dtype=complex)
    s2 = np.array([[0, -1j], [1j, 0]], dtype=complex)
    s3 = np.array([[1, 0], [0, -1]], dtype=complex)
    if d == 2:
        return [s1, s2], s3
    if d == 4:
        z = np.zeros((2, 2), dtype=complex)
        g = [np.block([[z, -1j * s], [1j * s, z]]) for s in (s1, s2, s3)]
        g.append(np.block([[z, np.eye(2)], [np.eye(2), z]]))
        g5 = g[0] @ g[1] @ g[2] @ g[3]
        return g, g5
    raise ValueError("d = 2 or 4")


def naive_zeros(d):
    """The 2^d zeros of the naive operator and their chiralities prod cos p_mu."""
    zs = list(itertools.product((0.0, math.pi), repeat=d))
    return zs, [int(round(np.prod(np.cos(z)))) for z in zs]


def count_zeros_numeric(d, n=24, r=0.0):
    """Count zeros of |D(p)|^2 = sum sin^2 + (r sum(1 - cos))^2 on an n^d grid that contains 0 and pi."""
    p = 2 * math.pi * np.arange(n) / n
    grids = np.meshgrid(*([p] * d), indexing="ij")
    s2 = sum(np.sin(g) ** 2 for g in grids)
    w = sum(1 - np.cos(g) for g in grids)
    m2 = s2 + (r * w) ** 2
    return int(np.sum(m2 < 1e-20))


def wilson_doubler_masses(d, r=1.0):
    return {n: 2 * r * n for n in range(d + 1)}


def overlap_symbol(p, d, r=1.0):
    """Free overlap operator at momentum p (length d) as a matrix."""
    g, _ = gammas(d)
    s = np.sin(p)
    w = r * np.sum(1 - np.cos(p))
    A = 1j * sum(gi * si for gi, si in zip(g, s)) + (w - 1) * np.eye(g[0].shape[0])
    norm = math.sqrt(np.sum(s ** 2) + (w - 1) ** 2)
    return np.eye(g[0].shape[0]) + A / norm


def gw_residual(d, rng, n=50):
    """Largest |gamma5 D + D gamma5 - D gamma5 D| over random momenta."""
    _, g5 = gammas(d)
    worst = 0.0
    for _ in range(n):
        D = overlap_symbol(rng.uniform(-math.pi, math.pi, d), d)
        worst = max(worst, float(np.abs(g5 @ D + D @ g5 - D @ g5 @ D).max()))
    return worst


def overlap_at_corners(d):
    """|D| eigenvalue at each corner of the Brillouin zone: 0 at p = 0, 2 at every doubler."""
    out = {}
    for z in itertools.product((0.0, math.pi), repeat=d):
        ev = np.linalg.eigvals(overlap_symbol(np.array(z), d))
        out[z] = float(np.abs(ev).max())
    return out


def kernel_decay(kind, n=256):
    """Real-space 1D kernel |D(x)| of the derivative for kind 'naive' or 'slac'; returns (x, |D(x)|)."""
    p = 2 * math.pi * np.fft.fftfreq(n)
    sym = np.sin(p) if kind == "naive" else p
    k = np.fft.ifft(sym)
    x = np.arange(1, n // 2)
    return x, np.abs(k[1:n // 2])

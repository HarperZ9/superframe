# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Four-dimensional U(1) on an L^4 torus: constant fluxes in the (1,2) and (3,4) planes and the overlap index.

With Q12 flux quanta through every (1,2) plane and Q34 through every (3,4) plane, the topological charge is
(1 / 8 pi^2) int F ^ F = Q12 Q34, and the index theorem says the overlap index equals it. Dense matrices, so L = 4
(1024 components) is the practical size here.
"""
import itertools
import math

import numpy as np

from .free import gammas


def flux_links(L, Q12, Q34):
    """Link angles th[mu, x1, x2, x3, x4]: the 2D uniform-flux pattern of u1.instanton in each of the two planes."""
    th = np.zeros((4, L, L, L, L))
    x = np.indices((L, L, L, L))
    for (a, b), Q in (((0, 1), Q12), ((2, 3), Q34)):
        th[b] = 2 * math.pi * Q * x[a] / L ** 2
        th[a] = np.where(x[a] == L - 1, -2 * math.pi * Q * x[b] / L, 0.0)
    return th


def topological_charge(th):
    """Q12 Q34 read from plaquettes: (1/4 pi^2) sum over sites of F12 F34 + F13 F42 + F14 F23 (lattice, abelian)."""
    L = th.shape[1]

    def plaq(m, n):
        raw = th[m] + np.roll(th[n], -1, axis=m) - np.roll(th[m], -1, axis=n) - th[n]
        return (raw + math.pi) % (2 * math.pi) - math.pi
    F = {(m, n): plaq(m, n) for m in range(4) for n in range(4) if m < n}
    s = F[(0, 1)] * F[(2, 3)] - F[(0, 2)] * F[(1, 3)] + F[(0, 3)] * F[(1, 2)]
    return float(s.sum() / (4 * math.pi ** 2))


def wilson_dirac(th, r=1.0):
    L = th.shape[1]
    g, _ = gammas(4)
    V = L ** 4
    D = np.zeros((4 * V, 4 * V), dtype=complex)
    I4 = np.eye(4)
    sites = list(itertools.product(range(L), repeat=4))
    index = {s: i for i, s in enumerate(sites)}
    for s in sites:
        i = index[s]
        D[4 * i:4 * i + 4, 4 * i:4 * i + 4] += 4 * r * I4
        for mu in range(4):
            f = list(s)
            f[mu] = (f[mu] + 1) % L
            b = list(s)
            b[mu] = (b[mu] - 1) % L
            jf, jb = index[tuple(f)], index[tuple(b)]
            Uf = np.exp(1j * th[(mu,) + s])
            Ub = np.exp(-1j * th[(mu,) + tuple(b)])
            D[4 * i:4 * i + 4, 4 * jf:4 * jf + 4] += -0.5 * (r * I4 - g[mu]) * Uf
            D[4 * i:4 * i + 4, 4 * jb:4 * jb + 4] += -0.5 * (r * I4 + g[mu]) * Ub
    return D


def overlap_index(th):
    """Tr sign(H) / 2 with H = gamma5 (D_W - 1)."""
    L = th.shape[1]
    _, g5 = gammas(4)
    G5 = np.kron(np.eye(L ** 4), g5)
    H = G5 @ (wilson_dirac(th) - np.eye(4 * L ** 4))
    ev = np.linalg.eigvalsh(0.5 * (H + H.conj().T))
    return int(round(np.sum(np.sign(ev)) / 2)), float(np.abs(ev).min())

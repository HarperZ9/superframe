# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The Narayanan-Neuberger overlap chiral determinant in 2D, on a fine lattice built from a continuum field.

The overlap formula writes the chiral determinant as the overlap of two many-body ground states: the vacuum of the
Wilson Hamiltonian H(U) = gamma5 (D_W(U) - m), 0 < m < 2, and the vacuum of gamma5 itself (the infinite-mass side).
A left mover of charge q uses links U^q and the gamma5 = -1 reference; a right mover uses the gamma5 = +1 reference,
whose overlap is the complex conjugate of the right-mover determinant in the orientation convention of `chiral`
(checked on flat and on smooth fields), so `phase` conjugates it.
Each vacuum is fixed in phase by the Wigner-Brillouin convention <0(1)|0(U)> > 0. Kaplan and Schmaltz showed that the
phase of this overlap is the eta-invariant phase of the domain-wall operator in one dimension more, the object in
Witten's formula |det D+| exp(-i pi eta). Here it is the eta-side realisation, compared with the Fourier phase of
`chiral` on the same continuum field. Antiperiodic fermions in both directions, as in `chiral`.
"""
import math

import numpy as np

from .u1 import gamma5, wilson_dirac

BC = (-1.0, -1.0)


def fine_links(A1, A2, L, s):
    """Link angles on an (s L) x (s L) lattice from a continuum field sampled on M x M points over a torus of side L:
    theta_mu(x) = int_x^{x + a mu} A_mu, a = 1/s, by the trapezoid rule on the sample grid (M divisible by s L)."""
    M = A1.shape[0]
    n = s * L
    k = M // n
    th = np.zeros((2, n, n))
    for a in range(n):
        for b in range(n):
            i, j = a * k, b * k
            seg1 = A1[(i + np.arange(k + 1)) % M, j]
            seg2 = A2[i, (j + np.arange(k + 1)) % M]
            h = (L / M)
            th[0, a, b] = h * (seg1.sum() - 0.5 * (seg1[0] + seg1[-1]))
            th[1, a, b] = h * (seg2.sum() - 0.5 * (seg2[0] + seg2[-1]))
    return th


def vacuum(th, q, m=1.0):
    """Negative-energy eigenvectors of H(U^q) = gamma5 (D_W - m): columns of a (2V x V) matrix (Q = 0)."""
    n = th.shape[1]
    H = gamma5(n) @ (wilson_dirac(q * th, bc=BC) - m * np.eye(2 * n * n))
    ev, V = np.linalg.eigh(0.5 * (H + H.conj().T))
    neg = V[:, ev < 0]
    return neg


def chiral_det(th, q, chirality, ref=None):
    """Overlap chiral determinant of charge q, Wigner-Brillouin phase; ref: the free vacuum (cached by the caller).
    Returned as (phase, log modulus) via slogdet, so large lattices neither underflow nor overflow."""
    n = th.shape[1]
    V = vacuum(th, q)
    V0 = vacuum(np.zeros_like(th), q) if ref is None else ref
    if V.shape[1] != V0.shape[1]:
        return float("nan"), -math.inf
    s_wb, _ = np.linalg.slogdet(V0.conj().T @ V)          # <0(1)|0(U)> = |.| exp(i arg s_wb)
    sel = np.arange(2 * n * n) % 2 == (1 if chirality == "L" else 0)   # gamma5 = -1 (spin 1) or +1 (spin 0)
    s1, l1 = np.linalg.slogdet(V[sel, :])
    s0, l0 = np.linalg.slogdet(V0[sel, :])
    ph = np.angle(s1) - np.angle(s_wb) - np.angle(s0)      # remove the vacuum phase so that <0(1)|0(U)> > 0
    return float((ph + math.pi) % (2 * math.pi) - math.pi), float(l1 - l0)


def phase(th, q, chirality, ref=None):
    """Phase of one factor in the orientation convention of `chiral` (right movers conjugated)."""
    p, _ = chiral_det(th, q, chirality, ref)
    return p if chirality == "L" else -p


def total_phase(th, left, right, ref=None):
    """Sum of the factor phases, in the convention of `chiral`; ref: the free vacuum for this lattice (shared)."""
    return sum(phase(th, q, "L", ref) for q in left if q) + sum(phase(th, q, "R", ref) for q in right if q)

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A first non-abelian step: continuum SU(2) Weyl fermions on a torus and the non-abelian consistent anomaly.

A smooth su(2) field A_mu = A_mu^a T^a (no lattice interpolation in this step) couples to Weyl fermions in the
spin-j representation. Under an infinitesimal gauge transformation delta A = d chi + i [chi, A], the phase of a left
mover moves by an amount proportional to the Dynkin index T(R) (tr_R T^a T^b = T(R) delta^ab): T = 1/2 for the doublet,
2 for the triplet. A theory is free of the perturbative anomaly when sum_L T(R) = sum_R T(R); four left doublets and one
right triplet is such a content. SU(2) has no global anomaly in two dimensions. The determinants are Fourier
truncations as in `chiral`, now with a colour index.
"""
import math

import numpy as np

from .chiral import Torus


def generators(j):
    """Hermitian spin-j generators T1, T2, T3 (2j+1 dimensional)."""
    d = int(round(2 * j + 1))
    m = j - np.arange(d)
    Tp = np.zeros((d, d), dtype=complex)
    for k in range(1, d):
        Tp[k - 1, k] = math.sqrt(j * (j + 1) - m[k] * (m[k] + 1))
    T1 = 0.5 * (Tp + Tp.conj().T)
    T2 = -0.5j * (Tp - Tp.conj().T)
    T3 = np.diag(m).astype(complex)
    return [T1, T2, T3]


def dynkin(j):
    d = 2 * j + 1
    return j * (j + 1) * d / 3


def smooth_su2(M, L, rng, amp=0.3, modes=2):
    """A^a_mu(x) on an M x M grid: a few low Fourier modes per component; returns array (2, 3, M, M)."""
    x = np.arange(M) * L / M
    X1, X2 = np.meshgrid(x, x, indexing="ij")
    A = np.zeros((2, 3, M, M))
    for mu in range(2):
        for a in range(3):
            for _ in range(modes):
                k1, k2 = rng.integers(-1, 2, 2)
                A[mu, a] += amp * rng.normal() * np.cos(2 * math.pi * (k1 * X1 + k2 * X2) / L + rng.uniform(0, 6.3))
    return A


def logdet(T, A, j, chirality):
    """log det(D / D_free) for a spin-j Weyl fermion; A: (2, 3, M, M) components."""
    gens = generators(j)
    d = gens[0].shape[0]
    M = A.shape[-1]
    n = T.size
    D = np.zeros((n * d, n * d), dtype=complex)
    kin = (1j * T.k1 - T.k2) if chirality == "L" else (1j * T.k1 + T.k2)
    for c in range(d):
        D[c::d, c::d] += np.diag(kin)
    for a in range(3):
        if chirality == "L":
            pot = np.fft.fft2(A[0, a] + 1j * A[1, a]) / M ** 2
        else:
            pot = np.fft.fft2(A[0, a] - 1j * A[1, a]) / M ** 2
        V = T.multiplier(1j * pot, M)
        D += np.kron(V, gens[a])
    kfull = np.repeat(kin, d)
    sgn, ld = np.linalg.slogdet(D / kfull[:, None])
    return ld + 1j * np.angle(sgn)


def gauge_shift(A, chi, L, eps):
    """An infinitesimal gauge transformation for D = d + i A: with g = 1 - i eps chi, A -> A + eps (d chi - i [chi, A]).
    With [T^b, T^c] = i eps_bcd T^d, -i [chi, A] = + eps_bcd chi^b A^c T^d, that is + (chi x A)."""
    M = A.shape[-1]
    kk = 2 * math.pi * np.fft.fftfreq(M, d=L / M)
    K1, K2 = np.meshgrid(kk, kk, indexing="ij")
    out = A.copy()
    for a in range(3):
        ch = np.fft.fft2(chi[a])
        out[0, a] += eps * np.real(np.fft.ifft2(1j * K1 * ch))
        out[1, a] += eps * np.real(np.fft.ifft2(1j * K2 * ch))
    for mu in range(2):
        cross = np.cross(chi, A[mu], axis=0)            # (chi x A)^d = eps_dbc chi^b A^c
        out[mu] += eps * cross
    return out


def total_phase(T, A, left, right):
    return (sum(logdet(T, A, j, "L").imag for j in left) + sum(logdet(T, A, j, "R").imag for j in right))

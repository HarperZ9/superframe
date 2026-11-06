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

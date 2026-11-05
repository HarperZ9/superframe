# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two-dimensional compact U(1) lattice gauge fields, the Wilson and overlap Dirac operators, and the index theorem.

Links U_mu(x) = exp(i theta_mu(x)) on an L x L periodic lattice. The plaquette angle F(x) is the principal value of
theta_1(x) + theta_2(x+1) - theta_1(x+2) - theta_2(x), and the geometric charge is Q = sum F / (2 pi), an integer.
Fields are admissible when every |F(x)| stays below a bound; on admissible fields the overlap index equals Q
(the lattice index theorem). The overlap operator is D = 1 + gamma5 sign(H), H = gamma5 (D_W - 1), and its index is
Tr sign(H) / 2. Spectral flow: the index also equals the net number of eigenvalues of H(m) = gamma5 (D_W - m)
that cross zero as m runs from 0 to 1, read as half the change in the signature of H(m).
Index convention here: n_minus - n_plus = Tr sign(H) / 2, which equals +Q with these orientations.
"""
import math

import numpy as np

S1 = np.array([[0, 1], [1, 0]], dtype=complex)
S2 = np.array([[0, -1j], [1j, 0]], dtype=complex)
S3 = np.array([[1, 0], [0, -1]], dtype=complex)


def plaquettes(th):
    """th: (2, L, L) link angles, index [mu, x1, x2]. Returns principal plaquette angles (L, L)."""
    t1, t2 = th
    raw = t1 + np.roll(t2, -1, axis=0) - np.roll(t1, -1, axis=1) - t2
    return (raw + math.pi) % (2 * math.pi) - math.pi


def charge(th):
    return float(np.sum(plaquettes(th)) / (2 * math.pi))


def instanton(L, Q):
    """Uniform field 2 pi Q / L^2 per plaquette, with the transition function on the last column."""
    th = np.zeros((2, L, L))
    x1, x2 = np.meshgrid(np.arange(L), np.arange(L), indexing="ij")
    th[1] = 2 * math.pi * Q * x1 / L ** 2
    th[0] = np.where(x1 == L - 1, -2 * math.pi * Q * x2 / L, 0.0)
    return th


def random_gauge(L, rng):
    return rng.uniform(-math.pi, math.pi, (L, L))


def gauge_transform(th, g):
    """theta_mu(x) -> theta_mu(x) + g(x) - g(x + mu)."""
    out = th.copy()
    out[0] = th[0] + g - np.roll(g, -1, axis=0)
    out[1] = th[1] + g - np.roll(g, -1, axis=1)
    return out


def smooth_noise(L, rng, eps, modes=3):
    """A smooth random perturbation of the links: a few low Fourier modes with amplitude eps."""
    x1, x2 = np.meshgrid(np.arange(L), np.arange(L), indexing="ij")
    out = np.zeros((2, L, L))
    for mu in range(2):
        for _ in range(modes):
            k1, k2 = rng.integers(-2, 3, 2)
            out[mu] += eps * rng.normal() * np.cos(2 * math.pi * (k1 * x1 + k2 * x2) / L + rng.uniform(0, 2 * math.pi))
    return out


def wilson_dirac(th, m=0.0, r=1.0):
    """Dense Wilson-Dirac matrix on 2 L^2 components; index = 2 * site + spin."""
    L = th.shape[1]
    n = L * L
    D = np.zeros((2 * n, 2 * n), dtype=complex)
    idx = lambda a, b: (a % L) * L + (b % L)  # noqa: E731
    I2 = np.eye(2)
    gam = (S1, S2)
    for a in range(L):
        for b in range(L):
            s = idx(a, b)
            D[2 * s:2 * s + 2, 2 * s:2 * s + 2] += (m + 2 * r) * I2
            for mu, (da, db) in enumerate(((1, 0), (0, 1))):
                f = idx(a + da, b + db)
                Uf = np.exp(1j * th[mu, a, b])
                bk = idx(a - da, b - db)
                Ub = np.exp(-1j * th[mu, (a - da) % L, (b - db) % L])
                D[2 * s:2 * s + 2, 2 * f:2 * f + 2] += -0.5 * (r * I2 - gam[mu]) * Uf
                D[2 * s:2 * s + 2, 2 * bk:2 * bk + 2] += -0.5 * (r * I2 + gam[mu]) * Ub
    return D


def gamma5(L):
    return np.kron(np.eye(L * L), S3)


def overlap(th):
    """Overlap operator, the spectrum of H, and the index Tr sign(H) / 2 (= n_minus - n_plus)."""
    L = th.shape[1]
    g5 = gamma5(L)
    H = g5 @ (wilson_dirac(th) - np.eye(2 * L * L))
    H = 0.5 * (H + H.conj().T)
    ev, V = np.linalg.eigh(H)
    sign = (V * np.sign(ev)) @ V.conj().T
    D = np.eye(2 * L * L) + g5 @ sign
    return D, ev, int(round(np.sum(np.sign(ev)) / 2))


def signature_flow(th, ms):
    """Signature of H(m) = gamma5 (D_W - m) along ms, and the lowest |eigenvalues| (for plotting)."""
    L = th.shape[1]
    g5 = gamma5(L)
    DW = wilson_dirac(th)
    sig, low = [], []
    for m in ms:
        H = g5 @ (DW - m * np.eye(2 * L * L))
        ev = np.linalg.eigvalsh(0.5 * (H + H.conj().T))
        sig.append(int(np.sum(np.sign(ev))))
        low.append(np.sort(ev[np.argsort(np.abs(ev))[:6]]))
    return np.array(sig), np.array(low)


def zero_modes(D, tol=1e-8):
    """Number of zero eigenvalues of the overlap operator and their gamma5 chiralities."""
    L = int(round(math.sqrt(D.shape[0] / 2)))
    ev, V = np.linalg.eig(D)
    z = np.where(np.abs(ev) < tol)[0]
    g5 = gamma5(L)
    chir = [float(np.real(V[:, i].conj() @ g5 @ V[:, i]) / np.real(V[:, i].conj() @ V[:, i])) for i in z]
    return len(z), chir


def metropolis_admissible(L, beta, rng, sweeps, bound, start=None, step=0.6):
    """Wilson-action Metropolis restricted to admissible fields (every |F| < bound); returns configurations and the
    acceptance rate. Admissible fields cannot change topology, so the run stays in the starting sector."""
    th = np.zeros((2, L, L)) if start is None else start.copy()
    acc = tot = 0
    for _ in range(sweeps):
        for mu in range(2):
            for a in range(L):
                for b in range(L):
                    old = th[mu, a, b]
                    F0 = plaquettes(th)
                    th[mu, a, b] = old + rng.uniform(-step, step)
                    F1 = plaquettes(th)
                    dS = -beta * (np.sum(np.cos(F1)) - np.sum(np.cos(F0)))
                    tot += 1
                    if np.abs(F1).max() < bound and (dS <= 0 or rng.random() < math.exp(-dS)):
                        acc += 1
                    else:
                        th[mu, a, b] = old
    return th, acc / max(tot, 1)

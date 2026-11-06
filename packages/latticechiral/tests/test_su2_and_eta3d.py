# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers: SU(2) quaternion algebra, a^2 convergence of the link interpolation and of its gauge covariance,
the anomaly ratio 4 on interpolated fields, and the 3D spectral eta against the flat-connection holonomy."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from latticechiral import chiral as ch, eta3d, nonabelian as na, su2lattice as su  # noqa: E402

L, M = 6.0, 48


def _mat(u):
    return su._q2m(u)


def test_quaternions_match_matrices():
    rng = np.random.default_rng(0)
    a, b = su.qexp(rng.normal(size=3)), su.qexp(rng.normal(size=3))
    assert np.allclose(_mat(su.qmul(a, b)), _mat(a) @ _mat(b))
    v = rng.normal(size=3)
    assert np.allclose(su.qlog(su.qexp(v)), v)


def _setup(seed=3):
    rng = np.random.default_rng(seed)
    A = na.smooth_su2(M, L, rng, 0.25, modes=1)
    x = np.arange(M) * L / M
    X1, X2 = np.meshgrid(x, x, indexing="ij")
    chi = np.stack([np.cos(2 * math.pi * (X1 + c * X2) / L + c) for c in range(3)])
    return A, chi


def _errs(A, chi, n):
    U = su.links_from_continuum(A, L, n)
    Ai = su.interpolate(U, L, M)
    rec = np.sqrt(np.mean((Ai - A) ** 2) / np.mean(A ** 2))
    idx = np.arange(n) * (M // n)
    Ag = su.interpolate(su.gauge_lattice(U, su.qexp(chi[:, idx][:, :, idx])), L, M)
    Ac = su.gauge_continuum(Ai, chi, L)
    cov = np.sqrt(np.mean((Ag - Ac) ** 2) / np.mean(Ac ** 2))
    return rec, cov


def test_interpolation_and_covariance_converge_as_a_squared():
    A, chi = _setup()
    r12, c12 = _errs(A, chi, 12)
    r24, c24 = _errs(A, chi, 24)
    assert 3.0 < r12 / r24 < 5.0 and 3.0 < c12 / c24 < 5.0


def test_smoothing_lowers_plaquette_angles():
    A, _ = _setup()
    U = su.noise(su.links_from_continuum(A, L, 12), np.random.default_rng(1), 0.3)
    assert su.max_plaquette_angle(su.smooth(U, 0.5, 3)) < su.max_plaquette_angle(U)


def test_anomaly_ratio_on_interpolated_fields():
    A, _ = _setup(4)
    n = 12
    U = su.links_from_continuum(A, L, n)
    Ai = su.interpolate(U, L, M)
    kk = 2 * math.pi * np.fft.fftfreq(M, d=L / M)
    K1, K2 = np.meshgrid(kk, kk, indexing="ij")
    d = lambda f, K: np.real(np.fft.ifft2(1j * K * np.fft.fft2(f)))  # noqa: E731
    curl = np.stack([d(A[1, a], K1) - d(A[0, a], K2) for a in range(3)])
    chi = curl / np.abs(curl).max()
    idx = np.arange(n) * (M // n)
    Ai2 = su.interpolate(su.gauge_lattice(U, su.qexp(-0.01 * chi[:, idx][:, :, idx])), L, M)
    T = ch.Torus(6, 5)
    dd = {j: na.logdet(T, Ai2, j, "L").imag - na.logdet(T, Ai, j, "L").imag for j in (0.5, 1.0)}
    assert dd[1.0] / dd[0.5] == pytest.approx(4.0, rel=0.02)


def test_spectral_eta_matches_flat_holonomy():
    rho = 0.15
    pe = math.pi * eta3d.eta(1, L, (0.0, 0.0), rho, 10.0, 3.0)
    assert pe == pytest.approx(-eta3d.holonomy_closed_form(1, L, math.pi * rho ** 2), rel=0.05)

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers: the curved-field 3D eta reduces to the flat one for constant fields; the closed-form holonomy of a
flat circle; U(1) link interpolation converges; an SU(2) x U(1) anomaly-free content cancels the U(1) move while a
content with one hypercharge changed moves by its sum of Y^2."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from latticechiral import chiral as ch, eta3d, nonabelian as na, su2lattice as su  # noqa: E402

L, M = 6.0, 48


def test_holonomy_field_matches_flat_closed_form():
    rho = 0.1
    B1 = np.zeros((2, 24, 24))
    B2 = np.zeros((2, 24, 24))
    B1[0] += rho
    B2[1] += rho
    assert eta3d.holonomy_field(2, B1, B2, L) == pytest.approx(eta3d.holonomy_closed_form(2, L, math.pi * rho ** 2))


def test_curved_eta_code_meets_flat_holonomy():
    rho = 0.08
    B1 = np.zeros((2, 24, 24))
    B2 = np.zeros((2, 24, 24))
    B1[0] += rho
    B2[1] += rho
    pe = math.pi * eta3d.eta_field(1, B1, B2, L, 10.0, 2.0, 4, 12)
    assert pe == pytest.approx(-eta3d.holonomy_field(1, B1, B2, L), rel=0.08)


def test_u1_interpolation_converges():
    rng = np.random.default_rng(2)
    B = na.smooth_su2(M, L, rng, 0.25, modes=1)[:, 0]
    e = [np.sqrt(np.mean((su.u1_interpolate(su.u1_links_from_continuum(B, L, n), L, M) - B) ** 2) / np.mean(B ** 2))
         for n in (12, 24)]
    assert e[1] < e[0] and e[0] < 0.05


def test_su2_u1_hypercharge_anomaly():
    rng = np.random.default_rng(7)
    A = na.smooth_su2(M, L, rng, 0.25, modes=1)
    B = na.smooth_su2(M, L, rng, 0.25, modes=1)[:, 0]
    kk = 2 * math.pi * np.fft.fftfreq(M, d=L / M)
    K1, K2 = np.meshgrid(kk, kk, indexing="ij")
    d = lambda f, K: np.real(np.fft.ifft2(1j * K * np.fft.fft2(f)))  # noqa: E731
    curl = d(B[1], K1) - d(B[0], K2)
    al = curl / np.abs(curl).max()
    eps = 0.01
    B2 = B + eps * np.stack([d(al, K1), d(al, K2)])
    unit = -eps * float((al * curl).sum()) * (L / M) ** 2 / (4 * math.pi)
    T = ch.Torus(6, 4)

    def move(left, right):
        f = lambda Bf: (sum(na.logdet(T, A, j, "L", Y, Bf).imag for j, Y in left)  # noqa: E731
                        + sum(na.logdet(T, A, j, "R", Y, Bf).imag for j, Y in right))
        return (f(B2) - f(B)) / unit
    left = [(0.5, 1.0)] * 4
    assert abs(move(left, [(1.0, 1.0), (0.0, 1.0), (0.0, 2.0)])) < 0.02
    assert move(left, [(1.0, 1.0), (0.0, 1.0), (0.0, 1.0)]) == pytest.approx(3.0, rel=0.03)

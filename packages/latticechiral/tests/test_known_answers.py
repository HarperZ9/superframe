# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers: doubling and Nielsen-Ninomiya, Ginsparg-Wilson, the 2D index theorem, spectral flow, the
consistent anomaly -q^2/(4 pi) int chi F, and its cancellation in the 3-4-5 model. Planted wrong cases must fail."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from latticechiral import chiral as ch, free, u1  # noqa: E402


@pytest.mark.parametrize("d", [1, 2, 3, 4])
def test_naive_doubling_and_wilson_cure(d):
    assert free.count_zeros_numeric(d, n=8) == 2 ** d
    assert free.count_zeros_numeric(d, n=8, r=1.0) == 1


@pytest.mark.parametrize("d", [2, 4])
def test_nielsen_ninomiya_chirality_sum(d):
    zs, chi = free.naive_zeros(d)
    assert len(zs) == 2 ** d and sum(chi) == 0 and chi[0] == 1


@pytest.mark.parametrize("d", [2, 4])
def test_overlap_ginsparg_wilson_and_doubler_masses(d):
    assert free.gw_residual(d, np.random.default_rng(d)) < 1e-12
    corners = free.overlap_at_corners(d)
    assert corners[(0.0,) * d] < 1e-14
    assert all(abs(v - 2.0) < 1e-12 for k, v in corners.items() if any(k))


def test_slac_evades_doubling_only_by_nonlocality():
    """Planted counterexample to doubling: the SLAC derivative has one zero but its kernel falls only as 1/x."""
    x, k = free.kernel_decay("slac")
    slope = np.polyfit(np.log(x[2:40:2]), np.log(k[2:40:2]), 1)[0]
    assert slope == pytest.approx(-1.0, abs=0.05)
    xn, kn = free.kernel_decay("naive")
    assert kn[0] > 0.4 and kn[1:].max() < 1e-12


@pytest.mark.parametrize("Q", [-2, -1, 0, 1, 2])
def test_index_theorem_on_admissible_fields(Q):
    rng = np.random.default_rng(10 + Q)
    th = u1.gauge_transform(u1.instanton(6, Q) + u1.smooth_noise(6, rng, 0.15), u1.random_gauge(6, rng))
    assert round(u1.charge(th)) == Q
    D, _, index = u1.overlap(th)
    assert index == Q
    n, chir = u1.zero_modes(D)
    assert n == abs(Q) and all(abs(abs(c) - 1) < 1e-8 for c in chir) and len({round(c) for c in chir}) <= 1


def test_spectral_flow_of_wilson_hamiltonian_counts_the_charge():
    th = u1.instanton(6, 2)
    sig, _ = u1.signature_flow(th, [-0.05, 1.0])
    assert sig[0] == 0 and (sig[1] - sig[0]) // 2 == 2


def test_rough_fields_can_break_the_index_theorem():
    """Planted wrong: far from admissible, the overlap index need not equal the rounded plaquette charge."""
    rng = np.random.default_rng(4)
    bad = 0
    for _ in range(12):
        th = rng.uniform(-math.pi, math.pi, (2, 6, 6))
        bad += u1.overlap(th)[2] != round(u1.charge(th))
    assert bad > 0


@pytest.mark.parametrize("q", [1, 2, 3, -2])
def test_spectral_flow_on_a_circle(q):
    L = 8
    x = np.arange(64) * L / 64
    A = 0.4 * np.sin(2 * math.pi * x / L) + 0.1
    assert ch.spectral_flow_circle(A, L, q, 16, steps=41) == q


@pytest.fixture(scope="module")
def field():
    rng = np.random.default_rng(2)
    th, _ = u1.metropolis_admissible(6, 4.0, rng, 15, 1.0)
    M = 64
    A1, A2 = ch.interpolate(th, M, coulomb=True)
    x = np.arange(M) * 6 / M
    X1, X2 = np.meshgrid(x, x, indexing="ij")
    c = 2 * math.pi / 6
    chi = 0.1 * np.cos(c * X1) * np.cos(c * X2)
    g1, g2 = -0.1 * c * np.sin(c * X1) * np.cos(c * X2), -0.1 * c * np.cos(c * X1) * np.sin(c * X2)
    Fc = ch.band_limited(u1.plaquettes(th), M, (0.5, 0.5))
    return th, A1, A2, g1, g2, float(np.sum(chi * Fc) * (6 / M) ** 2)


def _dphase(T, f, left, right):
    _, A1, A2, g1, g2, _ = f
    d = ch.total_logdet(T, A1 + g1, A2 + g2, left, right).imag - ch.total_logdet(T, A1, A2, left, right).imag
    return (d + math.pi) % (2 * math.pi) - math.pi


def test_consistent_anomaly_coefficient_and_charge_squared(field):
    T = ch.Torus(6, 10)
    unit = _dphase(T, field, (1,), ())
    assert unit == pytest.approx(-field[5] / (4 * math.pi), rel=0.02)
    assert _dphase(T, field, (2,), (1,)) / unit == pytest.approx(3.0, abs=0.05)
    assert _dphase(T, field, (3,), ()) / unit == pytest.approx(9.0, rel=0.03)


def test_345_cancels_and_vectorlike_is_real(field):
    T = ch.Torus(6, 10)
    unit = _dphase(T, field, (1,), ())
    assert abs(_dphase(T, field, (3, 4), (5, 0))) < 0.25 * abs(unit)
    _, A1, A2, *_ = field
    assert abs(ch.total_logdet(T, A1, A2, (3, 4), (3, 4)).imag) < 1e-9


def test_interpolation_is_gauge_covariant(field):
    th = field[0]
    g = u1.random_gauge(6, np.random.default_rng(9)) * 0.3
    a = ch.interpolate(th, 48, coulomb=True)
    b = ch.interpolate(u1.gauge_transform(th, g), 48, coulomb=True)
    assert max(np.abs(a[0] - b[0]).max(), np.abs(a[1] - b[1]).max()) < 1e-12

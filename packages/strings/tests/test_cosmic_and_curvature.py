# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for the cosmic-string background, the PTA refit likelihood and Chern classes from curvature."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest
from scipy.special import zeta

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stringlab import calabiyau, cosmicstrings as cs, curvature, pta  # noqa: E402


@pytest.fixture(scope="module")
def radiation_net():
    co = cs.Cosmology(omega_m=0.0, omega_r=1.0, omega_l=0.0, z_max=1e12, n_grid=4000)
    return cs.Network(co)


def test_vos_scaling_solutions_match_auclair_2020():
    xi_r, v_r = cs.scaling_solution(0.5)
    xi_m, v_m = cs.scaling_solution(2 / 3)
    assert xi_r == pytest.approx(0.271, rel=0.01) and v_r == pytest.approx(0.662, rel=0.01)
    assert xi_m == pytest.approx(0.625, rel=0.02) and v_m == pytest.approx(0.583, rel=0.01)


def test_network_stays_at_the_radiation_fixed_point(radiation_net):
    xi, v = cs.scaling_solution(0.5)
    assert np.abs(radiation_net.xi / xi - 1).max() < 1e-3
    assert np.abs(radiation_net.v / v - 1).max() < 1e-3


def test_loop_density_normalisation_is_bos_like(radiation_net):
    """Model I with F = 0.1 gives n t^(3/2) (l + Gamma G mu t)^(5/2) = 0.17; BOS simulations give 0.18."""
    co = radiation_net.cosmo
    i = co.N.size // 2
    t = co.t[i]
    l = np.array([1e-3, 1e-2, 5e-2]) * t
    n = radiation_net.density(l, i, 1e-12)
    coef = n * t ** 1.5 * (l + 50 * 1e-12 * t) ** 2.5
    assert np.allclose(coef, coef[0], rtol=2e-3)
    assert coef[0] == pytest.approx(0.172, rel=0.01)
    assert coef[0] == pytest.approx(0.18, rel=0.1)


@pytest.mark.parametrize("gmu,f", [(1e-11, 1e-2), (1e-8, 1e-3)])
def test_radiation_plateau_closed_form(radiation_net, gmu, f):
    """Deep in the plateau (f Gamma G mu t0 >> 1) the numeric spectrum meets the closed form, with the
    sum over harmonics truncated at kmax as in the code; at lower f it must fall below it."""
    kmax = 20000
    frac = np.sum(np.arange(1, kmax + 1, dtype=float) ** (-4 / 3)) / zeta(4 / 3)
    om = cs.omega_gw(radiation_net, np.array([f, f / 1e4]), gmu, kmax=kmax)
    want = cs.plateau_radiation(radiation_net, gmu) * frac
    assert om[0] == pytest.approx(want, rel=1e-3)
    assert om[1] < 0.99 * want


def test_harmonic_k_is_the_fundamental_at_f_over_k(radiation_net):
    """I_k(f) computed directly with l = 2 k a / f equals I_1(f / k)."""
    co = radiation_net.cosmo
    idx = np.arange(co.N.size)
    k, f, gmu = 7, 3e-8, 1e-10
    integ = np.exp(5 * co.N) / co.H * radiation_net.density(2 * k * co.a / f, idx, gmu)
    direct = 2 * k / f * np.trapezoid(integ, co.N)
    assert direct == pytest.approx(cs.I1(radiation_net, np.array([f / k]), gmu)[0], rel=1e-12)


def test_rho_conventions_agree():
    """h_c^2 = 3 H0^2 Omega / (2 pi^2 f^2): the Omega route and the power-law route give the same rho."""
    H0, T, f = 2.2e-18, 5e8, np.array([2e-9, 1e-8])
    A, gamma = 2.4e-15, 13 / 3
    hc2 = A ** 2 * (f / pta.FYR) ** (3 - gamma)
    omega = 2 * math.pi ** 2 * f ** 2 * hc2 / (3 * H0 ** 2)
    assert np.allclose(pta.log10_rho(omega, f, H0, T), pta.powerlaw_log10_rho(math.log10(A), gamma, f, T), atol=1e-12)


def test_free_spectrum_loglike_on_gaussian_bins():
    grid = np.linspace(-10, -5, 5001)
    mu = np.array([-7.0, -7.5])
    ld = -0.5 * ((grid[None, :] - mu[:, None]) / 0.2) ** 2
    fs = pta.FreeSpectrum(np.array([1e-9, 2e-9]), grid, ld, n_bins=2)
    x = np.array([-7.1, -7.3])
    assert fs.loglike(x) == pytest.approx(-0.5 * np.sum(((x - mu) / 0.2) ** 2), abs=1e-6)
    m, lo, hi = pta.credible(grid, -0.5 * ((grid + 7) / 0.2) ** 2, 0.68)
    assert m == pytest.approx(-7, abs=1e-4) and hi - lo == pytest.approx(0.4, rel=0.01)


@pytest.mark.parametrize("n", [1, 2, 3])
def test_euler_number_of_cpn_from_curvature(n):
    chi, err, _ = curvature.euler_cpn(np.random.default_rng(n), n, 500)
    assert chi == pytest.approx(n + 1, abs=1e-6)


def test_wrong_sign_curvature_fails_cp3():
    """Planted bad: flip the curvature sign; c3 is odd, so CP^3 gives -4."""
    w = np.array([[0.3 + 0.2j, 0.1 - 0.4j, 0.2j]])
    M, G = curvature.curvature_M(curvature.fs_metric, w)
    assert curvature.top_form_ratio(-M, G)[0][0] * 4 / 3 == pytest.approx(-4, abs=1e-5)


def test_quintic_euler_number_from_fs_curvature():
    z = calabiyau.sample_points(np.random.default_rng(5), 600)
    chi, err, imag = curvature.euler_quintic(z, calabiyau.monomials(1), np.eye(5, dtype=complex), 1)
    assert abs(chi + 200) < 4 * err and err < 30 and imag < 1e-6

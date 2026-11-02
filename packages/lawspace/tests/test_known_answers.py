# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known-answer tests: each asserts a published closed form or theorem, not just that code runs."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lawspace import diffusion, ising_rg, lake, lenia, logistic, orbits, scaling, thermo, walls


@pytest.mark.parametrize("n", [-1.0, 0.0, 1.0, 1.5, 2.0, 2.5])
def test_near_circular_apsidal_angle_matches_closed_form(n):
    assert orbits.apsidal_angle(n, 1e-3) == pytest.approx(np.pi / np.sqrt(3 - n), rel=1e-4)


def test_bertrand_points_close_for_every_amplitude():
    assert orbits.closure_spread(2.0) < 1e-8
    assert orbits.closure_spread(-1.0) < 1e-8
    assert orbits.closure_spread(1.0) > 1e-3


def test_kepler_precession_zero_and_spring_half_turn():
    assert orbits.precession_near_circular(2.0) == pytest.approx(0.0, abs=1e-12)
    assert orbits.precession_near_circular(-1.0) == pytest.approx(-np.pi)


def test_integrator_matches_quadrature_and_conserves_energy():
    xy, es = orbits.leapfrog(1.5, e=0.3, steps=40000, dt=0.002)
    psi, _ = orbits.apsidal_from_path(xy)
    assert psi == pytest.approx(orbits.apsidal_angle(1.5, 0.3), rel=5e-3)
    assert np.ptp(es) / abs(es.mean()) < 1e-4


def test_ehrenfest_stability_boundary():
    assert orbits.stays_bound(2.95) and not orbits.stays_bound(3.05)


def test_logistic_first_doubling_at_three():
    assert not logistic.period_above_one(2.99) and logistic.period_above_one(3.01)


def test_wall_finder_recovers_known_logistic_wall():
    res = walls.find_wall(lambda e, r: r.random() < 1 / (1 + np.exp(-(e - 0.3) / 0.05)), -1, 1,
                          np.random.default_rng(0), reps=10, n_boot=50)
    assert res["ok"] and abs(res["eps_star"] - 0.3) < 0.05 and 0.01 < res["width"] < 0.12


def test_lenia_kernel_unit_sum_and_growth_peak():
    K = lenia.kernel_fft(64, 13)
    assert np.real(K[0, 0]) == pytest.approx(1.0, rel=1e-5)
    assert lenia.growth(0.15, 0.15, 0.015) == pytest.approx(1.0)


def test_lake_floating_ice_keeps_liquid_and_sinking_ice_freezes_solid():
    real = lake.simulate(depth=3.0, years=1)
    sink = lake.simulate(depth=3.0, years=1, ice_rho=1100.0)
    assert real["solid_day"] is None and real["min_liquid_layers"] > 0
    assert sink["solid_day"] is not None
    assert abs(real["ledger_rel_error"]) < 1e-9


def test_stefan_law_scale():
    assert lake.stefan_thickness(1000.0) == pytest.approx(np.sqrt(2 * 2.2 * 1000 * 86400 / (917 * 3.34e5)))


def test_brownian_msd_slope_one_and_gaussian():
    s, k, _ = diffusion.msd_exponent(1.0, np.random.default_rng(1))
    assert s == pytest.approx(1.0, abs=0.05) and k == pytest.approx(3.0, abs=0.2)


def test_cascade_spectrum_width_matches_analytic():
    a, _ = scaling.cascade_spectrum(0.3)
    r = scaling.mfdfa(scaling.binomial_cascade(15, 0.3))
    assert r["width"] == pytest.approx(a.max() - a.min(), abs=0.15)


def test_fgn_is_monofractal_with_right_hurst():
    r = scaling.mfdfa(scaling.fgn(2 ** 15, 0.7, np.random.default_rng(2)))
    assert r["h"][list(r["q"]).index(2.0)] == pytest.approx(0.7, abs=0.05) and r["width"] < 0.2


def test_self_affine_exponents_per_direction():
    z = scaling.self_affine(1024, 0.4, 0.6, np.random.default_rng(3))
    assert scaling.profile_hurst(z, 1) == pytest.approx(0.4, abs=0.05)
    assert scaling.profile_hurst(z, 0) == pytest.approx(0.6, abs=0.1)  # lattice bias, see self_affine


def test_capillary_length():
    assert scaling.bond_number(np.sqrt(0.072 / (1000 * 9.81))) == pytest.approx(1.0)


def test_ising_fixed_point_near_onsager():
    res = ising_rg.flow(np.linspace(0.40, 0.48, 9), np.random.default_rng(0), L=81, levels=2, sweeps=120,
                        ref_L=27)
    assert ising_rg.fixed_point(res, 0, 1) == pytest.approx(ising_rg.KC, abs=0.02)


def test_zeroth_law_shared_temperature_and_transitivity():
    T = thermo.three_bodies([300, 350, 280], [1, 2, 1], 0.0, 1.0, 1.0)[-1]  # 1 and 2 meet only via 3
    assert np.allclose(T, (300 + 700 + 280) / 4, atol=1e-6)


def test_szilard_work_is_kT_ln2():
    assert thermo.szilard_ledger()["work_known_side"] == pytest.approx(np.log(2), rel=1e-8)
    assert thermo.szilard_ledger(error=0.2)["net_max"] < 0


def test_third_law_closed_forms_match_level_sums():
    T = np.array([0.05, 0.3, 1.0, 5.0])
    for (S, C), (Sn, Cn) in [(thermo.two_level(T), thermo.from_levels(T, [0, 1], [1, 1])),
                             (thermo.einstein(T), thermo.from_levels(T, np.arange(600), np.ones(600)))]:
        assert np.allclose(S, Sn, rtol=1e-6) and np.allclose(C, Cn, rtol=1e-6)
    S0, C0 = thermo.two_level(np.array([1e-3]))
    assert S0[0] < 1e-12 and C0[0] < 1e-12
    assert thermo.two_level(np.array([1e-3]), g0=2)[0][0] == pytest.approx(np.log(2))


def test_loschmidt_returns_without_noise_and_fails_with_noise():
    rng = np.random.default_rng(4)
    assert thermo.loschmidt(36, 200, 0.0, rng)[0] < 1e-6
    assert thermo.loschmidt(36, 400, 1e-2, rng)[0] > 0.05


def test_demon_record_pays_for_entropy_drop():
    r = thermo.demon(300, 2000, 1.0, np.random.default_rng(5))
    assert r["dS_gas"] < 0 and r["record_nats"] >= -r["dS_gas"]

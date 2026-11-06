# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for brute force: shocks and saturation in sound, cavitation and its collapse."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wavelab import bubble, burgers, consts  # noqa: E402


def test_fubini_harmonics_and_steepness_before_the_shock():
    rec = burgers.solve(1e5, 0.9, n=4096, record=[0.5, 0.9])
    for r in rec:
        assert np.abs(np.array(r["harmonics"][:6]) - burgers.fubini(r["sigma"], 6)).max() < 1e-3
        assert r["steepness"] == pytest.approx(1 / (1 - r["sigma"]), rel=2e-3)


def test_shock_forms_at_sigma_one_and_a_wrong_beta_misses():
    assert burgers.shock_sigma_numeric(n=4096) == pytest.approx(1.0, abs=0.01)
    assert abs(burgers.shock_sigma_numeric(n=4096, wrong_beta=1 / 1.2) - 1.0) > 0.1  # the B/2A term left out


def test_shock_distance_in_air():
    a = consts.air(293.15)
    assert a["c"] == pytest.approx(343.2, abs=0.2)
    assert consts.air_molar_mass() * 1000 == pytest.approx(28.9644, abs=2e-4)  # the standard's M0
    x = burgers.shock_distance(1000.0, 1000.0, a["rho"], a["c"], a["beta"])
    assert x == pytest.approx(a["rho"] * a["c"] ** 3 / (1.2 * 2 * np.pi * 1e6), rel=1e-12)
    assert 6.0 < x < 7.0


def test_saturation_reaches_the_fay_ceiling():
    r = burgers.saturation_curve(0.1, [10.0], n=4096)[0]
    assert r["p1"] == pytest.approx(r["fay"], rel=0.01)
    assert r["p1"] < 0.25 * r["linear"]  # ten times the source, a fifth of the linear answer
    assert burgers.saturation_level(0.1, 1e6) == pytest.approx(0.2 / np.sinh(0.1), rel=1e-5)


def test_rayleigh_collapse_time():
    assert bubble.rayleigh_factor() == pytest.approx(0.914681, abs=1e-6)
    r = bubble.rayleigh_collapse()
    assert r["t"] == pytest.approx(r["t_rayleigh"], rel=1e-4)
    bad = bubble.rayleigh_collapse(coeff=1.0)  # planted: wrong inertia coefficient
    assert abs(bad["t"] / r["t_rayleigh"] - 1) > 0.05


def test_minnaert_frequency_from_a_free_ring():
    assert bubble.minnaert(1e-3) == pytest.approx(3286, rel=2e-3)  # about 3.3 kHz for a 1 mm bubble at 1 atm
    assert bubble.ring_frequency(1e-3) == pytest.approx(bubble.minnaert(1e-3), rel=1e-3)
    assert abs(bubble.ring_frequency(1e-3, kappa=1.0) / bubble.minnaert(1e-3) - 1) > 0.1  # isothermal gas misses


def test_driven_bubble_collapses_hot_and_concentrates_energy():
    b = bubble.Bubble(4.5e-6)
    s = bubble.collapse_stats(b, 1.35e5, 26.5e3, cycles=2)
    assert 6 < s["Rmax"] / b.R0 < 12 and s["Rmin"] > b.h
    assert s["Tmax"] > 5e3  # adiabatic estimate, an approximation
    c = bubble.concentration(b, 1.35e5, 26.5e3, s)
    assert c["per_quantum"] > 1e9
    quiet = bubble.collapse_stats(b, 0.3e5, 26.5e3, cycles=2)
    assert quiet["Tmax"] < 400  # below the inertial threshold the gas barely warms

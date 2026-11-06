# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers at planetary scale: Earth's free oscillations from PREM and the Lamb wave."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wavelab import atmosphere, consts, earth  # noqa: E402

MODES = {m["id"]: m for m in consts.media()["modes"]["rows"]}


def test_prem_mass_and_surface_gravity():
    p = earth.Prem()
    assert p.mass[-1] == pytest.approx(5.974e24, rel=2e-3)
    assert p.g[-1] == pytest.approx(9.82, abs=0.01)


def test_gravest_modes_against_masters_widmer():
    s2 = earth.find_mode("S", 2, 250e-6, 360e-6) * 1e6
    t2 = earth.find_mode("T", 2, 300e-6, 450e-6) * 1e6
    s0 = earth.find_mode("R", 0, 700e-6, 900e-6) * 1e6
    assert s2 == pytest.approx(MODES["0S2"]["f_prem_uHz"], rel=1e-3)
    assert s2 == pytest.approx(MODES["0S2"]["f_obs_uHz"], rel=2e-3)
    assert 1e6 / s2 / 60 == pytest.approx(53.9, abs=0.1)
    assert t2 == pytest.approx(MODES["0T2"]["f_prem_uHz"], rel=2.5e-3)
    assert 1e6 / t2 / 60 == pytest.approx(44.0, abs=0.3)
    assert s0 == pytest.approx(MODES["0S0"]["f_prem_uHz"], rel=1e-3)


def test_planted_cowling_and_undispersed_moduli_miss():
    cow = earth.find_mode("S", 2, 250e-6, 700e-6, cowling=True, n=60) * 1e6
    assert abs(cow / MODES["0S2"]["f_prem_uHz"] - 1) > 0.1
    raw = earth.find_mode("S", 2, 250e-6, 360e-6, dispersion=False) * 1e6
    assert abs(raw / MODES["0S2"]["f_prem_uHz"] - 1) > 3e-3


def test_lamb_wave_isothermal_exact_and_standard_atmosphere_near_hunga():
    iso = atmosphere.lamb_speed(atmosphere.profile(lambda z: 250.0, n=200))
    assert iso["c"] == pytest.approx(consts.ideal_sound_speed(250.0, consts.air_molar_mass(), 1.4), rel=1e-6)
    std = atmosphere.lamb_speed(atmosphere.profile(atmosphere.ussa_temperature, n=300))["c"]
    assert 305 < std < 320
    assert abs(std - consts.row("tonga.lamb_pola")) < 10
    assert atmosphere.ussa_temperature(0.0) == 288.15
    assert atmosphere.ussa_temperature(15e3) == pytest.approx(216.65, abs=0.1)

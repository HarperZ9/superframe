# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for computing with a vibrating chain, sound on other worlds, the acoustic horizon and scaling."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wavelab import consts, otherworld, reservoir  # noqa: E402

RNG = np.random.default_rng(3)
U = RNG.uniform(-1, 1, 1500)
UB = RNG.choice([-1.0, 1.0], 1500)


def test_linear_chain_has_memory_but_no_products_however_loud():
    quiet = reservoir.capacities(reservoir.simulate(U, **reservoir.regime("linear")), U)
    loud = reservoir.capacities(reservoir.simulate(U, **reservoir.regime("linear_loud")), U)
    assert 10 < quiet["mc"] <= 48  # bounded by the 2n readout features
    assert loud["mc"] == pytest.approx(quiet["mc"], rel=1e-6)  # a linear medium is scale-free
    assert quiet["qc"] < 0.05  # zero in expectation; a few chance passes of the floor remain
    x = reservoir.xor_score(reservoir.simulate(UB, **reservoir.regime("linear_loud")), UB)
    assert x["r2"] < 0.05 and x["acc"] <= 0.8


def test_odd_springs_cannot_multiply_even_springs_can():
    odd = reservoir.xor_score(reservoir.simulate(UB, **reservoir.regime("nonlinear")), UB)
    even = reservoir.xor_score(reservoir.simulate(UB, **reservoir.regime("asymmetric")), UB)
    assert odd["r2"] < 0.05
    assert even["r2"] > 0.2


def test_taps_control_has_no_xor():
    assert reservoir.xor_score(reservoir.taps(UB), UB)["r2"] < 0.05


def test_mars_two_sound_speeds():
    lo, hi = consts.row("mars.c_temp_lo"), consts.row("mars.c_temp_hi")
    for T in (232.0, 240.0):
        s = otherworld.co2_speeds(T)
        assert s["relaxed"] == pytest.approx(consts.nist_at("co2_mars", T, "Sound Spd. (m/s)"), rel=1e-3)
        assert lo * 0.985 < s["relaxed"] < hi * 1.015
        assert consts.row("mars.c_libs_lo") <= s["frozen"] <= consts.row("mars.c_libs_hi")
        assert s["frozen"] - s["relaxed"] == pytest.approx(7.0, abs=2.0)  # measured: about 10 m/s apart
    c_eos = consts.nist_at("co2_mars", 236.0, "Sound Spd. (m/s)")
    gamma_eos = c_eos ** 2 * otherworld.co2_speeds(236.0)["M"] / (consts.R_GAS * 236.0)
    assert otherworld.co2_speeds(236.0)["gamma_relaxed"] == pytest.approx(gamma_eos, rel=2e-3)
    assert abs(gamma_eos - consts.row("mars.gamma0")) > 0.03  # the paper's 1.2857 is not the EOS value (reported)


def test_acoustic_horizon_peels_at_kappa_and_traps():
    assert otherworld.peel_rate() == pytest.approx(otherworld.surface_gravity(), rel=1e-3)
    assert otherworld.trapped(0.01) > 1 and otherworld.trapped(-0.01) < -1
    assert otherworld.hawking_temperature(1.0) == pytest.approx(consts.HBAR / (2 * np.pi * consts.KB))


def test_frequency_scaling_keeps_ratios_and_brune_slope():
    n, f = otherworld.octave_shift(309.45e-6)
    n2, f2 = otherworld.octave_shift(377.30e-6)
    assert n == n2 == 20 and f2 / f == pytest.approx(377.30 / 309.45, rel=1e-15)
    fc = [otherworld.brune(m)[1] for m in (6.0, 7.0, 8.0)]
    assert fc[0] / fc[1] == pytest.approx(10 ** 0.5, rel=1e-12) and fc[1] / fc[2] == pytest.approx(10 ** 0.5, rel=1e-12)

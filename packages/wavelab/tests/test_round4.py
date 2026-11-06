# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for round 4: the thermal bubble's adiabatic limit and slow-drive isothermal behaviour, its
match to the review's Fig. 4 radius, and the detuning patterns' weak-drive answer."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wavelab import consts, resonator as R, thermal  # noqa: E402


def test_heat_off_is_the_adiabatic_polytrope():
    b = thermal.ThermalBubble(4.5e-6, heat=False)
    t, Rr, T, _ = b.run3(1.2 * 101325, 26.5e3, cycles=1)
    assert np.max(np.abs(T / (b.T0 * (b._vol(b.R0) / b._vol(Rr)) ** (2 / 3)) - 1)) < 1e-6


def test_slow_drive_stays_near_isothermal_only_with_heat_flux():
    on = thermal.cycle_stats(thermal.ThermalBubble(4.5e-6), 0.1e5, 20e3, cycles=2)
    off = thermal.cycle_stats(thermal.ThermalBubble(4.5e-6, heat=False), 0.1e5, 20e3, cycles=2)
    assert on["Tmax"] - 293.15 < 1.0 < off["Tmax"] - 293.15


def test_fig4_expansion_with_heat_exchange():
    r = thermal.cycle_stats(thermal.ThermalBubble(4.5e-6), 1.2 * 101325, 26.5e3, cycles=3)
    assert r["Rmax"] == pytest.approx(consts.row("bhl.fig4_rmax_um") * 1e-6, rel=0.1)


def test_patterns_and_weak_drive():
    assert np.allclose(R.pattern("harmonic"), np.arange(1, 17))
    assert R.pattern("second", size=0.3)[1] == pytest.approx(2.6) and R.pattern("second", size=0.3)[2] == 3.0
    w = R.pattern("alternating", size=0.3)
    t, q = R.simulate(1e-4, w=w, periods=150)
    a1 = R.harmonic_amplitude(t, q[:, 0], 1)
    assert R.harmonic_amplitude(t, q[:, 1], 2) == pytest.approx(R.second_mode_weak(a1, w2=w[1]), rel=5e-3)


def test_diverging_narma_seed_is_refused_not_averaged():
    from wavelab import media_graph as G
    u = np.random.default_rng(301).uniform(0, 0.5, 3000)  # a draw known to diverge
    y = G.narma10(u)
    assert not G.narma_finite(y)
    with pytest.raises(FloatingPointError):
        G.narma_score(np.zeros((3000, 4)), y)
    assert G.narma_finite(G.narma10(np.random.default_rng(101).uniform(0, 0.5, 3000)))

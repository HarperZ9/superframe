# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for round 5: the radially resolved bubble's adiabatic limit and volume consistency, and the
mode-2 detuning pattern with a downward shift."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wavelab import conduction as C, resonator as R  # noqa: E402


def test_shells_follow_the_adiabat_without_conduction_and_fill_the_bubble():
    b = C.ConductingBubble(4.5e-6, n=12, conduct=False)
    s = b.run(1.2 * 101325, 26.5e3, cycles=1)
    assert np.max(np.abs(s.y[2:] * (s.y[0] ** 2)[None, :] / (b.T0 * b.R0 ** 2) - 1)) < 1e-6
    assert b.volume_check(s) < 1e-8
    assert b.N.sum() == pytest.approx(b.Ntot, rel=1e-12)


def test_conduction_cools_the_collapse():
    on = C.cycle_stats(C.ConductingBubble(4.5e-6, n=12), 1.2 * 101325, 26.5e3, cycles=1)
    off = C.cycle_stats(C.ConductingBubble(4.5e-6, n=12, conduct=False), 1.2 * 101325, 26.5e3, cycles=1)
    assert on["Tmean"] < on["Tcentre"]  # the wall is a heat bath, so the centre is hottest
    assert on["Rmax"] > off["Rmax"]  # an isothermal-ish gas lets the bubble grow further


def test_downward_mode2_weak_drive():
    w = R.pattern("second", size=-0.15)
    assert w[1] == pytest.approx(1.7)
    t, q = R.simulate(1e-4, w=w, periods=150)
    a1 = R.harmonic_amplitude(t, q[:, 0], 1)
    assert R.harmonic_amplitude(t, q[:, 1], 2) == pytest.approx(R.second_mode_weak(a1, w2=w[1]), rel=5e-3)

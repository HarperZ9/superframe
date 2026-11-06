# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for round 3: Lamb's shape-mode frequency, the ionisation sink's no-ionisation limit, Saha's
behaviour, and a planted sink-free compression that must run hotter."""
import sys
from pathlib import Path

import numpy as np
import pytest
from scipy.integrate import solve_ivp

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wavelab import bubble, cavity, consts  # noqa: E402


def test_static_shape_mode_rings_at_lambs_frequency():
    b = bubble.Bubble(20e-6)
    A, B = cavity._coeffs(b, b.R0, 0.0, 0.0, 2, 2 * np.pi * 26.5e3)
    w = cavity.lamb_frequency(b.R0, 2, b.sig, b.rho)
    assert -A == pytest.approx(w * w, rel=1e-12)
    T = 2 * np.pi / w
    s = solve_ivp(lambda t, y: [y[1], -B * y[1] + A * y[0]], [0, 20 * T], [1.0, 0.0], rtol=1e-11, atol=1e-14, dense_output=True)
    t = np.linspace(0, 20 * T, 200001)
    a = s.sol(t)[0]
    up = np.where((a[:-1] < 0) & (a[1:] >= 0))[0]
    tz = t[up] - a[up] * (t[up + 1] - t[up]) / (a[up + 1] - a[up])
    assert 2 * np.pi / np.mean(np.diff(tz)) == pytest.approx(np.sqrt(w * w - B * B / 4), rel=1e-4)


def test_ionisation_sink_limits_and_planted_error():
    N, V = 1e10, np.geomspace(1e-15, 1e-18, 4000)
    T, x = cavity.compress(N, V, 300.0, I_eV=1e4)
    assert T[-1] == pytest.approx(300.0 * (V[0] / V[-1]) ** (2 / 3), rel=1e-3) and x.max() < 1e-12
    T2, x2 = cavity.compress(N, V, 300.0)
    T3, _ = cavity.compress(N, V, 300.0, sink=False)
    assert T2[-1] < T[-1] and x2[-1] > 0.01
    assert T3[-1] > 1.05 * T2[-1]


def test_saha_rises_with_temperature_and_falls_with_density():
    assert consts.media()["argon"]["ionization_eV"] == pytest.approx(15.7596119, abs=1e-7)
    x = [cavity.saha_fraction(T, 1e27) for T in (8e3, 1.5e4, 3e4)]
    assert x[0] < x[1] < x[2] < 1
    assert cavity.saha_fraction(2e4, 1e28) < cavity.saha_fraction(2e4, 1e26)


def test_ionised_peak_without_ionisation_is_the_polytropic_peak():
    b = bubble.Bubble(2e-6)
    r = cavity.collapse_temperature(b, 1.8e5, 20e3, settle=3, I_eV=1e4)
    assert r["T_ionised"] == pytest.approx(r["T_poly"], rel=1e-3)
    r2 = cavity.collapse_temperature(b, 1.8e5, 20e3, settle=3)
    assert r2["T_ionised"] < r2["T_poly"]  # the sink can only cool

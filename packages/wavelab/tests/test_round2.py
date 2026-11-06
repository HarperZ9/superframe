# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for round 2: diffusive equilibrium in the static limit, the modal resonator's linear and
weak-drive answers, and graph media (symmetry, NARMA alignment), each with a control that must fail."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wavelab import bubble, media_graph as G, resonator as R  # noqa: E402


def test_weighted_gas_pressure_static_limit_is_the_equilibrium_pressure():
    b = bubble.Bubble(5e-6)
    assert bubble.weighted_gas_pressure(b, 0.0, 26.5e3, cycles=2, last=1) == pytest.approx(b.pg0 / b.p0, rel=1e-9)
    assert abs(b.pg0 / b.p0 - 1) > 0.2  # surface tension matters at 5 um: dropping it is a planted error


def test_resonator_linear_and_weak_drive_answers():
    F = 1e-4
    t, q = R.simulate(F, 0.0, periods=150, nonlinear=False)
    assert R.harmonic_amplitude(t, q[:, 0], 1) == pytest.approx(R.linear_amplitude(F), rel=1e-3)
    for d in (0.0, 0.05):
        t, q = R.simulate(F, d, periods=150)
        a1 = R.harmonic_amplitude(t, q[:, 0], 1)
        assert R.harmonic_amplitude(t, q[:, 1], 2) == pytest.approx(R.second_mode_weak(a1, d), rel=5e-3)
    assert R.second_mode_weak(0.005, 0.05) < 0.5 * R.second_mode_weak(0.005, 0.0)  # detuning starves mode 2


def test_interaction_matches_the_projection_of_u_squared():
    rng = np.random.default_rng(1)
    q = rng.standard_normal(6)
    th = np.linspace(0, 2 * np.pi, 4096, endpoint=False)
    u = sum(qn * np.cos((n + 1) * th) for n, qn in enumerate(q))
    proj = [2 * np.mean(u * u * np.cos(n * th)) for n in range(1, 7)]
    assert np.allclose(R._interaction(q), proj, atol=1e-12)


def test_graph_symmetry_and_narma():
    rng = np.random.default_rng(2)
    ub = rng.choice([-1.0, 1.0], 1200)
    odd = G.simulate(ub, "grid", 4, sites=3, k3=1.0, g=0.2, s=0.5)
    even = G.simulate(ub, "grid", 4, sites=3, k2=1.0, k3=1.0, g=0.2, s=0.5)
    assert G.xor_r2(odd, ub) < 0.05 and G.xor_r2(even, ub) > 0.5
    u = rng.uniform(0, 0.5, 1200)
    y = G.narma10(u)
    assert np.isfinite(y).all() and y[200:].std() > 0
    X = G.simulate(4 * u - 1, "chain", 16, sites=2, g=0.05, s=0.3)
    assert G.narma_score(X, y) < 0.9 and G.narma_score(X, y, shuffle_seed=0) > 0.97

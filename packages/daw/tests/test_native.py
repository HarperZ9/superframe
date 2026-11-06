# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The BuildLang real-time core against the Python reference. Skips, with the reason, where buildc or a
C compiler is missing or the buildc here predates slice::from_raw_parts_mut."""
import math
import os
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import materials as M  # noqa: E402
from daw import native  # noqa: E402
from daw import propagate as P  # noqa: E402
from daw.shapes_1d import Bar  # noqa: E402
from daw.synth import mode_sum  # noqa: E402

FS = 48000


@pytest.fixture(scope="module", autouse=True)
def built():
    why = native.unavailable()
    if why and os.environ.get("DAW_REQUIRE_NATIVE"):
        pytest.fail(why)       # the CI job that builds buildc must not skip
    if why:
        pytest.skip(why)


def test_modal_bank_impulse_matches_closed_form():
    m = Bar(M.material("aluminium"), 0.3, 0.012).modes(6)
    f, alpha = m.freqs, m.decay()
    a1, a2 = native.modal_coeffs(f, alpha, FS)
    w = 2 * math.pi * f / FS
    b = np.sin(w)                       # unit impulse -> r^n sin((n + 1) w): the closed form, one sample late
    x = np.zeros(FS // 2); x[0] = 1.0
    y = native.modal_process(a1, a2, b, (np.zeros(6), np.zeros(6)), x)
    want = mode_sum(f, np.exp(alpha / FS), alpha, len(x) + 1, FS, "sin")[1:]   # r^n sin((n + 1) w)
    assert np.max(np.abs(y - want)) < 1e-9
    assert np.max(np.abs(y - mode_sum(f, np.ones(6), alpha, len(x), FS, "sin"))) > 1e-3   # planted: off by one


def test_modal_bank_state_carries_across_periods():
    a1, a2 = native.modal_coeffs([440.0, 1210.0], [3.0, 5.0], FS)
    x = np.random.default_rng(1).standard_normal(1000)
    y_a = native.modal_process(a1, a2, np.ones(2), (np.zeros(2), np.zeros(2)), x, period=128)
    y_b = native.modal_process(a1, a2, np.ones(2), (np.zeros(2), np.zeros(2)), x, period=1000)
    assert np.array_equal(y_a, y_b)


def test_path_delay_to_the_sample():
    c = M.air_speed(20.0)
    x = np.zeros(32); x[0] = 1.0
    for r in (3.0, 10.0, 25.0):
        y = native.path_linear(x, (r, 0, 0), (0, 0, 0), (0, 0, 0), c, FS, FS // 4)
        assert int(np.argmax(np.abs(y))) == math.ceil(r / c * FS) or int(np.argmax(np.abs(y))) == round(r / c * FS)
        assert abs(np.abs(y).sum() - 1.0 / r) < 1e-9          # 1/r spreading, energy kept by interpolation


def test_path_matches_the_reference_and_the_doppler_formula():
    c, v, f0 = 343.0, 20.0, 1000.0
    x = np.sin(2 * math.pi * f0 * np.arange(2 * FS) / FS)
    y = native.path_linear(x, (-100.0, 0, 0), (v, 0, 0), (0, 0, 0), c, FS, FS)
    traj = lambda tau: np.stack([-100.0 + v * tau, np.zeros_like(tau), np.zeros_like(tau)], 1)
    ref, _ = P.moving_path(x, FS, traj, (0, 0, 0), c, FS)
    assert np.max(np.abs(y - ref)) < 1e-12
    assert abs(P.zero_cross_frequency(y[FS // 2:], FS) / (f0 * c / (c - v)) - 1) < 2e-4

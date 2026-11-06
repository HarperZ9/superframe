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


def test_bank_of_voices_equals_the_sum_of_single_voices():
    f = np.array([220.0, 610.0, 1300.0, 330.0, 900.0, 2100.0])
    a1, a2 = native.modal_coeffs(f, np.full(6, 4.0), FS)
    b = np.full(6, 0.3)
    out = native.bank_process(a1, a2, b, 2, 3, 0, 4800, 1000, 9600)
    want = np.zeros(9600)
    for v in range(2):
        x = np.zeros(9600)
        x[[t for t in range(9600) if (t + v * 1000) % 4800 == 0]] = 1.0
        s = slice(3 * v, 3 * v + 3)
        want += native.modal_process(a1[s], a2[s], b[s], (np.zeros(3), np.zeros(3)), x)
    assert np.max(np.abs(out - want)) < 1e-12



def test_live_voice_is_a_struck_free_bar_at_its_sample():
    voices, modes = 3, 6
    state = tuple(np.zeros(voices * modes) for _ in range(5))
    native.voice_set(state, 1, modes, 523.0, 2.3e-4, 0.5, FS)
    f = np.array([523.0 * r for r in Bar(M.material("aluminium"), 0.3, 0.012).modes(modes).ratios()])
    alpha = np.pi * f * 2.3e-4 + 2.0
    a1, a2 = native.modal_coeffs(f, alpha, FS)
    assert np.allclose(state[0][6:12], a1, rtol=0, atol=1e-6) and np.allclose(state[1][6:12], a2, atol=1e-12)
    out = native.bank_live(state, voices, modes, [-1, 100, -1], 480)
    x = np.zeros(480); x[100] = 1.0
    want = native.modal_process(a1, a2, 0.5 / np.arange(1, 7), (np.zeros(6), np.zeros(6)), x)
    assert np.max(np.abs(out - want)) < 1e-6 and np.all(out[:100] == 0)


def test_strike_position_weights_the_bar_modes_by_their_shapes():
    from daw.shapes_1d import free_free_shape
    modes = 8
    state = tuple(np.zeros(modes) for _ in range(5))
    for x in (0.5, 0.224, 0.1):
        native.voice_strike_at(state, 0, modes, 300.0, 2.3e-4, 1.0, x, FS)
        roots = Bar(M.material("aluminium"), 0.3, 0.01).roots(modes)
        want = np.array([free_free_shape(b, x) for b in roots]) / np.arange(1, modes + 1)
        assert np.allclose(state[2], want, atol=1e-9)
    native.voice_strike_at(state, 0, modes, 300.0, 2.3e-4, 1.0, 0.5, FS)
    assert abs(state[2][1]) < 1e-9 and abs(state[2][3]) < 1e-9        # struck at the middle: odd modes silent


def test_bubble_voice_rings_at_its_minnaert_frequency_and_decay():
    state = tuple(np.zeros(1) for _ in range(5))
    native.bubble_set(state, 0, 14000.0, 0.055, 1.0, FS)
    r = np.exp(-np.pi * 14000.0 * 0.055 / FS)
    assert abs(state[0][0] - 2 * r * np.cos(2 * np.pi * 14000.0 / FS)) < 1e-12 and abs(state[1][0] - r * r) < 1e-15
    native.bubble_set(state, 0, 30000.0, 0.055, 1.0, FS)
    assert state[2][0] == 0.0                                          # above 0.45 fs: silenced, not aliased



def test_f32_vector_bank_tracks_the_f64_bank():
    voices, modes = 8, 40
    rng = np.random.default_rng(0)
    f = rng.uniform(100.0, 16000.0, voices * modes)
    a1, a2 = native.modal_coeffs(f, np.pi * f * 2.3e-4 + 2.0, FS)
    b = rng.uniform(0.1, 1.0, voices * modes)
    hits = np.full(voices, -1.0)
    hits[::3] = 5.0
    st64 = (a1.copy(), a2.copy(), b.copy(), np.zeros(voices * modes), np.zeros(voices * modes))
    st32 = tuple(np.ascontiguousarray(x, np.float32) for x in (a1, a2, b, *([np.zeros(voices * modes)] * 3)))
    run = lambda fn, st: np.concatenate([fn(st, voices, modes, hits if i == 0 else np.full(voices, -1.0), 480)
                                         for i in range(8)])
    o64, o32 = run(native.bank_live, st64), run(native.bank_f32, st32)
    assert np.max(np.abs(o32 - o64)) / np.max(np.abs(o64)) < 5e-3          # f32 phase drift: -46 dB after 80 ms
    st32b = tuple(np.ascontiguousarray(x, np.float32) for x in (a1, a2, b, *([np.zeros(voices * modes)] * 3)))
    assert np.array_equal(run(native.bank_f32, st32b), o32)                   # same input, same bits

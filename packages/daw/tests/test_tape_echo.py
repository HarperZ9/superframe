# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Tape echo (H185): the analyser first recovers planted settings from a synthetic signal, then the tape
model's own settings: head delays within 1 percent, intensity 0.62 within 0.02, wow 0.8 Hz within 0.1 Hz,
and the speed depth once the record-and-read cancellation 2 |sin(pi f D)| is divided out."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import effects as fx  # noqa: E402
from daw.tape_echo import MODES, SPEED_RANGE, TapeEcho  # noqa: E402

FS = 48000


def pulse(seconds, at=0.05, dur=0.010, amp=0.05):
    x = np.zeros(int(seconds * FS))
    i, w = int(at * FS), int(dur * FS)
    x[i:i + w] = amp * np.hanning(w)
    return x


def fm_tone(seconds, rate, depth, f0=1000.0):
    t = np.arange(int(seconds * FS)) / FS
    return np.sin(2 * math.pi * (f0 * t - f0 * depth / (2 * math.pi * rate) * np.cos(2 * math.pi * rate * t)))


def test_analyser_recovers_planted_delay_gain_and_flutter():
    y = fx.delay(pulse(4), FS, 0.375, feedback=0.62, mix=1.0, echoes=8)
    assert fx.echo_spacing(y, FS) == pytest.approx(0.375, abs=1e-4)
    assert fx.echo_gain(y, FS, 0.375) == pytest.approx(0.62, abs=0.005)
    rate, depth, prom = fx.flutter(fm_tone(12, 0.8, 0.003), FS, 0.2, 5)
    assert rate == pytest.approx(0.8, abs=0.01) and depth == pytest.approx(0.003, rel=0.01) and prom > 100
    _, quiet, _ = fx.flutter(fm_tone(12, 0.8, 0.0), FS, 0.2, 5)
    assert quiet < 1e-6                                     # a steady tone reads as no flutter


def test_mode_selector_is_the_documented_table():
    assert len(MODES) == 12 and MODES[12] == ((), True)
    assert [MODES[m][0] for m in (1, 2, 3, 4)] == [(1,), (2,), (3,), (2, 3)]
    assert all(MODES[m][1] for m in range(5, 13)) and not any(MODES[m][1] for m in (1, 2, 3, 4))
    assert MODES[11][0] == (1, 2, 3)
    with pytest.raises(ValueError):
        TapeEcho(speed=0.5)                                # outside the documented 0.12 to 0.40 m/s


@pytest.mark.parametrize("mode", [1, 2, 3])
def test_model_head_delays_and_intensity_recovered(mode):
    e = TapeEcho(speed=0.2, mode=mode, intensity=0.62)
    x = pulse(6)
    wet, _ = e.process(x, FS)
    d = e.head_delays()[mode - 1]
    got = fx.echo_spacing(x + wet, FS)
    assert abs(got - d) / d < 0.01
    assert fx.echo_gain(x + wet, FS, got) == pytest.approx(0.62, abs=0.02)


def test_repeat_time_scales_as_one_over_tape_speed():
    lo, hi = SPEED_RANGE
    x = pulse(4)
    got = []
    for v in (lo, 0.2, hi):
        wet, _ = TapeEcho(speed=v, mode=1, intensity=0.3).process(x, FS)
        got.append(fx.echo_spacing(x + wet, FS, lo=0.03, hi=0.5))
    assert got[0] * lo == pytest.approx(got[2] * hi, rel=2e-3)
    assert got[1] / got[0] == pytest.approx(lo / 0.2, rel=2e-3)


def test_wow_and_capstan_flutter_recovered_from_the_model():
    e = TapeEcho(speed=0.2, mode=2, intensity=0.0, wow_hz=0.8, wow_depth=0.003, capstan_ecc=4e-6)
    tone = 0.1 * np.sin(2 * math.pi * 1000 * np.arange(14 * FS) / FS)
    wet, _ = e.process(tone, FS)
    wet = wet[FS // 2:]
    D = e.head_delays()[1]
    rate, pitch_depth, _ = fx.flutter(wet, FS, 0.2, 5)
    assert abs(rate - 0.8) < 0.1
    speed_depth = pitch_depth / (2 * abs(math.sin(math.pi * rate * D)))
    assert speed_depth == pytest.approx(0.003, rel=0.03)
    assert abs(pitch_depth - 0.003) / 0.003 > 0.1           # planted wrong: reading pitch depth as speed depth
    cap_hz = 0.2 / (math.pi * e.capstan_d)
    rate2, pd2, _ = fx.flutter(wet, FS, 5, 40)
    assert rate2 == pytest.approx(cap_hz, rel=0.01)
    assert pd2 / (2 * abs(math.sin(math.pi * rate2 * D))) == pytest.approx(4e-6 / (e.capstan_d / 2), rel=0.05)


def test_gap_loss_has_its_null_at_speed_over_gap():
    e = TapeEcho(speed=0.12, gap=4e-6, spacing=0.0)
    n = 8192
    h = np.abs(np.fft.rfft(e.read_loss(FS, taps=255), n))
    f = np.fft.rfftfreq(n, 1 / FS)
    k = np.argmin(np.abs(f - 15000))
    assert h[k] < np.abs(np.sinc(e.gap * 15000 / e.speed)) + 0.02
    slow = np.abs(np.fft.rfft(TapeEcho(speed=0.12).read_loss(FS), n))
    fast = np.abs(np.fft.rfft(TapeEcho(speed=0.40).read_loss(FS), n))
    assert slow[k] < fast[k]                               # slower tape, darker repeats


def test_saturation_is_odd_so_only_odd_harmonics_grow_with_drive():
    t = np.arange(FS) / FS
    x = 0.8 * np.sin(2 * math.pi * 100 * t)
    for drive, third_min in ((0.2, 0.0), (2.0, 0.02)):
        y = TapeEcho(drive=drive).saturate(x)
        sp = np.abs(np.fft.rfft(y)) / (FS / 2)
        assert sp[200] < 1e-9 and sp[300] / sp[100] >= third_min


def test_echo_never_outlives_the_record_head_path():
    e = TapeEcho(speed=0.2, mode=3, intensity=0.0)
    x = pulse(2)
    wet, _ = e.process(x, FS)
    d = e.head_delays()[2]
    i = int((0.05 + d) * FS)
    assert np.max(np.abs(wet[i + int(0.03 * FS):])) < 1e-9   # one head, no feedback: one repeat only


def test_render_is_deterministic_with_hiss_and_reverb():
    x = pulse(1.5)
    a = TapeEcho(mode=11, hiss=True, seed=3).render(x, FS)
    b = TapeEcho(mode=11, hiss=True, seed=3).render(x, FS)
    assert np.array_equal(a, b) and np.all(np.isfinite(a))

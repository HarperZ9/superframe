# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Waveguide strings and piano, and the effects analyser recovering planted settings
(tremolo 12 Hz, attack 400 ms, delay 375 ms)."""
import math
import sys
from pathlib import Path

import numpy as np
from scipy.signal import hilbert

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import effects as F  # noqa: E402
from daw import waveguide as W  # noqa: E402

FS = 48000


def peak_freq(y, lo, hi, pad=8):
    sp = np.abs(np.fft.rfft(y * np.hanning(len(y)), pad * len(y)))
    fr = np.fft.rfftfreq(pad * len(y), 1 / FS)
    k = int(np.argmax(np.where((fr > lo) & (fr < hi), sp, 0)))
    a, b, c = np.log(sp[k - 1:k + 2])
    return (k + 0.5 * (a - c) / (a - 2 * b + c)) * FS / (pad * len(y))


def test_waveguide_pitch_within_a_hundredth_of_a_cent_at_low_notes():
    for f0, tol in ((110.0, 0.01), (261.6256, 0.01), (1000.0, 0.05)):
        y = W.string(f0, 3.0, FS, W.pluck(f0, FS, np.random.default_rng(1)), t60=2.0)
        f = peak_freq(y[FS:], 0.9 * f0, 1.1 * f0)
        assert abs(1200 * math.log2(f / f0)) < tol, (f0, f)
        n, _, _ = W.loop_params(f0, FS, 2.0)
        assert abs(1200 * math.log2(FS / (n + 0.5) / f0)) > 1.0      # planted: no fractional allpass


def test_waveguide_decay_matches_the_requested_t60():
    f0, t60 = 220.0, 1.5
    y = W.string(f0, 3.0, FS, W.pluck(f0, FS, np.random.default_rng(2)), t60=t60)
    hop, win = 1200, 4800
    lv = []
    for s in range(FS // 4, 2 * FS, hop):
        seg = y[s:s + win] * np.hanning(win)
        lv.append(20 * np.log10(np.abs(np.fft.rfft(seg, 8 * win))[int(round(f0 * 8 * win / FS))]))
    slope = np.polyfit(np.arange(len(lv)) * hop / FS, lv, 1)[0]
    assert abs(-60 / slope / t60 - 1) < 0.05


def test_piano_unison_beats_at_the_detuning():
    f0, cents = 220.0, 4.0
    y = W.piano(f0, 8.0, FS, detune_cents=(0.0, cents), t60=20.0)
    spec = np.fft.rfft(y)
    fr = np.fft.rfftfreq(len(y), 1 / FS)
    spec[(fr < 200) | (fr > 240)] = 0
    env = np.abs(hilbert(np.fft.irfft(spec, len(y))))[FS:]
    beat = peak_freq(env - env.mean(), 0.1, 3.0, pad=4)
    assert abs(beat / (f0 * (2 ** (cents / 1200) - 1)) - 1) < 0.05


def test_analyser_recovers_tremolo_rate_and_attack():
    x = W.piano(220.0, 3.0, FS, t60=12.0)
    y = F.tremolo(F.swell(x, FS, 0.4), FS, 12.0, 0.5)
    rate, strength = F.tremolo_rate(y, FS)
    assert abs(rate / 12.0 - 1) < 0.005 and strength > 300
    assert abs(F.attack_time(y, FS, rate) / 0.4 - 1) < 0.03
    _, dry = F.tremolo_rate(F.swell(x, FS, 0.4), FS)
    assert dry < 300                                                      # planted: no tremolo, no claim


def test_analyser_recovers_the_delay_time():
    x = np.zeros(4 * FS)
    for k, t in enumerate((0.0, 1.3, 2.5)):
        n = W.piano(220 * 2 ** (k / 12), 1.0, FS, t60=0.8)
        x[int(t * FS):int(t * FS) + len(n)] += n
    y = F.delay(F.tremolo(F.swell(x, FS, 0.4), FS, 12.0, 0.5), FS, 0.375)
    t, h = F.delay_time(y, FS, 12.0)
    assert abs(t - 0.375) < 0.001 and h > 0.3
    t_dry, h_dry = F.delay_time(x, FS)
    assert abs(t_dry - 0.375) > 0.01 and h_dry < h                       # planted: the dry take has no echo

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The loudness meter against EBU Tech 3341 and Tech 3342 cases, synthesized from their parametric definitions
(the official test files were not reachable: HTTP 403, no archive capture), and the resampler's measured spec."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from remastering import loudness as LD  # noqa: E402
from remastering import resample as RS  # noqa: E402

FS = 48000


def tone(db, seconds, f=1000.0, fs=FS, phase=0.0):
    t = np.arange(int(round(seconds * fs))) / fs
    return 10 ** (db / 20) * np.sin(2 * math.pi * f * t + phase)


def stereo(*parts):
    m = np.concatenate([tone(d, s) for d, s in parts])
    return np.stack([m, m])


def test_k_weighting_matches_the_tabled_48k_coefficients():
    (b1, a1), (b2, a2) = LD.k_weighting(48000)
    assert np.allclose(b1, [1.53512485958697, -2.69169618940638, 1.19839281085285], atol=1e-12)
    assert np.allclose(a1, [1.0, -1.69065929318241, 0.73248077421585], atol=1e-12)
    assert np.allclose(a2, [1.0, -1.99004745483398, 0.99007225036621], atol=1e-12)
    assert b2 == [1.0, -2.0, 1.0]


@pytest.mark.parametrize("parts,expect", [
    ([(-23, 20)], -23.0),                                             # 3341 case 1
    ([(-33, 20)], -33.0),                                             # case 2
    ([(-36, 10), (-23, 60), (-36, 10)], -23.0),                       # case 3
    ([(-72, 10), (-36, 10), (-23, 60), (-36, 10), (-72, 10)], -23.0),  # case 4
    ([(-26, 20), (-20, 20.1), (-26, 20)], -23.0),                     # case 5
])
def test_tech3341_integrated(parts, expect):
    assert abs(LD.integrated(stereo(*parts), FS) - expect) <= 0.1


def test_tech3341_momentary_and_short_term_on_a_steady_tone():
    y = stereo((-23, 20))
    assert np.all(np.abs(LD.momentary(y, FS) - (-23.0)) <= 0.1)
    assert np.all(np.abs(LD.short_term(y, FS) - (-23.0)) <= 0.1)


def test_tech3341_short_term_on_the_alternating_sequence():
    """Case 9: 1.34 s at -20 dBFS then 1.66 s at -30 dBFS, repeated: a 3 s window always reads -23.0."""
    y = stereo(*[(-20, 1.34), (-30, 1.66)] * 20)
    st = LD.short_term(y, FS)
    assert np.all(np.abs(st[1:] - (-23.0)) <= 0.1)


def test_five_channel_weights():
    """Case 6 (5.0): -28, -28, -24, -30, -30 dBFS on L, R, C, Ls, Rs reads -23 LUFS with the 1.41 surround weights."""
    lv = [-28, -28, -24, -30, -30]
    y = np.stack([tone(d, 20) for d in lv])
    assert abs(LD.integrated(y, FS) - (-23.0)) <= 0.1


@pytest.mark.parametrize("parts,expect", [
    ([(-20, 20), (-30, 20)], 10.0),
    ([(-20, 20), (-15, 20)], 5.0),
    ([(-40, 20), (-20, 20)], 20.0),
    ([(-50, 20), (-35, 20), (-20, 20), (-35, 20), (-50, 20)], 15.0),
])
def test_tech3342_lra(parts, expect):
    assert abs(LD.lra(stereo(*parts), FS) - expect) <= 1.0


@pytest.mark.parametrize("phase_deg", [0.0, 45.0, 60.0, 67.5])
def test_true_peak_of_quarter_rate_sines(phase_deg):
    """Tech 3341 cases 15 to 18: a sine at fs / 4 whose true peak is -6 dBTP, sampled at four phases (sample peak
    as low as -8.3 dBFS at 45 degrees). Tolerance +0.2 / -0.4 dB."""
    y = tone(-6.0, 5.0, FS / 4, phase=math.radians(phase_deg))
    tp = LD.true_peak(np.stack([y, y]), FS)
    assert -6.4 <= tp <= -5.8
    if phase_deg == 45.0:
        assert LD.sample_peak(y) < -8.0          # the sample peak alone would miss it by 3 dB


def test_resampler_spec_is_measured_not_assumed():
    for a, b in [(44100, 48000), (48000, 44100), (96000, 48000)]:
        s = RS.spec(a, b)
        assert s["passband_ripple_db"] < 0.001
        assert s["stopband_db"] < -130
    x = tone(0, 1.0, 1000.0, 44100)
    y = RS.resample(x, 44100, 48000)
    ref = tone(0, 1.0, 1000.0, 48000)
    err = y[2000:-2000] - ref[2000:-2000]
    assert 20 * np.log10(np.abs(err).max()) < -100       # aligned, no delay, no gain error


def test_resampler_rejects_what_would_alias():
    """A 23 kHz tone at 48 kHz going to 44.1 kHz (new Nyquist 22.05 kHz) must vanish, not fold to 21.1 kHz."""
    x = tone(0, 1.0, 23000.0, 48000)
    y = RS.resample(x, 48000, 44100)
    assert 20 * np.log10(np.abs(y[3000:-3000]).max()) < -120

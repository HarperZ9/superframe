# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Electric piano tine and tone bar (H186): cantilever ratios, the tuning spring, Hertz contact, the fork's
sustain against detuning, and the pickup's harmonics against the tine's offset from the pole centre."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import rhodes as R  # noqa: E402

FS = 48000
G3 = 196.0


def test_bare_tine_is_a_cantilever_and_the_manual_tine_lands_near_a2():
    t = R.Tine(R.REPLACEMENT_L, spring_mass=0.0)
    f = t.bare_hz(3)
    assert f[1] / f[0] == pytest.approx((4.6941 / 1.8751) ** 2, rel=1e-4)
    assert f[2] / f[0] == pytest.approx((7.8548 / 1.8751) ** 2, rel=1e-4)
    assert 100 < f[0] < 125          # 111.8 Hz: a full-length replacement tine sits near A2 (110 Hz)
    with pytest.raises(AssertionError):   # planted wrong: free-free roots for a clamped tine
        assert f[1] / f[0] == pytest.approx(2.7565, rel=1e-2)


def test_tuning_spring_lowers_pitch_more_near_the_tip():
    f = [R.Tine(R.REPLACEMENT_L, spring_at=a).modes_hz(1)[0] for a in (0.2, 0.4, 0.6, 0.8, 1.0)]
    assert all(b < a for a, b in zip(f, f[1:]))
    assert R.tine_for(G3).modes_hz(1)[0] == pytest.approx(G3, rel=1e-9)


@pytest.mark.parametrize("shore", R.TIP_SHORE_A)
def test_hertz_contact_time_matches_the_closed_form(shore):
    k = R.hertz_stiffness(shore, 0.006)
    assert R.contact_rigid(shore, 2.0, 0.006, 0.006) == pytest.approx(R.contact_time_closed(0.006, k, 2.0), rel=0.01)


def test_harder_tips_make_shorter_contacts_and_brighter_strikes():
    tine = R.tine_for(G3)
    out = [R.strike(tine, shore_a=s) for s in R.TIP_SHORE_A]
    times = [o[2] for o in out]
    assert all(b < a for a, b in zip(times, times[1:]))
    upper = [abs(o[1][1]) / abs(o[1][0]) for o in out]     # mode 2 velocity over mode 1
    assert upper[-1] > upper[0]


def test_sustain_falls_smoothly_as_the_tine_is_detuned_from_its_bar():
    steps = np.arange(-4, 4.01, 0.5)
    t60 = np.array([R.Fork(R.tine_for(G3 * 2 ** (s / 12)), G3).tine_mode()[1] for s in steps])
    i0 = int(np.argmax(t60))
    assert steps[i0] == 0.0
    assert np.all(np.diff(t60[:i0 + 1]) > 0) and np.all(np.diff(t60[i0:]) < 0)


def test_pickup_centred_gives_no_fundamental_and_offset_brings_it_up():
    y = 0.5e-3 * np.sin(2 * math.pi * G3 * np.arange(FS) / FS)
    g = R.PICKUP_GAP[0]
    h0 = R.harmonics(R.pickup(y, FS, g, 0.0), FS, G3)
    assert h0[0] / h0[1] < 1e-3                           # even flux curve: dead centre is all even harmonics
    ratio = [(lambda h: h[0] / h[1])(R.harmonics(R.pickup(y, FS, g, o * g), FS, G3)) for o in (0.05, 0.1, 0.2, 0.3, 0.4, 0.5)]
    assert all(b > a for a, b in zip(ratio, ratio[1:]))
    with pytest.raises(AssertionError):   # the queue's wording: second harmonic zero at centre. It is not.
        assert h0[1] / h0[0] < 1e-3


def test_smaller_gap_is_louder_as_the_manual_says():
    y = 0.5e-3 * np.sin(2 * math.pi * G3 * np.arange(FS // 4) / FS)
    rms = [np.sqrt(np.mean(R.pickup(y, FS, g, 0.2 * R.PICKUP_GAP[0]) ** 2)) for g in (0.508e-3, *R.PICKUP_GAP)]
    assert rms[0] > rms[1] > rms[2]


def test_note_is_finite_deterministic_and_rings_at_its_pitch():
    v, y = R.note(G3, FS, seconds=1.0)
    v2, _ = R.note(G3, FS, seconds=1.0)
    assert np.array_equal(v, v2) and np.all(np.isfinite(v))
    seg = y[FS // 4:]
    sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), 8 * len(seg)))
    f = np.fft.rfftfreq(8 * len(seg), 1 / FS)
    assert f[np.argmax(sp)] == pytest.approx(G3, rel=0.01)


def test_second_harmonic_vanishes_at_the_flux_curves_inflection():
    # Phi = (1 + u^2)^(-3/2) bends the other way at u = 1/2, so a small swing there makes no second harmonic
    y = 0.02e-3 * np.sin(2 * math.pi * G3 * np.arange(FS // 2) / FS)
    g = R.PICKUP_GAP[0]
    offs = np.linspace(0.3, 0.7, 81)
    h2 = [R.harmonics(R.pickup(y, FS, g, o * g), FS, G3)[1] for o in offs]
    assert offs[int(np.argmin(h2))] == pytest.approx(0.5, abs=0.01)

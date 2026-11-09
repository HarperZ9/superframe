# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for the voice modulation chain: pitch and formants moved apart, harmoniser intervals, the
vocoder's envelope transfer, breath at a planted harmonics-to-noise ratio, varispeed, and the chopped sampler."""
import math
import sys
from pathlib import Path

import numpy as np
from scipy.signal import lfilter, sosfilt

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import spectral as S  # noqa: E402
from daw import voice_read as R  # noqa: E402
from daw import voicefx as X  # noqa: E402

FS = 48000
FORM = (700.0, 1220.0, 2600.0)


def vowel(f0, seconds=1.0, form=FORM, bw=(80, 90, 120)):
    """A harmonic source through three two-pole resonators: formants known by construction."""
    t = np.arange(int(seconds * FS)) / FS
    y = sum(np.cos(2 * math.pi * k * f0 * t) / k for k in range(1, int(0.45 * FS / f0)))
    for f, b in zip(form, bw):
        r = math.exp(-math.pi * b / FS)
        y = lfilter([1 - r], [1, -2 * r * math.cos(2 * math.pi * f / FS), r * r], y)
    return y / np.max(np.abs(y))


def mid(y):
    return y[FS // 4:len(y) - FS // 4]


def test_stft_round_trip_and_stretch_keeps_pitch():
    x = vowel(200)
    assert np.max(np.abs(S.istft(S.stft(x), len(x)) - x)) < 1e-9
    t = np.arange(FS) / FS
    sig = np.sin(2 * math.pi * 440 * t)
    st = S.stretch(sig, 1.5)
    assert len(st) == 72000 and abs(R.cents(R.f0_peak(st[2000:-2000], FS, 400, 480), 440)) < 1
    v = S.varispeed(sig, 0.8)
    assert len(v) == 60000 and abs(R.cents(R.f0_peak(v, FS, 300, 400), 352)) < 1


def test_pitch_moves_and_formants_stay():
    x = vowel(200)
    f_in = R.formants(mid(x), FS)[:2]
    for st in (3, -5):
        y = mid(X.pitch_shift(x, FS, st))
        want = 200 * 2 ** (st / 12)
        assert abs(R.cents(R.f0_peak(y, FS, 0.9 * want, 1.1 * want), want)) < 5
        f = R.formants(y, FS)[:2]
        assert all(abs(a / b - 1) < 0.07 for a, b in zip(f, f_in))


def test_formants_move_and_pitch_stays():
    x = vowel(200)
    f_in = R.formants(mid(x), FS)[:3]
    y = mid(X.formant_shift(x, FS, 1.2))
    assert abs(R.cents(R.f0_peak(y, FS, 150, 260), 200)) < 5
    f = R.formants(y, FS)[:3]
    assert all(abs(a / b / 1.2 - 1) < 0.05 for a, b in zip(f, f_in))
    same = mid(X.formant_shift(x, FS, 1.0))                              # control: ratio 1 changes nothing
    assert all(abs(a / b - 1) < 0.03 for a, b in zip(R.formants(same, FS)[:3], f_in))


def test_harmoniser_sounds_each_interval():
    y = mid(X.harmonize(vowel(200), FS, (0, 4, 7)))
    for st in (0, 4, 7):
        want = 200 * 2 ** (st / 12)
        assert abs(R.cents(R.f0_peak(y, FS, 0.97 * want, 1.03 * want), want)) < 5


def _profile(y):
    filt, _ = X._bands(FS, 24, 80, 8000)
    return np.array([10 * np.log10(np.mean(mid(sosfilt(s, y)) ** 2) + 1e-20) for s in filt])


def test_vocoder_takes_pitch_from_carrier_and_envelope_from_modulator():
    t = np.arange(FS) / FS
    saw = 2 * ((110 * t) % 1) - 1
    mod = vowel(150)
    v = X.vocoder(saw, mod, FS)
    assert abs(R.f0_peak(mid(v), FS, 90, 130) - 110) < 0.5
    pm, pv = _profile(mod), _profile(v)
    assert np.corrcoef(pm, pv)[0, 1] > 0.85
    noise = np.random.default_rng(0).standard_normal(FS)                # planted: a modulator with no vowel
    assert np.corrcoef(pm, _profile(X.vocoder(saw, noise, FS)))[0, 1] < 0.3


def test_breath_reaches_the_planted_hnr():
    x = vowel(200)
    assert R.hnr(mid(x), FS, 200) > 60
    for target in (5.0, 10.0, 20.0):
        assert abs(R.hnr(mid(X.breath(x, FS, target, seed=1)), FS, 200) - target) < 1.0
    a, b = X.breath(x, FS, 10, seed=7), X.breath(x, FS, 10, seed=7)
    assert np.array_equal(a, b)                                          # seeded: byte-repeatable


def test_chop_lands_on_exact_samples_with_hashes():
    t = np.arange(FS) / FS
    sig = np.sin(2 * math.pi * 440 * t)
    steps = [{"slice": 0}, {"slice": 1, "st": 3}, None, {"slice": 2, "reverse": True}, {"slice": 3, "gate": 0.5}]
    y, rows = X.chop(sig, FS, 120, steps, division=16, fade_ms=0)
    L = int(round(FS * 240 / (120 * 16)))
    assert [r["start"] for r in rows] == [0, L, 3 * L, 4 * L] and len(y) == 5 * L
    assert abs(R.cents(R.f0_peak(y[L:2 * L], FS, 400, 600), 440 * 2 ** 0.25)) < 5
    assert np.array_equal(y[3 * L:4 * L], sig[2 * L:3 * L][::-1])
    assert np.all(y[2 * L:3 * L] == 0) and np.all(y[4 * L + L // 2:5 * L] == 0)
    assert all(r["source_sha256"] == X.sha(sig) for r in rows)
    assert len({r["slice_sha256"] for r in rows}) == 4


def test_chain_receipt_and_screwed_varispeed():
    x = vowel(200, 0.5)
    y, rec = X.chain(x, FS, [("pitch", {"semitones": 2}), ("breath", {"hnr_db": 15, "seed": 3}),
                             ("varispeed", {"ratio": 0.8})])
    assert [r["step"] for r in rec] == ["input", "pitch", "breath", "varispeed"]
    assert rec[-1]["samples"] == len(y) == int(round(len(x) / 0.8))
    want = 200 * 2 ** (2 / 12) * 0.8
    assert abs(R.cents(R.f0_peak(y[FS // 8:-FS // 8], FS, 0.9 * want, 1.1 * want), want)) < 5
    y2, rec2 = X.chain(x, FS, [("pitch", {"semitones": 2}), ("breath", {"hnr_db": 15, "seed": 3}),
                               ("varispeed", {"ratio": 0.8})])
    assert rec2 == rec

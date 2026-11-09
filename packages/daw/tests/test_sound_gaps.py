# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for G19 (string dispersion), G14 (subtractive voice), G16 (generated spaces), and the mixer's
width and space sends."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import dispersion as D  # noqa: E402
from daw import patches as P  # noqa: E402
from daw import space as SP  # noqa: E402
from daw import stems as S  # noqa: E402
from daw import subtractive as SUB  # noqa: E402
from daw import waveguide as W  # noqa: E402
from daw.arrange import Arrangement, Note  # noqa: E402
from daw.voices import build  # noqa: E402

FS = 48000


@pytest.mark.parametrize("f0,b", [(55.0, 1e-4), (110.0, 2e-4), (523.25, 1e-3)])
def test_stiff_string_inharmonicity_reads_back(f0, b):
    y = D.stiff_string(f0, 3.5, FS, W.hammer(FS, 2e-3), 6.0, b)
    got, f = D.fit_b(y, FS, f0)
    assert got == pytest.approx(b, rel=0.30)                 # the DAW-GAPS acceptance: within 30 percent
    assert abs(1200 * math.log2(f[0] / f0)) < 1.0            # and the fundamental stays in tune


def test_no_dispersion_keeps_partials_harmonic():
    y = W.string(261.63, 3.5, FS, W.hammer(FS, 2e-3), 6.0, fast=True)
    assert abs(D.fit_b(y, FS, 261.63)[0]) < 2e-5


def test_register_curve_rises_with_pitch():
    assert D.piano_b(36) < D.piano_b(60) < D.piano_b(96)


@pytest.mark.parametrize("fc", [300.0, 1500.0, 6000.0])
def test_svf_lowpass_is_minus_3db_at_cutoff(fc):
    x = np.zeros(1 << 16)
    x[0] = 1.0
    H = np.abs(np.fft.rfft(SUB.svf(x, FS, fc)))
    f = np.fft.rfftfreq(len(x), 1 / FS)
    i = np.argmin(np.abs(20 * np.log10(np.maximum(H, 1e-30)) + 3.0103))
    assert f[i] == pytest.approx(fc, rel=0.01)


def test_svf_self_oscillates_at_the_set_frequency():
    x = np.zeros(FS)
    x[0] = 1.0
    y = SUB.svf(x, FS, 440.0, k=0.0)
    sp = np.abs(np.fft.rfft(y, 1 << 20))
    assert np.fft.rfftfreq(1 << 20, 1 / FS)[np.argmax(sp)] == pytest.approx(440.0, rel=0.01)
    assert np.abs(y[-1000:]).max() / np.abs(y[:1000]).max() > 0.999   # lossless: it does not decay


def test_polyblep_saw_has_its_fundamental_and_less_aliasing_than_naive():
    f0 = 1661.0
    f = np.fft.rfftfreq(FS, 1 / FS)
    harm = np.zeros(len(f), bool)
    for k in range(1, 15):
        harm |= np.abs(f - k * f0) < 8

    def alias_db(y):
        sp = np.abs(np.fft.rfft(y * np.hanning(FS)))
        return 10 * np.log10(np.sum(sp[~harm] ** 2) / np.sum(sp[harm] ** 2)), f[np.argmax(sp)]

    blep, peak = alias_db(SUB.oscillator(np.full(FS, f0), FS, "saw"))
    naive, _ = alias_db(2 * ((np.arange(FS) * f0 / FS) % 1.0) - 1)
    assert peak == pytest.approx(f0, abs=1.0)
    assert blep < -25 and blep < naive - 10


def test_pad_engine_sounds_at_pitch():
    v = build(P.patch("pad", "pad", {"tail": 2.0, "attack": 0.0, "release_t60": 0.0, "voices": 3}))
    y = v.play(Note(0, 4, 57, 0.5), FS, 0.5, None)
    seg = y[FS: 2 * FS]
    sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), 1 << 18))
    f = np.fft.rfftfreq(1 << 18, 1 / FS)
    band = (f > 150) & (f < 300)
    assert f[band][np.argmax(sp[band])] == pytest.approx(220.0, rel=0.01)


@pytest.mark.parametrize("seed", [1, 2])
def test_generated_space_holds_its_t60_per_band(seed):
    sp = SP.Space(t60=(6.0, 5.6, 5.0, 4.5, 3.8, 3.0, 2.0), dims=(30, 14, 18))
    h = sp.impulse_responses(FS, np.random.default_rng(seed))
    for band, want in zip(SP.BANDS, sp.band_t60()):
        got = np.mean([SP.measure_t60(x, FS, band, width=1 / 3) for x in h])
        tol = 0.10 if band < 200 else 0.05                   # a 29 Hz third-octave at 125 Hz holds few modes
        assert got == pytest.approx(want, rel=tol), band


def test_eyring_t60_falls_with_absorption_and_rises_with_volume():
    small = SP.eyring_t60((5, 4, 3), SP.SURFACES["plaster"])
    soft = SP.eyring_t60((5, 4, 3), SP.SURFACES["soft"])
    big = SP.eyring_t60((20, 16, 12), SP.SURFACES["plaster"])
    assert all(a > b for a, b in zip(small, soft)) and all(a > b for a, b in zip(big, small))


def test_tail_correlation_follows_the_setting():
    corr = []
    for c in (0.9, 0.1):
        hl, hr = SP.Space(t60=(2.0,) * 7, correlation=c, early=False).impulse_responses(FS, np.random.default_rng(4))
        corr.append(np.corrcoef(hl[FS // 4:], hr[FS // 4:])[0, 1])
    assert corr[0] > 0.8 and abs(corr[1]) < 0.25


def _piece(width=0.0, sends=None, spaces=None):
    tr = P.track(P.patch("p", "piano", {"t60": 2.0, "tail": 0.5}), [Note(0, 2, 60, 0.5)], width=width,
                 sends=sends or {})
    return Arrangement([tr], bpm=60, fs=FS, seconds=3.0, spaces=spaces or {})


def test_width_keeps_the_mono_sum_and_decorrelates():
    a = S.render(_piece(), np.random.default_rng(0))[0]["p"]
    b = S.render(_piece(width=0.8), np.random.default_rng(0))[0]["p"]
    assert np.allclose(a.sum(1), b.sum(1), atol=1e-12)        # L + R unchanged
    assert np.corrcoef(b[:, 0], b[:, 1])[0, 1] < np.corrcoef(a[:, 0], a[:, 1])[0, 1] - 0.05


def test_space_send_adds_a_tail_in_its_own_stem_and_stems_still_sum(tmp_path):
    hall = SP.Space(t60=(2.5,) * 7, early=False)
    arr = _piece(sends={"hall": 0.5}, spaces={"hall": hall})
    stems, _ = S.render(arr, np.random.default_rng(0))
    dry = S.render(_piece(), np.random.default_rng(0))[0]["p"]
    tail = slice(int(2.6 * FS), int(3.0 * FS))
    assert np.sqrt(np.mean(stems["p"][tail] ** 2)) > 3 * np.sqrt(np.mean(dry[tail] ** 2))
    S.write(tmp_path, stems, FS)
    assert S.check_sum(tmp_path)["equal"]

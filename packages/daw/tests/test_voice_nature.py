# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Body-shape voice and nature sounds: known answers with planted wrong cases."""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import materials as M  # noqa: E402
from daw import nature as N  # noqa: E402
from daw import voice as V  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "measured" / "generated"))
import constants as K  # noqa: E402


def test_uniform_tract_formants_are_odd_quarter_waves():
    c = M.air_speed(37.0)
    f = V.formants(*V.uniform_tract(0.175), c=c, fmax=4000)
    want = np.array([1, 3, 5, 7]) * c / (4 * 0.175)
    assert np.allclose(f[:4], want, rtol=1e-9)
    assert abs(f[0] - 503.6) < 1.0                       # about 500, 1500, 2500 Hz: the neutral vowel
    assert not np.allclose(f[:4], np.array([1, 2, 3, 4]) * c / (2 * 0.175), rtol=1e-2)   # planted: open-open


def test_formants_scale_inversely_with_tract_length():
    a = V.formants(*V.uniform_tract(0.175), fmax=3000)
    b = V.formants(*V.uniform_tract(0.14), fmax=3000)
    assert np.allclose(b[:2] / a[:2], 0.175 / 0.14, rtol=1e-9)


def test_area_shape_moves_formants_and_helium_scales_them():
    areas = np.r_[np.full(9, 1e-4), np.full(8, 7e-4)]              # narrow pharynx, wide mouth: an open vowel
    lengths = np.full(17, 0.01)
    air = V.formants(areas, lengths, c=M.air_speed(37.0), fmax=3000)
    uni = V.formants(*V.uniform_tract(0.17, 3e-4, 17), c=M.air_speed(37.0), fmax=3000)
    assert air[0] > uni[0] and air[1] < uni[1]                     # F1 up, F2 down, as for /a/
    he = M.row("helium.c0")["value"] * math.sqrt(310.15 / 273.15)  # helium at 37 C by the ideal-gas law
    hel = V.formants(areas, lengths, c=he, fmax=9000)
    assert np.allclose(hel[:2] / air[:2], he / M.air_speed(37.0), rtol=1e-9)


def test_glottal_source_pitch_and_controls():
    fs = 48000
    g = V.rosenberg_pulses(110.0, 1.0, fs, open_quotient=0.6)
    spec = np.abs(np.fft.rfft(g - g.mean()))
    assert abs(np.argmax(spec) * fs / len(g) - 110.0) < 1.0
    assert abs((g > 0).mean() - 0.6) < 0.01                       # the open quotient is the open fraction
    breathy = V.rosenberg_pulses(110.0, 0.2, fs, breath=0.1, rng=np.random.default_rng(3))
    assert np.std(breathy - V.rosenberg_pulses(110.0, 0.2, fs)) > 0.02


def test_vowel_render_is_finite_and_seeded():
    fs = 16000
    a = V.vowel(*V.uniform_tract(), 120.0, 0.3, fs, breath=0.05, rng=np.random.default_rng(7))
    b = V.vowel(*V.uniform_tract(), 120.0, 0.3, fs, breath=0.05, rng=np.random.default_rng(7))
    assert np.all(np.isfinite(a)) and np.array_equal(a, b)


def test_aeolian_tone_strouhal():
    assert abs(N.aeolian_frequency(10.0, 0.01) - 200.0) < 1e-12
    d = N.aeolian_frequency(19.0, 0.02)
    assert abs(d - 190.0) < 1e-9                                    # a 2 cm wire in a 19 m/s gale
    assert abs(N.aeolian_frequency(10.0, 0.01, strouhal=0.4) - 200.0) > 50


def test_minnaert_bubble():
    f = N.minnaert_frequency(1e-3)
    assert abs(f - math.sqrt(3 * 1.4 * 101325 / 998.2) / (2 * math.pi * 1e-3)) < 1e-9 and 3200 < f < 3350
    assert abs(N.minnaert_frequency(2e-3) - f / 2) < 1e-9
    assert abs(N.minnaert_frequency(1e-3, gamma=1.0) - f) > 400     # planted: isothermal gas


def test_sonification_keeps_every_ratio():
    lines_nm = np.array([557.7, 630.0, 636.4])                     # auroral oxygen lines
    nu = N.wavelength_to_frequency(lines_nm * 1e-9, K.c)
    audio, k = N.sonify(nu, 220.0)
    assert np.allclose(audio / audio.min(), nu / nu.min(), rtol=1e-15) and abs(audio.min() - 220.0) < 1e-9
    assert abs(nu[0] - 5.3755e14) / 5.3755e14 < 1e-4

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Bowed string, reed, lip radiation and wall loss, two-mass folds, and the measured printed vocal tracts."""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import folds as G  # noqa: E402
from daw import materials as M  # noqa: E402
from daw import sustain as S  # noqa: E402
from daw import tract as T  # noqa: E402
from daw import voice as V  # noqa: E402
from measured import load  # noqa: E402

FS = 48000


def peak(y, lo, hi, fs=FS):
    sp = np.abs(np.fft.rfft(y * np.hanning(len(y)), 8 * len(y)))
    fr = np.fft.rfftfreq(8 * len(y), 1 / fs)
    return fr[int(np.argmax(np.where((fr > lo) & (fr < hi), sp, 0)))]


def test_bowed_string_settles_into_helmholtz_motion():
    y, stick = S.bowed(220.0, 1.2, FS, beta=0.127, force=1.0)
    f = peak(y[FS // 2:], 100, 500)
    assert abs(f / (FS / round(FS / 220.0)) - 1) < 0.005                # the string's own period
    assert abs(stick[FS // 2:].mean() - (1 - 0.127)) < 0.05             # sticks for 1 - beta of each period
    silent, _ = S.bowed(220.0, 0.5, FS, bow_velocity=0.0)
    assert np.max(np.abs(silent)) == 0.0                                 # planted: a bow that does not move


def test_reed_sounds_a_quarter_wave_with_odd_harmonics_and_a_threshold():
    c, L = M.air_speed(20.0), 0.3
    y = S.reed(L, c, 1.2, FS, breath=0.6)[FS // 2:]
    f = peak(y, 200, 400)
    assert abs(f / (c / (4 * L)) - 1) < 0.01
    h1, h2, h3, h4 = S.odd_even(y, FS, f)
    assert h3 - h2 > 10 and h1 - h4 > 10                                  # odd harmonics dominate
    quiet = S.reed(L, c, 1.2, FS, breath=0.1)[FS // 2:]
    assert np.sqrt(np.mean(quiet ** 2)) < 0.05 * np.sqrt(np.mean(y ** 2))   # below threshold: no tone


def test_lip_radiation_adds_the_baffled_piston_end_correction():
    c = M.air_speed(37.0)
    a, l = V.uniform_tract()
    closed = T.formants_and_bandwidths(a, l, c, lips=False)
    rad = T.formants_and_bandwidths(a, l, c, lips=True)
    r = math.sqrt(3e-4 / math.pi)
    assert abs(rad[0][0] / (c / (4 * (0.175 + 8 * r / (3 * math.pi)))) - 1) < 0.005
    assert abs(closed[0][0] / (c / 0.7) - 1) < 0.005
    assert rad[2][1] > rad[1][1] > rad[0][1]                             # radiation loss grows as k^2


def test_yielding_walls_raise_f1_and_widen_it():
    c = M.air_speed(37.0)
    a, l = V.uniform_tract()
    rigid = T.formants_and_bandwidths(a, l, c)
    soft = T.formants_and_bandwidths(a, l, c, walls=True)
    assert soft[0][0] > rigid[0][0] * 1.02 and soft[0][1] > rigid[0][1] + 20
    assert abs(soft[2][0] / rigid[2][0] - 1) < 0.01                     # high formants barely move


def test_two_mass_folds_oscillate_above_threshold_near_their_mode():
    fs = 16000
    area, flow = G.simulate(800.0, 0.3, fs)
    f0, oq = G.pitch_and_open_quotient(area, fs)
    assert abs(f0 / G.linear_frequencies()[0] - 1) < 0.1 and 0.5 < oq < 0.9
    quiet, _ = G.simulate(100.0, 0.3, fs)
    assert G.pitch_and_open_quotient(quiet, fs)[0] == 0.0               # below the phonation threshold


def test_fold_controls_change_voice_quality_and_loudness():
    fs = 16000
    pressed = G.pitch_and_open_quotient(G.simulate(800.0, 0.3, fs, a0=3e-6)[0], fs)[1]
    breathy = G.pitch_and_open_quotient(G.simulate(800.0, 0.3, fs, a0=1.2e-5)[0], fs)[1]
    assert breathy > pressed + 0.2
    soft = G.simulate(400.0, 0.3, fs)[1].max()
    loud = G.simulate(1600.0, 0.3, fs)[1].max()
    assert loud > 2 * soft


def test_printed_mri_tracts_measured_and_published_agree():
    rows = load("vocal_tracts_dvtd")["rows"]
    assert len(rows) == 44
    ok = [r for r in rows if len(r["measured_hz"]) >= 2 and len(r["calculated_hz"]) >= 2
          and all(abs(m / c - 1) < 0.05 for m, c in zip(r["measured_hz"][:2], r["calculated_hz"][:2]))]
    assert len(ok) >= 36
    by = {(r["speaker"], r["sound"]): r["measured_hz"] for r in rows}
    for s in (1, 2):
        assert by[(s, "tense-a")][0] > by[(s, "tense-i")][0]             # /a/ opens F1, /i/ closes it
        assert by[(s, "tense-i")][1] > by[(s, "tense-u")][1]             # /i/ is front, /u/ back

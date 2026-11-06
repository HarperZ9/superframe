# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Consonance from an instrument's own partials, voice-leading distance, and tension as pitch."""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import harmony as H  # noqa: E402
from daw import materials as M  # noqa: E402
from daw.shapes_1d import Bar  # noqa: E402

AMPS = 0.88 ** np.arange(6)


def near(found, want, cents=1.0):
    return any(abs(H.cents(r / want)) < cents for r in found)


def test_harmonic_timbre_gives_the_just_intervals():
    rs, _ = H.minima(220.0 * np.arange(1, 7), AMPS, 1.0, 2.1, 8000)
    for r in (6 / 5, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 2.0):
        assert near(rs, r), r
    assert not near(rs, 2 ** (7 / 12), 0.5)          # the tempered fifth is not itself a minimum


def test_free_bar_minima_sit_on_its_own_ratios():
    r = Bar(M.material("aluminium"), 0.3, 0.01).modes(4).ratios()
    rs, _ = H.minima(220.0 * r, AMPS[:4], 1.0, 3.0, 12000)
    for want in (r[1], r[2] / r[1], r[3] / r[2]):    # 2.7565, 1.9604, 1.6531
        assert near(rs, want), want
    assert not near(rs, 1.5, 5.0)                     # the harmonic fifth is not a minimum for a bar
    harm, _ = H.minima(220.0 * np.arange(1, 7), AMPS, 1.0, 3.0, 12000)
    assert not near(harm, r[1], 5.0)                  # planted: a harmonic timbre does not favour 2.7565


def test_voice_leading_distance():
    assert H.voice_leading((60, 64, 67), (57, 60, 64)) == 10      # A minor with A below: G moves down a seventh
    assert H.voice_leading((60, 64, 67), (60, 64, 69)) == 2       # A above: G moves up a tone, the smooth path
    assert H.voice_leading((60, 64, 67), (60, 64, 67)) == 0


def test_tension_sets_pitch_as_sqrt():
    f1 = H.string_pitch(80.0, 1e-3, 0.65)
    assert abs(H.string_pitch(320.0, 1e-3, 0.65) / f1 - 2.0) < 1e-12   # four times the tension: an octave
    assert abs(H.string_pitch(160.0, 1e-3, 0.65) / f1 - math.sqrt(2)) < 1e-12

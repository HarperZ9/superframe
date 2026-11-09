# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A tempo map inside an Arrangement: notes start on the map's samples and are held for the map's time."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import materials as M  # noqa: E402
from daw import tempo as T  # noqa: E402
from daw.arrange import Arrangement, Instrument, Note, Track, render_track  # noqa: E402
from daw.shapes_1d import Bar  # noqa: E402

FS = 48000
BAR = Instrument("bar", Bar(M.material("aluminium"), 0.3, 0.012), tail=0.2)


def onsets(tempo, notes, bpm=96.0):
    """First non-zero sample of each note, rendered on its own."""
    return [int(np.flatnonzero(render(tempo, [n], bpm)[1])[0]) for n in notes]


def render(tempo, notes, bpm=96.0):
    arr = Arrangement([Track("t", BAR, notes)], bpm=bpm, fs=FS, seconds=8.0, tempo=tempo)
    return arr, render_track(arr, arr.tracks[0], np.random.default_rng(0))


def test_no_map_and_a_constant_map_place_notes_alike():
    notes = [Note(b, 0.5, 72) for b in (0.0, 1.0, 2.5, 4.0)]
    a0, y0 = render(None, notes)
    a1, y1 = render(T.TempoMap([T.Point(0, 96.0)]), notes)
    assert [a0.sample_of(n.beat) for n in notes] == [a1.sample_of(n.beat) for n in notes]
    assert np.array_equal(y0, y1)


def test_ritardando_notes_start_on_the_map_samples():
    tm = T.TempoMap([T.Point(0, 120.0, True), T.Point(8, 60.0), T.Point(16, 60.0)])
    notes = [Note(float(b), 0.5, 72) for b in range(0, 10)]
    want = [tm.sample(n.beat, FS) for n in notes]
    assert onsets(tm, notes) == want
    assert onsets(None, notes, bpm=120.0) != want                         # planted: no map, constant 120


def test_notes_are_held_for_the_map_time():
    tm = T.TempoMap([T.Point(0, 120.0, True), T.Point(8, 60.0)])
    arr = Arrangement([], bpm=120.0, fs=FS, tempo=tm)
    n = Note(2.0, 2.0, 60)
    assert abs(arr.note_seconds_per_beat(n) * 2.0 - (tm.seconds(4.0) - tm.seconds(2.0))) < 1e-12
    assert abs(arr.note_seconds_per_beat(n) - 0.5) > 0.05                 # not the constant 120 BPM beat

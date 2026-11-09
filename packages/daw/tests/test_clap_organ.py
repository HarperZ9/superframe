# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The CLAP organ (clap/organ.c) against the offline organ (daw/organ.py) with the stored table.

Known answers: the plugin's output equals organ.play with the table's numbers, bit for bit, at 44.1 and 48 kHz,
at any host block size and with stops drawn by program change; the recurrence oscillator stays within 1e-8 of
libm's sine over 10 s at 32.7 Hz, with its amplitude within 1e-9; the stored table is a fresh derivation within 1e-12.
Planted controls: chords one sample late, a wind constant off by a quarter, and the default stops in place of
the drawn ones must all differ. Skips with the reason where buildc or a C compiler is missing; the CI job that
builds buildc must not skip.
"""
import json
import math
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import clap_build, native  # noqa: E402
from daw import organ as O  # noqa: E402
from daw import organ_table as T  # noqa: E402

GAIN, INDEX = 0.25, 2
CHORDS = [(0.01, 0.30, [48, 55]), (0.2, 0.25, [60]), (0.5, 0.2, [36, 64, 67])]
DEFAULT = ["principal 8", "octave 4"]


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    why = clap_build.unavailable() or native.unavailable()
    if why and os.environ.get("DAW_REQUIRE_NATIVE"):
        pytest.fail(why)
    if why:
        pytest.skip(why)
    return clap_build.build(tmp_path_factory.mktemp("clap-organ"))


def events(chords, fs, program=None):
    """Host arguments: an optional program change at sample 0, then note-ons and note-offs in time order, with
    note-offs first on a shared sample."""
    ev = []
    for s, d, keys in chords:
        ev += [(int(round(s * fs)), 1, k) for k in keys]
        ev += [(int(round((s + d) * fs)), 0, k) for k in keys]
    ev.sort(key=lambda e: (e[0], e[1]))
    head = [] if program is None else [f"0:{program}:0:1:2"]
    return head + [f"{t}:{k}:1.0:0:{0 if on else 1}" for t, on, k in ev]


def play(built, chords, block, seconds, fs, program=None):
    plugin, host = built
    out = plugin.parent / f"organ-{fs}-{block}-{program}-{len(chords)}.f32"
    args = [str(host), f"{plugin}#{INDEX}", str(out), str(block), str(seconds), str(fs)]
    r = subprocess.run(args + events(chords, fs, program), capture_output=True, text=True, check=True)
    return np.fromfile(out, dtype=np.float32).reshape(-1, 2), json.loads(r.stdout)


def reference(chords, seconds, fs, stops=DEFAULT, k=0.04):
    total = int(seconds * fs)
    y, _ = O.play(chords, stops, fs, seconds=seconds, k=k, design=T.read(fs))
    return (GAIN * y[:total]).astype(np.float32)


def test_descriptor_is_an_instrument_with_no_latency(built):
    _, info = play(built, CHORDS[:1], 256, 0.1, 48000)
    assert info["id"] == "io.github.harperz9.superframe.organ"
    assert info["instrument"] == 1 and info["latency"] == 0


@pytest.mark.parametrize("fs", [48000, 44100])
def test_organ_equals_the_offline_organ_bit_for_bit(built, fs):
    y, _ = play(built, CHORDS, 256, 1.0, fs)
    want = reference(CHORDS, 1.0, fs)
    assert np.any(want != 0) and np.array_equal(y[:, 0], want) and np.array_equal(y[:, 1], want)
    late = [(s + 1 / fs, d, k) for s, d, k in CHORDS]
    assert not np.array_equal(y[:, 0], reference(late, 1.0, fs))                 # planted: one sample late
    assert not np.array_equal(y[:, 0], reference(CHORDS, 1.0, fs, k=0.05))       # planted: wrong wind constant


def test_program_change_draws_the_stops(built):
    stops = ["stopped flute 8", "nazard 2 2/3", "tierce 1 3/5"]
    bits = sum(1 << O.ORDER.index(s) for s in stops)
    y, _ = play(built, CHORDS, 256, 1.0, 48000, program=bits)
    assert np.array_equal(y[:, 0], reference(CHORDS, 1.0, 48000, stops))
    assert not np.array_equal(y[:, 0], reference(CHORDS, 1.0, 48000))           # planted: the default stops


def test_organ_block_size_changes_no_bit(built):
    runs = [play(built, CHORDS, b, 1.0, 48000)[0] for b in (64, 1000, 4096)]
    for y in runs[1:]:
        assert y.tobytes() == runs[0].tobytes()


def test_recurrence_oscillator_stays_on_the_sine():
    fs, f = 48000, 32.703                                 # C1, the lowest pitch of a 16' rank's key range here
    n = 10 * fs
    w = 2 * math.pi * f / fs
    y = O._osc(0.0, math.sin(w), 2 * math.cos(w), n)
    c = O._osc(1.0, -math.cos(w), 2 * math.cos(w), n)
    assert np.max(np.abs(y - np.sin(w * np.arange(n)))) < 1e-8                  # 4.6e-9 seen: -167 dB
    assert np.max(np.abs(y * y + c * c - 1.0)) < 1e-9                             # amplitude holds


def test_stored_table_is_a_fresh_derivation():
    for fs in T.RATES:
        a, b = T.read(fs), O.live_design(fs)
        assert a["release"] == b["release"]
        assert abs(a["attack"] - b["attack"]) < 1e-12 and abs(a["wind"] - b["wind"]) < 1e-12
        assert np.max(np.abs(np.array(a["open"]) - b["open"])) < 1e-12
        assert np.max(np.abs(np.array(a["stopped"]) - b["stopped"])) < 1e-12
        for si in range(len(O.ORDER)):
            for key in (21, 60, 108):
                (c1, s1, n1), (c2, s2, n2) = a["coef"](si, key), b["coef"](si, key)
                assert n1 == n2 and abs(c1 - c2) < 1e-12 and abs(s1 - s2) < 1e-12

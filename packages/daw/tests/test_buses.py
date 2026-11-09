# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Group buses and sidechain compression (daw/buses.py) inside the additive stems.

Known answers: the compressor's static curve puts a steady -6 dB detector at -15 dB out (threshold -18, ratio
4); the gain reduction reaches 1 - 1/e of its step at the attack time constant and falls to 1/e at the release
time constant once the detector's 20 ms hold has passed; a kick on a sidechain ducks a pad by the static curve's depth and leaves it bit-identical where
the kick is silent; a bus gain scales its members by exactly that gain; stems with buses still sum to the master
bit for bit. Planted controls: ratio 1 changes no sample; a missing stem breaks the sum; an unknown sidechain or
bus name is refused.
"""
import math
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import buses as B  # noqa: E402
from daw import stems as S  # noqa: E402
from daw.arrange import Arrangement, Note, Track  # noqa: E402

FS = 48000
COMP = B.Compressor(threshold_db=-18.0, ratio=4.0, attack=0.005, release=0.120)


@dataclass
class Sine:
    """A test instrument: a sine at the note's pitch, amplitude = velocity, for the note's length."""
    name: str = "sine"

    def play(self, note, fs, seconds_per_beat, rng):
        t = np.arange(int(round(note.beats * seconds_per_beat * fs))) / fs
        return note.velocity * np.sin(2 * math.pi * 440.0 * 2 ** ((note.pitch - 69) / 12) * t)


def piece(bus=None, sidechain=True, comp=COMP):
    kick = Track("kick", Sine(), [Note(1, 0.25, 36, 0.5), Note(3, 0.25, 36, 0.5)], send=0.0)
    pad = Track("pad", Sine(), [Note(0, 4, 60, 0.25)], send=0.0, bus=bus)
    keys = Track("keys", Sine(), [Note(0, 4, 67, 0.1)], send=0.0, bus=bus)
    buses = {} if bus is None else {bus: B.Bus(compressor=comp, sidechain="kick" if sidechain else None)}
    return Arrangement([kick, pad, keys], bpm=120, fs=FS, seconds=2.5, buses=buses)


def test_static_curve_puts_a_steady_level_on_the_ratio_line():
    g = B.gain_curve(np.full(FS, 10 ** (-6 / 20)), COMP, FS)
    out_db = -6.0 + 20 * math.log10(g[-1])
    assert abs(out_db - (COMP.threshold_db + (-6.0 - COMP.threshold_db) / COMP.ratio)) < 0.01      # -15 dB


def test_attack_and_release_time_constants():
    step = np.r_[np.zeros(FS // 10), np.full(FS // 2, 10 ** (-6 / 20)), np.zeros(FS)]
    g_db = 20 * np.log10(B.gain_curve(step, COMP, FS))
    on, off, depth = FS // 10, FS // 10 + FS // 2, -9.0
    assert abs(g_db[on + int(COMP.attack * FS)] / depth - (1 - math.exp(-1))) < 0.01
    base = off + (2 * (int(round(COMP.hold * FS)) // 2) + 1) - 2           # the last sample the hold still sees the step
    assert abs(g_db[base + int(COMP.release * FS)] / g_db[base] - math.exp(-1)) < 0.01


def test_ratio_one_changes_no_sample():
    plain, _ = S.render(piece(), np.random.default_rng(1))
    flat, _ = S.render(piece("pads", comp=B.Compressor(ratio=1.0)), np.random.default_rng(1))
    for k in plain:
        assert np.array_equal(plain[k], flat[k])                                        # planted: identity


def test_sidechain_ducks_the_pad_only_under_the_kick():
    plain, _ = S.render(piece(), np.random.default_rng(1))
    duck, info = S.render(piece("pads"), np.random.default_rng(1))
    beat = FS // 2
    assert np.array_equal(duck["pad"][:beat], plain["pad"][:beat])                    # kick silent: same bits
    assert np.array_equal(duck["kick"], plain["kick"])                                # the key is not ducked
    mid = slice(beat + beat // 8 - 480, beat + beat // 8 + 480)                        # 10 ms in the kick's middle
    ratio_db = 20 * math.log10(np.max(np.abs(duck["pad"][mid])) / np.max(np.abs(plain["pad"][mid])))
    want = -(-6.02 - COMP.threshold_db) * (1 - 1 / COMP.ratio)                         # kick at 0.5 peak: -8.98 dB
    assert abs(ratio_db - want) < 0.3
    assert abs(info["bus_min_gain_db"]["pads"] - want) < 0.3


def test_bus_gain_scales_members_exactly():
    plain, _ = S.render(piece(), np.random.default_rng(1))
    arr = piece("pads")
    arr.buses["pads"] = B.Bus(gain_db=-6.0)
    quiet, _ = S.render(arr, np.random.default_rng(1))
    g = 10 ** (-6.0 / 20)
    assert np.array_equal(quiet["pad"], plain["pad"] * g) and np.array_equal(quiet["kick"], plain["kick"])


def test_stems_with_buses_sum_to_the_master_bit_for_bit(tmp_path):
    stems, _ = S.render(piece("pads"), np.random.default_rng(1), target_lufs=-23.0)
    S.write(tmp_path, stems, FS, bits=32)
    assert S.check_sum(tmp_path) == {"equal": True, "max_abs_diff": 0.0}
    assert S.check_sum(tmp_path, leave_out="pad")["equal"] is False                   # planted: one stem missing


def test_unknown_names_are_refused():
    arr = piece("pads")
    arr.buses["pads"] = B.Bus(compressor=COMP, sidechain="snare")
    with pytest.raises(KeyError):
        S.render(arr, np.random.default_rng(1))
    arr = piece("pads")
    arr.tracks[1].bus = "strings"
    with pytest.raises(KeyError):
        S.render(arr, np.random.default_rng(1))

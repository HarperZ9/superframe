# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for G1 (additive stems), G2 (patch library), G6 (loudness in the DAW) and the waveguide
string as one recursive filter."""
import json
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import loudness as LD  # noqa: E402
from daw import materials as M  # noqa: E402
from daw import patches as P  # noqa: E402
from daw import stems as S  # noqa: E402
from daw import waveguide as W  # noqa: E402
from daw.arrange import Arrangement, Instrument, Note, Track  # noqa: E402
from daw.export import pcm_s16  # noqa: E402
from daw.room import Room  # noqa: E402
from daw.shapes_1d import Bar  # noqa: E402
from daw.voices import build  # noqa: E402

FS = 48000
BAR = {"shape": "Bar", "args": ["@aluminium", 0.3, 0.012], "kind": "strike", "x_in": [0.5], "x_out": [0.02],
       "tau": 1.2e-3, "tail": 1.0, "label": "bar"}


def small_piece(room=True):
    bar = Instrument("bar", Bar(M.material("aluminium"), 0.3, 0.012), "strike", (0.5,), (0.02,), 1.2e-3, 1.0)
    piano = build(P.patch("piano", "piano", {"t60": 3.0, "tail": 1.0}))
    floor = build(P.patch("floor", "floor", {"beta": 2.0, "tail": 0.0, "release_t60": 0.0}))
    tracks = [Track("bar", bar, [Note(0, 1, 69, 0.7), Note(2, 1, 72, 0.6)], pan=-0.3, send=0.4),
              Track("piano", piano, [Note(1, 2, 57, 0.6), Note(3, 1, 64, 0.5)], pan=0.2, send=0.3),
              Track("floor", floor, [Note(0, 6, 60, 0.05)], gain_db=-20, send=0.0)]
    return Arrangement(tracks, bpm=90, fs=FS, seconds=4.0, room=Room() if room else None)


@pytest.mark.parametrize("bits", [32, 24])
def test_written_stems_sum_to_the_written_master_bit_for_bit(tmp_path, bits):
    arr = small_piece()
    stems, info = S.render(arr, np.random.default_rng(7), target_lufs=-26.0)
    S.write(tmp_path, stems, FS, bits=bits)
    assert S.check_sum(tmp_path) == {"equal": True, "max_abs_diff": 0.0}
    planted = S.check_sum(tmp_path, leave_out="piano")      # the control: one stem missing must fail
    assert planted["equal"] is False and planted["max_abs_diff"] > 0
    assert info["room_gain"] > 0


def test_stems_carry_the_room_and_the_limiter():
    arr = small_piece()
    arr.ceiling = 0.05                                       # force the limiter to act
    stems, info = S.render(arr, np.random.default_rng(1))
    master = sum(stems.values())
    assert info["limiter_min_gain_db"] < -1.0
    assert np.max(np.abs(master)) <= 0.05 + 1e-12            # the limited sum, not each stem, meets the ceiling
    wet = S.render(small_piece(), np.random.default_rng(1))[0]["bar"]
    dry = S.render(small_piece(room=False), np.random.default_rng(1))[0]["bar"]
    room_part = wet - dry                                     # the bar's own room return lives in its stem
    assert np.sqrt(np.mean(room_part ** 2)) > 0.01 * np.sqrt(np.mean(dry ** 2))


def test_target_loudness_is_met_through_the_daw():
    stems, _ = S.render(small_piece(), np.random.default_rng(3), target_lufs=-28.0)
    assert LD.measure(sum(stems.values()), FS)["integrated_lufs"] == pytest.approx(-28.0, abs=0.05)


def test_full_scale_997hz_sine_reads_minus_3_01_lufs_through_the_daw():
    t = np.arange(FS * 5) / FS
    s = np.sin(2 * math.pi * 997 * t)
    mono = LD.measure(s[:, None], FS)
    assert mono["integrated_lufs"] == pytest.approx(-3.01, abs=0.02)
    assert mono["true_peak_dbtp"] == pytest.approx(0.0, abs=0.05)
    pair = LD.measure(np.stack([s, s], 1), FS)                 # two channels at weight 1 add 3.01 LU
    assert pair["integrated_lufs"] == pytest.approx(0.0, abs=0.02)


def test_patch_hash_is_stable_and_versions_are_never_rewritten(tmp_path):
    lib = P.Library(tmp_path)
    rec = P.patch("glass bar", "modal", BAR, track={"gain_db": -6, "pan": 0.1, "send": 0.4})
    h = lib.save(rec)
    assert h == P.digest(json.loads(json.dumps(rec))) and lib.save(rec) == h
    changed = P.patch("glass bar", "modal", dict(BAR, tau=2e-3))
    with pytest.raises(ValueError):
        lib.save(changed)
    lib.save(P.patch("glass bar", "modal", dict(BAR, tau=2e-3), version=2))
    assert lib.versions("glass bar") == [1, 2] and lib.load("glass bar")["params"]["tau"] == 2e-3
    assert [r[1] for r in lib.list()] == [1, 2]


def test_a_recalled_patch_renders_the_same_bytes_as_the_inline_instrument(tmp_path):
    lib = P.Library(tmp_path)
    lib.save(P.patch("bar", "modal", BAR))
    notes = [Note(0, 1, 69, 0.7), Note(1.5, 0.5, 76, 0.5)]
    inline = Track("bar", Instrument("bar", Bar(M.material("aluminium"), 0.3, 0.012), "strike", (0.5,), (0.02,),
                                     1.2e-3, 1.0), notes, pan=-0.2, send=0.3)
    recalled = P.track(lib.load("bar"), notes, pan=-0.2, send=0.3)
    out = []
    for tr in (inline, recalled):
        arr = Arrangement([tr], bpm=90, fs=FS, seconds=3.0, room=Room())
        stems, _ = S.render(arr, np.random.default_rng(11))
        out.append(pcm_s16(sum(stems.values())))
    assert out[0] == out[1]


def test_every_engine_sounds_at_its_pitch():
    for engine, params in (("piano", {"t60": 3.0}), ("rhodes", {"shore_a": 30}), ("pluck", {"t60": 2.0}),
                           ("bowed", {})):
        v = build(P.patch(engine, engine, dict(params, tail=0.5)))
        y = v.play(Note(0, 2, 57, 0.6), FS, 0.5, None)       # A3, 220 Hz, held 1 s
        seg = y[FS // 4: FS]
        sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), 1 << 18))
        fr = np.fft.rfftfreq(1 << 18, 1 / FS)
        band = (fr > 150) & (fr < 300)
        assert fr[band][np.argmax(sp[band])] == pytest.approx(220.0, rel=0.02), engine
        assert 0.5 < np.max(np.abs(y)) <= 0.6 + 1e-12, engine     # velocity sets the peak; the damper only lowers it


def test_inserts_run_on_the_track():
    rec = P.patch("p", "piano", {"t60": 2.0, "tail": 0.2}, inserts=[("gain", {"db": -6.0})])
    plain = P.patch("p", "piano", {"t60": 2.0, "tail": 0.2})
    arr = lambda r: Arrangement([P.track(r, [Note(0, 1, 60, 0.5)])], bpm=60, fs=FS, seconds=2.0)
    a = S.render(arr(rec), np.random.default_rng(0))[0]["p"]
    b = S.render(arr(plain), np.random.default_rng(0))[0]["p"]
    assert np.allclose(a, b * 10 ** (-6 / 20))


@pytest.mark.parametrize("f0", [55.0, 261.63, 1046.5])
def test_waveguide_filter_equals_the_sample_loop(f0):
    h = W.hammer(FS, 4e-3)
    a = W.string(f0, 1.0, FS, h, 3.0)
    b = W.string(f0, 1.0, FS, h, 3.0, fast=True)
    assert np.max(np.abs(a - b)) <= 1e-9 * np.max(np.abs(a))


def test_notes_carry_no_dc_offset():
    for engine in ("pluck", "piano"):
        y = build(P.patch(engine, engine, {"t60": 2.0, "tail": 0.5})).play(Note(0, 2, 52, 0.5), FS, 0.5, None)
        assert abs(float(np.mean(y))) < 1e-3 * float(np.max(np.abs(y))), engine
        assert np.max(np.abs(y)) == pytest.approx(0.5, rel=0.05)

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The CLAP instrument (clap/bars.c) played by a CLAP host (clap/host_check.c) against the offline reference.

Known answers: the plugin's output equals the BuildLang kernels driven offline, bit for bit, at any host block
size; a note sounds on its own sample and at its own pitch; the loss factor is the measured aluminium value.
Planted controls: a note one sample late, and a reference with the wrong loss factor, must both differ.
Skips with the reason where buildc or a C compiler is missing; the CI job that builds buildc must not skip.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import clap_build, clap_tables, native  # noqa: E402
from daw import dispersion as D  # noqa: E402
from daw import materials as M  # noqa: E402
from daw import waveguide as W  # noqa: E402

FS, VOICES, MODES, GAIN = 48000.0, 16, 12, 0.25
NOTES = [(100, 69, 1.0, 0), (600, 81, 0.5, 1), (30000, 57, 0.8, 0)]   # sample, key, velocity, sent as MIDI


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    why = clap_build.unavailable() or native.unavailable()
    if why and os.environ.get("DAW_REQUIRE_NATIVE"):
        pytest.fail(why)
    if why:
        pytest.skip(why)
    return clap_build.build(tmp_path_factory.mktemp("clap"))


def play(built, notes, block, seconds=1.0, index=0, fs=FS):
    plugin, host = built
    out = plugin.parent / f"out-{index}-{fs}-{block}-{len(notes)}-{notes[0][0]}.f32"
    args = [str(host), f"{plugin}#{index}", str(out), str(block), str(seconds), str(fs)]
    args += [f"{t}:{k}:{v}:{m}" for t, k, v, m in notes]
    r = subprocess.run(args, capture_output=True, text=True, check=True)
    y = np.fromfile(out, dtype=np.float32).reshape(-1, 2)
    return y, json.loads(r.stdout)


def reference(notes, seconds=1.0, eta=None):
    """The kernels driven offline: one bank call per stretch between notes, as the plugin splits its blocks."""
    eta = M.material("aluminium").eta if eta is None else eta
    total = int(seconds * FS)
    state = tuple(np.zeros(VOICES * MODES) for _ in range(5))
    hits, out, at, voice = -np.ones(VOICES), [], 0, 0
    for t, key, vel, midi in sorted(notes):
        out.append(native.bank_live(state, VOICES, MODES, hits, t - at)); at = t
        hits = -np.ones(VOICES)
        v = round(vel * 127) / 127 if midi else vel
        native.voice_set(state, voice, MODES, 440.0 * 2.0 ** ((key - 69) / 12), eta, v, FS)
        hits[voice] = 0.0
        voice = (voice + 1) % VOICES
    out.append(native.bank_live(state, VOICES, MODES, hits, total - at))
    return (GAIN * np.concatenate(out)).astype(np.float32)


def test_descriptor_is_an_instrument_with_no_latency(built):
    _, info = play(built, NOTES[:1], 256)
    assert info["id"] == "io.github.harperz9.superframe.bars"
    assert info["instrument"] == 1 and info["latency"] == 0


def test_plugin_equals_the_offline_reference_bit_for_bit(built):
    y, _ = play(built, NOTES, 256)
    want = reference(NOTES)
    assert np.array_equal(y[:, 0], want) and np.array_equal(y[:, 1], want)
    late = [(t + 1, k, v, m) for t, k, v, m in NOTES]
    assert not np.array_equal(y[:, 0], reference(late))                        # planted: one sample late
    assert not np.array_equal(y[:, 0], reference(NOTES, eta=2 * M.material("aluminium").eta))   # planted: wrong loss


def test_host_block_size_changes_no_bit(built):
    runs = [play(built, NOTES, b)[0] for b in (64, 256, 1000, 4096)]
    for y in runs[1:]:
        assert y.tobytes() == runs[0].tobytes()


def test_note_sounds_on_its_sample_and_pitch(built):
    y, _ = play(built, [(100, 69, 1.0, 0)], 128)
    x = y[:, 0].astype(np.float64)
    assert int(np.flatnonzero(x)[0]) == 100                                     # struck on the event's sample
    seg = x[100:100 + 32768] * np.hanning(32768)
    spec = np.abs(np.fft.rfft(seg, 1 << 19))
    k = int(np.argmax(spec[: int(1000 * (1 << 19) / FS)]))
    f = k * FS / (1 << 19)
    assert abs(f / 440.0 - 1) < 1e-3                                            # A4 is 440 Hz


# The piano (clap/piano.c): the offline stiff string, note for note.

PIANO = [(50, 21, 0.9, 0), (700, 60, 0.7, 0), (2000, 64, 1.0, 1), (2001, 67, 0.5, 0), (9000, 108, 0.8, 0)]


def piano_reference(notes, seconds, fs):
    """dispersion.stiff_loop with the table's loop and hammer for every note, placed and summed in voice order."""
    total = int(seconds * fs)
    out = np.zeros(total)
    rows, ham = clap_tables.read(fs)
    h = np.array(ham)
    for t, key, vel, midi in notes:                      # fewer than 16 notes: voice order is note order
        v = round(vel * 127) / 127 if midi else vel
        y = D.stiff_loop(rows[key], (total - t) / fs + 0.01, fs, h * v)
        out[t:] += y[:total - t]
    return (GAIN * out).astype(np.float32)


@pytest.mark.parametrize("fs", [48000, 44100])
def test_piano_equals_the_offline_stiff_string_bit_for_bit(built, fs):
    y, info = play(built, PIANO, 256, 0.5, index=1, fs=fs)
    assert info["id"] == "io.github.harperz9.superframe.piano" and info["latency"] == 0
    want = piano_reference(PIANO, 0.5, fs)
    assert np.array_equal(y[:, 0], want) and np.array_equal(y[:, 1], want)
    late = [(t + 1, k, v, m) for t, k, v, m in PIANO]
    assert not np.array_equal(y[:, 0], piano_reference(late, 0.5, fs))          # planted: one sample late


def test_piano_block_size_changes_no_bit(built):
    runs = [play(built, PIANO, b, 0.5, index=1)[0] for b in (64, 1000)]
    assert runs[0].tobytes() == runs[1].tobytes()


def test_piano_table_is_the_offline_design():
    for fs in clap_tables.RATES:
        rows, ham = clap_tables.read(fs)
        assert np.max(np.abs(np.array(ham) - W.hammer(fs, clap_tables.CONTACT))) < 1e-12
        for key in (21, 60, 108):
            n, t, g, a, m = clap_tables.row(key, fs)
            r = rows[key]
            assert (r[0], r[4]) == (n, m)
            assert np.max(np.abs(np.array(r[1:4]) - [t, g, a])) < 1e-9


def test_stored_loop_is_the_stiff_string_here():
    fs, key = 48000, 60
    y = D.stiff_loop(clap_tables.row(key, fs), 0.2, fs, W.hammer(fs, clap_tables.CONTACT))
    want = D.stiff_string(clap_tables.f0_of(key), 0.2, fs, W.hammer(fs, clap_tables.CONTACT), clap_tables.T60,
                          D.piano_b(key))
    assert np.array_equal(y, want)


def test_buildlang_string_equals_the_offline_loop():
    """bld/string.bld called straight from Python, in two calls to carry its state, against dispersion.stiff_loop."""
    why = native.unavailable()
    if why and os.environ.get("DAW_REQUIRE_NATIVE"):
        pytest.fail(why)
    if why:
        pytest.skip(why)
    fs, key, vel = 48000, 60, 0.7
    rows, ham = clap_tables.read(fs)
    n, t, g, a, m = rows[key]
    sos = [[g * t, g, 0.0, 1.0, t, 0.0], [0.5, 0.5, 0.0, 1.0, 0.0, 0.0]] + [[a, 1.0, 0.0, 1.0, a, 0.0]] * m

    def run(v):
        state = native.string_state(2048, len(sos))
        return np.concatenate([native.string_block(state, sos, ham, v, n, 1000),
                               native.string_block(state, sos, ham, v, n, 8600)])
    y = run(vel)
    want = D.stiff_loop(rows[key], 0.2, fs, np.array(ham) * vel)[:9600]
    assert len(want) == 9600 and np.array_equal(y, want)
    assert not np.array_equal(run(np.nextafter(vel, 1.0)), want)                # planted: velocity one ulp high

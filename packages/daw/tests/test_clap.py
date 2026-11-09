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
from daw import clap_build, native  # noqa: E402
from daw import materials as M  # noqa: E402

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


def play(built, notes, block, seconds=1.0):
    plugin, host = built
    out = plugin.parent / f"out-{block}-{len(notes)}-{notes[0][0]}.f32"
    args = [str(host), str(plugin), str(out), str(block), str(seconds), str(FS)]
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

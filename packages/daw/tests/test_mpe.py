# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Per-note expression on the CLAP bars (clap/bars.c, bld/mpe.bld): CLAP note-expression tuning and MPE pitch bend.

Known answers: the plugin equals the BuildLang kernels driven offline (voice_set at each note, voice_retune at
each expression) bit for bit; a +2 semitone tuning moves A4 to 493.88 Hz; an MPE bend on one member channel
bends only that channel's note. Planted controls: the expression one sample late, and the bend sent to the other
channel, must both differ.
"""
import math
import os
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import clap_build, native  # noqa: E402
from daw import materials as M  # noqa: E402

FS, VOICES, MODES, GAIN, RANGE = 48000.0, 16, 12, 0.25, 48.0


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    why = clap_build.unavailable() or native.unavailable()
    if why and os.environ.get("DAW_REQUIRE_NATIVE"):
        pytest.fail(why)
    if why:
        pytest.skip(why)
    return clap_build.build(tmp_path_factory.mktemp("mpe"))


def play(built, events, seconds=1.0):
    import subprocess
    plugin, host = built
    out = plugin.parent / f"mpe-{abs(hash(tuple(events)))}.f32"
    subprocess.run([str(host), f"{plugin}#0", str(out), "256", str(seconds), str(int(FS)), *events],
                   capture_output=True, text=True, check=True)
    return np.fromfile(out, dtype=np.float32).reshape(-1, 2)[:, 0]


def reference(script, seconds=1.0):
    """script: (sample, op, args) in time order; op 'on' (key, velocity, channel) or 'tune' (voice, key)."""
    eta = M.material("aluminium").eta
    total = int(seconds * FS)
    state = tuple(np.zeros(VOICES * MODES) for _ in range(5))
    hits, out, at, voice = -np.ones(VOICES), [], 0, 0
    for t, op, args in script:
        out.append(native.bank_live(state, VOICES, MODES, hits, t - at)); at = t
        hits = -np.ones(VOICES)
        if op == "on":
            key, vel = args
            native.voice_set(state, voice, MODES, 440.0 * 2.0 ** ((key - 69) / 12), eta, vel, FS)
            hits[voice] = 0.0
            voice += 1
        else:
            v, key = args
            native.voice_retune(state, v, MODES, key, eta, FS)
    out.append(native.bank_live(state, VOICES, MODES, hits, total - at))
    return (GAIN * np.concatenate(out)).astype(np.float32)


def peak_hz(x, lo, hi):
    n = 1 << 19
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x)), n))
    k0, k1 = int(lo * n / FS), int(hi * n / FS)
    return (k0 + int(np.argmax(spec[k0:k1]))) * FS / n


def test_note_expression_tuning_bends_the_ringing_bar(built):
    y = play(built, ["100:69:1.0", "12000:69:2.0:0:3"])
    want = reference([(100, "on", (69, 1.0)), (12000, "tune", (0, 71.0))])
    assert np.array_equal(y, want)
    late = reference([(100, "on", (69, 1.0)), (12001, "tune", (0, 71.0))])
    assert not np.array_equal(y, late)                                           # planted: one sample late
    before = peak_hz(y[100:12000].astype(float), 400, 520)
    after = peak_hz(y[14000:46000].astype(float), 400, 520)
    assert abs(before / 440.0 - 1) < 2e-3 and abs(after / (440.0 * 2 ** (2 / 12)) - 1) < 1e-3


def test_mpe_bend_moves_only_its_channel(built):
    bend = 8192 + 341                                                            # 341 / 8192 x 48 = 1.998 semitones
    semis = 341 / 8192 * RANGE
    y = play(built, ["100:69:1.0:2:0", "200:76:1.0:3:0", f"9000:1:{bend}:0:4"])   # notes on channels 1 and 2
    want = reference([(100, "on", (69, 1.0)), (200, "on", (76, 1.0)), (9000, "tune", (0, 69.0 + semis))])
    assert np.array_equal(y, want)
    other = reference([(100, "on", (69, 1.0)), (200, "on", (76, 1.0)), (9000, "tune", (1, 76.0 + semis))])
    assert not np.array_equal(y, other)                                          # planted: the other channel bent

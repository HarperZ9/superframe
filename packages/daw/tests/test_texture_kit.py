# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for G11 (granular and freeze), G10 (sampler over our own renders) and G13 (electronic kit)."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import granular as G  # noqa: E402
from daw import kit as K  # noqa: E402
from daw import patches as P  # noqa: E402
from daw import sampler as SM  # noqa: E402
from daw.arrange import Note  # noqa: E402
from daw.voices import build  # noqa: E402

FS = 48000


def tones(freqs, seconds=2.0, fs=FS):
    t = np.arange(int(seconds * fs)) / fs
    return sum(np.sin(2 * math.pi * f * t) / (k + 1) for k, f in enumerate(freqs)) * 0.3


def peaks(y, fs, count):
    sp = np.abs(np.fft.rfft(y * np.hanning(len(y)), 1 << 20))
    f = np.fft.rfftfreq(1 << 20, 1 / fs)
    out = []
    for _ in range(count):
        i = int(np.argmax(sp))
        out.append(f[i])
        sp[max(0, i - 400):i + 400] = 0
    return sorted(out)


def test_freeze_keeps_the_partials_within_one_percent():
    src = tones((220.0, 330.0, 550.0))
    y = G.freeze(src, FS, 0.5, 4.0, np.random.default_rng(1), blur=0.1)
    got = peaks(y[FS:3 * FS], FS, 3)
    for g, want in zip(got, (220.0, 330.0, 550.0)):
        assert g == pytest.approx(want, rel=0.01)
    assert np.sqrt(np.mean(y[FS:] ** 2)) == pytest.approx(np.sqrt(np.mean(src ** 2)), rel=0.25)


def test_cloud_keeps_pitch_without_spread_and_is_stereo():
    src = tones((440.0,), 3.0)
    y = G.cloud(src, FS, 3.0, np.random.default_rng(2), density=40, size=0.15, position=0.5, jitter=0.4)
    assert peaks(y[:, 0] + y[:, 1], FS, 1)[0] == pytest.approx(440.0, rel=0.01)
    assert np.corrcoef(y[:, 0], y[:, 1])[0, 1] < 0.95


def test_cloud_spread_widens_the_spectrum():
    src = tones((440.0,), 3.0)
    def width(spread):
        y = G.cloud(src, FS, 3.0, np.random.default_rng(3), density=60, size=0.1, position=0.5, spread=spread)
        sp = np.abs(np.fft.rfft(y[:, 0], 1 << 18)) ** 2
        f = np.fft.rfftfreq(1 << 18, 1 / FS)
        band = (f > 300) & (f < 640)
        mean = np.sum(f[band] * sp[band]) / np.sum(sp[band])
        return math.sqrt(np.sum((f[band] - mean) ** 2 * sp[band]) / np.sum(sp[band]))
    assert width(150.0) > 2 * width(0.0)


@pytest.fixture
def render_file(tmp_path):
    p = tmp_path / "our-render.wav"
    sf.write(str(p), np.stack([tones((220.0,), 2.0)] * 2, 1), FS, subtype="FLOAT")
    return p, SM.file_sha256(p)


def test_sampler_refuses_a_hash_mismatch(render_file):
    p, h = render_file
    with pytest.raises(ValueError):
        SM.load(p, "0" * 64)
    assert SM.load(p, h).source_sha256 == h


@pytest.mark.parametrize("keep_time", [True, False])
def test_a_planted_three_semitone_shift_reads_back_within_5_cents(render_file, keep_time):
    p, h = render_file
    s = SM.slice_(SM.load(p, h), 0.2, 1.8)
    y = SM.pitch(s, 3.0, keep_time=keep_time)
    got = SM.peak_frequency(y.data[2048:-2048], FS)
    assert abs(1200 * math.log2(got / (220.0 * 2 ** 0.25))) < 5
    assert y.provenance()["source_sha256"] == h
    if keep_time:
        assert len(y.data) == len(s.data)


def test_every_chop_slice_carries_its_source_and_place(render_file):
    p, h = render_file
    sl = SM.chop(SM.load(p, h), bpm=120, bars=1, division=8)
    assert len(sl) == 8 and all(x.source_sha256 == h for x in sl)
    assert [x.start for x in sl] == [int(k * 0.25 * FS) for k in range(8)]
    assert all(abs(x.data[0]) < 1e-9 and abs(x.data[-1]) < 1e-3 for x in sl)   # faded: no click at the cut


def test_sampler_engine_plays_our_render_at_the_note(render_file):
    p, h = render_file
    v = build(P.patch("s", "sampler", {"path": str(p), "sha256": h, "root": 57, "tail": 0.0, "release_t60": 0.0}))
    y = v.play(Note(0, 2, 60, 0.5), FS, 0.5, None)
    assert abs(1200 * math.log2(SM.peak_frequency(y[2048:FS // 2], FS) / (220.0 * 2 ** 0.25))) < 5


def test_bass_drum_decay_and_glide_read_back_within_5_percent():
    y = K.bass_drum(FS, 2.0, f_start=120.0, f_end=48.0, glide_tau=0.05, decay=1.2, attack_ms=0.0)
    assert K.decay_time(y, FS) == pytest.approx(1.2, rel=0.05)
    f = K.instantaneous_frequency(y, FS)
    t = np.arange(len(f)) / FS
    assert f[(t > 0.5) & (t < 1.0)].mean() == pytest.approx(48.0, rel=0.05)      # where the glide ends
    cycles = np.sum(f[(t > 0.01) & (t < 0.2)]) / FS                          # cycles from 10 to 200 ms
    model = 48 * 0.19 + 72 * 0.05 * (math.exp(-0.01 / 0.05) - math.exp(-0.2 / 0.05))
    assert cycles == pytest.approx(model, rel=0.05)
    assert abs(cycles - 48 * 0.19) > 0.2 * 48 * 0.19                         # the glide is really there


def test_hat_is_bright_and_short():
    y = K.hat(FS, np.random.default_rng(0), 0.4, decay=0.06)
    sp = np.abs(np.fft.rfft(y)) ** 2
    f = np.fft.rfftfreq(len(y), 1 / FS)
    assert np.sum(sp[f > 3000]) > 0.9 * np.sum(sp)
    assert K.decay_time(y, FS, smooth_ms=2.0) == pytest.approx(0.06, rel=0.25)


@pytest.mark.parametrize("division", [8, 16, 32])
def test_roll_onsets_land_within_1_ms(division):
    bpm, fs = 70.0, FS
    notes = K.roll(4.0, 2.0, division, v0=0.2, v1=0.5)
    spb = 60.0 / bpm
    for i, n in enumerate(notes):
        want = (4.0 + i * 4.0 / division) * spb
        sample = int(round(n.beat * 60.0 * fs / bpm))
        assert abs(sample / fs - want) < 1e-3
    assert notes[0].velocity == pytest.approx(0.2) and notes[-1].velocity == pytest.approx(0.5)
    assert len(notes) == int(2.0 / (4.0 / division))


@pytest.mark.parametrize("seconds", [0.4, 0.5142857, 0.3333333])
def test_hat_renders_any_length(seconds):
    y = K.hat(FS, np.random.default_rng(1), seconds)
    assert len(y) == int(seconds * FS) and np.all(np.isfinite(y))

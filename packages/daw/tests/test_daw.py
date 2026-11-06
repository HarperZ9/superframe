# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The workstation layers: synthesis, arrangement, mixer, export, receipt, determinism, materials, contract."""
import hashlib
import math
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import materials as M  # noqa: E402
from daw import superstack as ss  # noqa: E402
from daw.arrange import Arrangement, Envelope, Instrument, Note, Track, render_track  # noqa: E402
from daw.export import pcm_s16, receipt, write  # noqa: E402
from daw.mixer import limit, mix, pan_gains, place  # noqa: E402
from daw.shapes_1d import Bar  # noqa: E402
from daw.synth import render  # noqa: E402

FS = 48000
SUPERSTACK_V020 = "d5f86b29354a43e676d3d2db7005150b100427137e7708be9841f1e7d5589353"
BL_AUDIO_SHA256 = "f192909851b2a4d5bc85e502cb04cc47e04b0fa8116a8c36809500699fd6d054"   # buildlang runtime/audio


def test_vendored_superstack_is_the_pinned_release():
    data = (Path(__file__).resolve().parents[1] / "daw" / "superstack.py").read_bytes().replace(b"\r\n", b"\n")
    assert hashlib.sha256(data).hexdigest() == SUPERSTACK_V020


def test_vendored_audio_binding_is_buildlangs():
    data = (Path(__file__).resolve().parents[1] / "bld" / "bl_audio.c").read_bytes().replace(bytes([13, 10]), bytes([10]))
    assert hashlib.sha256(data).hexdigest() == BL_AUDIO_SHA256


def test_strike_spectrum_peaks_at_the_modes_and_decays_at_t60():
    m = Bar(M.material("aluminium"), 0.3, 0.012).modes(3)
    y = render(m, FS, 2.0, (0.2,), (0.02,), "strike", 0.5e-3)   # not at 0.5: mode 2 has a node there
    spec = np.abs(np.fft.rfft(y * np.hanning(len(y))))
    fr = np.fft.rfftfreq(len(y), 1 / FS)
    for f in m.freqs[:2]:
        band = (fr > f * 0.97) & (fr < f * 1.03)
        assert abs(fr[band][np.argmax(spec[band])] - f) < 1.0
    env = np.abs(render(Bar(M.material("aluminium"), 0.3, 0.012).modes(1), FS, 2.0, (0.5,), (0.02,), "pluck"))
    a, b = env[int(0.2 * FS):int(0.21 * FS)].max(), env[int(1.2 * FS):int(1.21 * FS)].max()
    want_db = 20 * math.log10(math.e) * math.pi * m.freqs[0] * M.material("aluminium").eta * 1.0
    assert abs(20 * math.log10(a / b) - want_db) < 0.2


def test_pan_law_is_constant_power():
    for p in np.linspace(-1, 1, 21):
        l, r = pan_gains(p)
        assert abs(l ** 2 + r ** 2 - 1) < 1e-12
    st = place(np.ones(4), 0.0, -1.0)
    assert np.allclose(st[:, 0], 1) and np.allclose(st[:, 1], 0, atol=1e-15)


def test_notes_land_on_the_exact_sample():
    arr = Arrangement([], bpm=120.0, fs=FS, seconds=4.0)
    imp = Instrument("probe", Bar(M.material("steel_mild"), 0.3, 0.01), "strike", (0.5,), (0.5,), 1 / FS, 0.0)
    tr = Track("probe", imp, [Note(3.0, 0.001, 69, 1.0)])
    buf = render_track(arr, tr, np.random.default_rng(0))
    assert np.flatnonzero(buf)[0] == 3 * 24000                     # beat 3 at 120 bpm = 1.5 s
    assert arr.sample_of(0.5) == 12000 and arr.sample_of(2.75) == 66000


def test_gain_automation_is_sampled_per_sample():
    env = Envelope([(0.0, -12.0), (1.0, 0.0)])
    g = env.sample(FS + 1, FS)
    assert g[0] == -12.0 and g[FS] == 0.0 and abs(g[FS // 2] + 6.0) < 1e-3


def test_limiter_never_passes_the_ceiling():
    x = np.random.default_rng(2).standard_normal((FS, 2)) * 2.0
    y, gain = limit(x, 0.9, FS)
    assert np.max(np.abs(y)) <= 0.9 + 1e-12 and gain.min() < 0.5


def test_two_tracks_mix_to_their_sum_without_room():
    inst = Instrument("bar", Bar(M.material("aluminium"), 0.3, 0.012), "strike", (0.5,), (0.03,), 1e-3, 0.5)
    t1 = Track("a", inst, [Note(0, 1, 69, 0.3)], pan=-0.5)
    t2 = Track("b", inst, [Note(1, 1, 72, 0.3)], pan=0.5)
    arr = Arrangement([t1, t2], seconds=2.0, ceiling=10.0)
    stems = {}
    out = mix(arr, np.random.default_rng(1), stems)
    assert np.allclose(out, stems["a"] + stems["b"], atol=1e-12)


def test_wav_and_flac_round_trip(tmp_path):
    x = np.random.default_rng(4).uniform(-0.9, 0.9, (4800, 2))
    pcm = write(tmp_path / "a.wav", x, FS)
    assert pcm == pcm_s16(x) and pcm[:16] == ss.quantize_s16(x.reshape(-1)[:8])   # the superstack rule
    y16, fs = sf.read(tmp_path / "a.wav", dtype="int16")
    assert fs == FS and np.array_equal(y16.reshape(-1), np.frombuffer(pcm, "<i2"))
    write(tmp_path / "b.wav", x, FS, "wav", 24)
    assert np.max(np.abs(sf.read(tmp_path / "b.wav")[0] - x)) < 2.0 / 2 ** 23
    write(tmp_path / "c.flac", x, FS, "flac", 16)
    assert np.array_equal(sf.read(tmp_path / "c.flac", dtype="int16")[0], sf.read(tmp_path / "a.wav", dtype="int16")[0])
    write(tmp_path / "d.wav", x, FS, "wav", 32)
    assert np.max(np.abs(sf.read(tmp_path / "d.wav")[0] - x)) < 1e-7


def test_receipt_verifies_and_rejects_tampering():
    pcm = pcm_s16(np.zeros((48, 2)))
    scene = {"kind": "superstack.sound/1", "seed": "s", "rate": FS, "channels": 2, "duration_samples": 48}
    rec = receipt(scene, pcm, FS, 48)
    assert ss.verify_receipt(rec) == [] and rec["content_sha256"] == hashlib.sha256(pcm).hexdigest()
    bad = dict(rec, content_sha256="0" * 64)
    assert ss.verify_receipt(bad) != []


def test_demo_is_deterministic(tmp_path):
    from daw.demo import render_demo
    a, _ = render_demo(tmp_path / "a", "unit-seed", 3.0)
    b, _ = render_demo(tmp_path / "b", "unit-seed", 3.0)
    c, _ = render_demo(tmp_path / "c", "other-seed", 3.0)
    assert a["content_sha256"] == b["content_sha256"] != c["content_sha256"]
    assert (tmp_path / "a" / "demo.wav").read_bytes() == (tmp_path / "b" / "demo.wav").read_bytes()


def test_materials_carry_provenance_and_agree_with_wikidata():
    al = M.material("aluminium")
    assert al.status["E"] == "measured" and al.status["rho"] == "derived" and al.status["eta"] == "measured"
    assert M.material("brass").status["eta"] == "from_memory"            # no recording of a brass bar yet
    x = M.crosscheck()
    for key, mine in (("steel_mild.density", M.material("steel_mild").rho), ("aluminium.density", al.rho),
                      ("brass.density", M.material("brass").rho), ("copper.density", M.material("copper").rho)):
        assert abs(mine / x[key] - 1) < 0.015, key
    assert abs(M.material("steel_mild").E / x["steel_mild.youngs_modulus"] - 1) < 0.02
    assert abs(M.material("brass").nu / x["brass.poisson_ratio"] - 1) < 0.06
    assert abs(M.material("brass").E / x["brass.youngs_modulus"] - 1) > 0.1   # a real 13 % disagreement, kept


def test_measured_loss_factors_and_the_decay_fit():
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "measured" / "build"))
    import b_decay
    t = M.table()
    al, st = t["aluminium.eta_measured"], t["steel_mild.eta_measured"]
    assert al["iqr"][0] <= al["value"] <= al["iqr"][1] and al["n"] >= 10 and st["n"] >= 10
    assert not al["iqr"][0] <= 1e-4 <= al["iqr"][1]                    # the old from-memory value is outside
    fs, f0, a0 = 44100, 523.0, 0.8                                       # planted: one partial, alpha 0.8 /s
    tt = np.arange(int(8 * fs)) / fs
    x = np.exp(-a0 * tt) * np.sin(2 * np.pi * f0 * tt) + 1e-6 * np.random.default_rng(5).standard_normal(len(tt))
    rows = b_decay.note_rows(x, fs, "planted", 0)
    assert len(rows) == 1 and abs(rows[0]["alpha"] / a0 - 1) < 0.02
    assert abs(rows[0]["eta"] - a0 / (np.pi * rows[0]["f_hz"])) < 1e-6

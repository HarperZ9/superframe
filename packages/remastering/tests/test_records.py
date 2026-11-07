# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Decode, source condition, provenance map and plate, receipts, edition generations, transcription and
resynthesis, the layer split, and the deterministic split (skipped with the reason when torch, Demucs or the pinned
weights are absent)."""
import importlib.util
import json
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from remastering import audio, condition, edition, layers, provenance, resynth, split  # noqa: E402
from remastering import receipts as RC  # noqa: E402
from remastering import transcribe as TR  # noqa: E402

FS = 44100


def tones(seconds=6.0, seed=0):
    rng = np.random.default_rng(seed)
    n = int(seconds * FS)
    t = np.arange(n) / FS
    y = np.zeros(n)
    for k in range(int(seconds * 4)):
        f0 = 220 * 2 ** (rng.integers(0, 12) / 12)
        s = int(k / 4 * FS)
        tt = t[: n - s]
        y[s:] += sum(0.5 ** h * np.sin(2 * math.pi * f0 * (h + 1) * tt) for h in range(8)) * np.exp(-tt * 8)
    y += 0.01 * rng.standard_normal(n)
    return np.stack([y, y]) / np.abs(y).max() * 0.7


def ffmpeg_ok():
    return audio.ffmpeg()[0] is not None


@pytest.mark.skipif(not ffmpeg_ok(), reason="imageio-ffmpeg not installed")
def test_decode_reads_a_lossy_file_and_its_condition(tmp_path):
    x = tones()
    p = tmp_path / "a.mp3"
    audio.encode(p, x, FS, ["-c:a", "libmp3lame", "-b:a", "96k"])
    y, fs, rep = audio.decode(p)
    assert fs == FS and rep["probe"]["codec"].startswith("mp3") and rep["probe"]["bitrate_kbps"] == 96
    c = condition.report(y, fs, rep)
    assert c["lossy_signature"] and c["cutoff_hz"] < 17500


@pytest.mark.skipif(not ffmpeg_ok(), reason="imageio-ffmpeg not installed")
def test_truncated_corrupt_stream_decodes_what_survives(tmp_path):
    x = tones(10.0)
    p = tmp_path / "b.mp3"
    audio.encode(p, x, FS, ["-c:a", "libmp3lame", "-b:a", "192k"])
    good, _ = audio.load(p)
    b = bytearray(p.read_bytes())
    cut = int(len(b) * 0.6)
    b = b[: cut // 2] + bytes(np.random.default_rng(1).integers(0, 256, 2048, dtype=np.uint8)) + b[cut // 2 + 2048: cut]
    q = tmp_path / "b-damaged.mp3"
    q.write_bytes(bytes(b))
    y, _, rep = audio.decode(q)
    assert 0.5 < y.shape[1] / good.shape[1] < 0.62
    head = int(0.4 * y.shape[1])
    assert np.array_equal(y[:, :head], good[:, :head])                # before the damage: identical samples


def test_condition_flags_clipping_and_dropouts():
    x = tones()
    x = np.clip(x, -0.3, 0.3)
    x[:, FS:FS + 2000] = 0.0
    c = condition.report(x, FS)
    assert c["clipped_share"] > 0.01
    assert c["dropouts"] and abs(c["dropouts"][0][0] - 1.0) < 0.01


def test_provenance_marks_and_plate(tmp_path):
    m = provenance.Map(10.0)
    m.mark(1.0, 2.0, "restored", 0.8, "declick")
    m.mark(5.0, 6.0, "inferred", 0.4, "long-gap")
    m.mark(5.5, 6.0, "restored", 0.9, "declick")                    # a milder mark never hides an inference
    m.mark(0.0, 10.0, "inferred", 0.3, "bandwidth", f0=16000)
    s = m.summary()
    assert s["inferred"] > 0 and s["restored"] > 0 and s["resynthesized"] == 0
    assert m.kind[0, 55] == provenance.KINDS.index("inferred") and m.conf[0, 55] <= 0.4
    assert (m.kind[-1] == provenance.KINDS.index("inferred")).all()
    p = provenance.plate(m, tmp_path / "plate.png")
    from PIL import Image
    assert Image.open(p).size[0] > 1000


def test_receipts_verify_and_detect_tampering():
    r = RC.make("x", {"a": "00"}, {"k": 1}, {"o": "11"})
    assert RC.verify(r)
    r["settings"]["k"] = 2
    assert not RC.verify(r)


def test_edition_generations_and_diff(tmp_path, monkeypatch):
    monkeypatch.setenv("REMASTER_LIBRARY", str(tmp_path))
    x = tones()
    for gain in (0.5, 0.25):
        g, d = edition.next_generation("t")
        y = x * gain
        audio.save(d / "master.flac", y, FS, "PCM_24")
        rec = {"generation": g, "settings": {"gain": gain}, "loudness_after": {"integrated_lufs": 20 * math.log10(gain)},
               "spectrum_after": edition.spectrum_summary(y, FS), "provenance_summary": {"original": 1.0},
               "master_sha256": RC.sha256_file(d / "master.flac"), "chain_receipt_sha256": "0", "written_utc": "now"}
        edition.write("t", d, rec)
    cat = json.loads((tmp_path / "t" / "catalogue.json").read_text())
    assert [e["generation"] for e in cat] == [1, 2]
    df = edition.diff("t", 1, 2)
    assert df["settings_changed"] == {"gain": [0.5, 0.25]}
    assert abs(df["loudness_delta"]["integrated_lufs"] - (-6.02)) < 0.01


def test_transcriber_on_known_notes_and_resynthesis():
    rng = np.random.default_rng(1)
    truth = [[0.25 * i + 0.1, 0.22, int(60 + rng.integers(0, 12)), 0.8] for i in range(20)]
    prof = {"harmonics_db": [-6.0 * h for h in range(16)], "attack_s": 0.005, "decay_db_per_s": -20.0,
            "noise_db": [-60.0] * 24}
    y = resynth.spectral_model(truth, prof, FS, int(6 * FS))
    est = TR.notes(y, FS)
    assert TR.note_f1(truth, est)["f1"] >= 0.9
    p = resynth.profile(y[None, :], FS, est)
    assert abs(p["harmonics_db"][1] - (-6.0)) < 1.5
    z, inst = resynth.physical_model(est, p, FS, len(y))
    assert inst in resynth.INSTRUMENTS and np.abs(z).max() > 0


def test_layers_sum_to_the_stem_and_carry_roles():
    x = tones()
    L = layers.split_layers(x, FS, device="cpu")
    assert np.abs(sum(L.values()) - x).max() < 1e-4
    out = layers.decompose({"piano": x}, FS, x)
    assert set(out["piano"]) == {"transient", "sustained", "moving"}
    assert all("role" in v for v in out["piano"].values())


def _split_ready(stems):
    if importlib.util.find_spec("torch") is None or importlib.util.find_spec("demucs") is None:
        return "torch or demucs not installed"
    return split.available(stems)


@pytest.mark.parametrize("stems", [4, 6])
def test_split_repeats_bit_for_bit(stems):
    why = _split_ready(stems)
    if why:
        pytest.skip(why)
    x = tones(8.0)
    a, ra = split.separate(x, FS, stems=stems)
    b, rb = split.separate(x, FS, stems=stems)
    assert ra["outputs"] == rb["outputs"]
    name = split.BY_STEMS[stems]
    assert ra["settings"]["model"] == name
    assert ra["models"] == split.MODELS[name]["files"]
    assert list(a) == split.MODELS[name]["sources"]
    assert all(v.shape == x.shape and np.isfinite(v).all() for v in a.values())   # stems need not sum to the mix: the chain adds the residual back


def test_split_needs_configured_weights(monkeypatch, tmp_path):
    monkeypatch.delenv("REMASTER_MODELS", raising=False)
    with pytest.raises(split.WeightsNotConfigured):
        split.model_dirs()
    assert "REMASTER_MODELS" in split.available(4)
    monkeypatch.setenv("REMASTER_MODELS", str(tmp_path))
    assert "not found" in split.available(6)
    with pytest.raises(ValueError):
        split.model_name(5)


def test_split_model_table_is_pinned():
    assert split.BY_STEMS == {4: "htdemucs_ft", 6: "htdemucs_6s"}
    assert split.MODELS["htdemucs_ft"]["sources"] == ["drums", "bass", "other", "vocals"]
    assert split.MODELS["htdemucs_6s"]["sources"][4:] == ["guitar", "piano"]
    for fname, sha in split.PINNED.items():
        assert len(sha) == 64 and sha.startswith(fname.split("-")[1].split(".")[0])   # Demucs names a file by its hash


def test_library_needs_configuring(monkeypatch):
    monkeypatch.delenv("REMASTER_LIBRARY", raising=False)
    with pytest.raises(edition.LibraryNotConfigured):
        edition.library()

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Vault and SPEC records: known answers on planted inputs."""
import json
import os
import stat

from cleanroom import decompose, safety, sources
from cleanroom.config import Layout


def test_records_carry_required_fields(world):
    v = world["vault"]
    sha = world["shas"]["pic0.md"][0]
    rec = v.record(sha)
    assert rec["tier"] == "copy"
    assert rec["licence"] == "unknown"
    assert rec["media_type"] == "image/jpeg"
    assert rec["original_url"] == "https://example.org/m/1.jpg"
    assert rec["post"] == "https://example.org/p/1"
    assert rec["save_date"] == "2026-10-20T00:00:00Z"
    path = v.copy_file(sha)
    assert path.replace("\\", "/").endswith(f"copies/{sha[:2]}/{sha[2:4]}/{sha}.jpg")
    assert not os.stat(path).st_mode & stat.S_IWRITE


def test_credential_named_file_is_never_ingested(world):
    assert "secret.md" not in world["shas"] or len(world["shas"]["secret.md"]) == 1  # post text only
    names = [s.get("source_path", "") for r in world["vault"].records() for s in r["sources"]]
    assert not any("wallet-recovery-phrase" in n for n in names)
    assert safety.refuse_reason(str(world["saves"] / "wallet-recovery-phrase.txt"))


def test_reingest_merges_not_duplicates(world):
    v = world["vault"]
    p = world["pics"][0][1]
    rec, status = v.ingest_file(p, {"source_kind": "file", "source_path": p})
    assert status in ("merged", "duplicate")
    assert rec["sha256"] == world["shas"]["pic0.md"][0]


def test_sniff_ignores_extension(tmp_path):
    p = tmp_path / "looks.txt"
    p.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\0" * 32)
    with open(p, "rb") as f:
        assert safety.sniff(f.read())[0] == "image/png"


def test_image_spec_has_measurements_and_no_media(world):
    sha = world["shas"]["pic1.md"][0]
    spec = decompose.load_spec(world["root"], decompose.spec_id_for(sha))
    assert spec["vault_sha256"] == sha
    assert spec["contains_no_media"] is True
    assert len(spec["parts"]["palette_lab"]) >= 1
    assert spec["description"] and spec["rules"]
    raw = json.dumps(spec)
    assert len(raw) < 20000  # numbers and prose only; a 512 px picture would not fit
    with open(world["vault"].copy_file(sha), "rb") as f:
        b = f.read()
    assert b[1000:1032].hex() not in raw


def test_text_spec_holds_no_words_of_the_original(world):
    sha = [s for s in world["shas"]["post.md"]][0]
    spec = decompose.load_spec(world["root"], decompose.spec_id_for(sha))
    raw = json.dumps(spec).lower()
    for w in ("heron", "brackish", "mudflat", "reeds"):
        assert w not in raw
    assert spec["measurements"]["words"] == len(world["text"].split())


def test_audio_spec_reads_known_tone(world):
    sha = world["shas"]["tone.md"][0]
    spec = decompose.load_spec(world["root"], decompose.spec_id_for(sha))
    m = spec["measurements"]
    assert m["has_audio"] and abs(m["seconds"] - 10) < 0.1
    assert 150 < m["spectral_centroid_hz"] < 1500


def test_gather_corpus_ingest(tmp_path):
    import hashlib
    from cleanroom.vault import Vault
    body = "gathered body text".encode()
    sha = hashlib.sha256(body).hexdigest()
    (tmp_path / "objects" / sha[:2]).mkdir(parents=True)
    (tmp_path / "objects" / sha[:2] / sha[2:]).write_bytes(body)
    row = {"sha256": sha, "ref": "https://example.org/doc", "kind": "document", "fetched_at": 1784157036.9, "meta": {}}
    (tmp_path / "catalog.jsonl").write_text(json.dumps(row) + "\n", encoding="utf-8")
    v = Vault(str(tmp_path / "v"))
    items = sources.gather_items(str(tmp_path))
    rec, status = v.ingest_file(items[0][1], items[0][2])
    assert status == "new" and rec["sha256"] == sha and rec["original_url"] == "https://example.org/doc"
    assert rec["save_date"].startswith("2026-")
    assert os.path.exists(Layout(str(tmp_path / "v")).record_path(sha))

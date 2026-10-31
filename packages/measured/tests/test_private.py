# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""The public/private split of the measured tables (author decision 2026-10-31).

Public tree: no private table, no private field, no private facts row. data/PRIVATE.json records each
private file by name, sha256, row count and reason. The loader names a missing private table, merges
an overlay when present, and the recorded hashes match the private files when a private folder is set."""
import hashlib
import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import measured  # noqa: E402
from measured import PrivateTable, field, load, private_index  # noqa: E402

DATA = ROOT / "data"
REMOVED = {"kodak_5219.json", "schott_glass.json"}
PRIVATE_SOURCES = {"ti-opa1642", "rca-tpm1508a", "itu-r-bt"}


def test_index_is_hash_only_and_complete():
    entries = private_index()
    assert {(e["file"], e.get("field")) for e in entries} == {
        ("kodak_5219.json", None), ("schott_glass.json", None),
        ("p22_kuhn2002.json", "fig3_digitised"), ("facts.json", "rows")}
    for e in entries:
        assert re.fullmatch(r"[0-9a-f]{64}", e["sha256"]) and e["rows"] > 0 and e["reason"]


def test_public_tree_holds_nothing_private():
    names = {p.name for p in DATA.glob("*.json")}
    assert not names & REMOVED
    assert not list(DATA.glob("*.private.json"))
    assert "fig3_digitised" not in json.loads((DATA / "p22_kuhn2002.json").read_text(encoding="utf-8"))
    rows = json.loads((DATA / "facts.json").read_text(encoding="utf-8"))["rows"]
    assert rows and not {r["source"] for r in rows} & PRIVATE_SOURCES
    gi = (ROOT / ".gitignore").read_text(encoding="utf-8").split()
    assert "data/private/" in gi and "*.private.json" in gi


def test_missing_private_table_says_so(tmp_path, monkeypatch):
    monkeypatch.setenv("MEASURED_PRIVATE", str(tmp_path))
    with pytest.raises(PrivateTable, match="schott_glass.*private"):
        load("schott_glass")
    with pytest.raises(PrivateTable, match="fig3_digitised"):
        field("p22_kuhn2002", "fig3_digitised")
    with pytest.raises(FileNotFoundError):  # a name that was never a table is not reported as private
        load("no_such_table")
    assert {r["id"] for r in load("facts")["rows"]}.isdisjoint({"ntsc.sync", "opa1642.en_1kHz"})


def test_overlay_merges_rows_and_fields(tmp_path, monkeypatch):
    monkeypatch.setenv("MEASURED_PRIVATE", str(tmp_path))
    (tmp_path / "facts.private.json").write_text(json.dumps(
        {"provenance": {}, "rows": [{"id": "x.overlay", "value": 1, "source": "itu-r-bt"}]}), encoding="utf-8")
    (tmp_path / "p22_kuhn2002.private.json").write_text(json.dumps({"fig3_digitised": {"red": []}}), encoding="utf-8")
    n_pub = len(json.loads((DATA / "facts.json").read_text(encoding="utf-8"))["rows"])
    rows = load("facts")["rows"]
    assert len(rows) == n_pub + 1 and rows[-1]["id"] == "x.overlay"
    assert field("p22_kuhn2002", "fig3_digitised") == {"red": []}
    assert load("p22_kuhn2002")["model"]  # public part still there


def test_recorded_hashes_match_private_files():
    folder = measured.private_dir()
    found = 0
    for e in private_index():
        p = folder / e.get("private_file", e["file"])
        if p.exists():
            found += 1
            assert hashlib.sha256(p.read_bytes()).hexdigest() == e["sha256"], p.name
    if not found:
        pytest.skip("no private folder in this tree (set MEASURED_PRIVATE to check the recorded hashes)")


def test_private_facts_rows_when_present():
    ids = {r["id"]: r for r in load("facts")["rows"]}
    if "ntsc.datum_to_active" not in ids:
        pytest.skip("facts.private.json is private and absent from this tree")
    assert ids["ntsc.datum_to_active"]["value"] == 9.2e-6 and ids["opa1642.en_1kHz"]["value"] == 5.1

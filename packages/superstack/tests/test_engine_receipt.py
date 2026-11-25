# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Unit and planted-tamper tests for packages/superstack/engine_receipt.py."""
from __future__ import annotations

import copy
import json
import subprocess
import sys
from pathlib import Path

import pytest

SUPERSTACK_ROOT = Path(__file__).resolve().parents[1]
if str(SUPERSTACK_ROOT) not in sys.path:
    sys.path.insert(0, str(SUPERSTACK_ROOT))

import engine_receipt as er  # noqa: E402


def _make_artifact(tmp_path: Path, name: str = "frame.bin", data: bytes = b"superframe-pixel-bytes-v1") -> Path:
    fp = tmp_path / name
    fp.write_bytes(data)
    return fp


def test_emit_and_verify_match_roundtrip(tmp_path: Path):
    art = _make_artifact(tmp_path)
    out = tmp_path / "out.receipt.json"
    cmd = [sys.executable, "-c", "print('[PASS] all 4 checks passed')"]
    receipt = er.emit_receipt(
        out_path=out,
        engine="superframe",
        flagship="superframe",
        task_id="wave1-unit-match",
        root=tmp_path,
        artifact_paths=[art],
        oracle_cmd=cmd,
    )
    assert out.is_file()
    assert receipt["schema"] == "engine-receipt/1"
    assert receipt["in_toto_statement_type"] == "https://in-toto.io/Statement/v1"
    assert receipt["predicate_type"] == "https://flywheel.dev/EngineReceipt/v1"
    assert receipt["verdict"] == "MATCH"
    assert receipt["oracle"]["exit_code"] == 0
    assert receipt["oracle"]["pass_lines"] == 1
    assert receipt["oracle"]["fail_lines"] == 0
    ok, errs = er.verify_receipt(receipt, check_files=True)
    assert ok and errs == []


def test_unverifiable_without_oracle_is_fail_closed(tmp_path: Path):
    art = _make_artifact(tmp_path)
    receipt = er.build_receipt(
        engine="superframe",
        flagship="superframe",
        task_id="wave1-no-oracle",
        root=tmp_path,
        artifact_paths=[art],
        oracle_cmd=None,
    )
    assert receipt["verdict"] == "UNVERIFIABLE"
    assert receipt["oracle"] is None
    ok, errs = er.verify_receipt(receipt, check_files=True)
    assert ok and errs == []


def test_drift_on_nonzero_exit_and_fail_marker(tmp_path: Path):
    art = _make_artifact(tmp_path)
    r_exit = er.build_receipt(
        engine="superframe",
        flagship="superframe",
        task_id="wave1-drift-exit",
        root=tmp_path,
        artifact_paths=[art],
        oracle_cmd=[sys.executable, "-c", "import sys; print('FAIL: pixel mismatch'); sys.exit(1)"],
    )
    assert r_exit["verdict"] == "DRIFT"
    ok, errs = er.verify_receipt(r_exit, check_files=True)
    assert ok and errs == []

    # Even if exit code is 0, a FAIL: line in output forces DRIFT (fail-closed)
    r_marker = er.build_receipt(
        engine="superframe",
        flagship="superframe",
        task_id="wave1-drift-marker",
        root=tmp_path,
        artifact_paths=[art],
        oracle_cmd=[sys.executable, "-c", "print('FAIL: planted mismatch')"],
    )
    assert r_marker["oracle"]["exit_code"] == 0
    assert r_marker["oracle"]["fail_lines"] == 1
    assert r_marker["verdict"] == "DRIFT"
    ok2, errs2 = er.verify_receipt(r_marker, check_files=True)
    assert ok2 and errs2 == []


def test_hmac_signature_roundtrip_and_wrong_key_rejected(tmp_path: Path):
    art = _make_artifact(tmp_path)
    key = "wave1-test-hmac-secret"
    receipt = er.build_receipt(
        engine="superframe",
        flagship="superframe",
        task_id="wave1-hmac",
        root=tmp_path,
        artifact_paths=[art],
        oracle_cmd=[sys.executable, "-c", "print('PASS ok')"],
        hmac_key=key,
    )
    assert receipt["digests"]["signature"].startswith("hmac-sha256:")
    ok, errs = er.verify_receipt(receipt, check_files=True, hmac_key=key)
    assert ok and errs == []
    bad_ok, bad_errs = er.verify_receipt(receipt, check_files=True, hmac_key="wrong-key")
    assert not bad_ok
    assert any("HMAC-SHA256" in e for e in bad_errs)


def test_planted_tamper_artifact_byte_flip_caught(tmp_path: Path):
    art = _make_artifact(tmp_path, "buffer.raw", b"\x00\x01\x02\x03\x04\x05")
    receipt = er.build_receipt(
        engine="superframe",
        flagship="superframe",
        task_id="wave1-tamper-file",
        root=tmp_path,
        artifact_paths=[art],
        oracle_cmd=[sys.executable, "-c", "print('[PASS] clean')"],
    )
    assert er.verify_receipt(receipt, check_files=True)[0] is True
    # Plant a 1-byte flip in the artifact on disk
    art.write_bytes(b"\x00\x01\x02\x03\x04\x06")
    ok, errs = er.verify_receipt(receipt, check_files=True)
    assert not ok
    assert any("artifact SHA-256 drift" in e for e in errs)


def test_planted_tamper_missing_artifact_caught(tmp_path: Path):
    art = _make_artifact(tmp_path, "ephemeral.dat", b"payload")
    receipt = er.build_receipt(
        engine="superframe",
        flagship="superframe",
        task_id="wave1-missing-file",
        root=tmp_path,
        artifact_paths=[art],
        oracle_cmd=[sys.executable, "-c", "print('[PASS] clean')"],
    )
    art.unlink()
    ok, errs = er.verify_receipt(receipt, check_files=True)
    assert not ok
    assert any("missing artifact file" in e for e in errs)


def test_planted_tamper_forged_match_verdict_caught(tmp_path: Path):
    art = _make_artifact(tmp_path)
    unverifiable = er.build_receipt(
        engine="superframe",
        flagship="superframe",
        task_id="wave1-forge-match",
        root=tmp_path,
        artifact_paths=[art],
        oracle_cmd=None,
    )
    forged = copy.deepcopy(unverifiable)
    forged["verdict"] = "MATCH"
    # Even if an attacker recomputes the digests for a forged MATCH without an oracle, fail-closed catches it
    claim = {"subject": forged["subject"], "verdict": "MATCH", "oracle": None, "scope": forged["scope"]}
    forged["digests"] = er.compute_digests(forged["subject"], claim)
    ok, errs = er.verify_receipt(forged, check_files=True)
    assert not ok
    assert any("fail-closed violation" in e for e in errs)


def test_planted_tamper_schema_scope_and_envelope_digest_caught(tmp_path: Path):
    art = _make_artifact(tmp_path)
    base = er.build_receipt(
        engine="superframe",
        flagship="superframe",
        task_id="wave1-tamper-fields",
        root=tmp_path,
        artifact_paths=[art],
        oracle_cmd=[sys.executable, "-c", "print('[PASS] ok')"],
    )

    bad_schema = copy.deepcopy(base)
    bad_schema["schema"] = "engine-receipt/999"
    ok, errs = er.verify_receipt(bad_schema)
    assert not ok and any("unexpected schema" in e for e in errs)

    bad_scope = copy.deepcopy(base)
    bad_scope["scope"] = ["forged scope"]
    ok, errs = er.verify_receipt(bad_scope)
    assert not ok and any("scope mismatch" in e for e in errs)

    bad_subject = copy.deepcopy(base)
    bad_subject["subject"]["task_id"] = "tampered-task"
    ok, errs = er.verify_receipt(bad_subject)
    assert not ok and any("subject_sha256" in e for e in errs)

    bad_env = copy.deepcopy(base)
    bad_env["digests"]["envelope_sha256"] = "sha256:" + ("0" * 64)
    ok, errs = er.verify_receipt(bad_env)
    assert not ok and any("envelope_sha256" in e for e in errs)


def test_missing_artifact_raises_on_emit(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        er.build_receipt(
            engine="superframe",
            flagship="superframe",
            task_id="wave1-missing-input",
            root=tmp_path,
            artifact_paths=[tmp_path / "does_not_exist.bin"],
        )


def test_cli_emit_and_verify_roundtrip(tmp_path: Path):
    art = _make_artifact(tmp_path, "sample.txt", b"hello superframe\n")
    out = tmp_path / "cli.receipt.json"
    script = str(SUPERSTACK_ROOT / "engine_receipt.py")
    em = subprocess.run(
        [
            sys.executable, script, "emit",
            "--engine", "superframe",
            "--flagship", "superframe",
            "--task-id", "wave1-cli-test",
            "--root", str(tmp_path),
            "--artifact", str(art),
            "--out", str(out),
            "--oracle-cmd", sys.executable, "-c", "print('[PASS] cli oracle')",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert em.returncode == 0, em.stderr
    summary = json.loads(em.stdout)
    assert summary["verdict"] == "MATCH"

    vf = subprocess.run(
        [sys.executable, script, "verify", str(out), "--check-files"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert vf.returncode == 0, vf.stderr
    vf_json = json.loads(vf.stdout)
    assert vf_json["ok"] is True
    assert vf_json["verdict"] == "MATCH"

    # Tamper the artifact and confirm CLI verify fails with exit code 2
    art.write_bytes(b"corrupted superframe\n")
    vf_bad = subprocess.run(
        [sys.executable, script, "verify", str(out), "--check-files"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert vf_bad.returncode == 2
    assert json.loads(vf_bad.stdout)["ok"] is False

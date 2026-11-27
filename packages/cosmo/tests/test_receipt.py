# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Unit and planted-tamper tests for native engine-receipt/1 in cosmolab (CPU-only)."""
from __future__ import annotations

import copy
import sys
from pathlib import Path

import numpy as np

COSMO_ROOT = Path(__file__).resolve().parents[1]
if str(COSMO_ROOT) not in sys.path:
    sys.path.insert(0, str(COSMO_ROOT))

from cosmolab import background, linear, receipt as cosmo_receipt  # noqa: E402


def _compute_linear_summary() -> dict:
    cosmo = background.Cosmology()
    ks = np.array([0.02, 0.1, 0.5])
    tf = linear.eh98_transfer(ks, cosmo)
    return {
        "package": "cosmolab",
        "omega_m": float(cosmo.omega_m),
        "h": float(cosmo.h),
        "growth_a1": float(cosmo.growth(1.0)),
        "k_h_mpc": [float(v) for v in ks],
        "eh98_transfer": [float(v) for v in tf],
    }


def test_cosmo_summary_receipt_match_roundtrip(tmp_path: Path):
    summary = _compute_linear_summary()
    summary_path, receipt_path, rec = cosmo_receipt.write_summary_and_receipt(
        out_dir=tmp_path,
        task_id="cosmo-linear-eh98",
        summary=summary,
        oracle_cmd=[sys.executable, "-c", "print('[PASS] cosmolab linear summary check')"],
    )
    assert summary_path.is_file() and receipt_path.is_file()
    assert rec["schema"] == "engine-receipt/1"
    assert rec["verdict"] == "MATCH"
    ok, errs = cosmo_receipt.verify_cosmo_receipt(receipt_path, check_files=True)
    assert ok and errs == []


def test_cosmo_receipt_unverifiable_and_drift_states(tmp_path: Path):
    summary = _compute_linear_summary()
    _, rec_unv_path, rec_unv = cosmo_receipt.write_summary_and_receipt(
        out_dir=tmp_path,
        task_id="cosmo-unverifiable",
        summary=summary,
        oracle_cmd=None,
    )
    assert rec_unv["verdict"] == "UNVERIFIABLE"
    assert cosmo_receipt.verify_cosmo_receipt(rec_unv_path, check_files=True) == (True, [])

    _, rec_drift_path, rec_drift = cosmo_receipt.write_summary_and_receipt(
        out_dir=tmp_path,
        task_id="cosmo-drift",
        summary=summary,
        oracle_cmd=[sys.executable, "-c", "import sys; print('FAIL: power spectrum drift'); sys.exit(1)"],
    )
    assert rec_drift["verdict"] == "DRIFT"
    assert cosmo_receipt.verify_cosmo_receipt(rec_drift_path, check_files=True) == (True, [])


def test_cosmo_planted_tamper_file_and_verdict_caught(tmp_path: Path):
    summary = _compute_linear_summary()
    summary_path, receipt_path, rec = cosmo_receipt.write_summary_and_receipt(
        out_dir=tmp_path,
        task_id="cosmo-tamper",
        summary=summary,
        oracle_cmd=[sys.executable, "-c", "print('[PASS] ok')"],
        hmac_key="cosmo-test-key",
    )
    assert cosmo_receipt.verify_cosmo_receipt(receipt_path, check_files=True, hmac_key="cosmo-test-key") == (True, [])
    # Wrong HMAC key rejected
    ok_key, errs_key = cosmo_receipt.verify_cosmo_receipt(receipt_path, check_files=True, hmac_key="wrong-key")
    assert not ok_key and any("HMAC-SHA256" in e for e in errs_key)

    # Planted 1-byte tamper on the simulation summary artifact is caught
    raw = bytearray(summary_path.read_bytes())
    raw[-2] = ord("9") if raw[-2] != ord("9") else ord("8")
    summary_path.write_bytes(bytes(raw))
    ok_file, errs_file = cosmo_receipt.verify_cosmo_receipt(receipt_path, check_files=True)
    assert not ok_file and any("artifact SHA-256 drift" in e for e in errs_file)

    # Planted forged MATCH on an UNVERIFIABLE receipt is caught fail-closed
    forged = copy.deepcopy(rec)
    forged["oracle"] = None
    forged["verdict"] = "MATCH"
    ok_forge, errs_forge = cosmo_receipt.verify_cosmo_receipt(forged, check_files=False)
    assert not ok_forge and any("fail-closed violation" in e for e in errs_forge)

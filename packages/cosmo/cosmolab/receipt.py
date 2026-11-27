# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Native engine-receipt/1 emission and verification for cosmolab runs.

Reuses packages/superstack/engine_receipt.py so every cosmological simulation
summary or power-spectrum artifact can be sealed into a canonical SHA-256
engine-receipt/1 envelope without duplicating receipt logic.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Mapping, Sequence

_SUPERSTACK_DIR = Path(__file__).resolve().parents[2] / "superstack"
if str(_SUPERSTACK_DIR) not in sys.path:
    sys.path.insert(0, str(_SUPERSTACK_DIR))

import engine_receipt as _er  # noqa: E402

SCHEMA = _er.SCHEMA


def emit_cosmo_receipt(
    out_path: Path | str,
    task_id: str,
    artifact_paths: Sequence[Path | str],
    oracle_cmd: Sequence[str] | None = None,
    root: Path | str | None = None,
    hmac_key: str | None = None,
    timeout: int = 120,
) -> dict:
    """Emit a canonical engine-receipt/1 JSON envelope for cosmolab artifacts."""
    resolved_root = Path(root) if root is not None else Path(out_path).resolve().parent
    return _er.emit_receipt(
        out_path=out_path,
        engine="superframe",
        flagship="superframe",
        task_id=task_id,
        root=resolved_root,
        artifact_paths=artifact_paths,
        oracle_cmd=oracle_cmd,
        hmac_key=hmac_key,
        timeout=timeout,
    )


def verify_cosmo_receipt(
    receipt_or_path: dict | Path | str,
    check_files: bool = True,
    hmac_key: str | None = None,
) -> tuple[bool, list[str]]:
    """Verify a cosmolab engine-receipt/1 dict or JSON file."""
    if isinstance(receipt_or_path, (Path, str)):
        receipt = json.loads(Path(receipt_or_path).read_text(encoding="utf-8"))
    else:
        receipt = receipt_or_path
    return _er.verify_receipt(receipt, check_files=check_files, hmac_key=hmac_key)


def write_summary_and_receipt(
    out_dir: Path | str,
    task_id: str,
    summary: Mapping[str, object],
    oracle_cmd: Sequence[str] | None = None,
    hmac_key: str | None = None,
) -> tuple[Path, Path, dict]:
    """Write a canonical JSON simulation summary and seal it with engine-receipt/1."""
    target_dir = Path(out_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    summary_path = target_dir / f"{task_id}.summary.json"
    receipt_path = target_dir / f"{task_id}.receipt.json"
    summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    receipt = emit_cosmo_receipt(
        out_path=receipt_path,
        task_id=task_id,
        artifact_paths=[summary_path],
        oracle_cmd=oracle_cmd,
        root=target_dir,
        hmac_key=hmac_key,
    )
    return summary_path, receipt_path, receipt

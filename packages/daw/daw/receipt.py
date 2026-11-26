# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Native engine-receipt/1 emission and verification for DAW renders.

Reuses packages/superstack/engine_receipt.py alongside daw.export's
superstack.receipt/1 audio receipt so DAW renders emit Flywheel-compatible
SHA-256 verification envelopes.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Sequence

from . import export as daw_export

_SUPERSTACK_DIR = Path(__file__).resolve().parents[2] / "superstack"
if str(_SUPERSTACK_DIR) not in sys.path:
    sys.path.insert(0, str(_SUPERSTACK_DIR))

import engine_receipt as _er  # noqa: E402

SCHEMA = _er.SCHEMA


def emit_daw_receipt(
    out_path: Path | str,
    task_id: str,
    artifact_paths: Sequence[Path | str],
    oracle_cmd: Sequence[str] | None = None,
    root: Path | str | None = None,
    hmac_key: str | None = None,
    timeout: int = 120,
) -> dict:
    """Emit a canonical engine-receipt/1 JSON envelope for DAW render artifacts."""
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


def verify_daw_receipt(
    receipt_or_path: dict | Path | str,
    check_files: bool = True,
    hmac_key: str | None = None,
) -> tuple[bool, list[str]]:
    """Verify a DAW engine-receipt/1 dict or JSON file."""
    if isinstance(receipt_or_path, (Path, str)):
        receipt = json.loads(Path(receipt_or_path).read_text(encoding="utf-8"))
    else:
        receipt = receipt_or_path
    return _er.verify_receipt(receipt, check_files=check_files, hmac_key=hmac_key)


def export_with_engine_receipt(
    wav_path: Path | str,
    receipt_path: Path | str,
    scene: dict,
    stereo,
    fs: int,
    task_id: str,
    oracle_cmd: Sequence[str] | None = None,
    fmt: str = "wav",
    bits: int = 16,
    hmac_key: str | None = None,
) -> tuple[dict, dict]:
    """Export stereo audio, write its superstack.receipt/1 sidecar, and seal both with engine-receipt/1."""
    audio_file = Path(wav_path)
    audio_file.parent.mkdir(parents=True, exist_ok=True)
    pcm = daw_export.write(str(audio_file), stereo, fs, fmt=fmt, bits=bits)
    audio_rec = daw_export.receipt(scene, pcm, fs, len(stereo))
    sidecar = audio_file.with_suffix(audio_file.suffix + ".superstack.json")
    sidecar.write_text(json.dumps(audio_rec, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    env_rec = emit_daw_receipt(
        out_path=receipt_path,
        task_id=task_id,
        artifact_paths=[audio_file, sidecar],
        oracle_cmd=oracle_cmd,
        root=audio_file.parent,
        hmac_key=hmac_key,
    )
    return audio_rec, env_rec

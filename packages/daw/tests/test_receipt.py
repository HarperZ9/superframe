# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Unit and planted-tamper tests for native engine-receipt/1 in packages/daw."""
from __future__ import annotations

import copy
import sys
from pathlib import Path

import numpy as np

DAW_ROOT = Path(__file__).resolve().parents[1]
if str(DAW_ROOT) not in sys.path:
    sys.path.insert(0, str(DAW_ROOT))

from daw import materials as M  # noqa: E402
from daw import receipt as daw_receipt  # noqa: E402
from daw.mixer import place  # noqa: E402
from daw.shapes_1d import Bar  # noqa: E402
from daw.synth import render  # noqa: E402

FS = 48000


def _render_short_bar():
    modes = Bar(M.material("aluminium"), 0.3, 0.012).modes(3)
    mono = render(modes, FS, 0.05, (0.2,), (0.02,), "strike", 0.5e-3)
    stereo = place(mono, 0.0, 0.0)
    scene = {
        "kind": "superstack.sound/1",
        "seed": "daw-wave2-receipt-test",
        "rate": FS,
        "channels": 2,
        "duration_samples": len(stereo),
    }
    return scene, stereo


def test_daw_export_and_engine_receipt_match_roundtrip(tmp_path: Path):
    scene, stereo = _render_short_bar()
    wav_path = tmp_path / "bar.wav"
    env_path = tmp_path / "bar.engine-receipt.json"
    audio_rec, env_rec = daw_receipt.export_with_engine_receipt(
        wav_path=wav_path,
        receipt_path=env_path,
        scene=scene,
        stereo=stereo,
        fs=FS,
        task_id="daw-bar-strike",
        oracle_cmd=[sys.executable, "-c", "print('[PASS] daw render verified')"],
    )
    assert wav_path.is_file() and env_path.is_file()
    assert audio_rec["schema"] == "superstack.receipt/1"
    assert env_rec["schema"] == "engine-receipt/1"
    assert env_rec["verdict"] == "MATCH"
    assert len(env_rec["subject"]["artifacts"]) == 2
    assert daw_receipt.verify_daw_receipt(env_path, check_files=True) == (True, [])


def test_daw_receipt_unverifiable_and_drift_states(tmp_path: Path):
    scene, stereo = _render_short_bar()
    _, env_unv = daw_receipt.export_with_engine_receipt(
        wav_path=tmp_path / "unv.wav",
        receipt_path=tmp_path / "unv.receipt.json",
        scene=scene,
        stereo=stereo,
        fs=FS,
        task_id="daw-unverifiable",
        oracle_cmd=None,
    )
    assert env_unv["verdict"] == "UNVERIFIABLE"
    assert daw_receipt.verify_daw_receipt(env_unv, check_files=True) == (True, [])

    _, env_drift = daw_receipt.export_with_engine_receipt(
        wav_path=tmp_path / "drift.wav",
        receipt_path=tmp_path / "drift.receipt.json",
        scene=scene,
        stereo=stereo,
        fs=FS,
        task_id="daw-drift",
        oracle_cmd=[sys.executable, "-c", "import sys; print('FAIL: audio SNR mismatch'); sys.exit(1)"],
    )
    assert env_drift["verdict"] == "DRIFT"
    assert daw_receipt.verify_daw_receipt(env_drift, check_files=True) == (True, [])


def test_daw_planted_tamper_wav_and_forged_verdict_caught(tmp_path: Path):
    scene, stereo = _render_short_bar()
    wav_path = tmp_path / "tamper.wav"
    env_path = tmp_path / "tamper.receipt.json"
    _, env_rec = daw_receipt.export_with_engine_receipt(
        wav_path=wav_path,
        receipt_path=env_path,
        scene=scene,
        stereo=stereo,
        fs=FS,
        task_id="daw-tamper",
        oracle_cmd=[sys.executable, "-c", "print('[PASS] clean audio')"],
        hmac_key="daw-hmac-key",
    )
    assert daw_receipt.verify_daw_receipt(env_path, check_files=True, hmac_key="daw-hmac-key") == (True, [])

    # Flip 1 byte in the WAV payload (last byte)
    data = bytearray(wav_path.read_bytes())
    data[-1] ^= 0x01
    wav_path.write_bytes(bytes(data))
    ok, errs = daw_receipt.verify_daw_receipt(env_path, check_files=True, hmac_key="daw-hmac-key")
    assert not ok and any("artifact SHA-256 drift" in e for e in errs)

    # Planted forged MATCH without oracle is rejected fail-closed
    forged = copy.deepcopy(env_rec)
    forged["oracle"] = None
    forged["verdict"] = "MATCH"
    ok_f, errs_f = daw_receipt.verify_daw_receipt(forged, check_files=False)
    assert not ok_f and any("fail-closed violation" in e for e in errs_f)

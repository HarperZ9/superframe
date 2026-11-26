# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Domain randomization presets, deterministic trajectory hashing, and engine-receipt/1 sealing."""
from __future__ import annotations

import hashlib
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Mapping, Sequence

import numpy as np

_SUPERSTACK_DIR = Path(__file__).resolve().parents[2] / "superstack"
if str(_SUPERSTACK_DIR) not in sys.path:
    sys.path.insert(0, str(_SUPERSTACK_DIR))

import engine_receipt as _er  # noqa: E402

GRAVITY_PRESETS: dict[str, float] = {
    "earth": 9.80665,
    "moon": 1.62,
    "mars": 3.72076,
}


@dataclass(frozen=True)
class DomainConfig:
    """SI domain randomization parameters for Physical-AI environments."""
    planet: str = "earth"
    gravity: float = 9.80665
    friction: float = 0.65
    mass_scale: float = 1.0
    wind_drag: float = 0.02


def sample_domain(rng: np.random.Generator, planet: str = "earth", randomize: bool = True) -> DomainConfig:
    """Sample deterministic SI domain parameters for Earth, Moon, or Mars."""
    if planet not in GRAVITY_PRESETS:
        raise ValueError(f"unknown planet preset: {planet}")
    g = GRAVITY_PRESETS[planet]
    if not randomize:
        return DomainConfig(planet=planet, gravity=g, friction=0.65, mass_scale=1.0, wind_drag=0.02)
    return DomainConfig(
        planet=planet,
        gravity=g,
        friction=float(rng.uniform(0.45, 0.85)),
        mass_scale=float(rng.uniform(0.90, 1.10)),
        wind_drag=float(rng.uniform(0.0, 0.04)) if planet != "moon" else 0.0,
    )


def trajectory_sha256(records: Sequence[Mapping[str, object]]) -> str:
    """Compute canonical SHA-256 digest over a deterministic episode trajectory."""
    raw = json.dumps(list(records), sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    return "sha256:" + hashlib.sha256(raw).hexdigest()


def emit_episode_receipt(
    out_dir: Path | str,
    task_id: str,
    trajectory: Sequence[Mapping[str, object]],
    summary: Mapping[str, object],
    oracle_cmd: Sequence[str] | None = None,
    hmac_key: str | None = None,
) -> tuple[Path, Path, dict]:
    """Write episode trajectory JSON and seal it with a canonical engine-receipt/1 envelope."""
    target = Path(out_dir)
    target.mkdir(parents=True, exist_ok=True)
    traj_path = target / f"{task_id}.trajectory.json"
    rec_path = target / f"{task_id}.receipt.json"
    payload = {
        "task_id": task_id,
        "trajectory_sha256": trajectory_sha256(trajectory),
        "summary": dict(summary),
        "steps": len(trajectory),
        "trajectory": list(trajectory),
    }
    traj_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    rec = _er.emit_receipt(
        out_path=rec_path,
        engine="superframe",
        flagship="superframe",
        task_id=task_id,
        root=target,
        artifact_paths=[traj_path],
        oracle_cmd=oracle_cmd,
        hmac_key=hmac_key,
    )
    return traj_path, rec_path, rec


def verify_episode_receipt(
    receipt_or_path: dict | Path | str,
    check_files: bool = True,
    hmac_key: str | None = None,
) -> tuple[bool, list[str]]:
    """Verify an episode engine-receipt/1 dict or file."""
    rec = (
        json.loads(Path(receipt_or_path).read_text(encoding="utf-8"))
        if isinstance(receipt_or_path, (Path, str))
        else receipt_or_path
    )
    return _er.verify_receipt(rec, check_files=check_files, hmac_key=hmac_key)


def domain_as_dict(cfg: DomainConfig) -> dict:
    return asdict(cfg)

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Wave 25F cross-engine parity contract tests: Superframe (100 Hz + Deja-VAE) <-> BuildLang."""
from __future__ import annotations

import importlib.util
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[3]
WORLD_ROOT = REPO_ROOT / "packages" / "world"
DEJA_PATH = REPO_ROOT / "packages" / "colour" / "build-color" / "build_color" / "deja_vae_oracle.py"
NATIVE_BLD_DIR = REPO_ROOT / "native" / "bld"

if str(WORLD_ROOT) not in sys.path:
    sys.path.insert(0, str(WORLD_ROOT))

from physai.latency_sim import (  # noqa: E402
    run_latency_vehicle_rollout,
    verify_latency_faithful_clock,
)

# Pinned BuildLang native/bld/wave25f_parity.bld numeric vectors (100 Hz zero-gust + Deja-VAE 2x4).
PINNED_SIM_FAST = {
    "ticks": 500, "decisions": 500, "stale": 1, "collisions": 0,
    "rmse": 0.640024566818, "max_over": 1.311357876416, "hash": "9eacfc895a68b176",
}
PINNED_SIM_SLOW = {
    "ticks": 500, "decisions": 28, "stale": 473, "collisions": 152,
    "rmse": 1.376676765987, "max_over": 2.543921244832, "hash": "1db5b193294f651a",
}
PINNED_DEJA_NAIVE_DRIFT = 168.702939368658

E_PARITY = np.array([[1.0, 0.5, -0.25, 0.25], [0.25, -0.5, 1.0, 0.5]], dtype=np.float64)
D_BASE_PARITY = np.array(
    [[1.12, 0.18], [0.41, -0.62], [-0.19, 1.09], [0.31, 0.44]],
    dtype=np.float64,
)
Z0_PARITY = np.array([1.25, -0.75], dtype=np.float64)


def _load_deja_module():
    spec = importlib.util.spec_from_file_location("wave25f_deja_vae_oracle", DEJA_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def _parse_kv_line(text: str, prefix: str) -> dict[str, str]:
    for line in text.splitlines():
        if line.startswith(prefix + " "):
            return dict(re.findall(r"([a-z_]+)=([^\s]+)", line))
    raise AssertionError(f"missing {prefix} line in BuildLang output:\n{text}")


def _run_native_bld_binary() -> str | None:
    require = os.environ.get("NATIVE_BLD_REQUIRE", "0") == "1"
    exe_name = "main.exe" if os.name == "nt" else "main"
    exe_path = NATIVE_BLD_DIR / "target" / "release" / exe_name
    buildc = os.environ.get("BUILDC") or shutil.which("buildc")
    if buildc:
        res = subprocess.run(
            [buildc, "build", "--release", str(NATIVE_BLD_DIR)],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            check=False,
        )
        if res.returncode != 0:
            raise AssertionError(f"buildc build failed:\n{res.stdout}\n{res.stderr}")
    if not exe_path.exists():
        if require:
            raise AssertionError(f"NATIVE_BLD_REQUIRE=1 but missing {exe_path}")
        return None
    run = subprocess.run([str(exe_path)], cwd=str(REPO_ROOT), capture_output=True, text=True, check=False)
    if run.returncode != 0:
        raise AssertionError(f"native/bld runner failed:\n{run.stdout}\n{run.stderr}")
    return run.stdout


def test_python_100hz_matches_buildlang_pinned_vectors() -> None:
    fast = run_latency_vehicle_rollout(seed=42, latency_ms=10.0, gust_sigma=0.0)
    slow = run_latency_vehicle_rollout(seed=42, latency_ms=180.0, gust_sigma=0.0)

    assert fast.world_ticks == PINNED_SIM_FAST["ticks"]
    assert fast.agent_decisions == PINNED_SIM_FAST["decisions"]
    assert fast.stale_ticks == PINNED_SIM_FAST["stale"]
    assert fast.collision_count == PINNED_SIM_FAST["collisions"]
    assert abs(fast.tracking_rmse_m - round(PINNED_SIM_FAST["rmse"], 6)) <= 1e-6
    assert abs(fast.max_overshoot_m - round(PINNED_SIM_FAST["max_over"], 6)) <= 1e-6

    assert slow.world_ticks == PINNED_SIM_SLOW["ticks"]
    assert slow.agent_decisions == PINNED_SIM_SLOW["decisions"]
    assert slow.stale_ticks == PINNED_SIM_SLOW["stale"]
    assert slow.collision_count == PINNED_SIM_SLOW["collisions"]
    assert abs(slow.tracking_rmse_m - round(PINNED_SIM_SLOW["rmse"], 6)) <= 1e-6
    assert abs(slow.max_overshoot_m - round(PINNED_SIM_SLOW["max_over"], 6)) <= 1e-6

    assert verify_latency_faithful_clock(fast)[0] is True
    assert verify_latency_faithful_clock(slow)[0] is True
    assert fast.tracking_rmse_m < slow.tracking_rmse_m


def test_python_dejavae_matches_buildlang_pinned_vectors_and_rejects_faults() -> None:
    deja_mod = _load_deja_module()
    codec = deja_mod.SurjectivePseudoInvertibleCodec(E_PARITY, D_BASE_PARITY)
    pass_rep = deja_mod.run_10step_roundtrip_oracle(codec, Z0_PARITY, steps=10, tol=1e-9, mode="deja")
    naive_rep = deja_mod.run_10step_roundtrip_oracle(codec, Z0_PARITY, steps=10, tol=1e-9, mode="naive")

    assert pass_rep.verdict == "PASS"
    assert pass_rep.max_latent_drift <= 1e-12
    assert naive_rep.verdict == "FAIL"
    assert abs(naive_rep.max_latent_drift - PINNED_DEJA_NAIVE_DRIFT) <= 1e-9

    # Planted distortion control must fail closed (0 silent divergence).
    distorted = deja_mod.SurjectivePseudoInvertibleCodec(
        E_PARITY, D_BASE_PARITY, distortion_fn=lambda x: x + np.array([0.01, 0.0, 0.0, 0.0]),
    )
    bad_rep = deja_mod.run_10step_roundtrip_oracle(distorted, Z0_PARITY, steps=10, tol=1e-9, mode="deja")
    assert bad_rep.verdict == "FAIL"
    assert bad_rep.reason == "roundtrip_drift_exceeded"


def test_live_buildlang_native_binary_matches_cpp_and_python_zero_divergence() -> None:
    main_src = (NATIVE_BLD_DIR / "main.bld").read_text(encoding="utf-8")
    for expected_pin in ("0x8e70a9159d2007bf", "0x364d778712fdc849", "0x2c4cd941314f50b5"):
        assert expected_pin in main_src
    out = _run_native_bld_binary()
    if out is None:
        return

    assert "modules identical to the C++: 3 of 3" in out
    assert "planted controls rejected: 3 of 3" in out
    assert "parity invariants verified: 2 of 2" in out

    bld_fast = _parse_kv_line(out, "parity_sim_fast")
    bld_slow = _parse_kv_line(out, "parity_sim_slow")
    bld_deja = _parse_kv_line(out, "parity_deja_pass")
    bld_naive = _parse_kv_line(out, "parity_deja_naive")

    assert bld_fast["hash"] == PINNED_SIM_FAST["hash"]
    assert bld_slow["hash"] == PINNED_SIM_SLOW["hash"]
    assert int(bld_fast["collisions"]) == PINNED_SIM_FAST["collisions"]
    assert int(bld_slow["collisions"]) == PINNED_SIM_SLOW["collisions"]
    assert abs(float(bld_fast["rmse"]) - PINNED_SIM_FAST["rmse"]) <= 1e-12
    assert abs(float(bld_slow["rmse"]) - PINNED_SIM_SLOW["rmse"]) <= 1e-12
    assert float(bld_deja["max_drift"]) <= 1e-12
    assert abs(float(bld_naive["max_drift"]) - PINNED_DEJA_NAIVE_DRIFT) <= 1e-9

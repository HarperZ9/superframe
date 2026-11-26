# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Wave 21B-3 tests for DrivingBench v2 100 Hz latency-faithful simulation mode."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

_PACKAGES = Path(__file__).resolve().parents[2]
for _sub in (_PACKAGES / "world", _PACKAGES / "superstack"):
    if str(_sub) not in sys.path:
        sys.path.insert(0, str(_sub))

import engine_receipt as _er  # noqa: E402
from physai.latency_sim import (  # noqa: E402
    LatencyRolloutMetrics,
    SIM_HZ,
    benchmark_fast_vs_overthinking,
    run_latency_quadrotor_rollout,
    run_latency_vehicle_rollout,
    verify_latency_faithful_clock,
)


def test_100hz_latency_faithful_fast_beats_overthinking_deterministically():
    """Fast-route (10 ms) beats overthinking-route (180 ms) on both vehicle & 6-DOF drone at 100 Hz."""
    bench_a = benchmark_fast_vs_overthinking(seed=42)
    bench_b = benchmark_fast_vs_overthinking(seed=42)
    assert bench_a == bench_b
    assert bench_a["sim_hz"] == SIM_HZ
    assert bench_a["fast_beats_overthinking_vehicle"], bench_a
    assert bench_a["fast_beats_overthinking_quadrotor"], bench_a
    assert bench_a["vehicle_staleness_penalty_x"] > 1.5
    assert bench_a["quadrotor_staleness_penalty_x"] > 1.3
    assert bench_a["vehicle_overthinking"]["stale_ticks"] > 400
    assert bench_a["vehicle_overthinking"]["max_overshoot_m"] > bench_a["vehicle_fast"]["max_overshoot_m"]


def test_latency_faithful_clock_verifier_rejects_planted_freeze_time_cheats():
    """Anti-cheat clock verifier passes real 100 Hz rollouts and rejects pause-and-cheat rollouts."""
    real_slow = run_latency_vehicle_rollout(seed=7, latency_ms=180.0, policy_name="overthinking")
    ok, msg = verify_latency_faithful_clock(real_slow)
    assert ok, msg

    real_quad = run_latency_quadrotor_rollout(seed=7, latency_ms=150.0, policy_name="overthinking-drone")
    ok_q, msg_q = verify_latency_faithful_clock(real_quad)
    assert ok_q, msg_q

    # Planted cheat 1: simulator freezes world during 180 ms think (zero stale ticks)
    cheat_zero_stale = LatencyRolloutMetrics(
        scenario="driving_100hz_chicane", policy_name="cheat", seed=7,
        latency_ms=180.0, ticks_per_decision=18, world_ticks=500,
        agent_decisions=25, stale_ticks=0, tracking_rmse_m=0.05,
        max_overshoot_m=0.1, collision_count=0, final_err_m=0.01,
        replay_sha256="sha256:0000",
    )
    ok_c1, msg_c1 = verify_latency_faithful_clock(cheat_zero_stale)
    assert not ok_c1 and "zero_stale_ticks" in msg_c1

    # Planted cheat 2: simulator claims 1 tick per decision despite 180 ms latency
    cheat_bad_ticks = LatencyRolloutMetrics(
        scenario="driving_100hz_chicane", policy_name="cheat", seed=7,
        latency_ms=180.0, ticks_per_decision=1, world_ticks=500,
        agent_decisions=500, stale_ticks=10, tracking_rmse_m=0.05,
        max_overshoot_m=0.1, collision_count=0, final_err_m=0.01,
        replay_sha256="sha256:0000",
    )
    ok_c2, msg_c2 = verify_latency_faithful_clock(cheat_bad_ticks)
    assert not ok_c2 and "ticks_per_decision" in msg_c2

    with pytest.raises(ValueError):
        run_latency_vehicle_rollout(latency_ms=-5.0)


def test_wave21b_latency_benchmark_seals_canonical_receipt_and_catches_tamper(tmp_path: Path):
    """Benchmark telemetry seals into engine-receipt/1 MATCH and catches 1-byte tamper."""
    bench = benchmark_fast_vs_overthinking(seed=42)
    rep = tmp_path / "wave21b_latency_bench.json"
    rec = tmp_path / "wave21b_latency_bench.receipt.json"
    rep.write_text(json.dumps(bench, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    emitted = _er.emit_receipt(
        out_path=rec, engine="superframe", flagship="superframe",
        task_id="wave21b-100hz-latency-sim", root=tmp_path, artifact_paths=[rep],
        oracle_cmd=[sys.executable, "-c", "print('[PASS] Wave 21B 100 Hz latency sim verified')"],
    )
    assert emitted["verdict"] == "MATCH"
    loaded = json.loads(rec.read_text(encoding="utf-8"))
    ok_rec, errs = _er.verify_receipt(loaded, check_files=True)
    assert ok_rec, errs
    rep.write_text(rep.read_text(encoding="utf-8") + " ", encoding="utf-8")
    ok_tamper, _ = _er.verify_receipt(loaded, check_files=True)
    assert not ok_tamper

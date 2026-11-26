# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""DrivingBench v2 latency-faithful 100 Hz fixed-timestep simulation mode.

Decouples the fixed 100 Hz world physics clock (dt = 0.01 s) from agent think time
so the world keeps advancing under the last held actuator command while an agent
deliberates. Quantifies real-world staleness and overthinking penalties across
fast-route vs overthinking-route policies with deterministic seeded replays.
"""
from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from typing import Callable

import numpy as np

from .aerospace_6dof import QuadrotorDroneEnv, quadrotor_action

SIM_HZ = 100.0
SIM_DT = 0.01


@dataclass(frozen=True)
class LatencyRolloutMetrics:
    """Deterministic telemetry for a 100 Hz latency-faithful simulation rollout."""
    scenario: str
    policy_name: str
    seed: int
    latency_ms: float
    ticks_per_decision: int
    world_ticks: int
    agent_decisions: int
    stale_ticks: int
    tracking_rmse_m: float
    max_overshoot_m: float
    collision_count: int
    final_err_m: float
    replay_sha256: str


class LatencyVehicleEnv:
    """100 Hz 2D lane-keeping and sudden-obstacle avoidance vehicle dynamics."""

    def __init__(self, dt: float = SIM_DT, max_ticks: int = 600) -> None:
        self.dt = float(dt)
        self.max_ticks = int(max_ticks)
        self.lane_half_width_m = 1.6
        self.reset(seed=0)

    def reset(self, seed: int = 0) -> np.ndarray:
        self._rng = np.random.default_rng(seed)
        self.t = 0.0
        self.ticks = 0
        self.x = 0.0
        self.y = 0.0
        self.vx = 14.0
        self.vy = 0.0
        self.gust_y = 0.0
        self.target_y = 0.0
        self.collision_count = 0
        self.max_overshoot = 0.0
        self.sq_err_sum = 0.0
        return self._obs()

    def _reference_lane_y(self, t_sec: float) -> float:
        # Smooth chicane + sudden obstacle evasive swerve at t=1.6s and t=3.8s
        base = 0.9 * math.sin(1.4 * t_sec)
        evade1 = 1.35 * math.exp(-((t_sec - 1.8) / 0.35) ** 2)
        evade2 = -1.25 * math.exp(-((t_sec - 4.0) / 0.35) ** 2)
        return base + evade1 + evade2

    def step(self, action: np.ndarray) -> tuple[np.ndarray, float, bool, dict[str, float]]:
        act = np.asarray(action, dtype=np.float64).reshape(2)
        ax = max(-6.0, min(4.0, float(act[0])))
        ay_cmd = max(-9.5, min(9.5, float(act[1])))
        alpha = math.exp(-self.dt / 0.4)
        self.gust_y = alpha * self.gust_y + math.sqrt(max(0.0, 1.0 - alpha * alpha)) * float(self._rng.normal(0.0, 0.85))
        ay = ay_cmd + self.gust_y - 0.18 * self.vy

        self.vx = max(4.0, min(22.0, self.vx + ax * self.dt))
        self.vy = self.vy + ay * self.dt
        self.x += self.vx * self.dt
        self.y += self.vy * self.dt
        self.t += self.dt
        self.ticks += 1

        self.target_y = self._reference_lane_y(self.t)
        err = abs(self.y - self.target_y)
        self.sq_err_sum += err * err
        if err > self.max_overshoot:
            self.max_overshoot = err
        if err > self.lane_half_width_m:
            self.collision_count += 1
        done = self.ticks >= self.max_ticks
        return self._obs(), -err, done, {"err_m": err, "target_y": self.target_y, "y": self.y}

    def _obs(self) -> np.ndarray:
        return np.array([self.x, self.y, self.vx, self.vy, self.target_y, self.t], dtype=np.float64)


def vehicle_pd_action(env: LatencyVehicleEnv) -> np.ndarray:
    """Fast closed-loop PD lane-tracking controller."""
    err_y = env.target_y - env.y
    ay = 14.0 * err_y - 4.8 * env.vy
    ax = 0.8 * (14.0 - env.vx)
    return np.array([ax, ay], dtype=np.float64)


def _build_metrics(
    scenario: str,
    policy_name: str,
    seed: int,
    latency_ms: float,
    ticks_per_decision: int,
    world_ticks: int,
    decisions: int,
    stale_ticks: int,
    sq_err_sum: float,
    max_overshoot: float,
    collisions: int,
    final_err: float,
    trace: list[float],
) -> LatencyRolloutMetrics:
    rmse = math.sqrt(sq_err_sum / max(1, world_ticks))
    digest = "sha256:" + hashlib.sha256(
        json.dumps({"seed": seed, "latency_ms": latency_ms, "trace": trace}, sort_keys=True).encode("utf-8")
    ).hexdigest()
    return LatencyRolloutMetrics(
        scenario=scenario, policy_name=policy_name, seed=seed, latency_ms=float(latency_ms),
        ticks_per_decision=ticks_per_decision, world_ticks=world_ticks, agent_decisions=decisions,
        stale_ticks=stale_ticks, tracking_rmse_m=round(rmse, 6), max_overshoot_m=round(max_overshoot, 6),
        collision_count=collisions, final_err_m=round(final_err, 6), replay_sha256=digest,
    )


def run_latency_vehicle_rollout(
    *,
    seed: int = 42,
    latency_ms: float = 10.0,
    policy_name: str = "fast-route",
    total_ticks: int = 500,
    policy_fn: Callable[[LatencyVehicleEnv], np.ndarray] = vehicle_pd_action,
) -> LatencyRolloutMetrics:
    """Run 100 Hz vehicle rollout where physics keeps ticking during agent latency_ms."""
    if latency_ms < 0.0:
        raise ValueError("latency_ms must be non-negative")
    ticks_per_decision = max(1, int(math.ceil(latency_ms / (SIM_DT * 1000.0))))
    env = LatencyVehicleEnv(dt=SIM_DT, max_ticks=total_ticks)
    env.reset(seed=seed)
    held, pending = np.zeros(2, dtype=np.float64), policy_fn(env)
    ticks_until, decisions, stale_ticks = ticks_per_decision, 1, 0
    trace: list[float] = []
    for _ in range(total_ticks):
        if ticks_until <= 0:
            held, pending = pending, policy_fn(env)
            ticks_until = ticks_per_decision
            decisions += 1
        else:
            stale_ticks += 1
        _, _, done, info = env.step(held)
        ticks_until -= 1
        if env.ticks % 10 == 0:
            trace.append(round(info["err_m"], 6))
        if done:
            break
    return _build_metrics(
        "driving_100hz_chicane", policy_name, seed, latency_ms, ticks_per_decision,
        env.ticks, decisions, stale_ticks, env.sq_err_sum, env.max_overshoot,
        env.collision_count, abs(env.y - env.target_y), trace,
    )


def run_latency_quadrotor_rollout(
    *,
    seed: int = 42,
    latency_ms: float = 10.0,
    policy_name: str = "fast-route",
    total_ticks: int = 400,
) -> LatencyRolloutMetrics:
    """Run 100 Hz 6-DOF QuadrotorDroneEnv rollout under realistic agent inference lag."""
    if latency_ms < 0.0:
        raise ValueError("latency_ms must be non-negative")
    ticks_per_decision = max(1, int(math.ceil(latency_ms / (SIM_DT * 1000.0))))
    env = QuadrotorDroneEnv(dt=SIM_DT, max_steps=total_ticks)
    env.reset(seed=seed, wind_bias=(3.5, -2.5, 0.0), gust_sigma=1.1, target=(0.0, 0.0, 3.0))
    held = np.full(4, env.mass * env.planet.gravity * 0.25, dtype=np.float64)
    pending = quadrotor_action(env)
    ticks_until, decisions, stale_ticks = ticks_per_decision, 1, 0
    sq_err, max_over, collisions = 0.0, 0.0, 0
    trace: list[float] = []
    for step in range(total_ticks):
        t_sec = step * SIM_DT
        env.target = np.array([1.2 * math.sin(1.2 * t_sec), 0.8 * math.cos(1.2 * t_sec), 3.0], dtype=np.float64)
        if ticks_until <= 0:
            held, pending = pending, quadrotor_action(env)
            ticks_until = ticks_per_decision
            decisions += 1
        else:
            stale_ticks += 1
        _, _, done, info = env.step(held)
        ticks_until -= 1
        err = float(info["pos_err_m"])
        sq_err += err * err
        max_over = max(max_over, err)
        collisions += int(err > 1.8)
        if step % 10 == 0:
            trace.append(round(err, 6))
        if done:
            break
    return _build_metrics(
        "quadrotor_6dof_100hz", policy_name, seed, latency_ms, ticks_per_decision,
        env.steps, decisions, stale_ticks, sq_err, max_over,
        collisions, float(np.linalg.norm(env.pos - env.target)), trace,
    )


def verify_latency_faithful_clock(metrics: LatencyRolloutMetrics) -> tuple[bool, str]:
    """Fail-closed guard rejecting freeze-time/pause-and-cheat rollouts."""
    expected_ticks = max(1, int(math.ceil(metrics.latency_ms / (SIM_DT * 1000.0))))
    if metrics.ticks_per_decision < expected_ticks:
        return False, f"clock_cheat_ticks_per_decision:{metrics.ticks_per_decision}<{expected_ticks}"
    if metrics.latency_ms > 10.0 and metrics.stale_ticks <= 0:
        return False, "clock_cheat_zero_stale_ticks_under_latency"
    if metrics.world_ticks < (metrics.agent_decisions - 1) * expected_ticks:
        return False, "clock_cheat_world_paused_during_think"
    return True, "latency_faithful_100hz_verified"


def benchmark_fast_vs_overthinking(seed: int = 42) -> dict[str, object]:
    """Head-to-head DrivingBench v2 staleness benchmark: fast-route (10 ms) vs overthinking (180 ms)."""
    v_fast = run_latency_vehicle_rollout(seed=seed, latency_ms=10.0, policy_name="fast-route")
    v_slow = run_latency_vehicle_rollout(seed=seed, latency_ms=180.0, policy_name="overthinking-route")
    q_fast = run_latency_quadrotor_rollout(seed=seed, latency_ms=10.0, policy_name="fast-route")
    q_slow = run_latency_quadrotor_rollout(seed=seed, latency_ms=180.0, policy_name="overthinking-route")
    return {
        "seed": seed,
        "sim_hz": SIM_HZ,
        "vehicle_fast": v_fast.__dict__,
        "vehicle_overthinking": v_slow.__dict__,
        "vehicle_staleness_penalty_x": round(v_slow.tracking_rmse_m / max(v_fast.tracking_rmse_m, 1e-9), 4),
        "quadrotor_fast": q_fast.__dict__,
        "quadrotor_overthinking": q_slow.__dict__,
        "quadrotor_staleness_penalty_x": round(q_slow.tracking_rmse_m / max(q_fast.tracking_rmse_m, 1e-9), 4),
        "fast_beats_overthinking_vehicle": v_fast.tracking_rmse_m < v_slow.tracking_rmse_m and v_fast.collision_count <= v_slow.collision_count,
        "fast_beats_overthinking_quadrotor": q_fast.tracking_rmse_m < q_slow.tracking_rmse_m,
    }

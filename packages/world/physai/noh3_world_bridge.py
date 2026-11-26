# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Engine-to-Living-World (NOH-3) Bridge for Superframe world-tick orchestration.

Wires NOH-3 Buckingham-Pi dimensionless scale normalization, Caustic-Carved sparse tick
scheduling (held_tick_ratio > 0.70 on quiet actors), and CODIT per-actor fault-isolation
immunity directly into superframe's packages/world/physai world-tick loop so 1,000+ actors
(foliage, vehicles, props) run stably across orders-of-magnitude scales with zero OOD blowup.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Sequence

import numpy as np

from .tree_biomechanics import compute_tree_structure


@dataclass(frozen=True)
class CODITQuarantineEvent:
    """Record of an isolated actor fault prevented from corrupting the live world."""
    step: int
    actor_id: int
    kind: str
    reason: str


@dataclass
class WorldActor:
    """Heterogeneous living-world actor spanning foliage, vehicles, or rigid props."""
    actor_id: int
    kind: str
    length_scale_m: float
    vel_scale_m_s: float
    pos: np.ndarray
    vel: np.ndarray
    quat: np.ndarray = field(default_factory=lambda: np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float64))
    cached_delta: np.ndarray = field(default_factory=lambda: np.zeros(3, dtype=np.float64))
    last_energy: float = 0.0


class BuckinghamPiScaleNormalizer:
    """Dimensionless Buckingham-Pi normalizer preventing raw OOD polynomial blowup."""

    def __init__(self, length_scale_m: float, vel_scale_m_s: float, eps: float = 1e-6) -> None:
        self.l_scale = max(abs(float(length_scale_m)), eps)
        self.v_scale = max(abs(float(vel_scale_m_s)), eps)

    def to_pi(self, pos: np.ndarray, vel: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        return pos / self.l_scale, vel / self.v_scale

    def bound_pi_delta(self, pi_delta: np.ndarray, cap: float = 2.0) -> np.ndarray:
        return cap * np.tanh(pi_delta / cap)

    def from_pi_pos(self, pi_pos: np.ndarray) -> np.ndarray:
        return pi_pos * self.l_scale

    def from_pi_vel(self, pi_vel: np.ndarray) -> np.ndarray:
        return pi_vel * self.v_scale


class CausticSparseScheduler:
    """DS-08 caustic-carved asynchronous scheduler keeping quiet actors in a held frame."""

    def __init__(self, n_actors: int, surprise_threshold: float = 0.025) -> None:
        self.threshold = float(surprise_threshold)
        self.initialized = np.zeros(n_actors, dtype=bool)
        self.ticks_executed = 0
        self.ticks_held = 0

    def should_tick(self, idx: int, surprise_pi: float) -> bool:
        if (not self.initialized[idx]) or surprise_pi >= self.threshold:
            self.initialized[idx] = True
            self.ticks_executed += 1
            return True
        self.ticks_held += 1
        return False

    @property
    def held_tick_ratio(self) -> float:
        total = self.ticks_executed + self.ticks_held
        return (self.ticks_held / float(total)) if total > 0 else 0.0


class CODITFaultGuard:
    """Compartmentalizes NaN, Pi-norm explosion, and quaternion drift without halting the world."""

    def __init__(self, max_pi_norm: float = 8.0, quat_tol: float = 0.05) -> None:
        self.max_pi_norm = float(max_pi_norm)
        self.quat_tol = float(quat_tol)
        self.quarantined: set[int] = set()
        self.events: list[CODITQuarantineEvent] = []

    def inspect(self, step: int, actor: WorldActor, pi_pos: np.ndarray, pi_vel: np.ndarray) -> bool:
        if actor.actor_id in self.quarantined:
            return False
        if not (np.all(np.isfinite(pi_pos)) and np.all(np.isfinite(pi_vel)) and np.all(np.isfinite(actor.quat))):
            self._isolate(step, actor, "non_finite_state")
            return False
        pi_norm = float(np.linalg.norm(pi_vel))
        if pi_norm > self.max_pi_norm:
            self._isolate(step, actor, f"pi_vel_explosion:{pi_norm:.2f}")
            return False
        qnorm = float(np.linalg.norm(actor.quat))
        if abs(qnorm - 1.0) > self.quat_tol:
            self._isolate(step, actor, f"quaternion_norm_drift:{qnorm:.4f}")
            return False
        return True

    def _isolate(self, step: int, actor: WorldActor, reason: str) -> None:
        self.quarantined.add(actor.actor_id)
        actor.vel[:] = 0.0
        actor.quat = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float64)
        self.events.append(CODITQuarantineEvent(step, actor.actor_id, actor.kind, reason))


class LivingWorldTickBridge:
    """NOH-3 living-world tick orchestrator for 1,000+ multi-scale foliage/vehicle/prop actors."""

    def __init__(self, actors: Sequence[WorldActor], dt: float = 0.02, surprise_threshold: float = 0.025) -> None:
        self.actors = list(actors)
        self.dt = float(dt)
        self.scheduler = CausticSparseScheduler(len(self.actors), surprise_threshold=surprise_threshold)
        self.codit = CODITFaultGuard()
        self.step_count = 0

    def _integrate_actor(self, actor: WorldActor, norm: BuckinghamPiScaleNormalizer, wind_xy: np.ndarray, gust_force: float) -> None:
        pi_pos, pi_vel = norm.to_pi(actor.pos, actor.vel)
        # Dimensionless restoring + wind forcing bounded smoothly via Buckingham-Pi tanh cap
        pi_wind = np.array([wind_xy[0] / norm.v_scale, wind_xy[1] / norm.v_scale, 0.0], dtype=np.float64)
        if actor.kind == "foliage":
            pi_acc = -2.2 * pi_pos - 0.85 * pi_vel + 0.18 * gust_force * pi_wind
        elif actor.kind == "vehicle":
            pi_acc = -0.35 * pi_vel + 0.08 * pi_wind
        else:
            pi_acc = -1.5 * pi_vel
        pi_dv = norm.bound_pi_delta(pi_acc * self.dt, cap=1.5)
        pi_vel_next = pi_vel + pi_dv
        pi_dp = norm.bound_pi_delta(pi_vel_next * self.dt, cap=1.5)
        actor.vel = norm.from_pi_vel(pi_vel_next)
        actor.pos = actor.pos + norm.from_pi_pos(pi_dp)
        actor.cached_delta = norm.from_pi_pos(pi_dp)

    def tick(
        self,
        wind_xy: tuple[float, float] = (0.0, 0.0),
        *,
        active_ids: set[int] | None = None,
        faults: dict[int, dict[str, object]] | None = None,
    ) -> dict[str, float | int]:
        """Advance all actors one world tick with Buckingham-Pi scaling, Caustic scheduling, and CODIT immunity."""
        self.step_count += 1
        wind = np.asarray(wind_xy, dtype=np.float64)
        wind_mag = float(np.linalg.norm(wind))
        active_set = active_ids or set()
        executed_now = 0
        for idx, actor in enumerate(self.actors):
            if faults and actor.actor_id in faults:
                spec = faults[actor.actor_id]
                if "vel" in spec:
                    actor.vel = np.asarray(spec["vel"], dtype=np.float64)
                if "quat" in spec:
                    actor.quat = np.asarray(spec["quat"], dtype=np.float64)
            norm = BuckinghamPiScaleNormalizer(actor.length_scale_m, actor.vel_scale_m_s)
            pi_pos, pi_vel = norm.to_pi(actor.pos, actor.vel)
            if not self.codit.inspect(self.step_count, actor, pi_pos, pi_vel):
                continue
            local_gust = 1.0 if actor.actor_id in active_set else 0.0
            surprise_pi = float(np.linalg.norm(pi_vel)) + local_gust * (wind_mag / norm.v_scale)
            if self.scheduler.should_tick(idx, surprise_pi):
                self._integrate_actor(actor, norm, wind, local_gust)
                executed_now += 1
            else:
                actor.pos = actor.pos + 0.0 * actor.cached_delta
        return {
            "step": self.step_count,
            "actor_count": len(self.actors),
            "executed_now": executed_now,
            "held_tick_ratio": round(self.scheduler.held_tick_ratio, 4),
            "quarantined_count": len(self.codit.quarantined),
        }


def spawn_mixed_world_actors(count: int = 1000, seed: int = 2026) -> list[WorldActor]:
    """Generate a multi-scale population (foliage 0.5-35 m, vehicles 10-500 m, props 0.2-2 m)."""
    rng = np.random.default_rng(seed)
    actors: list[WorldActor] = []
    species_list = ("birch", "spruce", "oak", "eucalyptus")
    for i in range(count):
        if i % 10 < 7:
            st = compute_tree_structure(species_list[i % 4], float(rng.uniform(0.14, 0.65)))
            actors.append(WorldActor(i, "foliage", st.height_m, max(1.0, st.height_m * 0.4), np.zeros(3), np.zeros(3)))
        elif i % 10 < 9:
            scale = float(rng.uniform(10.0, 450.0))
            actors.append(WorldActor(i, "vehicle", scale, max(5.0, scale * 0.25), np.zeros(3), np.zeros(3)))
        else:
            actors.append(WorldActor(i, "prop", float(rng.uniform(0.2, 2.0)), 1.0, np.zeros(3), np.zeros(3)))
    return actors

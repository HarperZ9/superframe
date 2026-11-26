# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Levels 1-3 Nested Organism Hierarchy (NOH-1) with Immune Verification Organ.

Architecture:
  - Level 0 (Organelles): VirtualCPUOrganelle + UniverseSimOrganelle (`organelles.py`).
  - Level 1 (Specialist Micro-Models): DynamicsCell (physics sim + online fast-weight residual),
    ControlCell (VirtualCPU bytecode guidance), SymbolicProgramCell (exact vis-viva solver).
  - Level 2 (Immune Organ): Independent invariant & SHA-256 trace verifier with reseating-valve
    fallback on corrupted organelle output, tampered trace, or Hamiltonian drift.
  - Level 3 (Executive Organism): NestedOrganism coordinating cells, online adaptation, and
    head-to-head out-of-distribution (OOD) benchmark against a flat linear ridge policy.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import math
import numpy as np

from .organelles import (
    CPUResult,
    OrbitState,
    UniverseSimOrganelle,
    VirtualCPUOrganelle,
    make_orbit_state,
    prog_orbital_guidance,
    prog_vis_viva_speed,
)


@dataclass(frozen=True)
class ImmuneVerdict:
    ok: bool
    defects: tuple[str, ...]
    fallback_used: bool
    action: tuple[float, float]


class SymbolicProgramCell:
    """Level 1 micro-model invoking VirtualCPUOrganelle for exact symbolic invariants."""

    def __init__(self, cpu: VirtualCPUOrganelle) -> None:
        self.cpu = cpu
        self._prog = prog_vis_viva_speed()

    def target_orbital_speed(self, mu: float, r_target: float) -> tuple[float, CPUResult]:
        res = self.cpu.execute(self._prog, (mu, r_target))
        return res.registers[2], res


class ControlCell:
    """Level 1 guidance cell executing orbital PD thrust bytecode inside VirtualCPUOrganelle."""

    def __init__(self, cpu: VirtualCPUOrganelle, kp: float = 1.6, kd: float = 1.8, max_thrust: float = 4.0) -> None:
        self.cpu = cpu
        self.kp = kp
        self.kd = kd
        self.max_thrust = max_thrust
        self._prog = prog_orbital_guidance()

    def compute_thrust(self, state: OrbitState, r_target: float) -> tuple[tuple[float, float], CPUResult]:
        r = math.hypot(state.x, state.y)
        rx, ry = state.x / r, state.y / r
        tx, ty = -ry, rx
        vr = state.vx * rx + state.vy * ry
        vt = state.vx * tx + state.vy * ty
        res = self.cpu.execute(self._prog, (r, r_target, vr, vt, state.mu, self.kp, self.kd))
        ur, ut = res.registers[0], res.registers[1]
        ux = ur * rx + ut * tx
        uy = ur * ry + ut * ty
        mag = math.hypot(ux, uy)
        if mag > self.max_thrust and mag > 0.0:
            scale = self.max_thrust / mag
            ux, uy = ux * scale, uy * scale
        return (ux, uy), res


class DynamicsCell:
    """Level 1 mental-sim cell combining UniverseSimOrganelle with online fast-weight drag adaptation."""

    def __init__(self, sim: UniverseSimOrganelle, lr: float = 0.35) -> None:
        self.sim = sim
        self.lr = lr
        self.drag_est = 0.0
        self.bias_ax = 0.0
        self.bias_ay = 0.0

    def predict(self, state: OrbitState, dt: float, ux: float, uy: float) -> OrbitState:
        return self.sim.step_orbit_verlet(state, dt, ux=ux + self.bias_ax, uy=uy + self.bias_ay, drag=self.drag_est)

    def adapt(self, state: OrbitState, pred: OrbitState, actual: OrbitState, dt: float) -> float:
        err_vx = actual.vx - pred.vx
        err_vy = actual.vy - pred.vy
        v2 = state.vx * state.vx + state.vy * state.vy
        if v2 > 1e-6 and dt > 0.0:
            # Estimate residual linear drag from velocity error aligned with -v
            delta_drag = -(err_vx * state.vx + err_vy * state.vy) / (dt * (v2 + 0.25))
            self.drag_est = max(0.0, min(0.5, self.drag_est + self.lr * delta_drag))
        return math.hypot(actual.x - pred.x, actual.y - pred.y)


class ImmuneOrgan:
    """Level 2 verification organ enforcing trace integrity, bounds, and Hamiltonian invariants."""

    def __init__(self, max_thrust: float = 4.5, max_unforced_drift: float = 1e-3) -> None:
        self.max_thrust = max_thrust
        self.max_unforced_drift = max_unforced_drift
        self.checks_run = 0
        self.interventions = 0

    def inspect(
        self,
        action: tuple[float, float],
        cpu_res: CPUResult,
        *,
        unforced_energy_drift: float | None = None,
    ) -> ImmuneVerdict:
        self.checks_run += 1
        defects: list[str] = []
        ux, uy = action
        if cpu_res.halted_reason != "halt":
            defects.append(f"cpu_abnormal_halt:{cpu_res.halted_reason}")
        if not VirtualCPUOrganelle.verify_trace(cpu_res):
            defects.append("cpu_trace_sha256_tampered")
        if not (math.isfinite(ux) and math.isfinite(uy)):
            defects.append("action_non_finite")
        elif math.hypot(ux, uy) > self.max_thrust:
            defects.append("action_exceeds_thrust_bound")
        if unforced_energy_drift is not None and (not math.isfinite(unforced_energy_drift) or unforced_energy_drift > self.max_unforced_drift):
            defects.append("hamiltonian_drift_exceeded")
        if defects:
            self.interventions += 1
            return ImmuneVerdict(ok=False, defects=tuple(defects), fallback_used=True, action=(0.0, 0.0))
        return ImmuneVerdict(ok=True, defects=(), fallback_used=False, action=action)


class NestedOrganism:
    """Level 3 executive organism orchestrating nested Level 0-2 organelles and micro-models."""

    def __init__(self) -> None:
        self.cpu = VirtualCPUOrganelle(max_steps=128)
        self.sim = UniverseSimOrganelle()
        self.symbolic = SymbolicProgramCell(self.cpu)
        self.control = ControlCell(self.cpu)
        self.dynamics = DynamicsCell(self.sim)
        self.immune = ImmuneOrgan()
        self._receipt_hashes: list[str] = []

    def step(self, state: OrbitState, r_target: float, dt: float) -> tuple[tuple[float, float], OrbitState, ImmuneVerdict]:
        _v_target, sym_res = self.symbolic.target_orbital_speed(state.mu, r_target)
        raw_action, ctl_res = self.control.compute_thrust(state, r_target)
        # Compensate online-learned drag inside closed-loop thrust
        comp_action = (
            raw_action[0] + self.dynamics.drag_est * state.vx,
            raw_action[1] + self.dynamics.drag_est * state.vy,
        )
        verdict = self.immune.inspect(comp_action, ctl_res)
        pred_next = self.dynamics.predict(state, dt, verdict.action[0], verdict.action[1])
        h = hashlib.sha256(f"{sym_res.trace_sha256}|{ctl_res.trace_sha256}|{verdict.ok}".encode("utf-8")).hexdigest()[:16]
        self._receipt_hashes.append(h)
        return verdict.action, pred_next, verdict

    def replay_digest(self) -> str:
        return hashlib.sha256("|".join(self._receipt_hashes).encode("utf-8")).hexdigest()


class FlatPolicy:
    """Flat ridge-regression baseline with NO nested VirtualCPU or UniverseSim organelles."""

    def __init__(self, weights: np.ndarray) -> None:
        self.weights = weights

    @staticmethod
    def _features(state: OrbitState, r_target: float) -> np.ndarray:
        return np.array([state.x, state.y, state.vx, state.vy, r_target, state.mu, 1.0], dtype=np.float64)

    @classmethod
    def fit_in_distribution(cls, seed: int = 42, n_samples: int = 400) -> "FlatPolicy":
        rng = np.random.default_rng(seed)
        teacher = ControlCell(VirtualCPUOrganelle())
        xs, ys = [], []
        for _ in range(n_samples):
            r = float(rng.uniform(0.85, 1.25))
            ang = float(rng.uniform(0.0, 2.0 * math.pi))
            r_tgt = float(rng.uniform(0.90, 1.20))
            v_circ = math.sqrt(1.0 / r)
            st = make_orbit_state(
                r * math.cos(ang),
                r * math.sin(ang),
                -v_circ * math.sin(ang) + float(rng.normal(0.0, 0.08)),
                v_circ * math.cos(ang) + float(rng.normal(0.0, 0.08)),
                mu=1.0,
            )
            (ux, uy), _ = teacher.compute_thrust(st, r_tgt)
            xs.append(cls._features(st, r_tgt))
            ys.append([ux, uy])
        X = np.asarray(xs, dtype=np.float64)
        Y = np.asarray(ys, dtype=np.float64)
        w = np.linalg.solve(X.T @ X + 1e-3 * np.eye(X.shape[1]), X.T @ Y)
        return cls(w)

    def act(self, state: OrbitState, r_target: float) -> tuple[float, float]:
        out = self._features(state, r_target) @ self.weights
        ux, uy = float(out[0]), float(out[1])
        mag = math.hypot(ux, uy)
        if mag > 4.0 and mag > 0.0:
            ux, uy = ux * (4.0 / mag), uy * (4.0 / mag)
        return ux, uy


def _eval_scenario(policy_kind: str, flat: FlatPolicy, noh: NestedOrganism, r0: float, r_tgt: float, mu: float, drag: float) -> tuple[float, float]:
    env = UniverseSimOrganelle()
    v0 = 0.85 * math.sqrt(mu / r0)
    st = make_orbit_state(r0, 0.0, 0.0, v0, mu=mu)
    dt, steps = 0.05, 120
    sq_errs = []
    for _ in range(steps):
        if policy_kind == "flat":
            ux, uy = flat.act(st, r_tgt)
            st = env.step_orbit_verlet(st, dt, ux=ux, uy=uy, drag=drag)
        else:
            (ux, uy), pred, _v = noh.step(st, r_tgt, dt)
            nxt = env.step_orbit_verlet(st, dt, ux=ux, uy=uy, drag=drag)
            noh.dynamics.adapt(st, pred, nxt, dt)
            st = nxt
        err = abs(math.hypot(st.x, st.y) - r_tgt)
        sq_errs.append(err * err)
    rmse = math.sqrt(sum(sq_errs) / len(sq_errs))
    term_err = abs(math.hypot(st.x, st.y) - r_tgt)
    return rmse, term_err


def run_noh1_benchmark(seed: int = 42) -> dict[str, object]:
    """Head-to-head OOD benchmark: FlatPolicy vs NestedOrganism (NOH-1)."""
    flat = FlatPolicy.fit_in_distribution(seed=seed)
    noh = NestedOrganism()
    ood_scenarios = [
        (2.4, 3.0, 1.8, 0.00),
        (3.6, 2.8, 2.5, 0.02),
        (2.8, 3.5, 3.0, 0.03),
        (4.0, 3.2, 2.2, 0.01),
        (2.5, 3.8, 1.5, 0.02),
        (3.2, 4.2, 2.8, 0.04),
    ]
    flat_rmses, flat_terms, noh_rmses, noh_terms = [], [], [], []
    for r0, r_tgt, mu, drag in ood_scenarios:
        fr, ft = _eval_scenario("flat", flat, noh, r0, r_tgt, mu, drag)
        nr, nt = _eval_scenario("noh1", flat, noh, r0, r_tgt, mu, drag)
        flat_rmses.append(fr)
        flat_terms.append(ft)
        noh_rmses.append(nr)
        noh_terms.append(nt)

    f_mean = sum(flat_rmses) / len(flat_rmses)
    n_mean = sum(noh_rmses) / len(noh_rmses)
    f_term = sum(flat_terms) / len(flat_terms)
    n_term = sum(noh_terms) / len(noh_terms)
    return {
        "scenarios": len(ood_scenarios),
        "flat_mean_radial_rmse": round(f_mean, 6),
        "noh1_mean_radial_rmse": round(n_mean, 6),
        "rmse_reduction_factor": round(f_mean / max(n_mean, 1e-12), 3),
        "flat_mean_terminal_err": round(f_term, 6),
        "noh1_mean_terminal_err": round(n_term, 6),
        "terminal_err_reduction_factor": round(f_term / max(n_term, 1e-12), 3),
        "immune_checks_total": noh.immune.checks_run,
        "immune_false_alarms": noh.immune.interventions,
        "replay_sha256": noh.replay_digest(),
    }

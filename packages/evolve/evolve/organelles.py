# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Level 0 deterministic nested organelles: VirtualCPUOrganelle and UniverseSimOrganelle.

Provides an embedded IEEE-754 register-VM with step-budget safety valves and canonical
SHA-256 execution traces, paired with a symplectic Velocity-Verlet orbital and drag-oscillator
physics simulator usable as both an internal mental-model organelle and an external environment.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import math
from typing import Sequence


@dataclass(frozen=True)
class CPUResult:
    registers: tuple[float, ...]
    stack: tuple[float, ...]
    steps: int
    halted_reason: str  # "halt" | "budget_exceeded" | "error"
    trace_sha256: str
    trace_lines: tuple[str, ...]


def _hash_trace(lines: Sequence[str]) -> str:
    h = hashlib.sha256()
    for ln in lines:
        h.update(ln.encode("utf-8"))
        h.update(b"\n")
    return h.hexdigest()


class VirtualCPUOrganelle:
    """Compact deterministic 8-register + stack IEEE-754 float64 virtual CPU organelle."""

    NUM_REGS = 8

    def __init__(self, max_steps: int = 256) -> None:
        self.max_steps = max_steps

    @staticmethod
    def verify_trace(res: CPUResult) -> bool:
        return _hash_trace(res.trace_lines) == res.trace_sha256

    def _exec_alu(self, op: str, args: tuple, regs: list[float], stack: list[float]) -> bool:
        if op == "CONST":
            regs[args[0]] = float(args[1])
        elif op == "MOV":
            regs[args[0]] = regs[args[1]]
        elif op == "ADD":
            regs[args[0]] = regs[args[1]] + regs[args[2]]
        elif op == "SUB":
            regs[args[0]] = regs[args[1]] - regs[args[2]]
        elif op == "MUL":
            regs[args[0]] = regs[args[1]] * regs[args[2]]
        elif op == "DIV":
            if regs[args[2]] == 0.0:
                return False
            regs[args[0]] = regs[args[1]] / regs[args[2]]
        elif op == "FMA":
            regs[args[0]] = regs[args[1]] * regs[args[2]] + regs[args[3]]
        elif op == "SQRT":
            if regs[args[1]] < 0.0:
                return False
            regs[args[0]] = math.sqrt(regs[args[1]])
        elif op == "ABS":
            regs[args[0]] = abs(regs[args[1]])
        elif op == "NEG":
            regs[args[0]] = -regs[args[1]]
        elif op == "PUSH":
            stack.append(regs[args[0]])
        elif op == "POP":
            if not stack:
                return False
            regs[args[0]] = stack.pop()
        else:
            return False
        return True

    def execute(self, program: Sequence[tuple], init_regs: Sequence[float] = ()) -> CPUResult:
        regs = [0.0] * self.NUM_REGS
        for i, val in enumerate(init_regs[: self.NUM_REGS]):
            regs[i] = float(val)
        stack: list[float] = []
        trace: list[str] = []
        pc, cmp_flag, steps, reason = 0, 0, 0, "halt"
        n_ins = len(program)

        while 0 <= pc < n_ins:
            if steps >= self.max_steps:
                reason = "budget_exceeded"
                break
            ins = program[pc]
            op, args = str(ins[0]), tuple(ins[1:])
            steps += 1
            if op == "HALT":
                trace.append(f"{pc}:HALT:{regs[0]:.12g}:{regs[1]:.12g}")
                break
            if op == "CMP":
                diff = regs[args[0]] - regs[args[1]]
                cmp_flag = -1 if diff < 0.0 else (1 if diff > 0.0 else 0)
                pc += 1
            elif op == "JMP":
                pc = int(args[0])
            elif op == "JZ":
                pc = int(args[0]) if cmp_flag == 0 else pc + 1
            elif op == "JLT":
                pc = int(args[0]) if cmp_flag < 0 else pc + 1
            else:
                if not self._exec_alu(op, args, regs, stack):
                    reason = "error"
                    trace.append(f"{pc}:ERR:{op}")
                    break
                pc += 1
            trace.append(f"{pc}:{op}:{regs[0]:.12g}:{regs[1]:.12g}:{regs[2]:.12g}")

        return CPUResult(
            registers=tuple(regs),
            stack=tuple(stack),
            steps=steps,
            halted_reason=reason,
            trace_sha256=_hash_trace(trace),
            trace_lines=tuple(trace),
        )


def prog_vis_viva_speed() -> tuple[tuple, ...]:
    """Bytecode: R0=mu, R1=r -> R2=sqrt(mu / r)."""
    return (
        ("DIV", 2, 0, 1),
        ("SQRT", 2, 2),
        ("HALT",),
    )


def prog_orbital_guidance() -> tuple[tuple, ...]:
    """Exact IEEE-754 guidance bytecode inside VirtualCPUOrganelle.

    Inputs:  R0=r, R1=r_target, R2=vr, R3=vt, R4=mu, R5=kp, R6=kd
    Outputs: R0=u_r = kp*(r_target - r) - kd*vr, R1=u_t = kd*(sqrt(mu/r_target) - vt), R2=v_target
    """
    return (
        ("PUSH", 2),             # stack <- vr
        ("DIV", 7, 4, 1),        # R7 = mu / r_target
        ("SQRT", 2, 7),          # R2 = v_target = sqrt(mu / r_target)
        ("SUB", 7, 1, 0),        # R7 = r_target - r
        ("MUL", 0, 5, 7),        # R0 = kp * (r_target - r)
        ("POP", 7),              # R7 = vr
        ("NEG", 7, 7),           # R7 = -vr
        ("FMA", 0, 6, 7, 0),     # R0 = kd * (-vr) + kp * (r_target - r) = u_r
        ("SUB", 7, 2, 3),        # R7 = v_target - vt
        ("MUL", 1, 6, 7),        # R1 = kd * (v_target - vt) = u_t
        ("HALT",),
    )


@dataclass(frozen=True)
class OrbitState:
    x: float
    y: float
    vx: float
    vy: float
    mu: float
    t: float
    energy: float
    ang_mom: float


def orbital_invariants(x: float, y: float, vx: float, vy: float, mu: float) -> tuple[float, float]:
    r = math.hypot(x, y)
    energy = 0.5 * (vx * vx + vy * vy) - mu / r
    ang_mom = x * vy - y * vx
    return energy, ang_mom


def make_orbit_state(x: float, y: float, vx: float, vy: float, mu: float = 1.0, t: float = 0.0) -> OrbitState:
    e, l = orbital_invariants(x, y, vx, vy, mu)
    return OrbitState(x=x, y=y, vx=vx, vy=vy, mu=mu, t=t, energy=e, ang_mom=l)


class UniverseSimOrganelle:
    """Symplectic Velocity-Verlet orbital & damped-oscillator physics organelle."""

    @staticmethod
    def _accel(x: float, y: float, vx: float, vy: float, mu: float, ux: float, uy: float, drag: float) -> tuple[float, float]:
        r2 = x * x + y * y
        r = math.sqrt(r2)
        inv_r3 = 1.0 / (r2 * r)
        ax = -mu * x * inv_r3 + ux - drag * vx
        ay = -mu * y * inv_r3 + uy - drag * vy
        return ax, ay

    def step_orbit_verlet(
        self,
        state: OrbitState,
        dt: float,
        ux: float = 0.0,
        uy: float = 0.0,
        drag: float = 0.0,
    ) -> OrbitState:
        ax0, ay0 = self._accel(state.x, state.y, state.vx, state.vy, state.mu, ux, uy, drag)
        vx_half = state.vx + 0.5 * dt * ax0
        vy_half = state.vy + 0.5 * dt * ay0
        x1 = state.x + dt * vx_half
        y1 = state.y + dt * vy_half
        ax1, ay1 = self._accel(x1, y1, vx_half, vy_half, state.mu, ux, uy, drag)
        vx1 = vx_half + 0.5 * dt * ax1
        vy1 = vy_half + 0.5 * dt * ay1
        return make_orbit_state(x1, y1, vx1, vy1, state.mu, state.t + dt)

    def step_orbit_euler(
        self,
        state: OrbitState,
        dt: float,
        ux: float = 0.0,
        uy: float = 0.0,
        drag: float = 0.0,
    ) -> OrbitState:
        ax, ay = self._accel(state.x, state.y, state.vx, state.vy, state.mu, ux, uy, drag)
        x1 = state.x + dt * state.vx
        y1 = state.y + dt * state.vy
        vx1 = state.vx + dt * ax
        vy1 = state.vy + dt * ay
        return make_orbit_state(x1, y1, vx1, vy1, state.mu, state.t + dt)

    def rollout_orbit(
        self,
        state: OrbitState,
        dt: float,
        steps: int,
        integrator: str = "verlet",
        drag: float = 0.0,
    ) -> tuple[OrbitState, float]:
        cur = state
        e0 = abs(state.energy) if abs(state.energy) > 1e-12 else 1.0
        max_rel_drift = 0.0
        step_fn = self.step_orbit_verlet if integrator == "verlet" else self.step_orbit_euler
        for _ in range(steps):
            cur = step_fn(cur, dt, drag=drag)
            drift = abs(cur.energy - state.energy) / e0
            if drift > max_rel_drift:
                max_rel_drift = drift
        return cur, max_rel_drift

    @staticmethod
    def step_drag_oscillator(x: float, v: float, dt: float, omega: float, gamma: float, u: float = 0.0) -> tuple[float, float]:
        a0 = -(omega * omega) * x - gamma * v + u
        v_half = v + 0.5 * dt * a0
        x1 = x + dt * v_half
        a1 = -(omega * omega) * x1 - gamma * v_half + u
        return x1, v_half + 0.5 * dt * a1

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known-answer, planted-failure, and OOD generalization tests for NOH-1 nested organism.

Run: python -I -B -m pytest -p no:cacheprovider packages/evolve/tests/test_nested_organism.py
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from evolve.nested_organism import ImmuneOrgan, NestedOrganism, run_noh1_benchmark  # noqa: E402
from evolve.organelles import (  # noqa: E402
    CPUResult,
    UniverseSimOrganelle,
    VirtualCPUOrganelle,
    make_orbit_state,
    prog_orbital_guidance,
    prog_vis_viva_speed,
)


def test_virtual_cpu_known_answers_and_budget_valve():
    """Exact IEEE-754 bytecode execution, SHA-256 trace verification, and infinite-loop valve."""
    cpu = VirtualCPUOrganelle(max_steps=64)
    res_vv = cpu.execute(prog_vis_viva_speed(), (4.0, 2.0))
    assert res_vv.halted_reason == "halt"
    assert math.isclose(res_vv.registers[2], math.sqrt(2.0), rel_tol=1e-12, abs_tol=0.0)
    assert VirtualCPUOrganelle.verify_trace(res_vv)

    # Exact orbital PD guidance bytecode check: r=2, r_target=3, vr=0.5, vt=0.5, mu=3, kp=2, kd=1.5
    res_gd = cpu.execute(prog_orbital_guidance(), (2.0, 3.0, 0.5, 0.5, 3.0, 2.0, 1.5))
    assert res_gd.halted_reason == "halt"
    assert math.isclose(res_gd.registers[0], 2.0 * (3.0 - 2.0) - 1.5 * 0.5, rel_tol=1e-12)
    assert math.isclose(res_gd.registers[1], 1.5 * (1.0 - 0.5), rel_tol=1e-12)
    assert VirtualCPUOrganelle.verify_trace(res_gd)

    # Deterministic repeat produces identical trace SHA-256
    res_gd2 = cpu.execute(prog_orbital_guidance(), (2.0, 3.0, 0.5, 0.5, 3.0, 2.0, 1.5))
    assert res_gd.trace_sha256 == res_gd2.trace_sha256

    # Planted infinite-loop control MUST be halted cleanly by step-budget valve
    infinite_loop = (("ADD", 0, 0, 1), ("JMP", 0))
    res_inf = cpu.execute(infinite_loop, (0.0, 1.0))
    assert res_inf.halted_reason == "budget_exceeded"
    assert res_inf.steps == 64


def test_universe_sim_symplectic_conservation_vs_planted_euler():
    """Velocity-Verlet conserves Hamiltonian energy < 1e-5; planted Forward-Euler MUST fail."""
    sim = UniverseSimOrganelle()
    # Eccentric elliptical orbit (e = 0.3): r_peri = 1.0, v_peri = sqrt(1.3)
    st0 = make_orbit_state(1.0, 0.0, 0.0, math.sqrt(1.3), mu=1.0)
    final_v, drift_v = sim.rollout_orbit(st0, dt=0.005, steps=4000, integrator="verlet")
    assert drift_v < 1e-5, f"Symplectic Verlet energy drift too large: {drift_v}"
    assert abs(final_v.ang_mom - st0.ang_mom) < 1e-11

    # Planted unstable Euler control MUST drift severely (> 1e-2 relative energy error)
    _final_e, drift_e = sim.rollout_orbit(st0, dt=0.005, steps=4000, integrator="euler")
    assert drift_e > 1e-2, f"Planted Forward-Euler control failed to diverge: {drift_e}"

    # Damped oscillator energy strictly decays under positive drag gamma > 0
    x, v = 1.0, 0.0
    e_init = 0.5 * (v * v + 4.0 * x * x)
    for _ in range(50):
        x, v = sim.step_drag_oscillator(x, v, dt=0.02, omega=2.0, gamma=0.25)
    e_end = 0.5 * (v * v + 4.0 * x * x)
    assert e_end < e_init * 0.85


def test_noh1_outperforms_flat_policy_ood_and_replays_bit_exact():
    """NestedOrganism (NOH-1) beats FlatPolicy on OOD orbital control with bit-exact replay."""
    r1 = run_noh1_benchmark(seed=42)
    r2 = run_noh1_benchmark(seed=42)
    assert r1["replay_sha256"] == r2["replay_sha256"]
    assert r1["noh1_mean_radial_rmse"] < r1["flat_mean_radial_rmse"]
    assert r1["rmse_reduction_factor"] >= 2.0
    assert r1["noh1_mean_terminal_err"] < r1["flat_mean_terminal_err"] * 0.25
    assert r1["immune_checks_total"] == 720
    assert r1["immune_false_alarms"] == 0


def test_immune_organ_kills_all_planted_corruptions_and_reseats():
    """Level 2 ImmuneOrgan catches 4/4 planted defects (0 false accepts) and reseats cleanly."""
    cpu = VirtualCPUOrganelle(max_steps=32)
    immune = ImmuneOrgan(max_thrust=4.5, max_unforced_drift=1e-3)
    good_res = cpu.execute(prog_vis_viva_speed(), (2.0, 1.0))

    # Clean control passes
    clean_v = immune.inspect((0.5, -0.5), good_res, unforced_energy_drift=1e-6)
    assert clean_v.ok and not clean_v.fallback_used and clean_v.action == (0.5, -0.5)

    # Planted defect 1: NaN organelle output
    v_nan = immune.inspect((float("nan"), 0.1), good_res)
    # Planted defect 2: Tampered SHA-256 execution trace hash
    tampered = CPUResult(
        registers=good_res.registers,
        stack=good_res.stack,
        steps=good_res.steps,
        halted_reason=good_res.halted_reason,
        trace_sha256="0" * 64,
        trace_lines=good_res.trace_lines,
    )
    v_tamper = immune.inspect((0.2, 0.2), tampered)
    # Planted defect 3: Budget-exceeded CPU loop
    inf_res = cpu.execute((("JMP", 0),))
    v_budget = immune.inspect((0.1, 0.1), inf_res)
    # Planted defect 4: Excessive unforced Hamiltonian energy drift
    v_drift = immune.inspect((0.1, 0.1), good_res, unforced_energy_drift=0.05)

    planted = [v_nan, v_tamper, v_budget, v_drift]
    assert all((not v.ok) and v.fallback_used and v.action == (0.0, 0.0) for v in planted)
    assert immune.interventions == 4

    # Reseating valve: organism continues cleanly on next valid step
    noh = NestedOrganism()
    act, pred, verdict = noh.step(make_orbit_state(2.0, 0.0, 0.0, 0.7, mu=1.0), r_target=2.5, dt=0.05)
    assert verdict.ok and math.isfinite(pred.x) and math.isfinite(act[0])

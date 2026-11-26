# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Known-answer physical laws and planted-failure controls for packages/world/physai."""
from __future__ import annotations

import copy
import math
import sys
from pathlib import Path

import numpy as np
import pytest

WORLD_ROOT = Path(__file__).resolve().parents[2]
if str(WORLD_ROOT) not in sys.path:
    sys.path.insert(0, str(WORLD_ROOT))

from physai import (  # noqa: E402
    BipedBalanceContactEnv,
    ContactConstraint,
    ContactPlane,
    OrbitalRendezvousEnv,
    PlanarArmReachEnv,
    RigidBody,
    balance_action,
    docking_action,
    emit_episode_receipt,
    mechanical_energy,
    plan_arm_torque,
    step_rigid_world,
    trajectory_sha256,
    verify_contact_physics,
    verify_episode_receipt,
)


# ---------------------------------------------------------------------------
# 1. Known-Answer Bounce Restitution Height Law (h1 / h0 == e^2)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("e_val", [0.5, 0.7])
def test_bounce_restitution_height_law_and_energy_decay(e_val: float):
    """Dropping from h0 under gravity gives rebound apex h1 / h0 == e^2 and non-increasing energy."""
    g, h0, radius, dt = 9.80665, 2.0, 0.1, 0.001
    body = RigidBody(np.array([0.0, 0.0, h0 + radius]), np.zeros(3), mass=1.0, radius=radius, restitution=e_val, friction=0.3)
    plane = ContactPlane.horizontal(0.0, friction=0.3, restitution=e_val)
    e0 = mechanical_energy([body], gravity=g)

    bounced = False
    peak_after = 0.0
    for _ in range(1800):
        e_pre = mechanical_energy([body], gravity=g)
        contacts = step_rigid_world([body], [plane], dt, gravity=g, integrator="velocity_verlet")
        e_post = mechanical_energy([body], gravity=g)
        if contacts:
            ok, errs = verify_contact_physics(contacts, e_pre=e_pre, e_post=e_post)
            assert ok, errs
            if body.vel[2] > 0.1:
                bounced = True
        if bounced:
            h = float(body.pos[2] - radius)
            if h > peak_after:
                peak_after = h
            elif body.vel[2] < -0.1:
                break

    assert bounced
    ratio = peak_after / h0
    assert abs(ratio - e_val * e_val) < 0.025, (e_val, ratio, e_val * e_val)
    assert mechanical_energy([body], gravity=g) <= e0 + 1e-3


# ---------------------------------------------------------------------------
# 2. Known-Answer Coulomb Friction Incline Law (Static vs Sliding)
# ---------------------------------------------------------------------------

def test_coulomb_incline_static_equilibrium_and_sliding_acceleration():
    """tan(theta) < mu remains static; tan(theta) > mu accelerates at g*(sin(theta) - mu*cos(theta))."""
    g, dt = 9.80665, 0.002

    # Static case: theta = 15 deg (tan = 0.2679) < mu = 0.5
    th_static = math.radians(15.0)
    pl_static = ContactPlane.incline(th_static, friction=0.5, restitution=0.0)
    b_static = RigidBody(pl_static.normal * 0.1, np.zeros(3), mass=2.0, radius=0.1, restitution=0.0, friction=0.5)
    start_pos = b_static.pos.copy()
    for _ in range(250):
        contacts = step_rigid_world([b_static], [pl_static], dt, gravity=g)
        ok, errs = verify_contact_physics(contacts)
        assert ok, errs
    assert float(np.linalg.norm(b_static.vel)) < 1e-5
    assert float(np.linalg.norm(b_static.pos - start_pos)) < 1e-4

    # Sliding case: theta = 35 deg (tan = 0.7002) > mu = 0.2
    th_slide = math.radians(35.0)
    mu_slide = 0.2
    pl_slide = ContactPlane.incline(th_slide, friction=mu_slide, restitution=0.0)
    b_slide = RigidBody(pl_slide.normal * 0.1, np.zeros(3), mass=2.0, radius=0.1, restitution=0.0, friction=mu_slide)
    t_hat = np.array([math.cos(th_slide), 0.0, -math.sin(th_slide)], dtype=np.float64)
    n_steps = 400
    for _ in range(n_steps):
        contacts = step_rigid_world([b_slide], [pl_slide], dt, gravity=g)
        ok, errs = verify_contact_physics(contacts)
        assert ok, errs
    total_t = n_steps * dt
    v_down = float(np.dot(b_slide.vel, t_hat))
    a_expected = g * (math.sin(th_slide) - mu_slide * math.cos(th_slide))
    a_measured = v_down / total_t
    assert abs(a_measured - a_expected) / a_expected < 0.02, (a_measured, a_expected)


# ---------------------------------------------------------------------------
# 3. Closed-Loop Physical-AI Environments & Deterministic Seed Replay
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("planet", ["earth", "moon", "mars"])
def test_planar_arm_reach_closed_loop_and_torque_clamp(planet: str):
    """PlanarArmReachEnv reaches target under Earth/Moon/Mars gravity and enforces torque clamps."""
    env = PlanarArmReachEnv()
    env.reset(seed=7, planet=planet)
    # Planted over-torque control: 999 N*m command must clamp to tau_max
    clamped = env.clamp_torque(np.array([999.0, -999.0]))
    assert abs(float(clamped[0])) <= env.tau_max + 1e-12
    assert abs(float(clamped[1])) <= env.tau_max + 1e-12

    info = {}
    for _ in range(env.max_steps):
        _, _, done, info = env.step(plan_arm_torque(env))
        if done:
            break
    assert info["ee_error_m"] < 0.02, (planet, info["ee_error_m"])


def test_biped_balance_contact_env_survives_disturbance_and_replays_deterministically():
    """BipedBalanceContactEnv stays upright under disturbance and replays bit-identically by seed."""
    def _run(seed: int) -> tuple[list[dict], bool, float]:
        env = BipedBalanceContactEnv()
        env.reset(seed=seed, planet="earth")
        traj = []
        last_info = {}
        for _ in range(env.max_steps):
            obs, rew, done, last_info = env.step(balance_action(env))
            assert last_info["contact_ok"]
            traj.append({"obs": [round(float(x), 8) for x in obs], "r": round(float(rew), 8)})
            if done:
                break
        return traj, bool(last_info["fallen"]), abs(float(last_info["theta_rad"]))

    traj1, fallen1, th1 = _run(42)
    traj2, fallen2, th2 = _run(42)
    assert not fallen1 and not fallen2
    assert th1 < 0.12 and th2 < 0.12
    assert trajectory_sha256(traj1) == trajectory_sha256(traj2)


def test_orbital_rendezvous_docking_and_engine_receipt_tamper_control(tmp_path: Path):
    """OrbitalRendezvousEnv docks within delta-V budget and seals verified engine-receipt/1."""
    env = OrbitalRendezvousEnv()
    env.reset(seed=13)
    traj = []
    info = {}
    for _ in range(env.max_steps):
        obs, rew, done, info = env.step(docking_action(env))
        traj.append({"obs": [round(float(x), 6) for x in obs], "r": round(float(rew), 6)})
        if done:
            break
    assert info["docked"], info
    assert info["dist_m"] < 0.5 and info["speed_m_s"] < 0.05
    assert 0.0 < info["dv_used"] <= env.dv_budget

    traj_path, rec_path, rec = emit_episode_receipt(
        out_dir=tmp_path,
        task_id="physai-orbital-dock-seed13",
        trajectory=traj,
        summary=info,
        oracle_cmd=[sys.executable, "-c", "print('[PASS] orbital docking verified')"],
    )
    assert rec["schema"] == "engine-receipt/1" and rec["verdict"] == "MATCH"
    assert verify_episode_receipt(rec_path, check_files=True) == (True, [])

    # Planted-failure control: 1-byte tamper on trajectory file MUST fail receipt verification
    raw = bytearray(traj_path.read_bytes())
    raw[-2] ^= 0x01
    traj_path.write_bytes(bytes(raw))
    ok, errs = verify_episode_receipt(rec_path, check_files=True)
    assert not ok and any("artifact SHA-256 drift" in e for e in errs)


# ---------------------------------------------------------------------------
# 4. Planted-Failure Physical Invariant Controls
# ---------------------------------------------------------------------------

def test_planted_failure_controls_reject_unphysical_contacts():
    """Super-elastic bounce, Coulomb cone violation, interpenetration, and energy gain are rejected."""
    n = np.array([0.0, 0.0, 1.0], dtype=np.float64)
    # Super-elastic restitution e = 1.2 > 1.0
    c_super = ContactConstraint(0, -1, n, 0.0, restitution=1.2, friction=0.4, impulse_n=5.0)
    ok1, errs1 = verify_contact_physics([c_super], e_pre=10.0, e_post=12.0)
    assert not ok1
    assert any("restitution" in e for e in errs1)
    assert any("energy increased" in e for e in errs1)

    # Coulomb friction cone violation: |f_t| = 6.0 > mu * f_n = 0.4 * 10.0 = 4.0
    c_cone = ContactConstraint(0, -1, n, 0.0, restitution=0.5, friction=0.4, impulse_n=10.0,
                               impulse_t=np.array([6.0, 0.0, 0.0]))
    ok2, errs2 = verify_contact_physics([c_cone])
    assert not ok2 and any("Coulomb cone violation" in e for e in errs2)

    # Residual interpenetration violation
    c_pen = ContactConstraint(0, -1, n, penetration=0.05, restitution=0.5, friction=0.4, impulse_n=5.0)
    ok3, errs3 = verify_contact_physics([c_pen])
    assert not ok3 and any("interpenetration" in e for e in errs3)

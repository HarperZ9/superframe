# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Known-answer conservation, sensor/EKF fault-gating, and NOH-1 6-DOF aerospace tests."""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

PACKAGES_DIR = Path(__file__).resolve().parents[2]
for _p in (PACKAGES_DIR / "world", PACKAGES_DIR / "evolve", PACKAGES_DIR / "superstack"):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

import engine_receipt as _er  # noqa: E402
from evolve.nested_organism import evaluate_noh1_aerospace_6dof  # noqa: E402
from physai.aerospace_6dof import (  # noqa: E402
    PLANET_PRESETS,
    PoweredDescent6DOFEnv,
    QuadrotorDroneEnv,
    descent_6dof_action,
    quadrotor_action,
    quadrotor_alloc_matrix,
)
from physai.instrument_pipeline import InstrumentSuite, NavStateEstimator, SensorFaults  # noqa: E402
from physai.quat_math import clamp_gimbal_angles, exp_atmosphere_density, quat_angle_rad, quat_integrate  # noqa: E402


# ---------------------------------------------------------------------------
# 1. Quaternion Norm, Exponential Atmosphere, TVC Gimbal & Rotor Allocation
# ---------------------------------------------------------------------------

def test_quaternion_unit_norm_and_exponential_atmosphere_exact():
    """6-DOF exponential quaternion integration holds ||q|| == 1 to <1e-12; atmosphere exact."""
    q = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float64)
    omega = np.array([1.7, -2.3, 3.1], dtype=np.float64)
    for _ in range(250):
        q = quat_integrate(q, omega, 0.01)
        assert abs(float(np.linalg.norm(q)) - 1.0) < 1e-12
    # Exact exponential atmosphere density check
    earth = PLANET_PRESETS["earth"]
    assert abs(exp_atmosphere_density(0.0, earth.rho0, earth.scale_height_m) - 1.225) < 1e-15
    assert abs(exp_atmosphere_density(8500.0, earth.rho0, earth.scale_height_m) - 1.225 * math.exp(-1.0)) < 1e-12
    assert exp_atmosphere_density(1000.0, PLANET_PRESETS["moon"].rho0, 1.0) == 0.0
    # 4-rotor allocation matrix is invertible
    alloc = quadrotor_alloc_matrix()
    assert abs(float(np.linalg.det(alloc))) > 1e-5


def test_tvc_gimbal_clamp_and_unphysical_thrust_rejection():
    """Commanded 80-deg gimbal is clamped to <=25 deg; negative/over-max thrust is clamped."""
    gx, gy, bdir = clamp_gimbal_angles(math.radians(80.0), math.radians(40.0), max_deg=25.0)
    assert math.degrees(math.hypot(gx, gy)) <= 25.0 + 1e-9
    assert abs(float(np.linalg.norm(bdir)) - 1.0) < 1e-12
    assert math.degrees(math.acos(min(1.0, float(bdir[2])))) <= 25.0 + 1e-9

    # Planted unphysical negative thrust and excessive gimbal inside PoweredDescent6DOFEnv
    env = PoweredDescent6DOFEnv(dt=0.05, max_thrust_n=40000.0)
    env.reset(seed=1, planet="moon", pos=(0.0, 0.0, 100.0), vel=(0.0, 0.0, 0.0))
    _, _, _, info_neg = env.step(np.array([-5000.0, math.radians(75.0), 0.0, 0.0]))
    assert info_neg["impulse_ns"] == 0.0 and info_neg["fuel_burned_kg"] == 0.0
    assert info_neg["gimbal_deg"] <= 25.0 + 1e-9
    _, _, _, info_hi = env.step(np.array([999999.0, 0.0, math.radians(-80.0), 0.0]))
    assert info_hi["impulse_ns"] <= 40000.0 * 0.05 + 1e-9
    assert info_hi["gimbal_deg"] <= 25.0 + 1e-9


# ---------------------------------------------------------------------------
# 2. Zero-Thrust Free-Fall & Exact Tsiolkovsky Mass Conservation
# ---------------------------------------------------------------------------

def test_zero_thrust_vacuum_free_fall_and_tsiolkovsky_mass_conservation():
    """Moon vacuum free-fall matches z0 + v0*t - 0.5*g*t^2; powered burn conserves Tsiolkovsky mass."""
    env = PoweredDescent6DOFEnv(dt=0.05, max_steps=100)
    z0, v0 = 200.0, -2.0
    env.reset(seed=2, planet="moon", pos=(0.0, 0.0, z0), vel=(0.0, 0.0, v0))
    g = PLANET_PRESETS["moon"].gravity
    steps = 40
    for _ in range(steps):
        env.step(np.zeros(4))
    t = steps * env.dt
    expected_z = z0 + v0 * t - 0.5 * g * t * t
    assert abs(float(env.pos[2]) - expected_z) < 1e-5
    assert abs(float(env.vel[2]) - (v0 - g * t)) < 1e-5
    assert env.mass == env.initial_mass

    # Powered burn: exact Tsiolkovsky propellant conservation m_final == m0 - total_impulse / (Isp * g0)
    env2 = PoweredDescent6DOFEnv(dt=0.05, max_steps=60)
    env2.reset(seed=3, planet="mars", mass_kg=2800.0, dry_mass_kg=1600.0, pos=(0.0, 0.0, 150.0), vel=(0.0, 0.0, -5.0))
    info = {}
    for _ in range(30):
        _, _, _, info = env2.step(np.array([15000.0, 0.05, -0.04, 10.0]))
    expected_mass = env2.initial_mass - info["impulse_ns"] / (env2.isp_s * env2.g0)
    assert abs(info["mass_kg"] - expected_mass) < 1e-9
    assert abs(info["quat_norm"] - 1.0) < 1e-12


# ---------------------------------------------------------------------------
# 3. Closed-Loop 6-DOF Quadrotor & Powered-Descent Environments
# ---------------------------------------------------------------------------

def test_quadrotor_6dof_hover_and_powered_descent_landing():
    """Quadrotor stabilizes under Dryden gusts; powered descent lands softly with PGS contact."""
    qenv = QuadrotorDroneEnv(dt=0.01, max_steps=300)
    qenv.reset(seed=5, wind_bias=(2.0, -1.5, 0.0), gust_sigma=0.6, target=(0.0, 0.0, 3.0))
    info_q = {}
    for _ in range(qenv.max_steps):
        _, _, _, info_q = qenv.step(quadrotor_action(qenv))
        assert abs(info_q["quat_norm"] - 1.0) < 1e-12
        assert info_q["contact_ok"]
    assert info_q["pos_err_m"] < 0.6 and info_q["battery_soc"] < 1.0

    denv = PoweredDescent6DOFEnv(dt=0.05, max_steps=300)
    denv.reset(seed=9, planet="mars", pos=(12.0, -8.0, 90.0), vel=(-1.0, 0.5, -10.0))
    info_d = {}
    for _ in range(denv.max_steps):
        _, _, done, info_d = denv.step(descent_6dof_action(denv))
        assert abs(info_d["quat_norm"] - 1.0) < 1e-12
        assert info_d["contact_ok"]
        if done:
            break
    assert info_d["landed"], info_d


# ---------------------------------------------------------------------------
# 4. Noisy Instrument Pipeline, EKF Tracking & Planted Fault Controls
# ---------------------------------------------------------------------------

def test_instrument_pipeline_ekf_tracking_and_planted_fault_rejection():
    """EKF tracks altitude & attitude under realistic noise and rejects planted dropouts/spikes/bias."""
    inst = InstrumentSuite(seed=17)
    est = NavStateEstimator(init_alt_m=50.0, init_vz=-2.0)
    pos = np.array([0.0, 0.0, 50.0])
    vel = np.array([0.0, 0.0, -2.0])
    q = np.array([1.0, 0.0, 0.0, 0.0])
    omega = np.array([0.05, -0.04, 0.02])
    dt, g = 0.02, 9.80665
    for _ in range(80):
        acc = np.array([0.0, 0.0, 0.4])
        vel = vel + acc * dt
        pos = pos + vel * dt
        q = quat_integrate(q, omega, dt)
        rd = inst.sample(pos, acc, q, omega, g, dt)
        st = est.update(rd, g, dt)
    assert abs(st.alt_m - float(pos[2])) < 0.6
    assert quat_angle_rad(st.quat, q) < 0.08

    # Planted fault 1: LiDAR 90 m spike MUST be rejected without corrupting altitude estimate
    alt_before = st.alt_m
    rd_spike = inst.sample(pos, np.zeros(3), q, omega, g, dt, faults=SensorFaults(lidar_spike_m=90.0))
    st_spike = est.update(rd_spike, g, dt)
    assert "lidar_outlier_rejected" in st_spike.fault_flags
    assert abs(st_spike.alt_m - alt_before) < 0.5

    # Planted fault 2: IMU gross bias injection + star-tracker dropout MUST be flagged & rejected
    rd_fault = inst.sample(
        pos, np.zeros(3), q, omega, g, dt,
        faults=SensorFaults(star_tracker_dropout=True, accel_bias_injection=(0.0, 0.0, 250.0), gyro_bias_injection=(30.0, 0.0, 0.0)),
    )
    st_fault = est.update(rd_fault, g, dt)
    assert "star_tracker_dropout" in st_fault.fault_flags
    assert "accel_bias_fault_rejected" in st_fault.fault_flags
    assert "gyro_bias_or_rate_fault" in st_fault.fault_flags
    assert est.rejections >= 3


# ---------------------------------------------------------------------------
# 5. NOH-1 vs FlatPolicy 6-DOF Aerospace OOD Benchmark + Receipt Verification
# ---------------------------------------------------------------------------

def test_noh1_beats_flat_policy_on_aerospace_6dof_ood_with_receipt(tmp_path: Path):
    """NOH-1 beats FlatPolicy on OOD wind/mass shifts across both 6-DOF envs and emits MATCH receipt."""
    res = evaluate_noh1_aerospace_6dof(seed=42, out_dir=tmp_path)
    assert res["noh1_beats_flat_quad"], res
    assert res["noh1_beats_flat_descent"], res
    assert res["quad_noh1_mean_err_m"] < res["quad_flat_mean_err_m"] * 0.6
    assert res["descent_noh1_mean_score"] < res["descent_flat_mean_score"] * 0.6
    assert res["immune_checks"] > 0 and res["immune_interventions"] == 0
    assert res["receipt_verdict"] == "MATCH"

    rec_path = Path(res["receipt_path"])
    rec = _er.json.loads(rec_path.read_text(encoding="utf-8"))
    assert _er.verify_receipt(rec, check_files=True) == (True, [])
    # Planted 1-byte tamper on evaluation artifact MUST fail receipt verification
    rep_path = tmp_path / "noh1_aerospace_6dof_eval.json"
    buf = bytearray(rep_path.read_bytes())
    buf[-2] ^= 0x01
    rep_path.write_bytes(bytes(buf))
    ok, errs = _er.verify_receipt(rec, check_files=True)
    assert not ok and any("artifact SHA-256 drift" in e for e in errs)

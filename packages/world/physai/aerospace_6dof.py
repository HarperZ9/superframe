# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""6-DOF QuadrotorDroneEnv and PoweredDescent6DOFEnv in exact SI units.

Features:
  - Unit-quaternion attitude kinematics (||q|| == 1 to <1e-12)
  - 4-rotor thrust/torque allocation, quadratic aero drag, Dryden gusts, battery coupling
  - Exponential atmosphere rho(h) = rho0 * exp(-h/H), Tsiolkovsky propellant burn,
    TVC gimbal clamp (<=25 deg), and PGS/Coulomb landing-pad ground contact.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .quat_math import (
    clamp_gimbal_angles,
    exp_atmosphere_density,
    quat_error_vec,
    quat_integrate,
    quat_normalize,
    quat_to_rotmat,
)
from .rigid_contact import ContactPlane, RigidBody, detect_contacts, solve_contacts_pgs, verify_contact_physics


@dataclass(frozen=True)
class BodyPreset:
    """Planetary gravity and exponential atmosphere SI constants."""
    name: str
    gravity: float
    rho0: float
    scale_height_m: float


PLANET_PRESETS: dict[str, BodyPreset] = {
    "earth": BodyPreset("earth", 9.80665, 1.225, 8500.0),
    "mars": BodyPreset("mars", 3.72076, 0.020, 11100.0),
    "moon": BodyPreset("moon", 1.62, 0.0, 1.0),
}


def quadrotor_alloc_matrix(arm_m: float = 0.22, yaw_coeff: float = 0.016) -> np.ndarray:
    """4x4 X-configuration rotor thrust -> [T_total, tau_x, tau_y, tau_z] allocation matrix."""
    d = arm_m * math.sqrt(0.5)
    k = yaw_coeff
    return np.array([
        [1.0, 1.0, 1.0, 1.0],
        [d, -d, -d, d],
        [-d, -d, d, d],
        [k, -k, k, -k],
    ], dtype=np.float64)


class QuadrotorDroneEnv:
    """Full 6-DOF quadrotor with Dryden wind gusts, quadratic drag, battery coupling, and PGS pad."""

    def __init__(self, dt: float = 0.01, max_steps: int = 400, f_max_rotor: float = 12.0):
        self.dt, self.max_steps, self.f_max_rotor = float(dt), int(max_steps), float(f_max_rotor)
        self.alloc = quadrotor_alloc_matrix()
        self.alloc_inv = np.linalg.inv(self.alloc)
        self.inertia = np.array([0.028, 0.028, 0.052], dtype=np.float64)
        self.cd_area = 0.14
        self.pad_plane = ContactPlane.horizontal(0.0, friction=0.75, restitution=0.05)
        self.reset(seed=0)

    def reset(
        self,
        seed: int = 0,
        *,
        mass_kg: float = 1.6,
        wind_bias: tuple[float, float, float] = (0.0, 0.0, 0.0),
        gust_sigma: float = 1.2,
        target: tuple[float, float, float] = (0.0, 0.0, 3.0),
    ) -> np.ndarray:
        self._rng = np.random.default_rng(seed)
        self.planet = PLANET_PRESETS["earth"]
        self.mass = float(mass_kg)
        self.battery_wh = 55.0
        self.battery_max_wh = 55.0
        self.pos = np.array([float(self._rng.uniform(-1.5, 1.5)), float(self._rng.uniform(-1.5, 1.5)), 2.5])
        self.vel = np.zeros(3, dtype=np.float64)
        self.quat = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float64)
        self.omega = np.zeros(3, dtype=np.float64)
        self.target = np.array(target, dtype=np.float64)
        self.wind_bias = np.array(wind_bias, dtype=np.float64)
        self.gust_sigma = float(gust_sigma)
        self.wind = self.wind_bias.copy()
        self.steps = 0
        return self._obs()

    def _step_dryden_wind(self) -> np.ndarray:
        alpha = math.exp(-self.dt / 0.8)
        noise = self._rng.normal(0.0, self.gust_sigma, size=3)
        self.wind = self.wind_bias + alpha * (self.wind - self.wind_bias) + math.sqrt(max(0.0, 1.0 - alpha * alpha)) * noise
        return self.wind

    def step(self, rotor_thrusts: np.ndarray) -> tuple[np.ndarray, float, bool, dict]:
        f_raw = np.asarray(rotor_thrusts, dtype=np.float64).reshape(4)
        f = np.clip(f_raw, 0.0, self.f_max_rotor)
        if self.battery_wh <= 0.0:
            f[:] = 0.0
        wrench = self.alloc @ f
        thrust_total, tau = float(wrench[0]), wrench[1:4]
        rot = quat_to_rotmat(self.quat)
        wind = self._step_dryden_wind()
        v_rel = self.vel - wind
        rho = exp_atmosphere_density(float(self.pos[2]), self.planet.rho0, self.planet.scale_height_m)
        f_drag = -0.5 * rho * self.cd_area * float(np.linalg.norm(v_rel)) * v_rel
        f_world = rot @ np.array([0.0, 0.0, thrust_total]) + f_drag + np.array([0.0, 0.0, -self.mass * self.planet.gravity])
        acc = f_world / self.mass
        self.vel = self.vel + acc * self.dt
        self.pos = self.pos + self.vel * self.dt
        omega_dot = (tau - np.cross(self.omega, self.inertia * self.omega)) / self.inertia
        self.omega = self.omega + omega_dot * self.dt
        self.quat = quat_integrate(self.quat, self.omega, self.dt)
        body = RigidBody(self.pos.copy(), self.vel.copy(), self.mass, radius=0.12, restitution=0.05, friction=0.75)
        contacts = detect_contacts([body], [self.pad_plane])
        c_ok = True
        if contacts:
            solve_contacts_pgs([body], contacts, self.dt, iterations=12)
            self.pos, self.vel = body.pos, body.vel
            c_ok, _ = verify_contact_physics(contacts)
        power_w = float(np.sum(np.power(f, 1.5))) * 8.5
        self.battery_wh = max(0.0, self.battery_wh - power_w * (self.dt / 3600.0))
        self.steps += 1
        err = float(np.linalg.norm(self.pos - self.target))
        done = self.steps >= self.max_steps
        info = {"pos_err_m": err, "quat_norm": float(np.linalg.norm(self.quat)), "battery_soc": self.battery_wh / self.battery_max_wh, "contact_ok": c_ok, "wind": self.wind.tolist()}
        return self._obs(), -err, done, info

    def _obs(self) -> np.ndarray:
        return np.concatenate([self.pos, self.vel, self.quat, self.omega, self.target, np.array([self.mass, self.battery_wh / self.battery_max_wh])])


def quadrotor_action(env: QuadrotorDroneEnv, wind_est: np.ndarray | None = None, mass_est: float | None = None) -> np.ndarray:
    """Geometric PD position + quaternion attitude controller mapped via inverse rotor allocation."""
    m = env.mass if mass_est is None else float(mass_est)
    g = env.planet.gravity
    w_comp = np.zeros(3) if wind_est is None else np.asarray(wind_est, dtype=np.float64)
    a_des = 2.8 * (env.target - env.pos) - 2.6 * env.vel + np.array([0.0, 0.0, g]) - w_comp
    a_des[0] = max(-5.0, min(5.0, float(a_des[0])))
    a_des[1] = max(-5.0, min(5.0, float(a_des[1])))
    a_des[2] = max(0.5, min(2.2 * g, float(a_des[2])))
    f_des = m * a_des
    t_mag = float(np.linalg.norm(f_des))
    z_b = f_des / max(t_mag, 1e-8)
    x_c = np.array([1.0, 0.0, 0.0])
    y_b = np.cross(z_b, x_c)
    y_b /= max(float(np.linalg.norm(y_b)), 1e-8)
    x_b = np.cross(y_b, z_b)
    r_des = np.column_stack([x_b, y_b, z_b])
    r_cur = quat_to_rotmat(env.quat)
    r_err = r_cur.T @ r_des
    e_rot = 0.5 * np.array([r_err[2, 1] - r_err[1, 2], r_err[0, 2] - r_err[2, 0], r_err[1, 0] - r_err[0, 1]])
    tau = 0.45 * e_rot - 0.14 * env.omega
    wrench = np.array([t_mag, tau[0], tau[1], tau[2]], dtype=np.float64)
    return np.clip(env.alloc_inv @ wrench, 0.0, env.f_max_rotor)


class PoweredDescent6DOFEnv:
    """Full 6-DOF powered-descent lander with Tsiolkovsky burn, exp atmosphere, 25-deg TVC, and PGS gear."""

    def __init__(self, dt: float = 0.05, max_steps: int = 400, max_thrust_n: float = 42000.0, isp_s: float = 310.0):
        self.dt, self.max_steps = float(dt), int(max_steps)
        self.max_thrust_n, self.isp_s, self.g0 = float(max_thrust_n), float(isp_s), 9.80665
        self.max_gimbal_deg = 25.0
        self.lever_arm_m = 2.4
        self.cd_area = 4.2
        self.pad_plane = ContactPlane.horizontal(0.0, friction=0.8, restitution=0.02)
        self.reset(seed=0)

    def reset(
        self,
        seed: int = 0,
        *,
        planet: str = "mars",
        mass_kg: float = 2800.0,
        dry_mass_kg: float = 1600.0,
        pos: tuple[float, float, float] | None = None,
        vel: tuple[float, float, float] | None = None,
        wind_bias: tuple[float, float, float] = (0.0, 0.0, 0.0),
    ) -> np.ndarray:
        if planet not in PLANET_PRESETS:
            raise ValueError(f"unknown planet preset: {planet}")
        self._rng = np.random.default_rng(seed)
        self.planet = PLANET_PRESETS[planet]
        self.mass = float(mass_kg)
        self.dry_mass = float(dry_mass_kg)
        self.initial_mass = float(mass_kg)
        self.inertia = np.array([3200.0, 3200.0, 1800.0], dtype=np.float64)
        self.pos = np.array([15.0, -10.0, 120.0] if pos is None else pos, dtype=np.float64)
        self.vel = np.array([-1.5, 1.0, -14.0] if vel is None else vel, dtype=np.float64)
        self.quat = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float64)
        self.omega = np.zeros(3, dtype=np.float64)
        self.wind_bias = np.array(wind_bias, dtype=np.float64)
        self.fuel_burned_kg = 0.0
        self.impulse_ns = 0.0
        self.last_gimbal_rad = 0.0
        self.landed = False
        self.steps = 0
        return self._obs()

    def _compute_burn(self, thrust_req: float) -> tuple[float, float]:
        max_burn_kg = max(0.0, self.mass - self.dry_mass)
        dm_req = (thrust_req * self.dt) / (self.isp_s * self.g0)
        if dm_req > max_burn_kg and dm_req > 1e-12:
            return max_burn_kg * (self.isp_s * self.g0) / self.dt, max_burn_kg
        return thrust_req, dm_req

    def step(self, action: np.ndarray) -> tuple[np.ndarray, float, bool, dict]:
        act = np.asarray(action, dtype=np.float64).reshape(4)
        gx, gy, body_dir = clamp_gimbal_angles(float(act[1]), float(act[2]), self.max_gimbal_deg)
        rcs_z = float(np.clip(act[3], -800.0, 800.0))
        self.last_gimbal_rad = math.hypot(gx, gy)
        thrust, dm = self._compute_burn(float(np.clip(act[0], 0.0, self.max_thrust_n)))

        rot = quat_to_rotmat(self.quat)
        rho = exp_atmosphere_density(float(self.pos[2]), self.planet.rho0, self.planet.scale_height_m)
        v_rel = self.vel - self.wind_bias
        f_drag = -0.5 * rho * self.cd_area * float(np.linalg.norm(v_rel)) * v_rel
        f_thrust_body = thrust * body_dir
        acc = (rot @ f_thrust_body + f_drag + np.array([0.0, 0.0, -self.mass * self.planet.gravity])) / self.mass
        self.pos = self.pos + self.vel * self.dt + 0.5 * acc * (self.dt * self.dt)
        self.vel = self.vel + acc * self.dt

        tau_body = np.cross(np.array([0.0, 0.0, -self.lever_arm_m]), f_thrust_body) + np.array([0.0, 0.0, rcs_z])
        self.omega = self.omega + ((tau_body - np.cross(self.omega, self.inertia * self.omega)) / self.inertia) * self.dt
        self.quat = quat_integrate(self.quat, self.omega, self.dt)
        self.mass -= dm
        self.fuel_burned_kg += dm
        self.impulse_ns += thrust * self.dt

        body = RigidBody(self.pos.copy(), self.vel.copy(), self.mass, radius=0.0, restitution=0.02, friction=0.8)
        contacts = detect_contacts([body], [self.pad_plane])
        c_ok = True
        if contacts:
            touch_speed = float(np.linalg.norm(self.vel))
            solve_contacts_pgs([body], contacts, self.dt, iterations=12)
            self.pos, self.vel = body.pos, body.vel
            c_ok, _ = verify_contact_physics(contacts)
            self.landed = touch_speed < 3.0 and float(np.linalg.norm(self.pos[:2])) < 8.0
        self.steps += 1
        done = bool(contacts) or self.steps >= self.max_steps
        info = {
            "alt_m": float(self.pos[2]), "speed_m_s": float(np.linalg.norm(self.vel)),
            "mass_kg": self.mass, "fuel_burned_kg": self.fuel_burned_kg, "impulse_ns": self.impulse_ns,
            "gimbal_deg": math.degrees(self.last_gimbal_rad), "quat_norm": float(np.linalg.norm(self.quat)),
            "rho": rho, "contact_ok": c_ok, "landed": self.landed,
        }
        return self._obs(), -(float(np.linalg.norm(self.pos)) + 2.0 * float(np.linalg.norm(self.vel))), done, info

    def _obs(self) -> np.ndarray:
        return np.concatenate([self.pos, self.vel, self.quat, self.omega, np.array([self.mass, self.planet.gravity])])


def descent_6dof_action(env: PoweredDescent6DOFEnv, mass_est: float | None = None, acc_bias: np.ndarray | None = None) -> np.ndarray:
    """Closed-loop 6-DOF outer-loop guidance + exact TVC attitude control for PoweredDescent6DOFEnv."""
    m = env.mass if mass_est is None else float(mass_est)
    g = env.planet.gravity
    alt = max(0.0, float(env.pos[2]))
    vz_des = -max(0.8, min(11.0, 0.28 * alt + 0.7))
    az_cmd = g + 1.8 * (vz_des - float(env.vel[2]))
    ax_cmd = -0.35 * float(env.pos[0]) - 1.4 * float(env.vel[0])
    ay_cmd = -0.35 * float(env.pos[1]) - 1.4 * float(env.vel[1])
    a_cmd = np.array([ax_cmd, ay_cmd, az_cmd], dtype=np.float64) - (np.zeros(3) if acc_bias is None else acc_bias)
    a_cmd[0] = max(-0.30 * g, min(0.30 * g, float(a_cmd[0])))
    a_cmd[1] = max(-0.30 * g, min(0.30 * g, float(a_cmd[1])))
    a_cmd[2] = max(0.25 * g, float(a_cmd[2]))

    f_world = m * a_cmd
    thrust = float(np.clip(np.linalg.norm(f_world), 0.1 * m * g, env.max_thrust_n))
    z_des = f_world / max(float(np.linalg.norm(f_world)), 1e-8)
    y_des = np.cross(z_des, np.array([1.0, 0.0, 0.0]))
    y_des /= max(float(np.linalg.norm(y_des)), 1e-8)
    x_des = np.cross(y_des, z_des)
    r_des = np.column_stack([x_des, y_des, z_des])
    r_err = quat_to_rotmat(env.quat).T @ r_des
    e_rot = 0.5 * np.array([r_err[2, 1] - r_err[1, 2], r_err[0, 2] - r_err[2, 0], r_err[1, 0] - r_err[0, 1]])
    tau_des = 6500.0 * e_rot - 4200.0 * env.omega
    denom = max(env.lever_arm_m * thrust, 1.0)
    gx = float(np.clip(-tau_des[1] / denom, -0.4, 0.4))
    gy = float(np.clip(tau_des[0] / denom, -0.4, 0.4))
    rcs_z = float(np.clip(tau_des[2], -800.0, 800.0))
    return np.array([thrust, gx, gy, rcs_z], dtype=np.float64)

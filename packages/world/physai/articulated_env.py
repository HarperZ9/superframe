# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Deterministic SI-unit Physical-AI continuous-control and universe environments.

Provides standard reset(seed) -> obs, step(action) -> (obs, reward, done, info):
  - PlanarArmReachEnv: 2-link articulated rigid-body arm with Euler-Lagrange dynamics
  - BipedBalanceContactEnv: ground-contact articulated torso/foot balance via PGS + Coulomb
  - OrbitalRendezvousEnv: 3D Clohessy-Wiltshire orbital thruster docking with delta-V budget
"""
from __future__ import annotations

import math

import numpy as np

from .env_receipts import DomainConfig, domain_as_dict, sample_domain
from .rigid_contact import ContactPlane, RigidBody, step_rigid_world, verify_contact_physics


class PlanarArmReachEnv:
    """2-link planar articulated manipulator with exact Coriolis, centrifugal, and gravity dynamics."""

    def __init__(self, dt: float = 0.005, max_steps: int = 500, tau_max: float = 45.0, power_max: float = 180.0):
        self.dt, self.max_steps = float(dt), int(max_steps)
        self.tau_max, self.power_max = float(tau_max), float(power_max)
        self.l1, self.l2 = 0.5, 0.45
        self.domain = DomainConfig()
        self.q = np.zeros(2, dtype=np.float64)
        self.qd = np.zeros(2, dtype=np.float64)
        self.target = np.array([0.65, 0.35], dtype=np.float64)
        self.steps = 0

    def reset(self, seed: int = 0, planet: str = "earth", randomize: bool = True) -> np.ndarray:
        rng = np.random.default_rng(seed)
        self.domain = sample_domain(rng, planet=planet, randomize=randomize)
        self.m1, self.m2 = 1.6 * self.domain.mass_scale, 1.1 * self.domain.mass_scale
        self.q = np.array([float(rng.uniform(-0.3, 0.3)), float(rng.uniform(-0.4, 0.4))], dtype=np.float64)
        self.qd = np.zeros(2, dtype=np.float64)
        ang = float(rng.uniform(0.25, 1.05))
        rad = float(rng.uniform(0.45, 0.78))
        self.target = np.array([rad * math.cos(ang), rad * math.sin(ang)], dtype=np.float64)
        self.steps = 0
        return self._obs()

    def end_effector(self) -> np.ndarray:
        x = self.l1 * math.cos(self.q[0]) + self.l2 * math.cos(self.q[0] + self.q[1])
        y = self.l1 * math.sin(self.q[0]) + self.l2 * math.sin(self.q[0] + self.q[1])
        return np.array([x, y], dtype=np.float64)

    def _dynamics_mats(self) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        lc1, lc2 = 0.5 * self.l1, 0.5 * self.l2
        i1, i2 = self.m1 * self.l1 ** 2 / 12.0, self.m2 * self.l2 ** 2 / 12.0
        c2, s2 = math.cos(self.q[1]), math.sin(self.q[1])
        m11 = self.m1 * lc1 ** 2 + i1 + self.m2 * (self.l1 ** 2 + lc2 ** 2 + 2.0 * self.l1 * lc2 * c2) + i2
        m12 = self.m2 * (lc2 ** 2 + self.l1 * lc2 * c2) + i2
        m22 = self.m2 * lc2 ** 2 + i2
        M = np.array([[m11, m12], [m12, m22]], dtype=np.float64)
        h = -self.m2 * self.l1 * lc2 * s2
        C = np.array([h * (2.0 * self.qd[0] * self.qd[1] + self.qd[1] ** 2), -h * (self.qd[0] ** 2)])
        g = self.domain.gravity
        g1 = (self.m1 * lc1 + self.m2 * self.l1) * g * math.cos(self.q[0]) + self.m2 * lc2 * g * math.cos(self.q[0] + self.q[1])
        g2 = self.m2 * lc2 * g * math.cos(self.q[0] + self.q[1])
        return M, C, np.array([g1, g2], dtype=np.float64)

    def clamp_torque(self, action: np.ndarray) -> np.ndarray:
        tau = np.clip(np.asarray(action, dtype=np.float64), -self.tau_max, self.tau_max)
        for i in range(2):
            speed = abs(float(self.qd[i]))
            if speed > 1e-6 and abs(float(tau[i])) * speed > self.power_max:
                tau[i] = math.copysign(self.power_max / speed, float(tau[i]))
        return tau

    def step(self, action: np.ndarray) -> tuple[np.ndarray, float, bool, dict]:
        tau = self.clamp_torque(action)
        M, C, G = self._dynamics_mats()
        qdd = np.linalg.solve(M, tau - C - G - 0.15 * self.qd)
        self.qd = self.qd + qdd * self.dt
        self.q = self.q + self.qd * self.dt
        self.steps += 1
        err = float(np.linalg.norm(self.end_effector() - self.target))
        done = err < 0.015 or self.steps >= self.max_steps
        info = {"ee_error_m": err, "tau_applied": [float(tau[0]), float(tau[1])], "domain": domain_as_dict(self.domain)}
        return self._obs(), -err, done, info

    def _obs(self) -> np.ndarray:
        ee = self.end_effector()
        return np.array([self.q[0], self.q[1], self.qd[0], self.qd[1], ee[0], ee[1], self.target[0], self.target[1]])


def plan_arm_torque(env: PlanarArmReachEnv) -> np.ndarray:
    """Closed-loop analytical IK + gravity-compensated PD controller for PlanarArmReachEnv."""
    tx, ty = float(env.target[0]), float(env.target[1])
    c2 = max(-1.0, min(1.0, (tx * tx + ty * ty - env.l1 ** 2 - env.l2 ** 2) / (2.0 * env.l1 * env.l2)))
    q2_des = math.acos(c2)
    q1_des = math.atan2(ty, tx) - math.atan2(env.l2 * math.sin(q2_des), env.l1 + env.l2 * math.cos(q2_des))
    _, _, G = env._dynamics_mats()
    q_err = np.array([q1_des - env.q[0], q2_des - env.q[1]], dtype=np.float64)
    return G + 85.0 * q_err - 14.0 * env.qd


class BipedBalanceContactEnv:
    """Ground-contact articulated foot/torso balance under PGS normal + Coulomb friction."""

    def __init__(self, dt: float = 0.005, max_steps: int = 300, tau_max: float = 120.0):
        self.dt, self.max_steps, self.tau_max = float(dt), int(max_steps), float(tau_max)
        self.pole_len = 0.95
        self.domain = DomainConfig()
        self.foot = RigidBody.from_material("rubber", (0.0, 0.0, 0.05), radius=0.05, mass=6.0)
        self.plane = ContactPlane.horizontal(0.0, friction=0.75, restitution=0.05)
        self.theta, self.theta_d, self.steps = 0.0, 0.0, 0
        self._impulse_step, self._impulse_fx = 80, 0.0

    def reset(self, seed: int = 0, planet: str = "earth", randomize: bool = True) -> np.ndarray:
        rng = np.random.default_rng(seed)
        self.domain = sample_domain(rng, planet=planet, randomize=randomize)
        self.m_torso = 32.0 * self.domain.mass_scale
        self.foot = RigidBody(np.array([0.0, 0.0, 0.05]), np.zeros(3), 6.0 * self.domain.mass_scale, 0.05, 0.0, self.domain.friction)
        self.plane = ContactPlane.horizontal(0.0, friction=self.domain.friction, restitution=0.0)
        self.theta = float(rng.uniform(-0.12, 0.12))
        self.theta_d = float(rng.uniform(-0.08, 0.08))
        self._impulse_step = int(rng.integers(50, 120))
        self._impulse_fx = float(rng.choice([-1.0, 1.0]) * rng.uniform(2.5, 4.5))
        self.steps = 0
        return self._obs()

    def step(self, action: float) -> tuple[np.ndarray, float, bool, dict]:
        tau = float(np.clip(float(action), -self.tau_max, self.tau_max))
        if self.steps == self._impulse_step:
            self.theta_d += self._impulse_fx / (self.m_torso * self.pole_len)
        g = self.domain.gravity
        inertia = self.m_torso * (self.pole_len ** 2)
        f_horiz = tau / self.pole_len
        self.foot.vel[0] += (f_horiz / self.foot.mass) * self.dt
        contacts = step_rigid_world([self.foot], [self.plane], self.dt, gravity=g, pgs_iters=12)
        c_ok, c_errs = verify_contact_physics(contacts)
        eff_tau = tau if contacts else 0.0
        alpha = (self.m_torso * g * self.pole_len * math.sin(self.theta) - eff_tau - 2.0 * self.theta_d) / inertia
        self.theta_d += alpha * self.dt
        self.theta += self.theta_d * self.dt
        self.steps += 1
        fallen = abs(self.theta) > 0.65
        done = fallen or self.steps >= self.max_steps
        info = {"theta_rad": self.theta, "contact_ok": c_ok, "contact_errors": c_errs, "tau_applied": tau, "fallen": fallen}
        return self._obs(), 1.0 - abs(self.theta), done, info

    def _obs(self) -> np.ndarray:
        return np.array([self.theta, self.theta_d, self.foot.pos[0], self.foot.vel[0], self.foot.pos[2]])


def balance_action(env: BipedBalanceContactEnv) -> float:
    """Stabilizing gravity-feedforward PD ankle torque controller for BipedBalanceContactEnv."""
    g_comp = env.m_torso * env.domain.gravity * env.pole_len * math.sin(env.theta)
    return float(g_comp + 260.0 * env.theta + 75.0 * env.theta_d)


class OrbitalRendezvousEnv:
    """3D Clohessy-Wiltshire orbital thruster docking with Tsiolkovsky propellant depletion."""

    def __init__(self, dt: float = 1.0, max_steps: int = 360, max_thrust_n: float = 40.0, dv_budget: float = 25.0):
        self.dt, self.max_steps = float(dt), int(max_steps)
        self.max_thrust_n, self.dv_budget = float(max_thrust_n), float(dv_budget)
        self.isp_s, self.g0 = 280.0, 9.80665
        self.n_rad_s = 0.00113  # ~400 km LEO mean motion
        self.pos = np.zeros(3, dtype=np.float64)
        self.vel = np.zeros(3, dtype=np.float64)
        self.mass, self.dv_used, self.steps = 500.0, 0.0, 0

    def reset(self, seed: int = 0) -> np.ndarray:
        rng = np.random.default_rng(seed)
        self.pos = rng.uniform(-35.0, 35.0, size=3).astype(np.float64)
        self.vel = rng.uniform(-0.15, 0.15, size=3).astype(np.float64)
        self.mass = float(rng.uniform(460.0, 540.0))
        self.dry_mass = 0.85 * self.mass
        self.dv_used = 0.0
        self.steps = 0
        return self._obs()

    def step(self, action: np.ndarray) -> tuple[np.ndarray, float, bool, dict]:
        f_cmd = np.asarray(action, dtype=np.float64).reshape(3)
        fn = float(np.linalg.norm(f_cmd))
        thrust = f_cmd * (self.max_thrust_n / fn) if fn > self.max_thrust_n else f_cmd.copy()
        if self.dv_used >= self.dv_budget or self.mass <= self.dry_mass:
            thrust[:] = 0.0
        f_mag = float(np.linalg.norm(thrust))
        acc_t = thrust / self.mass
        n = self.n_rad_s
        x, y, z = self.pos
        vx, vy, vz = self.vel
        ax = 3.0 * n * n * x + 2.0 * n * vy + acc_t[0]
        ay = -2.0 * n * vx + acc_t[1]
        az = -n * n * z + acc_t[2]
        self.vel = self.vel + np.array([ax, ay, az]) * self.dt
        self.pos = self.pos + self.vel * self.dt
        dm = (f_mag * self.dt) / (self.isp_s * self.g0)
        self.mass = max(self.dry_mass, self.mass - dm)
        self.dv_used += float(np.linalg.norm(acc_t)) * self.dt
        self.steps += 1
        dist, speed = float(np.linalg.norm(self.pos)), float(np.linalg.norm(self.vel))
        docked = dist < 0.5 and speed < 0.05
        done = docked or self.steps >= self.max_steps
        info = {"dist_m": dist, "speed_m_s": speed, "dv_used": self.dv_used, "mass_kg": self.mass, "docked": docked}
        return self._obs(), -(dist + 5.0 * speed), done, info

    def _obs(self) -> np.ndarray:
        return np.concatenate([self.pos, self.vel, np.array([self.mass, self.dv_budget - self.dv_used])])


def docking_action(env: OrbitalRendezvousEnv) -> np.ndarray:
    """Closed-loop Clohessy-Wiltshire Coriolis-cancelling PD thruster docking law."""
    n = env.n_rad_s
    x, _, z = env.pos
    vx, vy, _ = env.vel
    cw_comp = np.array([-(3.0 * n * n * x + 2.0 * n * vy), 2.0 * n * vx, n * n * z], dtype=np.float64)
    acc_des = cw_comp - 0.0045 * env.pos - 0.14 * env.vel
    return env.mass * acc_des

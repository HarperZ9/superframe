# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Unit-quaternion 6-DOF attitude kinematics, TVC gimbal clamping, and exponential atmosphere."""
from __future__ import annotations

import math

import numpy as np


def quat_normalize(q: np.ndarray) -> np.ndarray:
    """Normalize quaternion [w, x, y, z] to unit length in canonical w >= 0 hemisphere."""
    arr = np.asarray(q, dtype=np.float64)
    n = float(np.linalg.norm(arr))
    if n < 1e-15:
        return np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float64)
    out = arr / n
    return -out if out[0] < 0.0 else out


def quat_mul(q1: np.ndarray, q2: np.ndarray) -> np.ndarray:
    """Hamilton product q1 * q2 for [w, x, y, z] quaternions."""
    w1, x1, y1, z1 = q1
    w2, x2, y2, z2 = q2
    return np.array([
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
        w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
        w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
        w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
    ], dtype=np.float64)


def quat_conj(q: np.ndarray) -> np.ndarray:
    return np.array([q[0], -q[1], -q[2], -q[3]], dtype=np.float64)


def quat_to_rotmat(q: np.ndarray) -> np.ndarray:
    """Return 3x3 body-to-world SO(3) rotation matrix from unit quaternion [w, x, y, z]."""
    w, x, y, z = quat_normalize(q)
    return np.array([
        [1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y - w * z), 2.0 * (x * z + w * y)],
        [2.0 * (x * y + w * z), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z - w * x)],
        [2.0 * (x * z - w * y), 2.0 * (y * z + w * x), 1.0 - 2.0 * (x * x + y * y)],
    ], dtype=np.float64)


def quat_integrate(q: np.ndarray, omega_body: np.ndarray, dt: float) -> np.ndarray:
    """Exact exponential-map integration q_{k+1} = q_k * exp(0.5 * dt * [0, omega])."""
    w = np.asarray(omega_body, dtype=np.float64)
    theta = float(np.linalg.norm(w)) * dt
    if theta < 1e-12:
        dq = np.array([1.0, 0.5 * w[0] * dt, 0.5 * w[1] * dt, 0.5 * w[2] * dt], dtype=np.float64)
    else:
        axis = w / float(np.linalg.norm(w))
        s = math.sin(0.5 * theta)
        dq = np.array([math.cos(0.5 * theta), axis[0] * s, axis[1] * s, axis[2] * s], dtype=np.float64)
    return quat_normalize(quat_mul(q, dq))


def quat_error_vec(q_cur: np.ndarray, q_des: np.ndarray) -> np.ndarray:
    """Return 3D body-frame rotation error vector driving q_cur toward q_des."""
    qe = quat_normalize(quat_mul(quat_conj(q_cur), q_des))
    return 2.0 * qe[1:4]


def quat_angle_rad(q1: np.ndarray, q2: np.ndarray) -> float:
    """Geodesic angular separation (rad) between two unit quaternions."""
    dot = min(1.0, abs(float(np.dot(quat_normalize(q1), quat_normalize(q2)))))
    return 2.0 * math.acos(dot)


def clamp_gimbal_angles(gx_rad: float, gy_rad: float, max_deg: float = 25.0) -> tuple[float, float, np.ndarray]:
    """Clamp TVC gimbal deflection cone to <= max_deg and return unit thrust dir in body frame."""
    lim = math.radians(max_deg)
    mag = math.hypot(gx_rad, gy_rad)
    if mag > lim and mag > 1e-12:
        scale = lim / mag
        gx_rad *= scale
        gy_rad *= scale
        mag = lim
    if mag < 1e-12:
        return 0.0, 0.0, np.array([0.0, 0.0, 1.0], dtype=np.float64)
    s = math.sin(mag)
    body_dir = np.array([s * (gx_rad / mag), s * (gy_rad / mag), math.cos(mag)], dtype=np.float64)
    return float(gx_rad), float(gy_rad), body_dir


def exp_atmosphere_density(alt_m: float, rho0: float, scale_height_m: float) -> float:
    """Exponential atmosphere density rho(h) = rho0 * exp(-max(h, 0) / H) in kg/m^3."""
    if rho0 <= 0.0 or scale_height_m <= 0.0:
        return 0.0
    return float(rho0 * math.exp(-max(0.0, alt_m) / scale_height_m))

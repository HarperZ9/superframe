# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Noisy sensor & instrument pipeline with deterministic Complementary / EKF State Estimator.

Simulates:
  - 6-axis IMU (gyro + accelerometer constant bias + Gaussian random walk + white noise)
  - Star tracker (unit-quaternion attitude + arcsec noise + dropout)
  - LiDAR altimeter (range noise + max-range / fault dropout + spike injection)
  - Barometer (exponential pressure altitude + noise)
Includes innovation-gated fault detection rejecting planted sensor dropouts & bias injections.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from .quat_math import quat_angle_rad, quat_integrate, quat_normalize, quat_to_rotmat


@dataclass
class SensorFaults:
    """Configurable fault-injection controls for planted-failure tests."""
    imu_dropout: bool = False
    star_tracker_dropout: bool = False
    lidar_dropout: bool = False
    baro_dropout: bool = False
    accel_bias_injection: tuple[float, float, float] = (0.0, 0.0, 0.0)
    gyro_bias_injection: tuple[float, float, float] = (0.0, 0.0, 0.0)
    lidar_spike_m: float = 0.0


@dataclass
class SensorReading:
    """Timestamped multi-sensor measurement packet."""
    accel_body: np.ndarray
    gyro_body: np.ndarray
    star_quat: np.ndarray | None
    lidar_alt_m: float | None
    baro_pa: float | None
    baro_alt_m: float | None
    imu_valid: bool = True


class InstrumentSuite:
    """Realistic noisy aerospace instrument pipeline with random-walk IMU biases."""

    def __init__(
        self,
        seed: int = 0,
        *,
        p0_pa: float = 101325.0,
        scale_height_m: float = 8500.0,
        lidar_max_range_m: float = 250.0,
    ):
        self._rng = np.random.default_rng(seed)
        self.p0_pa = float(p0_pa)
        self.scale_height_m = float(scale_height_m)
        self.lidar_max_range_m = float(lidar_max_range_m)
        self.accel_bias = self._rng.normal(0.0, 0.02, size=3)
        self.gyro_bias = self._rng.normal(0.0, 0.001, size=3)

    def _sample_imu(self, acc_world: np.ndarray, quat: np.ndarray, omega_body: np.ndarray, gravity: float, dt: float, flt: SensorFaults) -> tuple[np.ndarray, np.ndarray]:
        self.accel_bias = self.accel_bias + self._rng.normal(0.0, 0.002 * math.sqrt(dt), size=3)
        self.gyro_bias = self.gyro_bias + self._rng.normal(0.0, 0.0002 * math.sqrt(dt), size=3)
        if flt.imu_dropout:
            return np.zeros(3, dtype=np.float64), np.zeros(3, dtype=np.float64)
        rot = quat_to_rotmat(quat)
        spec_force = rot.T @ (np.asarray(acc_world, dtype=np.float64) + np.array([0.0, 0.0, gravity]))
        accel = spec_force + self.accel_bias + np.asarray(flt.accel_bias_injection, dtype=np.float64) + self._rng.normal(0.0, 0.05, size=3)
        gyro = np.asarray(omega_body, dtype=np.float64) + self.gyro_bias + np.asarray(flt.gyro_bias_injection, dtype=np.float64) + self._rng.normal(0.0, 0.003, size=3)
        return accel, gyro

    def sample(
        self,
        pos_world: np.ndarray,
        acc_world: np.ndarray,
        quat: np.ndarray,
        omega_body: np.ndarray,
        gravity: float,
        dt: float,
        faults: SensorFaults | None = None,
    ) -> SensorReading:
        flt = faults or SensorFaults()
        accel_meas, gyro_meas = self._sample_imu(acc_world, quat, omega_body, gravity, dt, flt)
        star_q = None if flt.star_tracker_dropout else quat_integrate(quat, self._rng.normal(0.0, 0.0015, size=3), 1.0)
        alt = max(0.0, float(pos_world[2]))
        if flt.lidar_dropout or alt > self.lidar_max_range_m:
            lidar_alt = None
        else:
            lidar_alt = max(0.0, alt + float(self._rng.normal(0.0, 0.04)) + float(flt.lidar_spike_m))
        if flt.baro_dropout or self.p0_pa <= 0.0:
            baro_pa, baro_alt = None, None
        else:
            p_true = self.p0_pa * math.exp(-alt / self.scale_height_m)
            baro_pa = max(1.0, p_true + float(self._rng.normal(0.0, 3.5)))
            baro_alt = max(0.0, -self.scale_height_m * math.log(baro_pa / self.p0_pa))
        return SensorReading(accel_meas, gyro_meas, star_q, lidar_alt, baro_pa, baro_alt, imu_valid=not flt.imu_dropout)


@dataclass
class EstimatorState:
    """Estimated 6-DOF altitude/attitude navigation state and fault flags."""
    alt_m: float = 0.0
    vz_m_s: float = 0.0
    quat: np.ndarray = field(default_factory=lambda: np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float64))
    p_cov: np.ndarray = field(default_factory=lambda: np.diag([1.0, 0.5]))
    fault_flags: list[str] = field(default_factory=list)


class NavStateEstimator:
    """Deterministic Complementary + 2-state vertical EKF with innovation fault gating."""

    def __init__(self, init_alt_m: float = 0.0, init_vz: float = 0.0, init_quat: np.ndarray | None = None):
        q0 = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float64) if init_quat is None else quat_normalize(init_quat)
        self.state = EstimatorState(alt_m=float(init_alt_m), vz_m_s=float(init_vz), quat=q0)
        self.rejections = 0

    def _kalman_alt_update(self, z_meas: float, r_var: float, gate_m: float, label: str) -> None:
        innov = z_meas - self.state.alt_m
        s_var = float(self.state.p_cov[0, 0]) + r_var
        if abs(innov) > max(gate_m, 4.5 * math.sqrt(max(s_var, 1e-6))):
            self.state.fault_flags.append(f"{label}_outlier_rejected")
            self.rejections += 1
            return
        k0 = float(self.state.p_cov[0, 0]) / s_var
        k1 = float(self.state.p_cov[1, 0]) / s_var
        self.state.alt_m += k0 * innov
        self.state.vz_m_s += k1 * innov
        p = self.state.p_cov
        self.state.p_cov = np.array([
            [(1.0 - k0) * p[0, 0], (1.0 - k0) * p[0, 1]],
            [p[1, 0] - k1 * p[0, 0], p[1, 1] - k1 * p[0, 1]],
        ], dtype=np.float64)

    def update(self, reading: SensorReading, gravity: float, dt: float) -> EstimatorState:
        self.state.fault_flags = []
        if not reading.imu_valid:
            self.state.fault_flags.append("imu_dropout")
            self.rejections += 1
            az_world = 0.0
        else:
            if float(np.linalg.norm(reading.gyro_body)) > 15.0:
                self.state.fault_flags.append("gyro_bias_or_rate_fault")
                self.rejections += 1
            else:
                self.state.quat = quat_integrate(self.state.quat, reading.gyro_body, dt)
            acc_w = quat_to_rotmat(self.state.quat) @ reading.accel_body - np.array([0.0, 0.0, gravity])
            if abs(float(acc_w[2])) > 60.0:
                self.state.fault_flags.append("accel_bias_fault_rejected")
                self.rejections += 1
                az_world = 0.0
            else:
                az_world = float(acc_w[2])

        # Vertical EKF predict
        self.state.alt_m = max(0.0, self.state.alt_m + self.state.vz_m_s * dt + 0.5 * az_world * dt * dt)
        self.state.vz_m_s += az_world * dt
        f_mat = np.array([[1.0, dt], [0.0, 1.0]], dtype=np.float64)
        q_proc = np.diag([0.01 * dt, 0.15 * dt])
        self.state.p_cov = f_mat @ self.state.p_cov @ f_mat.T + q_proc

        # Star tracker complementary fusion
        if reading.star_quat is None:
            self.state.fault_flags.append("star_tracker_dropout")
        else:
            ang = quat_angle_rad(self.state.quat, reading.star_quat)
            if ang > math.radians(30.0):
                self.state.fault_flags.append("star_tracker_outlier_rejected")
                self.rejections += 1
            else:
                q_s = reading.star_quat if float(np.dot(self.state.quat, reading.star_quat)) >= 0.0 else -reading.star_quat
                self.state.quat = quat_normalize(0.85 * self.state.quat + 0.15 * q_s)

        if reading.lidar_alt_m is None:
            self.state.fault_flags.append("lidar_dropout")
        else:
            self._kalman_alt_update(reading.lidar_alt_m, r_var=0.04, gate_m=3.5, label="lidar")

        if reading.baro_alt_m is None:
            self.state.fault_flags.append("baro_dropout")
        else:
            self._kalman_alt_update(reading.baro_alt_m, r_var=1.5, gate_m=8.0, label="baro")

        return self.state

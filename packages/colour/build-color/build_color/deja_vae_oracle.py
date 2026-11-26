# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Deja-VAE training-free null-space invertibility & 10-step PasteBench drift oracle.

Clean-room implementation of training-free surjective pseudo-invertible wrapping (SPNN):
  - Moore-Penrose null-space back-projection: x' = x + A^dagger (y - A x)
  - Right-invertible decoder wrapper: D'(z) = D_base(z) + E^dagger (z - E D_base(z))
    guaranteeing exact E(D'(z)) == z to machine precision without retraining D_base
  - 10-step chained encode-decode PasteBench drift check + fail-closed planted controls.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class RoundTripReport:
    """Telemetry from a chained multi-step encode-decode invertibility check."""
    mode: str
    steps: int
    verdict: str
    reason: str
    max_latent_drift: float
    final_latent_drift: float
    max_signal_residual: float
    condition_number: float
    step_drifts: tuple[float, ...]


def moore_penrose_pinv(matrix: np.ndarray, rcond: float = 1e-10) -> tuple[np.ndarray, float, int]:
    """Compute SVD Moore-Penrose pseudoinverse, condition number, and numerical rank."""
    a = np.asarray(matrix, dtype=np.float64)
    if a.ndim != 2 or a.shape[0] == 0 or a.shape[1] == 0:
        raise ValueError("operator matrix must be non-empty 2D")
    u, s, vt = np.linalg.svd(a, full_matrices=False)
    s_max = float(s[0]) if s.size else 0.0
    cutoff = rcond * s_max
    rank = int(np.sum(s > cutoff))
    cond = (s_max / float(s[rank - 1])) if rank > 0 else float("inf")
    s_inv = np.where(s > cutoff, 1.0 / np.where(s > cutoff, s, 1.0), 0.0)
    pinv = (vt.T * s_inv) @ u.T
    return pinv, cond, rank


def nullspace_backproject(
    x: np.ndarray,
    y: np.ndarray,
    operator_a: np.ndarray,
    a_pinv: np.ndarray | None = None,
) -> np.ndarray:
    """Exact null-space back-projection x' = x + A^dagger (y - A x) preserving null(A) component."""
    xv = np.asarray(x, dtype=np.float64)
    yv = np.asarray(y, dtype=np.float64)
    a = np.asarray(operator_a, dtype=np.float64)
    pinv = moore_penrose_pinv(a)[0] if a_pinv is None else np.asarray(a_pinv, dtype=np.float64)
    return xv + pinv @ (yv - (a @ xv))


class SurjectivePseudoInvertibleCodec:
    """Training-free Deja-VAE wrapper enforcing E(D'(z)) = z via null-space back-projection."""

    def __init__(
        self,
        encoder_e: np.ndarray,
        base_decoder_d: np.ndarray,
        *,
        max_cond: float = 1e6,
        distortion_fn=None,
    ) -> None:
        self.encoder_e = np.asarray(encoder_e, dtype=np.float64)
        self.base_decoder_d = np.asarray(base_decoder_d, dtype=np.float64)
        if self.encoder_e.ndim != 2 or self.base_decoder_d.ndim != 2:
            raise ValueError("encoder_e and base_decoder_d must be 2D matrices")
        m, d = self.encoder_e.shape
        if self.base_decoder_d.shape != (d, m):
            raise ValueError(f"decoder shape {self.base_decoder_d.shape} must match {(d, m)}")
        self.e_pinv, self.cond, self.rank = moore_penrose_pinv(self.encoder_e)
        self.full_row_rank = self.rank == m and math.isfinite(self.cond) and self.cond <= max_cond
        self.distortion_fn = distortion_fn

    def encode(self, x: np.ndarray) -> np.ndarray:
        return self.encoder_e @ np.asarray(x, dtype=np.float64)

    def decode_naive(self, z: np.ndarray) -> np.ndarray:
        x = self.base_decoder_d @ np.asarray(z, dtype=np.float64)
        return self.distortion_fn(x) if self.distortion_fn is not None else x

    def decode_deja(self, z: np.ndarray) -> np.ndarray:
        """Training-free SPNN decoder: D'(z) = D_base(z) + E^dagger (z - E D_base(z))."""
        zv = np.asarray(z, dtype=np.float64)
        x_base = self.base_decoder_d @ zv
        x_proj = nullspace_backproject(x_base, zv, self.encoder_e, self.e_pinv)
        return self.distortion_fn(x_proj) if self.distortion_fn is not None else x_proj


def build_test_codec(
    *,
    signal_dim: int = 16,
    latent_dim: int = 6,
    mismatch_sigma: float = 0.08,
    seed: int = 2026,
    singular: bool = False,
    distortion_fn=None,
) -> SurjectivePseudoInvertibleCodec:
    """Build deterministic orthonormal-PCA encoder + imperfectly matched baseline decoder."""
    rng = np.random.default_rng(seed)
    raw = rng.normal(0.0, 1.0, size=(signal_dim, signal_dim))
    q, _ = np.linalg.qr(raw)
    e = q[:latent_dim, :].copy()
    if singular:
        e[-1, :] = e[0, :]
    d_base = e.T + rng.normal(0.0, mismatch_sigma, size=(signal_dim, latent_dim))
    return SurjectivePseudoInvertibleCodec(e, d_base, distortion_fn=distortion_fn)


def run_10step_roundtrip_oracle(
    codec: SurjectivePseudoInvertibleCodec,
    z0: np.ndarray,
    *,
    steps: int = 10,
    tol: float = 1e-9,
    mode: str = "deja",
) -> RoundTripReport:
    """PasteBench-style 10-step chained encode-decode invertibility oracle (fail-closed)."""
    if mode not in ("deja", "naive"):
        raise ValueError(f"unknown oracle mode: {mode}")
    z_init = np.asarray(z0, dtype=np.float64)
    if not codec.full_row_rank:
        return RoundTripReport(
            mode=mode, steps=steps, verdict="FAIL", reason="non_invertible_operator",
            max_latent_drift=float("inf"), final_latent_drift=float("inf"),
            max_signal_residual=float("inf"), condition_number=codec.cond, step_drifts=(),
        )

    z_cur = z_init.copy()
    drifts: list[float] = []
    max_sig_res = 0.0
    for _ in range(steps):
        x_hat = codec.decode_deja(z_cur) if mode == "deja" else codec.decode_naive(z_cur)
        z_next = codec.encode(x_hat)
        step_err = float(np.linalg.norm(z_next - z_init))
        sig_res = float(np.linalg.norm(codec.encode(x_hat) - z_cur))
        drifts.append(step_err)
        max_sig_res = max(max_sig_res, sig_res)
        z_cur = z_next

    max_drift = max(drifts) if drifts else 0.0
    final_drift = drifts[-1] if drifts else 0.0
    if not math.isfinite(max_drift) or max_drift > tol:
        return RoundTripReport(
            mode=mode, steps=steps, verdict="FAIL", reason="roundtrip_drift_exceeded",
            max_latent_drift=max_drift, final_latent_drift=final_drift,
            max_signal_residual=max_sig_res, condition_number=codec.cond,
            step_drifts=tuple(drifts),
        )
    return RoundTripReport(
        mode=mode, steps=steps, verdict="PASS", reason="exact_invertibility_conserved",
        max_latent_drift=max_drift, final_latent_drift=final_drift,
        max_signal_residual=max_sig_res, condition_number=codec.cond,
        step_drifts=tuple(drifts),
    )

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Tests for Deja-VAE null-space back-projection & 10-step PasteBench drift oracle."""
from __future__ import annotations

import numpy as np

from build_color.deja_vae_oracle import (
    build_test_codec,
    moore_penrose_pinv,
    nullspace_backproject,
    run_10step_roundtrip_oracle,
)


def test_nullspace_backproject_enforces_exact_constraint_and_preserves_nullspace():
    """x' = x + A^dagger (y - A x) satisfies A x' == y and leaves null(A) component intact."""
    rng = np.random.default_rng(7)
    a = rng.normal(0.0, 1.0, size=(4, 12))
    a_pinv, cond, rank = moore_penrose_pinv(a)
    assert rank == 4 and cond < 50.0

    x = rng.normal(0.0, 1.0, size=12)
    y = rng.normal(0.0, 1.0, size=4)
    x_proj = nullspace_backproject(x, y, a, a_pinv)
    assert float(np.linalg.norm(a @ x_proj - y)) < 1e-12

    # Null-space component P_null @ x must be untouched by back-projection
    p_null = np.eye(12) - a_pinv @ a
    assert float(np.linalg.norm(p_null @ (x_proj - x))) < 1e-12


def test_deja_vae_10step_roundtrip_beats_naive_vae_and_rejects_planted_distortions():
    """Deja-VAE passes 10-step E'(D'(z)) == z to <1e-11 while naive & planted distortions fail."""
    rng = np.random.default_rng(42)
    z0 = rng.normal(0.0, 1.0, size=6)

    codec = build_test_codec(signal_dim=16, latent_dim=6, mismatch_sigma=0.09, seed=2026)
    rep_deja = run_10step_roundtrip_oracle(codec, z0, steps=10, tol=1e-9, mode="deja")
    rep_naive = run_10step_roundtrip_oracle(codec, z0, steps=10, tol=1e-9, mode="naive")
    assert rep_deja.verdict == "PASS", rep_deja
    assert rep_deja.max_latent_drift < 1e-11
    assert rep_deja.max_signal_residual < 1e-11
    assert rep_naive.verdict == "FAIL"
    assert rep_naive.reason == "roundtrip_drift_exceeded"
    assert rep_naive.max_latent_drift > 0.05

    # Planted control 1: non-invertible rank-deficient encoder MUST fail closed
    singular_codec = build_test_codec(signal_dim=16, latent_dim=6, seed=2026, singular=True)
    rep_sing = run_10step_roundtrip_oracle(singular_codec, z0, steps=10, tol=1e-9, mode="deja")
    assert rep_sing.verdict == "FAIL"
    assert rep_sing.reason == "non_invertible_operator"

    # Planted control 2: post-projection non-invertible nonlinear clipping MUST fail closed
    clipped_codec = build_test_codec(
        signal_dim=16,
        latent_dim=6,
        seed=2026,
        distortion_fn=lambda x: np.clip(x, -0.25, 0.25),
    )
    rep_clip = run_10step_roundtrip_oracle(clipped_codec, z0, steps=10, tol=1e-9, mode="deja")
    assert rep_clip.verdict == "FAIL"
    assert rep_clip.reason == "roundtrip_drift_exceeded"
    assert rep_clip.max_latent_drift > 0.1

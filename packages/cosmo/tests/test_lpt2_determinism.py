# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Second-order Lagrangian initial conditions against a planted two-mode field, and bitwise repeat runs."""
import hashlib
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import background, ic, linear, pm  # noqa: E402
from cosmolab.backend import get_backend  # noqa: E402

C = background.Cosmology()
BOX, N = 100.0, 32
K1, K2 = 2 * np.pi / BOX, 4 * np.pi / BOX


def _two_mode(amp):
    """delta = A cos(k1 x) + A cos(k2 y) and its exact second-order displacement grad phi2.

    phi1_xx = A cos(k1 x), phi1_yy = A cos(k2 y), phi1_xy = 0, so the source is their product and
    grad phi2 = A^2 / (k1^2 + k2^2) (k1 sin(k1 x) cos(k2 y), k2 cos(k1 x) sin(k2 y), 0)."""
    q = ic.lattice(BOX, N)
    delta = (amp * np.cos(K1 * q[:, 0]) + amp * np.cos(K2 * q[:, 1])).reshape(N, N, N)
    exact = amp * amp / (K1 ** 2 + K2 ** 2) * np.stack(
        [K1 * np.sin(K1 * q[:, 0]) * np.cos(K2 * q[:, 1]), K2 * np.cos(K1 * q[:, 0]) * np.sin(K2 * q[:, 1]),
         np.zeros(len(q))], axis=1)
    return q, np.fft.rfftn(delta), exact


def test_second_order_displacement_of_two_modes():
    _, dk, exact = _two_mode(0.2)
    psi2 = ic.second_order_displacement(dk, BOX, N)
    assert np.max(np.abs(psi2 - exact)) < 1e-12 * np.max(np.abs(exact))
    # a single plane wave is exact at first order: no second-order term at all
    q = ic.lattice(BOX, N)
    single = np.fft.rfftn((0.2 * np.cos(K1 * q[:, 0])).reshape(N, N, N))
    assert np.max(np.abs(ic.second_order_displacement(single, BOX, N))) < 1e-14


def _evolved_second_order(order, d2_sign, a_i=0.2, a_f=1.0, amp=0.2):
    """Run the PM solver from a_i to a_f and project the displacement beyond first order onto the exact
    grad phi2 pattern; returns the fitted coefficient over D2(a_f). Third-order terms live at other
    wavevectors (k1, k2, 2k1 +- k2, ...), so the projection isolates second order up to fourth order."""
    q, dk, exact = _two_mode(amp)
    x, p, psi, _ = ic.from_delta_k(C, dk, BOX, N, a_i, order, d2_sign)
    solver = pm.PMSolver(C, BOX, 2 * N, N ** 3, get_backend("numpy"))
    grid = np.unique(np.concatenate([np.geomspace(a_i, 0.3, 4), np.linspace(0.3, a_f, 25)]))
    x, _ = solver.run(x, p, grid)
    r = np.mod(x - q - C.growth(a_f) * psi + BOX / 2, BOX) - BOX / 2
    return float(np.sum(r * exact) / np.sum(exact * exact)) / ic.growth2(C, a_f)[0]


def test_2lpt_start_follows_the_second_order_growing_mode():
    assert _evolved_second_order(2, 1.0) == pytest.approx(1.0, abs=0.02)        # measured 1.008
    # Zel'dovich start: the missing second-order displacement decays only as a_i / a (Crocce et al. 2006)
    assert _evolved_second_order(1, 1.0) < 0.8                                    # measured 0.66
    # planted: the second-order term with the wrong sign
    assert _evolved_second_order(2, -1.0) < 0.5                                   # measured 0.30


def _hash_run(ops, steps=12):
    plin = linear.LinearPower(C)
    n = 64
    x, p, _ = ic.zeldovich(C, plin, 128.0, n, 0.05, seed=3, order=2)
    solver = pm.PMSolver(C, 128.0, 2 * n, n ** 3, ops, deconvolve=2)
    x, p = solver.run(ops.asarray(x), ops.asarray(p), np.geomspace(0.05, 1.0, steps + 1))
    h = hashlib.sha256()
    h.update(np.ascontiguousarray(ops.to_numpy(x)).tobytes())
    h.update(np.ascontiguousarray(ops.to_numpy(p)).tobytes())
    return h.hexdigest()


def test_numpy_runs_repeat_bitwise():
    ops = get_backend("numpy")
    assert _hash_run(ops, 4) == _hash_run(ops, 4)


def test_cuda_runs_repeat_bitwise_with_integer_deposit():
    try:
        ops = get_backend("torch")
    except RuntimeError:
        pytest.skip("torch with CUDA is not available here")
    assert ops.deterministic
    hashes = {_hash_run(ops) for _ in range(3)}
    assert len(hashes) == 1
    # planted: float atomics in the deposit; 5 runs gave 5 different hashes when this test was written
    float_ops = get_backend("torch", deterministic=False)
    assert len({_hash_run(float_ops) for _ in range(3)}) > 1

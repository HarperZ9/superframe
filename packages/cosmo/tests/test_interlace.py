# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Interlaced P(k) (power.py) and the shifted deposit behind it (lean.deposit), round five.

Truth here is the same particles measured on a mesh four times finer, where the band under test sits below a
quarter of that mesh's Nyquist frequency and aliasing is negligible. Both coarse estimators are compared
without shot-noise subtraction, so the comparison is about aliasing alone."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import background, ic, linear, pm, power  # noqa: E402
from cosmolab.backend import get_backend  # noqa: E402

C = background.Cosmology()
OPS = get_backend("numpy")
BOX, N, NG = 32.0, 64, 64


def _particles():
    pos, _, _ = ic.zeldovich(C, linear.LinearPower(C), BOX, N, 1.0, 3, fixed=True, order=1)
    return pos


def _band(k, p, w, ref_k, ref_p, lo=0.7, hi=0.9):
    kn = np.pi * NG / BOX
    s = (k >= lo * kn) & (k < hi * kn)
    return float(np.average(p[s] / np.interp(k[s], ref_k, ref_p), weights=w[s]))


def test_alias_sums_match_jing_closed_form():
    x = np.linspace(0.0, np.pi / 2, 9)
    plain, signed = power._alias_sums(x, images=200)
    assert np.abs(plain - (1 - 2 / 3 * np.sin(x) ** 2)).max() < 1e-8
    assert abs(signed[-1]) < 1e-8 and abs(signed[0] - 1) < 1e-12     # images cancel in pairs at the Nyquist


def test_interlacing_removes_odd_aliases():
    pos = _particles()
    rk, rp, _ = power.power_spectrum(pos, BOX, 4 * NG, OPS, N ** 3, subtract_shot=False)
    k, plain, w = power.power_spectrum(pos, BOX, NG, OPS, N ** 3, subtract_shot=False)
    _, il, _ = power.power_spectrum(pos, BOX, NG, OPS, N ** 3, subtract_shot=False, interlace=True)
    assert abs(_band(k, il, w, rk, rp) - 1) < 0.01                    # measured 0.0029
    assert _band(k, plain, w, rk, rp) - 1 > 0.05                      # measured 0.094: plain CIC reads high
    # planted: the second deposit shifted the wrong way, so the phase factor no longer lines it up
    h = BOX / NG
    d1 = pm.PMSolver(C, BOX, NG, N ** 3, OPS).deposit(pos)
    bad = pm.PMSolver(C, BOX, NG, N ** 3, OPS).deposit(np.mod(pos - 0.5 * h, BOX))
    _, pb, _ = power.power_spectrum(None, BOX, NG, OPS, N ** 3, subtract_shot=False, delta=d1, delta_half=bad)
    assert abs(_band(k, pb, w, rk, rp) - 1) > 0.05                    # measured 0.46 of the truth


def test_shot_term_is_returned_and_subtracted():
    pos = _particles()
    _, raw, _ = power.power_spectrum(pos, BOX, NG, OPS, N ** 3, subtract_shot=False, interlace=True)
    _, sub, _, shot = power.power_spectrum(pos, BOX, NG, OPS, N ** 3, interlace=True, return_shot=True)
    assert np.allclose(raw - sub, shot, rtol=1e-10, atol=1e-12)
    assert abs(shot[0] - BOX ** 3 / N ** 3) < 1e-3 * BOX ** 3 / N ** 3   # vol / N on the largest scales
    _, _, _, shot_plain = power.power_spectrum(pos, BOX, NG, OPS, N ** 3, return_shot=True)
    assert np.all(shot_plain >= shot - 1e-12)                       # interlacing drops the odd images' noise too


def test_shifted_lean_deposit_matches_moved_particles():
    try:
        ops = get_backend("torch")
    except RuntimeError:
        pytest.skip("torch with CUDA is not available here")
    from cosmolab import lean
    pos = _particles()
    xyz = [ops.torch.as_tensor(np.ascontiguousarray(pos[:, c], dtype=np.float32), device=ops.device) for c in range(3)]
    h = BOX / NG
    for shift in (0.0, 0.5):
        gpu = ops.to_numpy(lean.deposit(ops, xyz, BOX, NG, N ** 3, slabs=3, shift=shift))
        cpu = pm.PMSolver(C, BOX, NG, N ** 3, OPS).deposit(np.mod(pos.astype(np.float32).astype(np.float64) + shift * h, BOX))
        assert np.abs(gpu - cpu).max() < 1e-4                           # float32 cell coordinates
    a = ops.to_numpy(lean.deposit(ops, xyz, BOX, NG, N ** 3, shift=0.5))
    b = ops.to_numpy(lean.deposit(ops, xyz, BOX, NG, N ** 3, slabs=7, shift=0.5))
    assert np.array_equal(a, b)                                         # integer sums: slab count does not matter

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Block time steps (stepping.py): the level rule, linear growth with few mesh steps, P(k) against a run on
many global steps with a planted too-coarse step rule, and the lean CUDA engine against the CPU one."""
import hashlib
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import background, ic, linear, pm, power, shortrange, stepping  # noqa: E402
from cosmolab.backend import get_backend  # noqa: E402

C = background.Cosmology()
OPS = get_backend("numpy")


def test_level_rule():
    # 4^l >= crit |g|: r = 1 -> 0, 1 < r <= 4 -> 1, 4 < r <= 16 -> 2; above 4^lmax is clamped and counted
    lv, clamped = stepping.level_rule(np.array([0.0, 1.0, 1.01, 4.0, 4.01, 16.0, 1e6]), 1.0, 0, 3)
    assert lv.tolist() == [0, 0, 1, 1, 2, 2, 3] and clamped == 1
    lv, _ = stepping.level_rule(np.array([0.0, 5.0]), 1.0, 2, 3)          # never coarser than the boundary allows
    assert lv.tolist() == [2, 2]
    assert [stepping._v2(j) for j in (1, 2, 3, 4, 6, 8)] == [0, 1, 0, 2, 1, 3]


def test_subset_pair_sum_equals_full_sum():
    rng = np.random.default_rng(3)
    pos = rng.uniform(0, 10.0, (2000, 3))
    act = np.array([5, 17, 900, 1999])
    full = shortrange.short_range_cpu(pos, 10.0, 0.01, 0.2, 0.9, eps=0.01)
    sub = shortrange.short_range_subset(pos, act, 10.0, 0.01, 0.2, 0.9, eps=0.01)
    assert np.abs(full[act] - sub).max() < 1e-15 * np.abs(full).max()


def _pancake_amplitude(n_global, linear_exact):
    n, box = 16, 64.0
    pos, mom, q = ic.pancake(C, box, n, 40.0, 0.1)
    s = pm.P3MSolver(C, box, 2 * n, n ** 3, OPS, eps=box / n / 30, gradient="ik")
    e = stepping.NumpyEngine(s, pos, mom)
    stepping.BlockStepper(C, box / n / 30, 0.05, 2, linear_exact=linear_exact).run(e, np.geomspace(0.1, 1.0, n_global + 1))
    k = 2 * np.pi / box
    disp = np.mod(e.pos[:, 0] - q[:, 0] + box / 2, box) - box / 2
    return -np.sum(disp * np.sin(k * q[:, 0])) / np.sum(np.sin(k * q[:, 0]) ** 2) * k


def test_linear_growth_with_four_mesh_steps():
    """FastPM-style mesh kicks and drift scaling keep linear growth with four global steps from a = 0.1."""
    ref = _pancake_amplitude(64, True)
    assert abs(_pancake_amplitude(4, True) / ref - 1) < 0.01             # measured 0.007
    # planted: plain kick and drift integrals on the same four steps lose 6 percent
    assert _pancake_amplitude(4, False) / ref < 0.96                       # measured 0.940


def _pk(grid, levels, eta, linear_exact=True, n=16, box=16.0):
    pos, mom, _ = ic.zeldovich(C, linear.LinearPower(C), box, n, 0.02, 3, fixed=True, order=2)
    eps = box / n / 30
    e = stepping.NumpyEngine(pm.P3MSolver(C, box, 4 * n, n ** 3, OPS, eps=eps, gradient="ik"), pos, mom)
    stepping.BlockStepper(C, eps, eta, levels, linear_exact=linear_exact).run(e, grid)
    k, p, nm = power.power_spectrum(e.pos, box, 2 * n, OPS, n ** 3, cosmo=C)
    return k, p, nm, e.pair_evals / n ** 3


def _bands(k, r, w):
    return [float(np.average(r[(k >= lo) & (k < hi)], weights=w[(k >= lo) & (k < hi)])) for lo, hi in ((0, 1), (1, 2))]


def _grid(n_log, n_lin):
    early = np.geomspace(0.02, 0.1, n_log + 1)
    return np.unique(np.concatenate([early, np.linspace(0.1, 1.0, n_lin + 1), [0.5]]))


def test_block_steps_match_many_global_steps():
    """40 global steps with three sub-step levels against 210 plain global steps, 16^3 particles."""
    k, ref, nm, _ = _pk(_grid(30, 180), 0, 1.0, linear_exact=False)
    _, blk, _, evals = _pk(_grid(10, 30), 3, 0.05)
    assert max(abs(b - 1) for b in _bands(k, blk / ref, nm)) < 0.005      # measured 0.002
    assert evals < 0.5 * 210                                               # measured 89 pair sums per particle
    # planted: a step rule 64 times too lenient leaves nearly every particle on the global step
    _, bad, _, _ = _pk(_grid(10, 30), 3, 3.2)
    assert _bands(k, bad / ref, nm)[1] < 0.9                               # measured 0.85


def _cuda_ops():
    try:
        return get_backend("torch")
    except RuntimeError:
        pytest.skip("torch with CUDA is not available here")


def test_lean_cuda_engine_matches_cpu_and_repeats_bitwise():
    ops = _cuda_ops()
    from cosmolab import lean
    n, box = 32, 32.0
    eps = box / n / 30
    pos, mom, _ = ic.zeldovich(C, linear.LinearPower(C), box, n, 0.3, 7, fixed=True, order=2)
    cpu = stepping.NumpyEngine(pm.P3MSolver(C, box, 2 * n, n ** 3, OPS, eps=eps, gradient="ik"), pos, 0 * mom)
    gpu = lean.CudaEngine(C, box, 2 * n, n ** 3, pos, 0 * mom, ops, eps=eps)

    def gpu_mom():
        p = np.stack([ops.to_numpy(c) for c in gpu.p], 1)
        out = np.empty_like(p)
        out[ops.to_numpy(gpu.ids)] = p
        return out
    cpu.long_kick(1.0)
    gpu.long_kick(1.0)
    assert np.abs(cpu.mom - gpu_mom()).max() < 1e-5 * np.abs(cpu.mom).max()      # measured 7e-7
    cpu.mom[:] = 0
    for c in gpu.p:
        c.zero_()
    kc, ko = np.zeros(4), np.ones(4)
    cpu.short_kick(0, kc, ko, 1.0, 3)
    gpu.short_kick(0, kc, ko, 1.0, 3)
    assert np.abs(cpu.mom - gpu_mom()).max() < 1e-3 * np.abs(cpu.mom).max()      # measured 9e-5
    lv = np.empty(n ** 3, dtype=np.int64)
    lv[ops.to_numpy(gpu.ids)] = ops.to_numpy(gpu.level)
    assert np.array_equal(lv, cpu.level)

    def run(**kw):
        e = lean.CudaEngine(C, box, 2 * n, n ** 3, pos, mom, ops, eps=eps, **kw)
        stepping.BlockStepper(C, eps, 0.05, 3).run(e, np.geomspace(0.3, 0.6, 5))
        return hashlib.sha256(e.positions().tobytes()).hexdigest()
    hashes = {run(), run(), run(offload=True, slabs=5)}
    assert len(hashes) == 1        # repeat runs, and the chunked deposit with offloaded momenta, agree bitwise


def test_float32_ics_and_matched_phases():
    pl = linear.LinearPower(C)
    dk = ic.linear_delta_k(pl, 64.0, 16, 5, True)
    p, m, _, _ = ic.from_delta_k(C, dk, 64.0, 16, 0.05, 2)
    pos, mom = ic.from_delta_k_f32(C, dk, 64.0, 16, 0.05, 2)
    assert np.abs(np.stack(pos, 1) - p).max() < 4e-6                   # float32 rounding of positions < 64
    assert np.abs(np.stack(mom, 1) - m).max() < 1e-6 * np.abs(m).max()
    lo = ic.linear_delta_k(pl, 64.0, 16, 5, True)
    hi = ic.linear_delta_k(pl, 64.0, 32, 5, True, match_n=16)
    f = np.r_[0:8, -7:0]
    a = lo[np.ix_(f % 16, f % 16, np.arange(8))] * 8                   # delta_k scales as n^3 at a fixed field
    b = hi[np.ix_(f % 32, f % 32, np.arange(8))]
    assert np.abs(a - b).max() < 1e-12 * np.abs(b).max()
    other = ic.linear_delta_k(pl, 64.0, 32, 5, True)                   # unmatched: different phases
    assert np.abs(a - other[np.ix_(f % 32, f % 32, np.arange(8))]).max() > 0.5 * np.abs(b).max()

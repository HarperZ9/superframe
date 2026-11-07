# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Out-of-core slab stepping (ooc.py, slabwindow.py) and the sliced FFT (slicedfft.py).

The window layout, the ghost bound and the re-sort plan are plain Python and run everywhere. The engine
tests need CUDA: slab stepping must give the in-core engine's bits, a planted one-cell ghost must not, the
memory-mapped store must give the RAM store's bits, and the sliced FFT must match torch's 3-D FFT."""
import hashlib
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import background, ic, lean, linear, ooc  # noqa: E402

C = background.Cosmology()


def test_window_ranges_wrap_and_order():
    assert ooc.window_ranges(10, 20, 3, 40) == [(7, 10), (10, 20), (20, 23)]
    assert ooc.window_ranges(0, 10, 3, 40) == [(37, 40), (0, 10), (10, 13)]       # low ghosts wrap
    assert ooc.window_ranges(30, 40, 3, 40) == [(27, 30), (30, 40), (0, 3)]       # high ghosts wrap
    assert ooc.window_ranges(1, 10, 3, 40) == [(38, 40), (0, 1), (1, 10), (10, 13)]
    with pytest.raises(ValueError):
        ooc.window_ranges(0, 20, 11, 40)                                          # would see itself


def test_ghost_bound():
    # (2^L + 1) r_cut + 2 skin + 2 D over the cell: L = 3, r_cut 2.8125, skin 0.43, D 2, cell 1.62 -> 19
    assert ooc.ghost_cells(2.8125, 1.62, 0.43, 3, 2.0) == 19
    assert ooc.ghost_cells(2.8125, 1.62, 0.43, 1, 0.0) == 6


def test_sort_plan():
    flags, moved = lean.sort_plan(0.0, 1.0, [0.1] * 8, 1.5, 0.4)
    # 0.15 per drift: past 0.4 after the third, then again three later
    assert flags == [False, False, True, False, False, True, False, False] and abs(moved - 0.3) < 1e-12
    flags, moved = lean.sort_plan(0.35, 1.0, [0.1], 1.5, 0.4)                 # the carried bound counts
    assert flags == [True] and moved == 0.0


def _cuda():
    torch = pytest.importorskip("torch")
    if not torch.cuda.is_available():
        pytest.skip("needs CUDA")
    from cosmolab.backend import get_backend
    return get_backend("torch")


def _setup(n=32, box=64.0):
    pos, mom = ic.from_delta_k_f32(C, ic.linear_delta_k(linear.LinearPower(C), box, n, 5, fixed=True), box, n, 0.02, 2)
    grid = np.concatenate([np.geomspace(0.02, 0.1, 4), np.linspace(0.1, 0.5, 4)[1:]])
    return pos, mom, grid


def _sha(cols):
    h = hashlib.sha256()
    for c in cols:
        h.update(np.ascontiguousarray(c).tobytes())
    return h.hexdigest()


def _ooc(ops, pos, mom, grid, eps, **kw):
    from cosmolab import stepping
    r = ooc.SlabRunner(C, 64.0, 128, 32 ** 3, pos, mom, ops, eps, 1, nslabs=3, **kw)
    r.run(stepping.BlockStepper(C, eps, 0.1, 1), grid)
    return _sha([r.store[c] for c in ooc.COLS[:6]]), r


def test_slab_stepping_equals_in_core(tmp_path):
    ops = _cuda()
    from cosmolab import stepping
    pos, mom, grid = _setup()
    eps = 2.0 / 30
    e = lean.CudaEngine(C, 64.0, 128, 32 ** 3, pos, mom, ops, eps=eps, track_ids=False, sort_policy="plan")
    stepping.BlockStepper(C, eps, 0.1, 1).run(e, grid)
    ref = _sha([ops.to_numpy(c) for c in e.x + e.p])
    assert e.skin_violations == 0
    sha, r = _ooc(ops, pos, mom, grid, eps)
    assert r.ghost == 7 and sha == ref
    sha_disk, _ = _ooc(ops, pos, mom, grid, eps, store_path=str(tmp_path))     # memory-mapped store
    assert sha_disk == ref
    try:                                                                       # planted: one-cell ghost
        bad, _ = _ooc(ops, pos, mom, grid, eps, ghost=1)
    except ooc.GhostTooNarrow:
        bad = None
    assert bad != ref


def test_sliced_fft_matches_3d_fft():
    ops = _cuda()
    from cosmolab import pm, slicedfft
    t = ops.torch

    class M:
        pass
    m = M()
    m.t, ng = t, 64
    m.mesh = pm.PMSolver(C, 64.0, ng, 1, ops, gradient="ik", deconvolve=2, split=1.25)
    green = lean.CudaEngine._green(m)
    gb, db = slicedfft.blocks_for(m)
    assert t.equal(gb(16, 48), green[:, 16:48])
    delta = t.exp(t.randn((ng,) * 3, device=ops.device, generator=t.Generator(device=ops.device).manual_seed(1)))
    delta = (delta / delta.mean() - 1).contiguous()
    phi = ops.rfftn(delta) * green
    full = [ops.irfftn(phi * (-1j * m.mesh._grad_k(c)), (ng,) * 3) for c in range(3)]
    worst = 0.0
    for c, x0, x1, g in slicedfft.force_slabs(ops, lambda a, b: delta[a:b], ng, gb, db, slabs=4, pencils=4):
        worst = max(worst, float((g - full[c][x0:x1]).abs().max() / full[c].abs().max()))
    assert worst < 1e-5

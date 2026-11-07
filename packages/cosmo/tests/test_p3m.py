# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for the P3M short-range force: the two-body force across the mesh/pair split against Ewald,
the Layzer-Irvine energy equation in an expanding box, and bitwise repeats of the CUDA pair kernel."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import background, ewald, ic, linear, pm, shortrange  # noqa: E402
from cosmolab.backend import get_backend  # noqa: E402

C = background.Cosmology()
OPS = get_backend("numpy")
BANDS = {"0-0.5": (0, 0.5), "0.5-1": (0.5, 1), "1-2": (1, 2), "2-4": (2, 4), "4-8": (4, 8), "8-16": (8, 16),
         "16+": (16, 1e9)}


def _two_body_errors(ng=64, **kw):
    """rms and max relative error of mesh + pair force against Ewald, by separation in mesh cells."""
    s = pm.P3MSolver(C, 1.0, ng, 1, OPS, gradient="ik", **kw)
    src = np.array([[0.3, 0.3, 0.3]]) + 0.37 / ng
    rng = np.random.default_rng(1)
    dirs = rng.standard_normal((4000, 3))
    dirs /= np.linalg.norm(dirs, axis=1)[:, None]
    r = np.exp(rng.uniform(np.log(0.05 / ng), np.log(0.45), len(dirs)))
    d = dirs * r[:, None]
    mesh = s.force_meshes(s.deposit(src))
    g = np.stack([s.interpolate(m, np.mod(src + d, 1.0)) for m in mesh], axis=1)
    g += shortrange.kernel(d, s.gm, s.short_rs) * (r < s.rcut)[:, None]
    ref = s.gm * ewald.ewald_force(d, 1.0)
    err = np.linalg.norm(g - ref, axis=1) / np.linalg.norm(ref, axis=1)
    cells = r * ng
    return {b: (float(np.sqrt(np.mean(err[(cells >= lo) & (cells < hi)] ** 2))), float(err[(cells >= lo) & (cells < hi)].max()))
            for b, (lo, hi) in BANDS.items()}


def test_two_body_force_across_the_split_matches_ewald():
    e = _two_body_errors()
    rms_limit = {"0-0.5": 1e-3, "0.5-1": 3e-3, "1-2": 0.01, "2-4": 0.02, "4-8": 0.015, "8-16": 0.005, "16+": 0.002}
    for band, lim in rms_limit.items():
        assert e[band][0] < lim, (band, e[band])
    assert max(v[1] for v in e.values()) < 0.03            # smooth: no shell anywhere misses by 3 percent
    # planted: the pair side uses a split radius 30 percent larger than the mesh's
    bad = _two_body_errors(short_rs=1.3 * 1.25 / 64)
    assert bad["2-4"][0] > 0.10


def test_pair_sum_is_antisymmetric():
    rng = np.random.default_rng(3)
    pos = rng.uniform(0, 10.0, (3000, 3))
    acc = shortrange.short_range_cpu(pos, 10.0, 0.01, 0.2, 0.9, eps=0.01)
    assert np.abs(acc.sum(axis=0)).max() / np.abs(acc).sum(axis=0).max() < 1e-13


class _NoPairForce(pm.P3MSolver):
    """Planted: the dynamics drop the pair force while the energy still counts its potential."""

    def accel(self, pos, mass=None):
        return pm.PMSolver.accel(self, pos)


def _layzer_irvine(cls, n=16, box=16.0, nsteps=160):
    """a (K + W) + integral of K da is constant (Layzer-Irvine). Returns the largest drift over |a W|."""
    pos, mom, _ = ic.zeldovich(C, linear.LinearPower(C), box, n, 0.05, seed=4, order=2)
    s = cls(C, box, 2 * n, n ** 3, OPS, eps=box / n / 30)
    grid = np.geomspace(0.05, 1.0, nsteps + 1)

    def kin(m, a):
        return 0.5 * np.sum(m * m) / a ** 2
    marks = []
    ks = [(grid[0], kin(mom, grid[0]))]
    marks.append((0, grid[0] * (ks[0][1] + 0.5 * np.sum(s.potential_at(pos)) / grid[0])))

    def cb(a, p, m):
        ks.append((a, kin(m, a)))
        if len(ks) % 16 == 1:
            w = 0.5 * np.sum(s.potential_at(p)) / a
            marks.append((len(ks) - 1, a * (ks[-1][1] + w), a * w))
    s.run(pos, mom, grid, callback=cb)
    ak = np.array(ks)
    cum = np.concatenate([[0.0], np.cumsum(0.5 * (ak[1:, 1] + ak[:-1, 1]) * np.diff(ak[:, 0]))])
    e0 = marks[0][1]
    return max(abs(e + cum[i] - e0) / abs(aw) for i, e, aw in marks[1:])


def test_layzer_irvine_energy():
    assert _layzer_irvine(pm.P3MSolver) < 0.025          # measured 0.019
    assert _layzer_irvine(_NoPairForce) > 0.10


def test_cuda_pair_kernel_matches_cpu_and_repeats_bitwise():
    try:
        get_backend("torch")
        import torch
    except (RuntimeError, ImportError):
        pytest.skip("torch with CUDA is not available here")
    rng = np.random.default_rng(0)
    pos = rng.uniform(0, 20.0, (20000, 3))
    pos[:4000] = np.mod(5 + 0.3 * rng.standard_normal((4000, 3)), 20.0)    # a dense clump
    ref = shortrange.short_range_cpu(pos, 20.0, 0.01, 0.3, 1.35, eps=0.02)
    sr = shortrange.ShortRangeCuda(20.0, 1.35)
    t = torch.as_tensor(pos, device="cuda", dtype=torch.float32)
    a1, a2 = sr(t, 0.01, 0.3, 0.02), sr(t, 0.01, 0.3, 0.02)
    assert torch.equal(a1, a2)
    assert np.abs(a1.cpu().numpy() - ref).max() / np.abs(ref).max() < 1e-4

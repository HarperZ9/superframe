# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Gravity on E2 to E6: the image-deposit Poisson solve against the eigenmode Green's function built from
COMPACT's selection rules; the planted untwisted solve must fail. No claim about our universe's topology."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import topology, twisted  # noqa: E402

CASES = {"E2": (1.0, 1.2, 0.5), "E3": (1.0, 1.0, 0.4), "E4": (1.0, 1.0, 0.5), "E5": (1.0, 1.0, 0.3),
         "E6": (0.5, 0.6, 0.4)}


def _grid(name, L, h):
    return tuple(int(round(c / h / 2)) * 2 for c in topology.cover(name, L))


@pytest.mark.parametrize("name", list(CASES))
def test_poisson_on_the_twisted_torus_matches_the_eigen_expansion(name):
    L = CASES[name]
    N = _grid(name, L, 0.015)
    A = twisted.lattice(name, L)
    src = A @ np.array([0.31, 0.27, 0.12])
    pts = (A @ np.random.default_rng(2).uniform(0, 1, (40, 3)).T).T
    ana = twisted.eigen_potential(name, L, src, pts, smooth=0.06, nmax=int(max(N) * 0.45))
    num = twisted.TwistedPoisson(name, L, N, smooth=0.06).potential(src[None], pts)
    scale = np.abs(ana).max()
    assert np.abs(num - ana).max() / scale < 0.005
    bad = twisted.TwistedPoisson(name, L, N, smooth=0.06, images=False).potential(src[None], pts)
    assert np.abs(bad - ana).max() / scale > 0.5


@pytest.mark.parametrize("name", list(CASES))
def test_group_order_and_force_equivariance(name):
    """|G| is the covering index, and the force at an image is the rotated force: g(x) feels R_g a(x).
    Square meshes map onto themselves under every element, so it holds to rounding there; the hexagonal
    mesh's skewed cloud-in-cell cells are not turn-symmetric, so E4 and E5 hold to the mesh error
    (3 percent at h = 0.04, 1.5 percent or less at h = 0.02)."""
    L = CASES[name]
    G = twisted.group(name, L)
    assert len(G) == {"E2": 2, "E3": 4, "E4": 3, "E5": 6, "E6": 4}[name]
    hexagonal = name in topology.HEX
    sol = twisted.TwistedPoisson(name, L, _grid(name, L, 0.02 if hexagonal else 0.04), smooth=0.1)
    A = twisted.lattice(name, L)
    pos = (A @ np.random.default_rng(5).uniform(0, 1, (30, 3)).T).T
    x = np.array([A @ np.array([0.21, 0.63, 0.37])])
    acc = sol.accel(pos, x)
    for R, t in G[1:]:
        tol = 0.02 if hexagonal else 1e-10
        assert np.abs(sol.accel(pos, x @ R.T + t) - acc @ R.T).max() < tol * np.abs(acc).max()


def test_e3_run_equals_the_cover_run_of_all_images():
    """An E3 box is the same universe as its covering torus filled with every image. Evolving E3's particles
    with the twisted solver must reproduce a plain PM run of all the images to rounding; the planted run
    without images does not."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "study"))
    from run_twisted import invariant_delta_k
    from scipy.spatial import cKDTree
    from cosmolab import background, ic, linear, pm
    from cosmolab.backend import get_backend
    c = background.Cosmology()
    L, box, n = (32.0, 32.0, 8.0), 32.0, 16
    G = twisted.group("E3", L)
    dk, _ = invariant_delta_k(linear.LinearPower(c), box, n, 11, G)
    pos_all, mom_all, _, _ = ic.from_delta_k(c, dk, box, n, 0.05)
    sel = ic.lattice(box, n)[:, 2] < L[2]
    grid = np.linspace(0.05, 1.0, 25)
    cover, _ = pm.PMSolver(c, box, 2 * n, n ** 3, get_backend("numpy"), deconvolve=1).run(pos_all, mom_all, grid)
    tree = cKDTree(np.mod(cover, box), boxsize=box)

    def offset(images):
        sim = twisted.TwistedPM(c, "E3", L, (2 * n,) * 3, int(sel.sum()))
        if not images:
            sim.poisson = twisted.TwistedPoisson("E3", L, (2 * n,) * 3, images=False, deconvolve=1)
        p, _ = sim.run(pos_all[sel], mom_all[sel], grid)
        return tree.query(np.mod(sim.wrap(sim.poisson.images(p) if images else p), box))[0].max()
    assert offset(True) < 1e-8
    assert offset(False) > 0.1

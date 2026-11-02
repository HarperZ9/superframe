# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known-answer tests for the packing algebra. Run from the repo root:
python -m pytest -q -p no:cacheprovider packages/lattice"""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from packing import algebra as L  # noqa: E402
from packing import apollonian as A, crystal as C, penrose as PR  # noqa: E402
from packing import polygons as PG, sampling as S, spiral as SP  # noqa: E402

TOL = 1e-6


@pytest.mark.parametrize("B,expected", [
    (L.SQUARE, math.pi / 4), (L.HEX, math.pi / math.sqrt(12)), (L.SC, math.pi / 6),
    (L.FCC, math.pi / math.sqrt(18)), (L.BCC, math.pi * math.sqrt(3) / 8)])
def test_ball_densities(B, expected):
    assert abs(L.with_balls(B).density - expected) < TOL


def test_hcp_equals_fcc():
    assert abs(L.hcp().density - math.pi / math.sqrt(18)) < TOL


def test_det_one_maps_keep_density_and_inverse_undoes():
    """A det-1 map carries the motif with it (discs become ellipses), so density is unchanged."""
    lat = L.with_balls(L.HEX)
    for M in (L.shear(0.7), L.rotation(0.3), L.shear(-1.3, 1) @ L.rotation(1.1)):
        t = lat.transform(M)
        assert abs(t.density - lat.density) < TOL
        assert np.allclose(t.untransform(M).B, lat.B)
    # only rotations keep round discs at the same density; refitting discs to a sheared hex lattice
    # loses density, because the hex lattice is the unique densest disc lattice
    assert abs(L.with_balls(lat.transform(L.rotation(0.3)).B).density - lat.density) < TOL
    assert L.with_balls(lat.transform(L.shear(0.7)).B).density < lat.density - 0.1


def test_scale_changes_covolume_not_density_of_scaled_motif():
    lat = L.with_balls(L.SQUARE)
    t = lat.transform(2.5 * np.eye(2))
    assert abs(t.covolume - 6.25) < TOL and abs(t.density - lat.density) < TOL


def test_gauss_reduction_finds_shortest():
    U = np.array([[7, 3], [2, 1]])          # unimodular
    R = L.gauss_reduce(L.HEX @ U)
    assert abs(np.linalg.norm(R[:, 0]) - 1) < TOL and abs(np.linalg.norm(R[:, 1]) - 1) < TOL
    assert abs(abs(np.linalg.det(R)) - math.sqrt(3) / 2) < TOL


def test_lll_on_skewed_fcc():
    U = np.array([[1, 4, 0], [0, 1, 3], [0, 0, 1]])
    R = L.lll_reduce(L.FCC @ U)
    assert abs(min(np.linalg.norm(R, axis=0)) - 1 / math.sqrt(2)) < TOL
    assert abs(L.Lattice(L.FCC @ U).packing_radius() - 1 / (2 * math.sqrt(2))) < TOL


def test_dual():
    for B in (L.HEX, L.FCC, L.BCC):
        D = L.Lattice(B).dual().B
        assert np.allclose(B.T @ D, np.eye(len(B)))
    # the dual of FCC is BCC up to scale
    Dn = L.Lattice(L.FCC).dual()
    assert abs(L.with_balls(Dn.B).density - math.pi * math.sqrt(3) / 8) < TOL


@pytest.mark.parametrize("name", ["square", "triangle", "hexagon", "rhombus72"])
def test_tilings(name):
    B, tiles = PG.tilings()[name]
    assert abs(sum(PG.area(T) for T in tiles) / abs(np.linalg.det(B)) - 1) < TOL
    pts = np.random.default_rng(1).uniform(-1.3, 1.3, (3000, 2))
    assert (PG.coverage_counts(B, tiles, pts) == 1).all()


@pytest.mark.parametrize("n,expected", [(3, 2 / 3), (4, 1.0), (6, 1.0),
                                        (8, (4 + 4 * math.sqrt(2)) / (5 + 4 * math.sqrt(2)))])
def test_densest_lattice_polygons(n, expected):
    assert abs(PG.densest_lattice_packing(PG.regular(n))[0] - expected) < TOL


def test_polygon_packing_returns_admissible_lattice():
    K = PG.regular(5)
    d, B = PG.densest_lattice_packing(K)
    pts = np.random.default_rng(2).uniform(-2, 2, (20000, 2))
    assert PG.coverage_counts(B, [K], pts, reach=4).max() == 1   # no overlaps
    assert 0.8 < d < (5 - math.sqrt(5)) / 3


def test_disc_limit():
    d, _ = PG.densest_lattice_packing(PG.regular(360))
    assert abs(d - math.pi / math.sqrt(12)) < 1e-4


def test_vogel_parastichies_are_fibonacci():
    fib = set(SP.fibonacci(1000))
    for band in SP.parastichies(SP.vogel(2000)):
        assert band["top"][0] in fib and band["top"][1] in fib
    assert abs(SP.GOLDEN_DEG - 137.50776405) < 1e-6


def test_penrose_ratio():
    assert abs(PR.count_ratio(30)[-1][3] - PR.PHI) < TOL
    full, _ = PR.rhombi(PR.tiling(8))
    assert abs(len(full[1]) / len(full[0]) - PR.PHI) < 0.01
    t = PR.tiling(4)
    assert all(abs(abs(B - A) - abs(C - A)) < 1e-9 for _, A, B, C in t)   # isosceles halves


def test_apollonian():
    c = A.gasket(3000)
    assert all(abs(k - round(k)) < 1e-6 for k, _ in c)
    assert len({(round(k), round(z.real, 7), round(z.imag, 7)) for k, z in c}) == len(c)
    assert abs(A.descartes_residual(A.root())) < TOL
    assert 0.99 < A.covered_fraction(c) < 1
    assert abs(A.dimension_fit(c, 50) - 1.30568) < 0.01


def test_fcc_hcp_shells():
    r = [1, math.sqrt(2), math.sqrt(8 / 3), math.sqrt(3)]
    for st, want in (("ABC", [12, 6, 0, 24]), ("AB", [12, 6, 2, 18])):
        P = C.close_packed_layers(st, 4, 3)
        c = P[np.argmin(np.linalg.norm(P - P.mean(0), axis=1))]
        assert C.shell_counts(P, c, r) == want


def test_32_crystal_classes():
    assert len(C.crystal_classes()) == 32


def test_equal_counts():
    rng = np.random.default_rng(0)
    for n in ("spiral", "hex", "square", "penrose", "random", "jitter_hex"):
        P = S.disc_set(n, 400, rng)
        assert P.shape == (400, 2) and np.linalg.norm(P, axis=1).max() < 1
    for n in ("fibonacci", "geodesic", "latlong", "random"):
        X = S.sphere_set(n, 642, rng)
        assert X.shape == (642, 3) and np.allclose(np.linalg.norm(X, axis=1), 1)


def test_motif_distance_with_far_offsets():
    """Regression: offsets many cells apart must fold back before the translate search."""
    B = np.array([[1.0, 0.3], [0.2, 1.1]])
    a, b = np.array([0.1, 0.2]), np.array([0.4, 0.5]) + B @ np.array([7, -5])
    lat = L.Lattice(B)
    d = L.min_motif_distance(lat, [a, b])
    assert abs(d - min(L.min_motif_distance(lat, [a]), np.linalg.norm(np.array([0.3, 0.3])))) < TOL

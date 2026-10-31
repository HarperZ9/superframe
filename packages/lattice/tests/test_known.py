# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known-answer tests. Run from the repo root: python -m pytest -q -p no:cacheprovider packages/lattice"""
import math
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from lattice import bandlimit as B, cells as C, gabor as Gb, imagerep as R, lattices as L  # noqa: E402
from lattice import sphere as Sp, stats as St, tonnetz as T  # noqa: E402


class Packing(unittest.TestCase):
    def test_packing_densities(self):
        known = {"square": math.pi / 4, "hex": math.pi / (2 * math.sqrt(3)), "cubic": math.pi / 6,
                 "bcc": math.pi * math.sqrt(3) / 8, "fcc": math.pi / (3 * math.sqrt(2))}
        for nm, v in known.items():
            self.assertAlmostEqual(L.packing_density(L.generator(nm)), v, places=10)

    def test_sampling_ratios(self):
        # Petersen and Middleton 1962: hex needs sqrt(3)/2 of the square count (13.4% fewer)
        self.assertAlmostEqual(L.nyquist_density("hex", 1) / L.nyquist_density("square", 1), math.sqrt(3) / 2, places=10)
        self.assertAlmostEqual(L.nyquist_density("bcc", 1) / L.nyquist_density("cubic", 1), 1 / math.sqrt(2), places=10)

    def test_strict_density_matches_packing(self):
        for nm in ("square", "hex", "bcc"):
            self.assertAlmostEqual(B.strict_density(L.generator(nm)) / L.nyquist_density(nm, 1), 1.0, places=3)

    def test_exact_count(self):
        for nm, rot in (("square", 0), ("hex", 0), ("hex", 15)):
            P, _ = L.points_with_count(nm, 200, 150, 777, rot)
            self.assertEqual(len(P), 777)


class Fold(unittest.TestCase):
    def test_no_alias_inside_cell(self):
        rng = np.random.default_rng(0)
        S = B.setup(L.generator("hex", 3.6), 30, "disc", 1.0)
        self.assertEqual(B.fold_error(S, B.draw(S, rng)), 0.0)
        S = B.setup(L.generator("square", 3.6), 30, "disc", 1.0)
        self.assertGreater(B.fold_error(S, B.draw(S, rng)), 0.0)

    def test_ls_equals_fold_on_regular_lattice(self):
        rng = np.random.default_rng(1)
        S = B.setup(L.generator("hex", 3.0), 10, "gauss", 0.5)
        c = B.draw(S, rng)
        self.assertAlmostEqual(B.ls_error(S, c, B.sample_points(S))[0], B.fold_error(S, c), places=9)

    def test_continuum_matches_grid(self):
        rng = np.random.default_rng(2)
        G = L.generator("square", 20.0)
        S = B.setup(G, 60, "gauss", 1.0)
        e, se = B.continuum_error(G, "gauss", 1.0, 400000, rng)
        self.assertLess(abs(e - B.expected_error(S)), 5 * se + 0.002)


class Gabor(unittest.TestCase):
    def test_walnut_equals_dense(self):
        for kind in ("rect", "hex"):
            G = Gb.atoms(96, 4.0, Gb.lattice(96, 8, 12, kind))
            self.assertLess(np.abs(G @ G.conj().T - Gb.frame_operator(96, 4.0, 8, 12, kind)).max(), 1e-12)

    def test_painless_diagonal(self):
        # window much shorter than L/b: S is diagonal, (L/b) sum_n |g(t - n a)|^2 (Daubechies et al. 1986)
        L_, a, b = 240, 4, 12
        S = Gb.frame_operator(L_, 1.0, a, b, "rect")
        g = Gb.window(L_, 1.0)
        diag = (L_ / b) * sum(np.roll(g, n * a) ** 2 for n in range(L_ // a))
        self.assertLess(np.abs(S - np.diag(diag)).max(), 1e-12)


class Images(unittest.TestCase):
    def test_partition_of_unity_and_linear_reproduction(self):
        H = W = 40
        yy, xx = np.mgrid[0:H, 0:W]
        ramp = (0.2 + 0.01 * xx + 0.005 * yy)[..., None]
        P, d = L.points_with_count("hex", W, H, 60)
        h = L.spacing(L.generator("hex", d))
        A0 = R.design(P, (H, W), "gauss", h, 0.7, "const")
        self.assertLess(np.abs(np.asarray(A0.sum(1)).ravel() - 1).max(), 1e-9)
        A1 = R.design(P, (H, W), "hex", h, 1.2, "lin", beta=6.0)
        rec = R.fit(ramp, A1, np.ones((H, W), bool), ridge=1e-12)
        self.assertLess(np.abs(rec - ramp).max(), 1e-6)

    def test_ssim_identity(self):
        x = np.random.default_rng(0).random((32, 32))
        self.assertAlmostEqual(R.ssim(x, x), 1.0, places=10)


class Other(unittest.TestCase):
    def test_geodesic_count_and_sh_orthonormal(self):
        self.assertEqual(len(Sp.geodesic(5)), 252)
        Y = Sp.real_basis(Sp.fibonacci(20000), 6)
        self.assertLess(np.abs(Y.T @ Y * 4 * math.pi / 20000 - np.eye(49)).max(), 2e-3)

    def test_cells_reproduce_linear(self):
        rng = np.random.default_rng(0)
        X = rng.random((5000, 3))
        y = 1 + X @ np.array([0.3, -0.2, 0.5])
        sites = C.lattice_sites_periodic(np.asarray(L.GENERATORS["bcc"], float) / 3, 1.0)
        yh = C.fit_cells(sites, X, y, X, "lin")
        self.assertLess(np.abs(yh - y).max(), 1e-6)

    def test_tonnetz(self):
        self.assertEqual([T.tonnetz_distance(k) for k in (0, 7, 4, 3, 2, 6)], [0, 1, 1, 1, 2, 2])

    def test_bh(self):
        out = St.bh({"a": 0.01, "b": 0.04, "c": 0.03}, 0.05)
        self.assertAlmostEqual(out["a"]["p_bh"], 0.03)
        self.assertAlmostEqual(out["b"]["p_bh"], 0.04)
        self.assertTrue(all(v["reject"] for v in out.values()))


if __name__ == "__main__":
    unittest.main(verbosity=1)

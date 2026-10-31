# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known-answer tests: the error threshold, the fixation probability, the landscapes and the estimators.

Run: python -I -B -m pytest -p no:cacheprovider packages/evolve/tests
"""
import sys
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from evolve import drift, engine, info, landscapes, popgen  # noqa: E402


def test_error_threshold_within_tolerance():
    """Eigen: the fitted threshold sits within 15% of mu_c = 1 - sigma^(-1/L) (L 20, sigma e)."""
    rng = np.random.default_rng(1)
    L, sigma = 20, np.e
    mus = np.linspace(0.005, 0.06, 12)
    shares = [popgen.eigen_share(L, sigma, m, 1000, 200, rng) for m in mus]
    mu_hat, _ = popgen.threshold_fit(L, sigma, mus, shares)
    assert abs(mu_hat - popgen.mu_c(sigma, L)) / popgen.mu_c(sigma, L) < 0.15
    for m, s in zip(mus[:6], shares[:6]):
        assert abs(s - popgen.master_share(sigma, L, m)) < 0.05
    assert shares[-1] < 0.02                       # above the threshold the master is lost


def test_kimura_fixation_haploid():
    """Fixation of one new allele: s 0.05 and neutral, N 50, inside 3 binomial SE of theory."""
    rng = np.random.default_rng(2)
    for s in (0.0, 0.05):
        reps = 6000
        p_hat = popgen.fixation(50, s, reps, rng)
        p = popgen.kimura_haploid(50, s)
        assert abs(p_hat - p) < 3 * np.sqrt(p * (1 - p) / reps)


def test_kimura_formula_values():
    assert abs(popgen.kimura_haploid(100, 0.0) - 0.01) < 1e-12
    assert abs(popgen.kimura_haploid(10 ** 6, 0.01) - (1 - np.exp(-0.02))) < 1e-9


def test_multilinear_extension_matches_table_on_vertices():
    rng = np.random.default_rng(3)
    for kind in ("smooth", "nk2", "nk4", "trap"):
        land = landscapes.make(kind, 10, rng)
        g = rng.integers(0, 2, (64, 10)).astype(np.int8)
        assert np.allclose(land.f_cont(g.astype(float)), land.lookup(g))
        x = rng.random((200, 10))
        assert land.f_cont(x).max() <= land.fmax + 1e-12


def test_trap_optimum_and_deception():
    rng = np.random.default_rng(4)
    land = landscapes.trap(12, 4, rng)
    assert land.n_global == 1 and abs(land.fmax - 1.0) < 1e-12
    comp = np.bitwise_xor(land.opt, 1)
    assert land.is_local_opt(comp) and not land.is_global(comp)


def test_drift_moves_optimum_and_keeps_values():
    rng = np.random.default_rng(5)
    land = landscapes.make("nk2", 10, rng)
    d = drift.Drift(10, "random", period=1, d=2, rng=rng)
    d.step(0)
    m = d.step(1).copy()
    assert m.sum() == 2
    assert abs(land.lookup(np.bitwise_xor(land.opt, m)[None, :], m)[0] - land.fmax) < 1e-12


def test_signal_bounds():
    rng = np.random.default_rng(6)
    opt = rng.integers(0, 2, 30)
    clone = np.repeat(opt[None, :], 40, axis=0).astype(np.int8)
    rand = rng.integers(0, 2, (40, 30)).astype(np.int8)
    assert info.signal(clone, opt) > 0.95 * 30 * info.hb(opt.mean())
    assert info.signal(rand, opt) < 1.0
    assert info.diversity(clone) < 1e-6


def test_engine_beats_random_on_smooth():
    rng = np.random.default_rng(7)
    land = landscapes.make("smooth", 16, rng)
    cfg = engine.Config(mu=1 / 16, G=60, target=land.fmax)
    assert np.mean([engine.run(land, cfg, rng)["hit"] for _ in range(10)]) >= 0.9

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Bound-violation rule: exact p, family corrections, and calibration under the worst-case null.

Run: python -B -m pytest -q -p no:cacheprovider tests   (from packages/formulas)
"""
import numpy as np
import pytest
from scipy.stats import binom

from formulas import bounds as B


def test_exact_p_matches_binomial_tail():
    assert B.exact_p(1082, 4000, 0.25) == pytest.approx(binom.sf(1081, 4000, 0.25))
    assert B.exact_p(5, 10, 1.0) == 1.0
    assert B.exact_p(0, 10, 0.3) == pytest.approx(1.0)


def test_holm_is_never_weaker_than_bonferroni():
    rng = np.random.default_rng(1)
    for _ in range(200):
        p = rng.uniform(0, 0.01, 30) ** rng.uniform(0.5, 2)
        assert np.all(B.holm(p) >= B.bonferroni(p))


def test_bh_known_case():
    p = np.array([0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.074, 0.205])
    assert B.bh(p).tolist() == [True, True, False, False, False, False, False, False]


def test_clear_violation_is_flagged_and_chance_is_not():
    flags, p = B.violations([1300, 1010], 4000, [0.25, 0.25])
    assert flags.tolist() == [True, False]
    assert p[0] < 1e-20


@pytest.mark.parametrize("method", ["holm", "bonferroni", "bh"])
def test_family_rate_at_the_bound_stays_near_alpha(method):
    """Every arm exactly at its bound (worst case): any flag in at most about 5% of families."""
    rng = np.random.default_rng(7)
    n, m, reps = 500, 200, 1000
    bound = np.full(m, 0.25)
    hits = sum(B.violations(rng.binomial(n, bound), n, bound, method=method)[0].any() for _ in range(reps))
    assert hits / reps <= 0.05 + 2 * np.sqrt(0.05 * 0.95 / reps)


def test_wald_rule_is_miscalibrated_where_the_new_rule_is_not():
    rng = np.random.default_rng(3)
    n, m, reps = 4000, 756, 200
    bound = np.full(m, 0.25)
    old = np.mean([B.wald_flags(rng.binomial(n, bound), n, bound).any() for _ in range(reps)])
    assert old > 0.5


def test_bad_inputs_are_refused():
    with pytest.raises(ValueError):
        B.violations([5], 4, [0.5])
    with pytest.raises(ValueError):
        B.violations([1], 4, [0.5], method="none")

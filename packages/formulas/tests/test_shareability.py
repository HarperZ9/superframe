# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Shareability estimator: chance for unrelated lenses, near 1 for a shared fine lens, ordered by overlap,
and equal to the round-1 study code on the same sample.

Run: python -B -m pytest -q -p no:cacheprovider tests   (from packages/formulas)
"""
import os
import sys
from pathlib import Path

import numpy as np
import pytest

from formulas import shareability as SH


def _cells(x, q):
    return np.minimum((x * q).astype(int), q - 1)


def test_unrelated_lenses_sit_at_chance():
    rng = np.random.default_rng(1)
    X = rng.uniform(size=(400, 2))
    acc = SH.shareability(_cells(X[:, :1], 4), _cells(X[:, 1:], 4), K=4, rng=rng)
    assert abs(acc - 0.25) < 0.04


def test_shared_fine_lens_is_near_one():
    rng = np.random.default_rng(2)
    X = rng.uniform(size=(400, 2))
    c = _cells(X, 8)
    assert SH.shareability(c, c, K=4, rng=rng) > 0.9


def test_more_overlap_more_shareable():
    rng = np.random.default_rng(3)
    X = rng.uniform(size=(400, 1))
    a = _cells(X, 8)
    coarse = SH.shareability(a, _cells(X, 2), K=4, rng=np.random.default_rng(4))
    fine = SH.shareability(a, _cells(X, 6), K=4, rng=np.random.default_rng(4))
    assert fine > coarse + 0.1


def test_too_few_objects_refused():
    with pytest.raises(ValueError):
        SH.shareability(np.zeros((5, 1)), np.zeros((5, 1)), K=4)


STUDY = Path(os.environ.get("FORMULAS_STUDY_DIR", "/nonexistent"))  # optional: the formula-round1 study folder


@pytest.mark.skipif(not (STUDY / "fr_c1.py").exists(), reason="study folder not present")
def test_matches_round1_study_code():
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(STUDY))
    import fr_c1
    rng = np.random.default_rng(5)
    X = rng.uniform(size=(400, 2))
    pa, pb = _cells(X, 6), np.column_stack([_cells(X[:, 0], 3), _cells(X[:, 1] + 0.1 * rng.normal(size=400) % 1, 4)])
    mine = SH.shareability(pa, pb, 4, np.random.default_rng(9))
    theirs = fr_c1.xfit_accuracy(pa, pb, 4, np.random.default_rng(9), "fact", 1.0, 0.02)
    assert mine == pytest.approx(theirs)

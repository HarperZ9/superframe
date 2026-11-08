# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Round nine's words: closure on the interval against on the mean only, the base scatter widening the
interval, and the convergence line on the mean and on the upper bound."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "study"))
import score_round9 as s9  # noqa: E402


def test_closure_words_use_the_lower_bound():
    assert s9.closure_words(0.998, 0.991) == "closes on the interval"
    assert s9.closure_words(0.998, 0.978) == "closes on the mean only"
    assert s9.closure_words(0.985, 0.970) == "partly closes"
    assert s9.closure_words(0.975, 0.960) == "does not close"


def test_base_scatter_widens_the_interval():
    cell = {"mean": 2.0, "ci95": [1.5, 2.5]}
    tight = s9.closure2({"mean": 0.976, "half": 0.0}, cell)
    wide = s9.closure2({"mean": 0.976, "half": 0.0126}, cell)
    assert tight["value"] == pytest.approx(0.976 * 1.02)
    assert tight["with_base"]["ci95"][0] == pytest.approx(tight["factor_only"]["ci95"][0], abs=1e-6)
    assert wide["with_base"]["ci95"][0] < wide["factor_only"]["ci95"][0] - 0.008
    assert tight["factor_only"]["words"] == "closes on the interval"
    assert wide["with_base"]["words"] == "closes on the mean only"


def test_convergence_line():
    assert s9.convergence({"mean": 0.9, "ci95": [0.5, 1.3]})["words"] == "not converged"
    assert s9.convergence({"mean": 0.3, "ci95": [0.1, 0.6]})["words"] == "converged on the mean"
    assert s9.convergence({"mean": 0.3, "ci95": [0.1, 0.45]})["words"] == "converged on the interval"
    assert s9.tail(0.92) == pytest.approx(0.92)  # r = 0.5: the tail equals the step
    assert s9.tail(2.0) is None

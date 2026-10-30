# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two-lines guard: the vendored base is verbatim, a fall to a floor is not a U, a real U still is.

Run: python -B -m pytest -q -p no:cacheprovider tests   (from packages/formulas)
"""
import hashlib
import os
from pathlib import Path

import numpy as np

from formulas import twolines_guard as G
from formulas.units import twolines as TL

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA = "9875b29f5108f6209ba0d8cf2acd8805cf7d64b4b2f09a4b10befd5b0f1c61e5"
SOURCE = Path(os.environ.get("FORMULAS_GOLDILOCKS_DIR", "/nonexistent")) / "twolines.py"  # optional study copy


def test_vendored_base_is_verbatim():
    assert hashlib.sha256((ROOT / "formulas/units/twolines.py").read_bytes()).hexdigest() == BASE_SHA
    if SOURCE.exists():
        assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == BASE_SHA


def _floor(rng, n=300):
    x = rng.uniform(0, 1, n)
    c = rng.uniform(0.3, 0.6)
    return x, np.where(x < c, 4 * (c - x) + rng.normal(0, 0.5, n), 0.0)


def test_fall_to_exact_floor_is_not_a_u():
    rng = np.random.default_rng(11)
    calls = [G.two_lines_guarded(*_floor(rng)).get("u", False) for _ in range(60)]
    assert np.mean(calls) <= 0.05


def test_planted_inverted_u_keeps_its_power():
    rng = np.random.default_rng(12)
    old, new = [], []
    for _ in range(60):
        x = rng.uniform(0, 1, 300)
        y = -6 * (x - 0.5) ** 2 + rng.normal(0, 1, 300)
        old.append(TL.two_lines(x, y).get("u", False))
        new.append(G.two_lines_guarded(x, y).get("u", False))
    assert np.mean(new) >= np.mean(old) - 0.02


def test_guard_changes_nothing_when_both_sides_vary():
    rng = np.random.default_rng(13)
    x = rng.uniform(0, 1, 300)
    y = 2 * x + rng.normal(0, 1, 300)
    a, b = TL.two_lines(x, y), G.two_lines_guarded(x, y)
    assert a["u"] == b["u"] and b["guard"]["guarded_sides"] == []

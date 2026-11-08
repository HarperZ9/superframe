# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The round-eight same-phase scorer: a planted 1 percent raise reads back as 1 percent, arms with different
k bins are refused, and the closure words follow the preregistered cut points."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "study"))
import score_massres as sm  # noqa: E402


def _run(path, k, pk, emu=None):
    arrays = {}
    for z in ("0", "1"):
        arrays.update({f"k_z{z}": k, f"pk_z{z}": pk, f"pk_il_z{z}": pk, f"nmodes_z{z}": np.ones_like(k) * 10,
                       f"emu_z{z}": pk if emu is None else emu})
    np.savez(path, **arrays)
    return str(path)


def test_planted_raise_reads_back(tmp_path):
    k = np.geomspace(0.05, 5, 60)
    base = 1e3 * k ** -1.5
    lo = [_run(tmp_path / f"lo_seed{s}.npz", k, base) for s in (1, 2, 3)]
    hi = [_run(tmp_path / f"hi_seed{s}.npz", k, base * (1 + 0.01 * s)) for s in (1, 2, 3)]
    r = sm.score_pair(hi, lo)
    cell = r["interlaced"]["z0"]["3.0-5.0"]
    assert cell["per_seed_percent"] == pytest.approx([1.0, 2.0, 3.0])
    assert cell["mean"] == pytest.approx(2.0)
    assert cell["ci95"][0] < 2.0 < cell["ci95"][1]
    assert cell["ci95"][1] - 2.0 == pytest.approx(4.303 * 1.0 / np.sqrt(3), rel=1e-6)


def test_mismatched_bins_refused(tmp_path):
    k = np.geomspace(0.05, 5, 60)
    lo = [_run(tmp_path / "lo_seed1.npz", k, k ** -1.5)]
    hi = [_run(tmp_path / "hi_seed1.npz", k * 2, k ** -1.5)]
    with pytest.raises(ValueError):
        sm.score_pair(hi, lo)


def test_closure_words():
    assert sm.closure(0.976, {"mean": 1.5})["verdict"] == "closes"
    assert sm.closure(0.976, {"mean": 0.6})["verdict"] == "partly closes"
    assert sm.closure(0.976, {"mean": 0.2})["verdict"] == "does not close"

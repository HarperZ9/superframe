# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Piano inharmonicity from measured data: the B table from a Steinway model B (packages/measured
piano_b_iowa.json) and the stiff string's B read back from rendered notes within 10 percent of it."""
import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import dispersion as D  # noqa: E402
from daw import waveguide as W  # noqa: E402
from measured import load  # noqa: E402

FS = 48000


def test_table_is_measured_with_provenance():
    t = load("piano_b_iowa")
    rows = [r for r in t["rows"] if r["quality"] == "good"]
    assert len(rows) >= 45                          # 47 of 86 notes pass the fit checks
    assert all(r["sha256"] == t["provenance"]["files"][r["file"]] for r in t["rows"])
    assert all(r["B"] > 0 and r["rms_cents"] <= 3.0 and r["partials"] >= 3 for r in rows)
    for r in rows:                                   # the table is what piano_b returns on measured notes
        assert D.piano_b(r["midi"]) == pytest.approx(r["B"], rel=1e-12)


def test_register_shape_and_the_textbook_curve_misses_it():
    assert D.piano_b(23) > D.piano_b(43)             # wound bass strings: B falls from B0 into the low tenor
    assert D.piano_b(48) < D.piano_b(72) < D.piano_b(96)
    rows = [r for r in load("piano_b_iowa")["rows"] if r["quality"] == "good"]
    off = sum(abs(D.piano_b_textbook(r["midi"]) / r["B"] - 1) > 0.10 for r in rows)
    assert off > len(rows) // 2                       # planted: the old curve is not the measured piano


@pytest.mark.parametrize("midi", [23, 36, 48, 60, 72, 84, 96, 108])
def test_stiff_string_meets_the_measured_b_within_10_percent(midi):
    f0, b = 440 * 2 ** ((midi - 69) / 12), D.piano_b(midi)
    count = 8
    while count > 3 and count * f0 * math.sqrt(1 + b * count * count) > 0.4 * FS:
        count -= 1
    y = D.stiff_string(f0, 3.5, FS, W.hammer(FS, 1e-3), 6.0, b)
    got, _ = D.fit_b(y, FS, f0, count)
    assert abs(got / b - 1) < 0.10

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Round 6: the van der Waals shells' adiabat, the batch resonator against the single one, structural damping, and
the loss factors read the same way the DAW reads them (so the two lanes cannot drift apart)."""
import sys
from pathlib import Path

import numpy as np
import pytest

PKGS = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PKGS / "wavelab"))
sys.path.insert(0, str(PKGS / "daw"))
from wavelab import conduction as C, consts, resonator as R  # noqa: E402


def test_vdw_shells_follow_their_adiabat():
    b = C.ConductingBubble(4.5e-6, n=10, conduct=False, core=1 / 8.86)
    s = b.run(1.2 * 101325, 26.5e3, cycles=1)
    inv = s.y[2:] * ((s.y[0] ** 3 - b.h ** 3) ** (2 / 3))[None, :]
    assert np.max(np.abs(inv / inv[:, :1] - 1)) < 1e-6
    assert b.volume_check(s) < 1e-8


def test_batch_runner_matches_single_runner():
    w = R.pattern("second", size=-0.15)
    g = 0.01 * np.arange(1, 17) ** 2
    batch = R.batch_measures([1e-4, 3e-3], w, g, periods=60)
    for F, b in zip((1e-4, 3e-3), batch):
        one = R.measures(F, w=w, g=g, periods=60)
        assert b["A1"] == pytest.approx(one["A1"], rel=1e-10) and b["phase1"] == pytest.approx(one["phase1"], abs=1e-8)


def test_structural_damping_and_loss_factors_match_the_daw():
    w = R.pattern("harmonic")
    assert np.allclose(R.structural_damping(2e-4, w), 1e-4 * w)
    from daw import materials as D
    for name in ("aluminium", "steel_mild", "brass", "oak"):
        assert consts.loss_factor(name)[0] == D.material(name).eta
    assert consts.loss_factor("aluminium")[1] == "measured"

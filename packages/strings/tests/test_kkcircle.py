# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for the one-circle sandbox: Behiel's radius and first rung, the mass and charge ladders, seam
invariance of F, and the closed string's w = 0 sector as the Kaluza-Klein ladder."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stringlab import kkcircle as kk  # noqa: E402


def test_radius_and_first_rung_match_behiel_within_one_percent():
    assert kk.radius_from_charge() == pytest.approx(23.4, rel=0.01)
    assert kk.first_rung_gev() == pytest.approx(5.2e17, rel=0.01)
    assert 1 / kk.ALPHA == pytest.approx(137.036, rel=1e-6)


def test_mass_ladder_converges_to_n_over_R_with_double_rungs():
    v, m = kk.mass_ladder(512, R=2.0)
    assert np.abs(v[1:] - np.arange(1, 6) / 2.0).max() < 5e-4
    assert m == [1, 2, 2, 2, 2, 2]


def test_charge_is_proportional_to_n_and_signed():
    c = kk.charge_ladder(R=1.3)
    assert all(abs(c[n] - n) < 1e-9 for n in c)


def test_seam_change_leaves_F_alone_but_a_non_gradient_change_does_not():
    rng = np.random.default_rng(1)
    B = rng.normal(size=(2, 16, 16))
    _, F, Fp = kk.seam_change(B, rng.normal(size=(16, 16)), 0.1)
    assert np.abs(F - Fp).max() < 1e-10
    _, F2, Fbad = kk.seam_change(B + np.stack([np.zeros((16, 16)), rng.normal(size=(16, 16))]), np.zeros((16, 16)), 0.1)
    assert np.abs(F2 - F).max() > 1.0


@pytest.mark.parametrize("R", [0.7, 2.3])
def test_string_w0_sector_is_the_kk_ladder(R):
    worst, count = kk.string_kk_match(R)
    assert worst < 1e-12 and count >= 3

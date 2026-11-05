# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers: the 4D index theorem for constant fluxes, and the overlap chiral determinant's basic properties."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from latticechiral import chiral as ch, overlap_nn as nn, u1, u1_4d  # noqa: E402


@pytest.mark.parametrize("q", [(1, 1), (1, -1), (2, 1), (0, 2)])
def test_4d_index_equals_flux_product(q):
    th = u1_4d.flux_links(4, *q)
    assert round(u1_4d.topological_charge(th)) == q[0] * q[1]
    index, gap = u1_4d.overlap_index(th)
    assert index == q[0] * q[1] and gap > 0.1


def test_overlap_determinant_is_one_at_zero_field_and_vectorlike_is_nearly_real():
    th = np.zeros((2, 8, 8))
    ph, lm = nn.chiral_det(th, 3, "L")
    assert abs(ph) < 1e-12 and abs(lm) < 1e-12
    rng = np.random.default_rng(3)
    t2, _ = u1.metropolis_admissible(4, 4.0, rng, 10, 1.0)
    A1, A2 = ch.interpolate(t2, 32, coulomb=True)
    fl = nn.fine_links(A1, A2, 4, 2)
    assert abs(nn.phase(fl, 2, "L") + nn.phase(fl, 2, "R")) < 0.005   # L x R of equal charge is nearly real


def test_fine_links_reproduce_a_constant_field_exactly():
    M, L, s = 48, 4, 3
    A1, A2 = np.full((M, M), 0.3), np.full((M, M), -0.2)
    th = nn.fine_links(A1, A2, L, s)
    assert np.allclose(th[0], 0.3 / s) and np.allclose(th[1], -0.2 / s)

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Eigenmode spectra of E1 to E6 (unequal sides, twisted gluings) against COMPACT's analytic modes.

A capability test of the topology machinery; nothing here bears on the topology of our universe."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import topology as T  # noqa: E402

# (sides, grid of the covering torus); grids divisible by the turn order along z, even for E6
CASES = {"E1": ((1.0, 1.3, 0.7), (10, 12, 8)), "E2": ((1.0, 1.3, 0.7), (10, 12, 12)),
         "E3": ((1.0, 1.0, 0.6), (10, 10, 16)), "E4": ((1.0, 1.0, 0.5), (11, 11, 12)),
         "E5": ((1.0, 1.0, 0.4), (11, 11, 18)), "E6": ((1.0, 1.3, 0.8), (10, 12, 8))}


@pytest.mark.parametrize("name", T.MANIFOLDS)
def test_numeric_spectrum_equals_analytic_modes(name):
    L, N = CASES[name]
    num, ana = T.compare((name, L), (name, L), N)
    assert len(num) >= 28                       # 28 to 137 eigenvalues below the grid-edge cut
    assert T.matches(num, ana)


@pytest.mark.parametrize("numeric, analytic", [
    (("E2", (1.0, 1.3, 0.7)), ("E1", (1.0, 1.3, 1.4))),      # half-turn space read as its covering torus
    (("E3", (1.0, 1.0, 0.6)), ("E2", (1.0, 1.0, 1.2))),      # quarter turn read as half turn
    (("E4", (1.0, 1.0, 0.8)), ("E5", (1.0, 1.0, 0.4))),      # third turn read as sixth turn
    (("E6", (1.0, 1.3, 0.8)), ("E1", (2.0, 2.6, 1.6))),      # Hantzsche-Wendt read as its covering torus
])
def test_planted_wrong_identification_fails(numeric, analytic):
    N = {"E2": (10, 12, 12), "E3": (10, 10, 16), "E4": (11, 11, 12), "E6": (10, 12, 8)}[numeric[0]]
    num, ana = T.compare(numeric, analytic, N)
    assert not T.matches(num, ana)


def test_e6_axis_modes_count_once():
    """COMPACT eq. 4.62 as printed lists n1 in 2Z, n1 != 0 for the axis set N_1A (and likewise N_1B,
    N_1C). The eigenfunctions for n and -n are proportional (cos(2 pi x / Lx) survives the half turns,
    sin does not), so the grid spectrum carries one mode per pair: 38 eigenvalues below the cut here, where
    the printed sets give 42. The collaboration's CMBtopology code (topology/src/E6.py) loops over positive
    even n only, which agrees with the grid."""
    L, N = CASES["E6"]
    num, ana = T.compare(("E6", L), ("E6", L), N, e6_axis_modes="as printed")
    assert (len(num), len(ana)) == (38, 42)


def test_spectrum_converges_to_continuum():
    """The same modes through |k|^2 instead of the stencil. On E6 the lowest ten miss |k|^2 by at most
    10.9 percent on a (10, 12, 8) grid and 3.2 percent on (20, 24, 16): second order in the spacing."""
    L = (1.0, 1.3, 0.8)
    k2 = np.sort(T.k2_continuum("E6", T.analytic_modes("E6", 4), L))[1:10]
    err = [np.max(np.abs(T.numeric_spectrum("E6", L, N)[1:10] - k2) / k2) for N in ((10, 12, 8), (20, 24, 16))]
    assert err[1] < 0.04 and err[0] / err[1] > 3

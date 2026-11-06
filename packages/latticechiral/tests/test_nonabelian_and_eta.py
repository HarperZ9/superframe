# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers: SU(2) generators and Dynkin indices, the anomaly ratio triplet / doublet = 4, and the adiabatic phase
reducing to the Wigner-Brillouin phase on a one-step path."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from latticechiral import chiral as ch, nonabelian as na, overlap_nn as nn  # noqa: E402


@pytest.mark.parametrize("j", [0.5, 1.0, 1.5])
def test_generators_close_and_dynkin(j):
    g = na.generators(j)
    assert np.abs(g[0] @ g[1] - g[1] @ g[0] - 1j * g[2]).max() < 1e-12
    assert np.trace(g[0] @ g[0]).real == pytest.approx(na.dynkin(j))


def test_su2_anomaly_scales_with_dynkin_index():
    rng = np.random.default_rng(1)
    L, M = 6, 48
    A = na.smooth_su2(M, L, rng, 0.25, modes=1)
    x = np.arange(M) * L / M
    X1, X2 = np.meshgrid(x, x, indexing="ij")
    chi = np.stack([np.cos(2 * math.pi * X1 / L), np.sin(2 * math.pi * X2 / L), np.cos(2 * math.pi * (X1 + X2) / L)])
    T = ch.Torus(L, 6)
    A2 = na.gauge_shift(A, chi, L, 0.01)
    d = {j: na.logdet(T, A2, j, "L").imag - na.logdet(T, A, j, "L").imag for j in (0.5, 1.0)}
    assert d[1.0] / d[0.5] == pytest.approx(4.0, rel=0.02)


def test_one_step_adiabatic_path_equals_wigner_brillouin():
    th = np.zeros((2, 8, 8))
    th[0] += 0.05 * np.sin(2 * math.pi * np.arange(8) / 8)[None, :]
    ph, _ = nn.adiabatic_phase([np.zeros_like(th), th], 2, "L")
    assert ph == pytest.approx(nn.phase(th, 2, "L"), abs=1e-12)

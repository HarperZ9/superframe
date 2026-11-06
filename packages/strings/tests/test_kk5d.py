# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers: the KK tower n / R with double rungs; the Wilson-line shift; spectrum invariance under theta ->
theta + 2 pi only for integer charge; the KK sum equals the image sum; the lattice Poisson solution approaches it."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stringlab import kk5d as k  # noqa: E402


def test_tower_and_wilson_line():
    R = 1.3
    assert np.allclose(k.tower_fd(400, R)[:7], k.tower_exact(R)[:7], atol=1e-3)
    assert np.allclose(k.tower_fd(400, R, q=1, theta=1.1)[:5], k.tower_exact(R, q=1, theta=1.1)[:5], atol=1e-3)


def test_charge_quantisation_from_large_gauge_transformations():
    assert k.large_gauge_mismatch(1.3, 1) < 1e-9 and k.large_gauge_mismatch(1.3, 2) < 1e-9
    assert k.large_gauge_mismatch(1.3, 0.5) > 0.1


def test_kk_sum_equals_image_sum_and_far_field_coupling():
    R = 1.3
    r = np.array([0.2, 1.0, 3.0, 10.0])
    assert np.allclose(k.potential_kk_sum(r, R, nmax=2000), k.potential_closed(r, R), rtol=1e-9)
    far = 60.0
    assert k.potential_closed(far, R) * 4 * math.pi * far == pytest.approx(k.g4_squared(R), rel=1e-6)


def test_lattice_poisson_approaches_closed_form():
    phi, (a, b) = k.poisson_fft(64, 16, 40.0, 0.5)
    i1, i2 = int(3 / a), int(6 / a)
    c = k.potential_closed(np.array([i1 * a, i2 * a]), 0.5)
    assert phi[i1] - phi[i2] == pytest.approx(c[0] - c[1], rel=0.08)

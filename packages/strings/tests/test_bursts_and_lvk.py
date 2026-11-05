# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for the LVK burst recipe (cusps, kinks, kink-kink collisions) and the cross-spectrum likelihood."""
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stringlab import cosmicstrings as cs, lvk, stringbursts as sb  # noqa: E402


def test_amplitude_prefactors_closed_forms():
    assert sb.G1["c"] == pytest.approx(0.85, abs=0.005)
    assert sb.G1["kk"] == pytest.approx(0.1013, abs=1e-4)
    assert sb.G1["k"] == pytest.approx(0.2565, abs=1e-4)   # the closed form; the LVK text quotes 0.29
    assert sb.DELTA == pytest.approx(2 / math.sqrt(3))


def test_decay_constant_grows_with_kinks():
    g = [sb.gamma_d(n) for n in (0, 1, 10, 100)]
    assert all(a < b for a, b in zip(g, g[1:]))
    assert sb.gamma_d(100) - sb.gamma_d(0) == pytest.approx(100 * (sb.gamma_d(1) - sb.gamma_d(0) - 0.25 * 2 * math.pi ** 2 * sb.G1["kk"] ** 2)
                                                           + 2500 * 2 * math.pi ** 2 * sb.G1["kk"] ** 2, rel=1e-12)


@pytest.mark.parametrize("Nk", [0, 1, 100])
def test_burst_sum_conserves_energy_in_radiation(Nk):
    """Pure radiation: the high-frequency plateau equals (128 pi / 9) 0.18 sqrt(G mu / Gamma_d), the energy bound
    of loops with the BOS density and decay constant Gamma_d."""
    co = cs.Cosmology(omega_m=1e-12, omega_r=1.0, omega_l=0.0, z_max=1e25, n_grid=2000)
    gmu = 1e-9
    tot = sb.omega(co, np.array([1e3]), gmu, Nk)[0]
    assert tot == pytest.approx(128 * math.pi / 9 * 0.18 * math.sqrt(gmu / sb.gamma_d(Nk)), rel=2e-3)


def test_cross_spectrum_likelihood():
    f = np.linspace(20, 90, 50)
    C = np.full(50, 1e-9)
    s = np.full(50, 4e-9)
    s[3] = np.inf
    x = lvk.CrossSpectrum(f, C, s, band=(20, 86))
    assert x.f.size == np.sum((f <= 86)) - 1
    om = np.full(x.f.size, 3e-9)
    chi = np.sum(((x.C - om) ** 2 - x.C ** 2) / s[0] ** 2)
    assert x.loglike(om) == pytest.approx(-0.5 * chi, rel=1e-12)
    assert x.loglike(np.zeros(x.f.size)) == 0.0


def test_powerlaw_upper_on_pure_noise_matches_quadrature():
    """C = 0: ln L(A) = -A^2 b / 2, so the log-uniform posterior CDF is an error-function integral done by brute force."""
    f = np.linspace(20, 80, 100)
    x = lvk.CrossSpectrum(f, np.zeros(100), np.full(100, 1e-8), band=(20, 86))
    up = x.powerlaw_upper(0.0, lo=1e-13, hi=1e-5)
    lw = np.linspace(-13, -5, 400001)
    p = np.exp(-0.5 * (10 ** lw) ** 2 * np.sum(x.w))
    c = np.cumsum(p) / p.sum()
    assert up == pytest.approx(10 ** np.interp(0.95, c, lw), rel=1e-3)

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for the background, the linear spectrum and halofit."""
import json
import sys
from pathlib import Path

import numpy as np
import pytest
from scipy.interpolate import interp1d

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from cosmolab import background, halofit, linear  # noqa: E402

REF = json.loads((ROOT / "data" / "camb_reference.json").read_text())
C = background.Cosmology()


def test_growth_integral_equals_growth_ode():
    a = np.array([0.02, 0.1, 0.3, 0.5, 0.8, 1.0])
    assert np.max(np.abs(C.growth(a) / C.growth_ode(a) - 1)) < 1e-7


def test_growth_is_a_in_matter_domination_and_planted_eds_fails():
    eds = C.with_(omega_m=1.0)
    a = np.array([0.05, 0.3, 1.0])
    assert np.allclose(eds.growth(a), a, rtol=1e-9)
    assert np.allclose(eds.growth_rate(a), 1.0, rtol=1e-9)
    # LambdaCDM is not EdS: D(0.5)/D(1) differs from 0.5 by more than 20 percent
    assert C.growth(0.5) / 0.5 - 1 > 0.2


def test_growth_rate_matches_numerical_derivative_and_gamma_fit():
    a = 0.7
    h = 1e-5
    f_num = (np.log(C.growth(a * (1 + h))) - np.log(C.growth(a * (1 - h)))) / (np.log1p(h) - np.log1p(-h))
    assert C.growth_rate(a) == pytest.approx(f_num, rel=1e-6)
    # Linder (2005): f ~ Omega_m(a)^0.55 to better than one percent for LambdaCDM
    assert C.growth_rate(1.0) == pytest.approx(C.omega_m ** 0.55, rel=0.01)


def test_kick_drift_factors_are_the_integrals():
    eds = C.with_(omega_m=1.0)
    # EdS: E = a^-1.5, so drift = int a^-1.5 da and kick = int a^-0.5 da
    assert eds.drift_factor(0.25, 1.0) == pytest.approx(2 * (0.25 ** -0.5 - 1), rel=1e-10)
    assert eds.kick_factor(0.25, 1.0) == pytest.approx(2 * (1 - 0.5), rel=1e-10)


def test_sigma8_normalisation():
    p = linear.LinearPower(C)
    assert linear.sigma_r(p, 8.0) == pytest.approx(C.sigma8, rel=1e-6)


def test_eh98_against_camb_linear():
    """Eisenstein and Hu quote a few percent; hold the fit to 4 percent of CAMB from 1e-3 to 10 h/Mpc."""
    p = linear.LinearPower(C)
    k = np.array(REF["k"])
    s = (k > 1e-3) & (k < 10)
    ratio = p(k[s]) / np.array(REF["linear"]["0"])[s]
    assert np.max(np.abs(ratio - 1)) < 0.04
    # planted: a spectrum with no baryons misses CAMB by far more
    nob = linear.LinearPower(C.with_(omega_b=1e-4))
    assert np.max(np.abs(nob(k[s]) / np.array(REF["linear"]["0"])[s] - 1)) > 0.1


@pytest.mark.parametrize("z", ["0", "1"])
def test_halofit_against_camb_takahashi(z):
    """Our halofit fed CAMB's own linear P(k) reproduces CAMB's halofit to 0.1 percent up to 10 h/Mpc."""
    k = np.array(REF["k"])
    lin = interp1d(np.log(k), np.log(REF["linear"][z]), fill_value="extrapolate")
    plin = lambda kk: np.exp(lin(np.log(kk)))
    s = (k > 1e-2) & (k < 10)
    ours = halofit.halofit(k[s], plin, REF["omega_m_z"][z], kmin=1e-4, kmax=100)
    assert np.max(np.abs(ours / np.array(REF["halofit"][z])[s] - 1)) < 1e-3
    # planted: a wrong Omega_m(z) moves the answer past the tolerance
    off = halofit.halofit(k[s], plin, 1.0 if z == "0" else 0.3, kmin=1e-4, kmax=100)
    assert np.max(np.abs(off / np.array(REF["halofit"][z])[s] - 1)) > 3e-3


def test_camb_table_as_ic_input():
    """The CAMB input spectrum reproduces the table, carries sigma8, and refuses another cosmology."""
    p = linear.camb_power(C)
    k = np.array(REF["k"])
    s = (k > 1e-3) & (k < 50)
    assert np.allclose(p(k[s]), np.array(REF["linear"]["0"])[s], rtol=1e-12)
    assert linear.sigma_r(p, 8.0) == pytest.approx(C.sigma8, rel=1e-3)
    d = C.growth(0.5)
    assert p(0.2, 0.5) == pytest.approx(p(0.2) * d * d, rel=1e-12)
    with pytest.raises(ValueError):
        linear.camb_power(C.with_(sigma8=0.9))

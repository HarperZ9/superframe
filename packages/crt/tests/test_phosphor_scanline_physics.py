# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Comprehensive known-answer and planted-wrong-control tests for CRT physics:
phosphor decay laws & emission spectra, faceplate Fresnel/halation optics,
NTSC scanline raster timing, gun gamma/spot blooming, and colour transforms.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from crt import Tube, beam, colour, glass, phosphors, scene, screen  # noqa: E402


# ---------------------------------------------------------------------------
# 1. Phosphor decay laws and emission spectra
# ---------------------------------------------------------------------------

def test_exponential_decay_known_answers_and_planted_control():
    """Single-level exponential decay: F(tau) = 1 - exp(-tau/tau0), I(tau) = exp(-tau/tau0)."""
    tau0 = 400e-6
    law = phosphors.Exponential([1.0], [tau0])
    assert float(law.F(np.array(0.0))) == 0.0
    assert float(law.F(np.array(-1e-6))) == 0.0
    assert abs(float(law.I(0.0)) - 1.0) < 1e-15
    assert abs(float(law.I(tau0)) - math.exp(-1.0)) < 1e-15
    assert abs(float(law.F(np.array(tau0))) - (1.0 - math.exp(-1.0))) < 1e-15
    assert abs(float(law.F(np.array(tau0 * math.log(10.0)))) - 0.9) < 1e-12
    # Monotonic cumulative energy
    ts = np.array([1e-6, 1e-5, 1e-4, 1e-3, 1e-2])
    vals = law.F(ts)
    assert np.all(np.diff(vals) > 0.0)

    # Planted-wrong-control: perturbing tau0 by +5% fails F(tau0) = 1 - 1/e
    bad_law = phosphors.Exponential([1.0], [tau0 * 1.05])
    assert abs(float(bad_law.F(np.array(tau0))) - (1.0 - math.exp(-1.0))) > 0.01


def test_hyperbolic_becquerel_decay_known_answers_and_guard():
    """Becquerel law: I(t0) = 2^-n, F(t0) = 1 - 2^-(n-1), and n <= 1 refused."""
    t0, n = 50e-6, 2.0
    law = phosphors.Hyperbolic(t0, n)
    assert float(law.F(np.array(0.0))) == 0.0
    assert abs(float(law.I(0.0)) - 1.0) < 1e-15
    assert abs(float(law.I(t0)) - 2.0 ** (-n)) < 1e-15
    assert abs(float(law.F(np.array(t0))) - (1.0 - 2.0 ** (-(n - 1.0)))) < 1e-15
    assert abs(phosphors.times_to(law, 0.25) - t0) < 1e-12

    # Infinite-energy exponent guard
    with pytest.raises(AssertionError):
        phosphors.Hyperbolic(t0, 1.0)
    with pytest.raises(AssertionError):
        phosphors.Hyperbolic(t0, 0.8)

    # Planted-wrong-control: exponent n=1.5 instead of 2.0 must fail I(t0) = 0.25
    bad_law = phosphors.Hyperbolic(t0, 1.5)
    assert abs(float(bad_law.I(t0)) - 0.25) > 0.05


def test_kuhn2002_p22_decay_ordering_and_normalization():
    """Kuhn 2002 measured P22: F(0)=0, F(t_cut)=1, strict rise, green/blue faster than red at 100 us."""
    r, g, b = phosphors.decay_preset("kuhn2002")
    for law in (r, g, b):
        assert float(law.F(np.array(0.0))) == 0.0
        assert abs(float(law.F(np.array(law.t_cut))) - 1.0) < 1e-12
        assert abs(float(law.I(0.0)) - 1.0) < 1e-12
        grid = np.linspace(1e-6, law.t_cut, 50)
        assert np.all(np.diff(law.F(grid)) > 0.0)
    # Green and blue ZnS decay faster initially than Y2O2S:Eu red
    f_r = float(r.F(np.array(100e-6)))
    f_g = float(g.F(np.array(100e-6)))
    f_b = float(b.F(np.array(100e-6)))
    assert f_g > f_r and f_b > f_r

    # Planted-wrong-control: unknown preset name raises KeyError
    with pytest.raises(KeyError):
        phosphors.decay_preset("nonexistent_preset")


@pytest.mark.parametrize("red_host", ["Y2O2S:Eu", "Y2O3:Eu"])
def test_p22_spectra_unit_energy_and_physical_chromaticities(red_host: str):
    """All three P22 spectra integrate to 1.0 W/W over the 5 nm grid and land inside the CIE horseshoe."""
    ph = phosphors.p22(red=red_host)
    spds = ph["spd"]
    assert spds.shape == (3, 81)
    integrals = spds.sum(axis=1) * phosphors.DL
    assert np.allclose(integrals, 1.0, atol=1e-12)
    assert np.all(spds >= 0.0)
    # Peak wavelength ordering: red > green > blue
    peaks = [float(phosphors.GRID[int(np.argmax(spds[c]))]) for c in range(3)]
    assert peaks[0] >= 605.0 and 515.0 <= peaks[1] <= 560.0 and 435.0 <= peaks[2] <= 465.0

    # Chromaticity checks via tube
    t = Tube(diagonal_in=6.0, red_host=red_host)
    chroms = colour.chromaticities(t)
    for x, y in chroms:
        assert 0.0 < x < 1.0 and 0.0 < y < 1.0 and (x + y) < 1.0
    # Red has largest x, green has largest y, blue has smallest y
    assert chroms[0][0] > chroms[1][0] > chroms[2][0]
    assert chroms[1][1] > chroms[0][1] > chroms[2][1]


# ---------------------------------------------------------------------------
# 2. Faceplate Fresnel, Brewster angle, TIR, and halation geometry
# ---------------------------------------------------------------------------

def test_faceplate_fresnel_normal_brewster_and_tir_with_controls():
    """Unpolarised internal Fresnel (glass n -> air 1): normal=0.04, Brewster Rp=0, TIR=1.0."""
    n = 1.5
    # Normal incidence: ((n - 1) / (n + 1))^2 = 0.04
    assert abs(glass.fresnel(n, 0.0) - 0.04) < 1e-15
    assert glass.fresnel(1.0, 0.3) == pytest.approx(0.0, abs=1e-15)
    # Internal Brewster angle: tan(theta_B) = 1 / n => rp = 0, so R = 0.5 * rs^2
    theta_b = math.atan(1.0 / n)
    ci = math.cos(theta_b)
    ct = math.sqrt(1.0 - (n * math.sin(theta_b)) ** 2)
    rs = (n * ci - ct) / (n * ci + ct)
    assert abs(glass.fresnel(n, theta_b) - 0.5 * rs * rs) < 1e-15
    # Critical angle boundary: theta_c = asin(1/n)
    theta_c = math.asin(1.0 / n)
    assert glass.fresnel(n, theta_c + 1e-6) == 1.0
    assert glass.fresnel(n, theta_c - 1e-3) < 1.0

    # Planted-wrong-control: wrong index n=1.6 must fail normal-incidence R=0.04
    assert abs(glass.fresnel(1.6, 0.0) - 0.04) > 0.01


def test_faceplate_halation_ring_and_exit_fraction_monotonicity():
    """Halation ring radius scales linearly with thickness; exit fraction falls with lower transmission."""
    p_thin = glass.Faceplate(thickness_mm=8.0, transmission=0.80)
    p_thick = glass.Faceplate(thickness_mm=16.0, transmission=0.80)
    p_tinted = glass.Faceplate(thickness_mm=16.0, transmission=0.45)
    n = 1.52
    want_thin = 2.0 * 8.0 * math.tan(math.asin(1.0 / n))
    assert abs(p_thin.ring_mm(n) - want_thin) < 1e-12
    assert abs(p_thick.ring_mm(n) - 2.0 * p_thin.ring_mm(n)) < 1e-12
    assert p_thick.exit_fraction(n) > p_tinted.exit_fraction(n) > 0.0
    # Clear glass exit fraction lies strictly below 1/n^2 due to Fresnel reflection
    p_clear = glass.Faceplate(thickness_mm=12.0, transmission=1.0)
    assert 0.85 / (n * n) < p_clear.exit_fraction(n) < 1.0 / (n * n)

    # Planted-wrong-control: using sin instead of tan underestimates ring radius
    wrong_ring = 2.0 * 8.0 * math.sin(math.asin(1.0 / n))
    assert abs(p_thin.ring_mm(n) - wrong_ring) > 2.0


# ---------------------------------------------------------------------------
# 3. Scanline raster timing, gun gamma, beam spot blooming, and colour space
# ---------------------------------------------------------------------------

def test_scanline_raster_timing_and_blanking_invariants():
    """NTSC 240p scanline timing: exact H, exact T, monotone beam_time, exact horizontal blanking."""
    t = Tube(diagonal_in=6.0)
    expected_h = 286.0 / 4.5e6
    assert abs(t.H - expected_h) < 1e-15
    assert abs(t.T - 262 * expected_h) < 1e-14
    bt = t.beam_time(0)
    assert bt.shape[0] == t.active_lines
    # Strictly increasing across every scanline and down every column
    assert np.all(np.diff(bt, axis=1) > 0.0)
    assert np.all(np.diff(bt, axis=0) > 0.0)
    # Line-to-line start spacing is exactly H
    for j in range(0, t.active_lines - 1, 20):
        assert abs((t.line_start(j + 1) - t.line_start(j)) - t.H) < 1e-15
    # Horizontal blanking interval equals H - active_s
    blanking = t.H - t.active_s
    assert abs(blanking - (1.5e-6 + 9.2e-6)) < 1e-9

    # Planted-wrong-control: PAL-like 15625 Hz line rate diverges from NTSC H by > 0.4 us
    t_pal = Tube(diagonal_in=6.0, line_hz=15625.0)
    assert abs(t_pal.H - expected_h) > 0.4e-6


def test_gun_gamma_law_spot_blooming_and_beam_energy():
    """Cathode current obeys drive^gamma, spot sigma blooms with current, energy = V * I * dx / v."""
    t = Tube(diagonal_in=6.0, gamma=2.4)
    for gun in range(3):
        assert float(t.current(0.0, gun)) == 0.0
        i_half = float(t.current(0.5, gun))
        i_full = float(t.current(1.0, gun))
        assert abs(i_half / i_full - (0.5 ** 2.4)) < 1e-12
        # Clamping outside [0, 1]
        assert float(t.current(-0.5, gun)) == 0.0
        assert float(t.current(1.5, gun)) == pytest.approx(i_full, rel=1e-12)
        # Beam energy exact formula
        e_full = float(t.beam_energy(i_full))
        assert abs(e_full - t.anode_v * i_full * t.dx / t.v) < 1e-18

    # Spot sigma ratio from zero current to i_max_a equals spot_hi / spot_lo
    s0 = float(t.sigma(0.0))
    smax = float(t.sigma(t.i_max_a))
    assert abs(smax / s0 - t.spot_hi / t.spot_lo) < 1e-12
    assert smax > s0

    # Planted-wrong-control: gamma 2.2 fails gamma 2.4 half-drive ratio by > 0.02
    t_g22 = Tube(diagonal_in=6.0, gamma=2.2)
    ratio_22 = float(t_g22.current(0.5, 0)) / float(t_g22.current(1.0, 0))
    assert abs(ratio_22 - (0.5 ** 2.4)) > 0.02


def test_colour_pipeline_white_black_and_lab_control():
    """D65 white maps to Lab (100, 0, 0) and 8-bit sRGB (255, 255, 255); black maps to (0, 0, 0)."""
    d65 = np.array([0.95047, 1.0, 1.08883])
    lab_white = colour.to_lab(d65, d65)
    assert np.allclose(lab_white, [100.0, 0.0, 0.0], atol=1e-12)
    lab_black = colour.to_lab(np.zeros(3), d65)
    assert np.allclose(lab_black, [0.0, 0.0, 0.0], atol=1e-12)
    rgb_white = colour.encode(d65, 1.0)
    assert tuple(int(c) for c in rgb_white) == (255, 255, 255)
    rgb_black = colour.encode(np.zeros(3), 1.0)
    assert tuple(int(c) for c in rgb_black) == (0, 0, 0)

    # Planted-wrong-control: wrong white point shifts D65 chromaticity away from a=0, b=0
    lab_wrong_wp = colour.to_lab(d65, np.array([1.0, 1.0, 1.0]))
    assert abs(float(lab_wrong_wp[1])) > 2.0 or abs(float(lab_wrong_wp[2])) > 2.0

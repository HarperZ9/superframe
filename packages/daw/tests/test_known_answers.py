# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for the resonators. Each test pairs a closed form or a published table with a planted
wrong case that the same check must reject."""
import math
import sys
from pathlib import Path

import numpy as np
from scipy.special import jn_zeros

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import materials as M  # noqa: E402
from daw.modes import tune  # noqa: E402
from daw.outline import Outline, polygon_mask  # noqa: E402
from daw.shapes_1d import Bar, String, Tube, clamped_free_roots  # noqa: E402
from daw.shapes_2d import (CircularMembrane, CircularPlate, RectPlate, clamped_circular_lambdas,  # noqa: E402
                           flexural_rigidity)

STEEL, AL = M.material("steel_mild"), M.material("aluminium")


def close(a, b, rel):
    return np.all(np.abs(np.asarray(a) / np.asarray(b) - 1) <= rel)


def test_ideal_string_is_harmonic():
    r = String(STEEL, 0.65, 0.5e-3, 80.0, stiff=False).modes(20).ratios()
    assert close(r, np.arange(1, 21), 1e-12)
    assert not close(String(STEEL, 0.65, 0.5e-3, 80.0, stiff=True).modes(20).ratios(), np.arange(1, 21), 1e-4)


def test_ideal_string_fundamental_from_tension_and_mass():
    s = String(STEEL, 0.65, 0.5e-3, 80.0, stiff=False)
    want = math.sqrt(80.0 / (STEEL.rho * math.pi * 0.25e-6 / 4)) / 1.3
    assert close(s.modes(1).freqs[0], want, 1e-12)
    assert not close(s.modes(1).freqs[0], want * 2, 1e-3)   # planted: forgetting the factor 2 in 2L


def test_stiff_string_follows_fletcher():
    s = String(STEEL, 0.65, 1.0e-3, 600.0)
    f, B = s.modes(30).freqs, s.inharmonicity
    n = np.arange(1, 31)
    assert close(f / f[0], n * np.sqrt((1 + B * n ** 2) / (1 + B)), 1e-12)
    assert B > 1e-5


def test_free_bar_ratios():
    r = Bar(AL, 0.3, 0.01).modes(4).ratios()
    assert np.all(np.abs(r - [1.0, 2.756, 5.404, 8.933]) < 6e-4)
    assert not np.all(np.abs(Bar(AL, 0.3, 0.01, "pinned").modes(4).ratios() - [1.0, 2.756, 5.404, 8.933]) < 6e-4)


def test_bar_roots_and_cantilever():
    bl = Bar(AL, 0.3, 0.01).roots(3)
    assert np.all(np.abs(bl - [4.7300, 7.8532, 10.9956]) < 1e-4)
    assert np.all(np.abs(clamped_free_roots(2) - [1.8751, 4.6941]) < 1e-4)


def test_bar_absolute_frequency():
    b = Bar(STEEL, 0.4, 0.008)
    want = 4.730041 ** 2 / (2 * math.pi * 0.16) * math.sqrt(STEEL.E * 0.008 ** 2 / (12 * STEEL.rho))
    assert close(b.modes(1).freqs[0], want, 1e-6)


def test_circular_membrane_bessel_ratios():
    r = CircularMembrane(0.2, 2000.0, 0.26).modes().ratios()[:4]
    assert np.all(np.abs(r - [1.0, 1.594, 2.136, 2.296]) < 1e-3)
    assert close(r[1], jn_zeros(1, 1)[0] / jn_zeros(0, 1)[0], 1e-12)
    assert not np.all(np.abs(r - [1.0, 2.0, 3.0, 4.0]) < 1e-3)   # planted: a harmonic drum


def test_rect_plate_navier_closed_form():
    p = RectPlate(STEEL, 0.4, 0.3, 0.002)
    f = p.modes(4, 4).freqs
    k = math.sqrt(flexural_rigidity(STEEL, 0.002) / (STEEL.rho * 0.002))
    want = sorted(math.pi / 2 * ((m / 0.4) ** 2 + (n / 0.3) ** 2) * k for m in range(1, 5) for n in range(1, 5))
    assert close(f, want, 1e-12)


def test_clamped_circular_plate_matches_leissa_table():
    """Leissa Table 2.1 to one unit in the last printed digit: the table truncates (60.8287 is printed 60.82)."""
    t = M.table()
    for n in range(3):
        lam2 = clamped_circular_lambdas(n, 2) ** 2
        for s in range(2):
            pub = t[f"leissa.clamped_circular.s{s}n{n}"]["value"]
            tol = 10.0 ** -len(repr(pub).split(".")[1])
            assert abs(lam2[s] - pub) <= tol, (n, s, lam2[s], pub)
    assert abs(clamped_circular_lambdas(0, 1)[0] ** 2 - 10.2168) > 5e-4   # the OCR misreading is rejected


def test_outline_square_plate_matches_navier():
    o = Outline(np.ones((60, 60), bool), 0.3, STEEL, h=0.002, k=6)
    fd = o.modes().freqs
    exact = RectPlate(STEEL, 0.3, 0.3, 0.002).modes(3, 3).freqs[:6]
    assert close(fd, exact, 2e-3)
    assert not close(fd, exact * 1.01, 2e-3)


def test_outline_disc_membrane_matches_bessel():
    xs = (np.arange(80) + 1.0) / 81
    X, Y = np.meshgrid(xs, xs, indexing="ij")
    disc = (X - 0.5) ** 2 + (Y - 0.5) ** 2 < 0.25
    o = Outline(disc, 0.4, STEEL.with_(rho=1000.0), h=1e-3, tension=500.0, k=4)
    assert abs(o.modes().ratios()[1] - jn_zeros(1, 1)[0] / jn_zeros(0, 1)[0]) < 0.02   # staircase edge


def test_polygon_mask_area():
    m = polygon_mask([(0.0, 0.0), (1.0, 0.0), (0.0, 1.0)], 200)
    assert abs(m.mean() - 0.5) < 0.01


def test_tube_open_and_closed_series():
    c = M.air_speed(20.0)
    oo = Tube(0.5, 0.01, "open-open", c, end_correction=False).modes(4)
    co = Tube(0.5, 0.01, "closed-open", c, end_correction=False).modes(4)
    assert close(oo.ratios(), [1, 2, 3, 4], 1e-12) and close(co.ratios(), [1, 3, 5, 7], 1e-12)
    assert close(oo.freqs[0], c / 1.0, 1e-12) and close(co.freqs[0], c / 2.0, 1e-12)
    corrected = Tube(0.5, 0.01, "open-open", c).modes(1).freqs[0]
    assert close(corrected, c / (2 * (0.5 + 2 * 0.6133 * 0.01)), 1e-12) and corrected < oo.freqs[0]
    assert not close(co.ratios(), [1, 2, 3, 4], 1e-3)


def test_air_speed_from_kaye_laby():
    assert abs(M.air_speed(0.0) - 331.46) < 1e-9
    assert abs(M.air_speed(20.0) - 343.38) < 0.01


def test_material_swap_scales_pitch_by_sqrt_e_over_rho():
    for shape in (lambda m: Bar(m, 0.3, 0.01), lambda m: RectPlate(m.with_(nu=0.3), 0.3, 0.2, 0.002)):
        r = shape(AL).modes().freqs[0] / shape(STEEL).modes().freqs[0]
        want = math.sqrt((AL.E / AL.rho) / (STEEL.E / STEEL.rho))
        assert close(r, want, 1e-12)
        assert not close(r, (AL.E / AL.rho) / (STEEL.E / STEEL.rho), 1e-3)   # planted: no square root


def test_tuning_lands_on_pitch():
    for res in (Bar(AL, 0.3, 0.01), String(STEEL, 0.6, 0.4e-3, 70.0), CircularPlate(STEEL, 0.1, 0.002),
                Tube(0.5, 0.01, "closed-open", M.air_speed())):
        assert close(tune(res, 261.6256).modes().freqs[0], 261.6256, 1e-6)


def test_decay_follows_loss_factor():
    m = Bar(AL, 0.3, 0.01).modes(3)
    assert close(m.t60(), math.log(1000) / (math.pi * m.freqs * AL.eta), 1e-12)

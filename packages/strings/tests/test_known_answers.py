# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known-answer tests: each asserts a published closed form or theorem, and planted wrong inputs must fail."""
import math
import sys
from fractions import Fraction as F
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stringlab import calabiyau, classical, extradim, fock, hagedorn, tduality, zeropoint  # noqa: E402


# ---- A1: critical dimensions -------------------------------------------------------------------------
@pytest.mark.parametrize("reg", ["exp", "gauss"])
def test_zero_point_sums_and_critical_dimensions(reg):
    d = zeropoint.critical_dimensions(reg)
    assert d["zeta_int"] == pytest.approx(-1 / 12, abs=1e-10)
    assert d["zeta_half"] == pytest.approx(1 / 24, abs=1e-10)
    assert abs(d["D_bosonic"] - 26) < 1e-6
    assert abs(d["D_super"] - 10) < 1e-6
    assert d["ramond_zero_point_D10"] == 0


def test_naive_truncated_sum_has_no_critical_dimension():
    """Planted bad: the bare partial sum grows with the cutoff, so D drifts instead of settling."""
    ds = [zeropoint.bosonic_dimension(zeropoint.truncated_part(1.0, n)) for n in (10, 100, 1000)]
    assert all(abs(x - 26) > 20 for x in ds)


def test_hurwitz_closed_form_agrees_with_numerics():
    for a in (0.25, 0.5, 0.75, 1.0):
        v, _ = zeropoint.finite_part(a, "gauss")
        assert v == pytest.approx(zeropoint.hurwitz_closed(a), abs=1e-10)


@pytest.mark.parametrize("name,c", [("boson", 1), ("majorana_ns", F(1, 2)), ("bc_lambda2", -26),
                                    ("bc_lambda1", -2), ("bc_lambda_half", 1), ("betagamma_32", 11)])
def test_virasoro_central_charges_exact(name, c):
    s = fock.SYSTEMS[name]
    assert [fock.central_charge(s, m) for m in (2, 3, 4)] == [c, c, c]


@pytest.mark.parametrize("name", ["boson", "majorana_ns", "bc_lambda2", "betagamma_32"])
def test_virasoro_algebra_closes(name):
    s = fock.SYSTEMS[name]
    c = fock.central_charge(s, 2)
    worst = max(fock.closure_defect(s, c, m, n, st) for st in fock.excited_states(s, (1, 2))
                for m in range(-2, 3) for n in range(-2, 3))
    assert worst == 0


def test_wrong_generator_fails_closure():
    """Planted bad: flip the sign of the Majorana generator; the algebra must not close.

    A shift s - m/2 -> s + m/2 is not a planted error: it adds m sum :psi_{m-s} psi_s:, which vanishes."""
    bad = fock.System("bad", ("p",), half=True)
    orig = bad.generator
    bad.generator = lambda m, window: [(-c, xy) for c, xy in orig(m, window)]
    c = fock.central_charge(bad, 2)
    st = fock.excited_states(bad, (1,))
    assert max(fock.closure_defect(bad, c, 1, -2, x) for x in st) != 0


def test_critical_dimension_from_central_charges():
    S = fock.SYSTEMS
    d = fock.critical_from_charges(*(fock.central_charge(S[k], 3) for k in
                                     ("boson", "majorana_ns", "bc_lambda2", "betagamma_32")))
    assert d == {"D_bosonic": 26, "D_super": 10}


# ---- A2: classical string ----------------------------------------------------------------------------
def test_lattice_spectrum_tends_to_integers():
    w = classical.richardson_frequencies()
    assert np.abs(w - np.arange(1, 6)).max() < 1e-9


def test_mass_from_fields_equals_mode_sum_and_rod_saturates_regge():
    rng = np.random.default_rng(3)
    for md in (classical.rod_modes(0.7), classical.random_modes(rng, 4)):
        o = classical.observables(md)
        assert o["M2"] == pytest.approx(o["M2_from_modes"], rel=1e-10)
    r = classical.regge_scan(rng, 150)
    assert all(abs(x["ratio"] - 1) < 1e-10 for x in r["rods"])
    assert max(r["random_ratios"]) < 1.0


def test_leapfrog_conserves_and_tracks_exact_solution():
    out = classical.evolve_lattice(classical.random_modes(np.random.default_rng(4), 3), n_sites=256,
                                   steps_per_unit=512)
    assert out["M2_drift"] < 1e-3 and out["J_drift"] < 1e-3 and out["max_dev"] < 1e-2


# ---- A3: T-duality -----------------------------------------------------------------------------------
@pytest.mark.parametrize("R", [0.37, 0.8, 1.7, 2.9])
def test_spectrum_is_t_dual(R):
    assert tduality.exact_spectrum_mismatch(R, 1 / R) < 1e-12
    assert tduality.exact_spectrum_mismatch(R, 1.001 / R) > 1e-3   # planted bad: a near-miss radius


def test_self_dual_radius_gains_100_massless_states():
    assert tduality.massless_count(1.3) == 576
    assert tduality.massless_count(1.0) == 676


@pytest.mark.parametrize("tau,R", [(0.31 + 0.87j, 1.37), (-0.2 + 1.3j, 0.6)])
def test_partition_function_poisson_duality_and_modular(tau, R):
    p = tduality.partition_checks(tau, R)
    assert max(p["poisson"], p["t_duality"], p["s_modular"], p["t_modular"]) < 1e-12
    wrong = abs(p["Z_H"] - tduality.z_hamiltonian(tau, R * 1.01)) / p["Z_H"]
    assert wrong > 1e-4


# ---- A4: Hagedorn ------------------------------------------------------------------------------------
def test_degeneracies_first_levels():
    assert hagedorn.bosonic_degeneracies(3) == [1, 24, 324, 3200]
    assert hagedorn.super_degeneracies(2) == [16, 256, 2304]


@pytest.mark.parametrize("kind", ["bosonic", "super"])
def test_hagedorn_temperature(kind):
    r = hagedorn.hagedorn(kind, 1500, (300, 1500))
    assert r["rel_err"] < 3e-4


# ---- B1: Calabi-Yau ----------------------------------------------------------------------------------
def test_quintic_topology():
    chi, c = calabiyau.euler_characteristic()
    assert chi == -200 and c[1] == 0
    assert calabiyau.hodge_21()[0] == 101
    assert calabiyau.hodge_21(np.random.default_rng(0), random_quintic=True)[0] == 101
    assert 2 * (1 - 101) == chi


def test_section_counts():
    assert [len(calabiyau.monomials(k)) for k in range(1, 7)] == [5, 15, 35, 70, 125, 205]


def test_balanced_metric_improves_and_keeps_the_kahler_class():
    rng = np.random.default_rng(11)
    z = calabiyau.sample_points(rng, 3000)
    assert np.abs(calabiyau.fermat(z)).max() < 1e-9
    J, o2 = calabiyau.tangent_frame(z)
    w = calabiyau.fs_weights(z, J, o2)
    zt = calabiyau.sample_points(np.random.default_rng(12), 2000)
    Jt, o2t = calabiyau.tangent_frame(zt)
    wt = calabiyau.fs_weights(zt, Jt, o2t)
    sig, vol = [], []
    for k in (1, 2, 3):
        H, _ = calabiyau.balanced(z, w, k, iters=6)
        s, v = calabiyau.sigma(zt, Jt, o2t, wt, calabiyau.monomials(k), H, k)
        sig.append(s)
        vol.append(v)
    assert sig[0] > sig[1] > sig[2] and sig[2] < 0.7 * sig[0]
    assert max(vol) / min(vol) - 1 < 0.02


# ---- C1: extra dimensions ----------------------------------------------------------------------------
@pytest.mark.parametrize("n", [1, 2, 3])
def test_kk_tower_alpha_and_short_range_law(n):
    assert extradim.yukawa_alpha(n, 1.0, 80.0) == pytest.approx(2 * n, rel=1e-9)
    assert extradim.yukawa_alpha(n, 4 / 3, 80.0) == pytest.approx(8 * n / 3, rel=1e-9)
    if n < 3:
        assert extradim.log_slope(n, 2e-2) == pytest.approx(-(1 + n), abs=1e-3)


@pytest.mark.parametrize("n", [1, 2])
def test_kk_sum_equals_image_sum(n):
    for x in (0.3, 1.0, 3.0):
        assert extradim.kk_ratio(x, n) == pytest.approx(extradim.image_ratio(x, n), rel=1e-6)


def test_derived_scales_from_measured_constants():
    """hbar c and the Planck mass, against values computed by hand from CODATA 2022."""
    assert extradim.HBARC_GEV_M == pytest.approx(1.97327e-16, rel=1e-5)
    assert extradim.M_PLANCK_GEV == pytest.approx(1.22089e19, rel=1e-4)


def test_ahn_2003_scale_reproduced():
    """AHN 2003: alpha = 16/3 allowed only below 130 um, so M* > 1.7 TeV (n = 2)."""
    assert extradim.add_scale(130e-6, 2) / 1e3 == pytest.approx(1.7, abs=0.05)
    assert extradim.radion_scale(2.4e-3) == pytest.approx(1000, rel=0.01)


def test_exclusion_reading_on_a_synthetic_curve():
    lam = np.logspace(-5, -3, 50)
    curve = list(zip(lam, (1e-4 / lam) ** 3))
    assert extradim.lambda_at_alpha(curve, 1.0) == pytest.approx(1e-4, rel=1e-6)
    assert extradim.excluded(curve, 2e-4, 1.0) is True
    assert extradim.excluded(curve, 5e-5, 1.0) is False

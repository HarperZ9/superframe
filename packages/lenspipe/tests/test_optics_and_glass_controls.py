# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Comprehensive known-answer and planted-wrong-control tests for lenspipe:
optical refraction (Snell + TIR + lensmaker), glass dispersion (Sellmeier/Cauchy/Abbe),
glass transmission (Beer-Lambert + Fresnel coated/uncoated), and diffraction MTF/Strehl.
"""
from __future__ import annotations

import math
import sys
import warnings
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

warnings.simplefilter("ignore")
np.seterr(all="ignore")

from lenspipe import design, glass, limits, optics, trace  # noqa: E402


def _make_plate(n: float, thickness: float, vd: float = 1e6) -> dict:
    return design.validate(dict(
        schema=design.SCHEMA,
        id="plate",
        units="mm",
        surfaces=[
            dict(r=None, t=0.0, material=None, semi=50.0, stop=True),
            dict(r=None, t=thickness, material={"nd": n, "vd": vd}, semi=50.0),
            dict(r=None, t=10.0, material=None, semi=50.0),
        ],
        intent=dict(fno=4.0, half_field_deg=[0.0], wavelengths_nm=[glass.ND], primary=0),
    ))


def _make_singlet(r1, r2, ct, mat, semi=10.0, conic=0.0, bfd=100.0, fno=5.0, wl=(glass.ND,)):
    s = [
        dict(r=None, t=0.0, material=None, semi=semi, stop=True),
        dict(r=r1, t=ct, material=mat, semi=semi),
        dict(r=r2, t=bfd, material=None, semi=semi, conic=conic),
    ]
    return design.validate(dict(
        schema=design.SCHEMA,
        id="singlet",
        units="mm",
        surfaces=s,
        intent=dict(fno=fno, half_field_deg=[0.0], wavelengths_nm=list(wl), primary=0),
    ))


# ---------------------------------------------------------------------------
# 1. Optical refraction: Snell's law, TIR, and thick-lens lensmaker equation
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("theta_deg", [10.0, 25.0, 40.0])
def test_snell_refraction_and_lateral_shift_known_answer(theta_deg: float):
    """Exact Snell refraction through a plane-parallel slab of index n and thickness t."""
    n, t = 1.52, 12.0
    L = design.to_lens(_make_plate(n, t))
    th1 = math.radians(theta_deg)
    th2 = math.asin(math.sin(th1) / n)
    # Launch ray arriving at (0, 0, 0) with angle theta_deg in y-z plane
    rays = dict(
        x=np.zeros(1) + 0j,
        y=np.zeros(1) + 0j,
        z=np.zeros(1) + 0j,
        L=np.zeros(1) + 0j,
        M=np.array([math.sin(th1)]) + 0j,
        N=np.array([math.cos(th1)]) + 0j,
    )
    res = trace.trace(L, 0, rays, keep=True)
    assert bool(res["ok"][0])
    # Exact Snell inside glass: cos_out[1] == cos(theta2)
    assert abs(float(res["cos_out"][1][0]) - math.cos(th2)) < 1e-12
    # Exit ray is parallel to incident ray
    assert abs(float(res["M"][0].real) - math.sin(th1)) < 1e-12
    # Exact image-plane y = t * tan(th2) + 10 * tan(th1)
    expected_y = t * math.tan(th2) + 10.0 * math.tan(th1)
    assert abs(float(res["y"][0].real) - expected_y) < 1e-11
    # Exact OPL = n * (t / cos(th2)) + 1.0 * (10 / cos(th1))
    expected_opl = n * (t / math.cos(th2)) + 10.0 / math.cos(th1)
    assert abs(float(res["opl"][0].real) - expected_opl) < 1e-11

    # Planted-wrong-control: perturbing n by +0.05 must fail Snell cos_out and lateral-shift checks
    L_bad = design.to_lens(_make_plate(n + 0.05, t))
    res_bad = trace.trace(L_bad, 0, rays, keep=True)
    assert abs(float(res_bad["cos_out"][1][0]) - math.cos(th2)) > 1e-4
    assert abs(float(res_bad["y"][0].real) - expected_y) > 0.02


def test_total_internal_reflection_critical_angle_boundary():
    """Glass-to-air boundary: below critical angle transmits, past critical angle triggers TIR (ok=False)."""
    n = 1.5
    theta_c = math.asin(1.0 / n)
    d = design.validate(dict(
        schema=design.SCHEMA,
        id="tir",
        units="mm",
        surfaces=[
            dict(r=None, t=5.0, material={"nd": n, "vd": 1e6}, semi=100.0, stop=True),
            dict(r=None, t=10.0, material=None, semi=100.0),
        ],
        intent=dict(fno=2.0, half_field_deg=[0.0], wavelengths_nm=[glass.ND], primary=0),
    ))
    L = design.to_lens(d)
    # Start rays inside glass medium (set medium 0 = n so surface 0 does not bend)
    L.n[:, 0] = n
    angles = np.array([theta_c - 0.02, theta_c + 0.02])
    rays = dict(
        x=np.zeros(2) + 0j,
        y=np.zeros(2) + 0j,
        z=np.zeros(2) + 0j,
        L=np.zeros(2) + 0j,
        M=np.sin(angles) + 0j,
        N=np.cos(angles) + 0j,
    )
    res = trace.trace(L, 0, rays)
    assert bool(res["ok"][0]) is True, "ray below critical angle must transmit"
    assert bool(res["ok"][1]) is False, "ray past critical angle must fail via TIR"


def test_lensmaker_thick_singlet_focal_length_and_planted_control():
    """Exact thick-lens lensmaker equation: 1/f = (n - 1)(1/R1 - 1/R2 + (n - 1) t / (n R1 R2))."""
    n, r1, r2, t = 1.5168, 80.0, -80.0, 6.0
    inv_f = (n - 1.0) * (1.0 / r1 - 1.0 / r2 + (n - 1.0) * t / (n * r1 * r2))
    expected_efl = 1.0 / inv_f
    L = design.to_lens(_make_singlet(r1, r2, t, {"nd": n, "vd": 64.17}, bfd=expected_efl))
    efl = float(np.real(trace.paraxial(L)[0]))
    assert abs(efl - expected_efl) < 1e-9

    # Planted-wrong-control: wrong index or flipped rear curvature must diverge sharply
    L_bad_n = design.to_lens(_make_singlet(r1, r2, t, {"nd": n + 0.08, "vd": 64.17}, bfd=expected_efl))
    efl_bad_n = float(np.real(trace.paraxial(L_bad_n)[0]))
    assert abs(efl_bad_n - expected_efl) > 5.0

    L_bad_r = design.to_lens(_make_singlet(r1, abs(r2), t, {"nd": n, "vd": 64.17}, bfd=expected_efl))
    efl_bad_r = float(np.real(trace.paraxial(L_bad_r)[0]))
    assert abs(efl_bad_r - expected_efl) > 100.0


# ---------------------------------------------------------------------------
# 2. Glass dispersion: Sellmeier catalogue, Abbe number, Cauchy model glass
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("name", ["N-BK7", "N-SF5", "S-LAM3", "S-BAH11"])
def test_catalogue_normal_dispersion_and_abbe_number(name: str):
    """Normal dispersion in visible band: nF > nd > nC, and Abbe number matches catalogue vd."""
    row = glass.catalog()[name]
    nf = glass.index(name, glass.NF)
    nd = glass.index(name, glass.ND)
    nc = glass.index(name, glass.NC)
    assert nf > nd > nc > 1.0
    vd_calc = (nd - 1.0) / (nf - nc)
    assert abs(vd_calc - row["vd"]) < 0.25, (name, vd_calc, row["vd"])

    # Planted-wrong-control: swapping F and C wavelengths flips the sign of Abbe number
    vd_swapped = (nd - 1.0) / (nc - nf)
    assert vd_swapped < 0.0 and abs(vd_swapped - row["vd"]) > 50.0


def test_model_glass_cauchy_exact_abbe_and_air_controls():
    """Two-term Cauchy model glass reproduces nd and Vd to machine precision."""
    nd_target, vd_target = 1.62, 36.3
    fn = glass.model_glass(nd_target, vd_target)
    nf, nd, nc = fn(glass.NF), fn(glass.ND), fn(glass.NC)
    assert abs(nd - nd_target) < 1e-12
    assert abs((nd - 1.0) / (nf - nc) - vd_target) < 1e-12
    assert glass.index("air", 550.0) == 1.0
    assert glass.index(None, 550.0) == 1.0
    with pytest.raises(KeyError):
        glass.index("NONEXISTENT_GLASS_999", 550.0)

    # Planted-wrong-control: perturbing vd by 5% breaks dispersion interval nF - nC
    fn_bad = glass.model_glass(nd_target, vd_target * 1.05)
    assert abs((fn_bad(glass.NF) - fn_bad(glass.NC)) - (nf - nc)) > 5e-4


# ---------------------------------------------------------------------------
# 3. Glass transmission: Beer-Lambert law and Fresnel uncoated / coated slab
# ---------------------------------------------------------------------------

def test_beer_lambert_internal_transmittance_scaling_and_control():
    """Catalogue absorption follows exact Beer-Lambert law T(d) = exp(-4 pi k d / lambda)."""
    cat = glass.catalog()
    # Pick a catalogue glass carrying measured extinction k (e.g. BAFN6 or N-BK7)
    glass_name = next(name for name, row in cat.items() if row.get("k"))
    nm = 400.0
    k = glass.k_at(glass_name, nm)
    assert k is not None and k > 0.0
    t10 = glass.internal_transmittance(glass_name, nm, 10.0)
    t20 = glass.internal_transmittance(glass_name, nm, 20.0)
    t0 = glass.internal_transmittance(glass_name, nm, 0.0)
    assert t0 == pytest.approx(1.0, abs=1e-15)
    assert 0.0 < t20 < t10 < 1.0
    assert abs(t20 - t10 * t10) < 1e-12
    expected_t10 = math.exp(-4.0 * math.pi * k * 10.0 / (nm * 1e-6))
    assert abs(t10 - expected_t10) < 1e-12
    assert glass.internal_transmittance({"nd": 1.5, "vd": 60.0}, nm, 10.0) is None

    # Planted-wrong-control: linear attenuation 1 - alpha*d diverges from Beer-Lambert at thick path
    alpha = 4.0 * math.pi * k / (nm * 1e-6)
    thick = 1.0 / alpha  # optical depth 1 => T = 1/e ~ 0.3679, linear gives 0
    t_od1 = glass.internal_transmittance(glass_name, nm, thick)
    assert abs(t_od1 - math.exp(-1.0)) < 1e-12
    assert abs(t_od1 - max(0.0, 1.0 - alpha * thick)) > 0.30


def test_fresnel_slab_transmission_uncoated_and_coated_known_answer():
    """Normal-incidence slab of n=1.5 has uncoated T = (1 - 0.04)^2 = 0.9216, coated T = (1 - R)^2."""
    d = _make_plate(1.5, 10.0)
    L = design.to_lens(d)
    uncoated = limits.transmission(L, d, field=0.0, coated_R=None, N=32)
    r0 = ((1.5 - 1.0) / (1.5 + 1.0)) ** 2  # exactly 0.04
    assert abs(r0 - 0.04) < 1e-15
    assert abs(uncoated["fresnel"] - (1.0 - r0) ** 2) < 1e-12
    assert uncoated["absorption"] == pytest.approx(1.0, abs=1e-15)

    coated = limits.transmission(L, d, field=0.0, coated_R=0.005, N=32)
    assert abs(coated["fresnel"] - (1.0 - 0.005) ** 2) < 1e-12
    assert coated["fresnel"] > uncoated["fresnel"]

    # Planted-wrong-control: higher index n=1.7 reduces uncoated transmission below n=1.5
    d_hi = _make_plate(1.7, 10.0)
    uncoated_hi = limits.transmission(design.to_lens(d_hi), d_hi, field=0.0, coated_R=None, N=32)
    assert abs(uncoated_hi["fresnel"] - (1.0 - r0) ** 2) > 0.04


# ---------------------------------------------------------------------------
# 4. Diffraction MTF, cutoff frequency, and aberration-degradation control
# ---------------------------------------------------------------------------

def test_diffraction_mtf_monotonicity_cutoff_and_aberration_control():
    """Stigmatic hyperboloid reaches circular-pupil MTF(0)=1, MTF(>=nuc)=0; aberration strictly degrades MTF."""
    n = glass.index({"nd": 1.5, "vd": 60}, glass.ND)
    d = _make_singlet(None, -50.0, 2.0, {"nd": 1.5, "vd": 60}, semi=5.0, conic=-n * n, bfd=50.0 / (n - 1.0))
    L = design.to_lens(d)
    rs = optics.field_rays(L, 0.0, 128)
    na = float(np.sqrt((optics._real(rs[0]["L"])[rs[0]["live"]] ** 2 + optics._real(rs[0]["M"])[rs[0]["live"]] ** 2).max()))
    nuc = 2.0 * na / (glass.ND * 1e-6)
    freqs = [0.0, 0.2 * nuc, 0.5 * nuc, 0.8 * nuc, 1.05 * nuc]
    ms, mt = optics.mtf(rs, L, freqs, pad=2)
    # MTF(0) == 1 and strictly decreases toward cutoff, zero past cutoff
    assert abs(ms[0] - 1.0) < 1e-6 and abs(mt[0] - 1.0) < 1e-6
    assert ms[0] > ms[1] > ms[2] > ms[3] >= ms[4]
    assert ms[4] < 0.01 and mt[4] < 0.01
    # Known analytical circular-pupil MTF at v = 0.5
    want_half = 2.0 / math.pi * (math.acos(0.5) - 0.5 * math.sqrt(1.0 - 0.25))
    assert abs(ms[2] - want_half) < 0.015

    # Planted-wrong-control: adding spherical wavefront error must drop Strehl and mid-frequency MTF
    L_aberr = L.copy()
    L_aberr.irr[2, 1] = 1.2 * (glass.ND * 1e-6) / 0.5
    rs_bad = optics.field_rays(L_aberr, 0.0, 128)
    ws_clean = optics.wave_stats(rs[0], *optics.centroid(rs[0]), glass.ND, remove_defocus=True)
    ws_bad = optics.wave_stats(rs_bad[0], *optics.centroid(rs_bad[0]), glass.ND, remove_defocus=True)
    ms_bad, _ = optics.mtf(rs_bad, L_aberr, [0.5 * nuc], pad=2)
    assert ws_clean["strehl"] > 0.99
    assert ws_bad["strehl"] < 0.80
    assert ms_bad[0] < ms[2] - 0.05

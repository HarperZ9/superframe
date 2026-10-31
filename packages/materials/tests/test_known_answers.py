# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Known-answer tests. Each asserts a number a physicist could check by hand."""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "build"))

import materials as M  # noqa: E402
from materials import drude, optics, spectral as S  # noqa: E402

GRID = S.GRID


def lch_of(material_id):
    R = M.get(material_id)["optics"]["reflectance_normal"]["value"]
    light = S.illuminant("D65")
    return S.lch(S.xyz_to_lab(S.to_xyz(R, light), S.white_xyz(light)))


# Colour tolerance, stated: CIELAB (D65 white) of the normal-incidence reflectance.
# Silver neutral: chroma C*ab < 3. Gold yellow: hue 70-95 deg, C*ab > 25.
# Copper red-orange: hue 35-60 deg, C*ab > 12, and at least 15 deg redder than gold.
def test_gold_is_yellow():
    L, C, h = lch_of("gold")
    assert 70 <= h <= 95 and C > 25, (L, C, h)


def test_copper_is_reddish_and_redder_than_gold():
    _, C, h = lch_of("copper")
    _, _, h_gold = lch_of("gold")
    assert 35 <= h <= 60 and C > 12, (C, h)
    assert h_gold - h >= 15, (h_gold, h)


def test_silver_is_neutral():
    _, C, _ = lch_of("silver")
    assert C < 3, C


def test_glass_normal_reflectance_is_four_percent():
    assert abs(optics.fresnel(1.5, 1.0) - 0.04) < 1e-12
    assert abs(optics.normal_reflectance(1.5, 0.0) - 0.04) < 1e-12
    R = M.get("bk7")["optics"]["reflectance_normal"]["value"][GRID.index(550)]
    assert 0.040 <= R <= 0.045, R  # n = 1.5185 at 550 nm gives 0.0424


def test_fresnel_limits_and_brewster():
    assert optics.fresnel(complex(0.2, 3.5), 1e-9) > 0.999  # grazing incidence reflects all
    n = 1.5
    tb = math.atan(n)  # Brewster angle: p-polarised reflectance is zero
    c = math.cos(tb)
    w = math.sqrt(n * n - math.sin(tb) ** 2)
    rp = (n * n * c - w) / (n * n * c + w)
    assert abs(rp) < 1e-12
    rs2 = ((c - w) / (c + w)) ** 2
    assert abs(optics.fresnel(n, c) - rs2 / 2) < 1e-12


def test_sellmeier_bk7_d_line():
    import ri_parse
    text = "DATA:\n  - type: formula 2\n    wavelength_range: 0.3 2.5\n    coefficients: 0 1.03961212 0.00600069867 0.231792344 0.0200179144 1.01046945 103.560653\n"
    n = ri_parse.evaluate(text, [587.56])["n"][0]
    assert abs(n - 1.5168) < 1e-4, n  # SCHOTT N-BK7 catalogue n_d = 1.51680


def test_drude_k_rises_with_conductivity():
    n_e = drude.electron_density(10490, 0.10787, 1)  # silver-like electron gas
    for wl in (450, 550, 700, 1550, 100_000):
        ks = [drude.nk(wl, s, n_e)[1] for s in (1e4, 1e5, 1e6, 1e7, 6.3e7, 1e8)]
        assert all(b > a for a, b in zip(ks, ks[1:])), (wl, ks)
    # Hagen-Rubens limit at 100 um for a poor conductor (w tau << 1)
    k_hr = drude.hagen_rubens_k(100_000, 1e5)
    k_full = drude.nk(100_000, 1e5, n_e)[1]
    assert abs(k_full - k_hr) / k_hr < 0.01, (k_full, k_hr)


def test_drude_matches_silver_in_the_red():
    rec = M.get("silver")
    d = rec["electromagnetic"]["drude"]["value"]
    for wl in ("650", "750"):
        assert abs(d["k_drude"][wl] - d["k_measured"][wl]) / d["k_measured"][wl] < 0.25, d


def test_water_reference_values():
    w = M.get("water")
    # NIST WebBook (IAPWS-95) at 298.15 K, 0.101325 MPa: 997.048 kg/m^3, cp 4181.31 J/(kg K)
    assert abs(w["thermal"]["density"]["value"] - 997.048) / 997.048 < 0.005
    assert abs(w["thermal"]["specific_heat"]["value"] - 4181.31) / 4181.31 < 0.01
    # IAPWS R9-97 at 25 C, 589 nm: n = 1.3325; physicallybased.info lists 1.3325
    n590 = w["optics"]["n"]["value"][GRID.index(590)]
    assert abs(n590 - 1.3325) < 0.002, n590


def test_every_record_validates():
    lib = M.library()
    errors = {r["id"]: M.schema.validate(r, len(lib["grid_nm"])) for r in lib["materials"]}
    bad = {k: v for k, v in errors.items() if v}
    assert not bad, bad
    assert len(lib["materials"]) >= 60


def test_sources_have_hashes_and_open_licences():
    src = json.loads((ROOT / "data" / "sources.json").read_text(encoding="utf-8"))
    for row in src["files"]:
        assert len(row["sha256"]) == 64 and row["licence"] != "unknown", row
        if row["shipped"]:
            assert row["licence"].startswith(("CC0", "CC-BY-4.0", "CC-BY-SA", "US-Government")), row


def test_brdf_reciprocity():
    rec = M.get("copper")
    flat = [1.0] * len(GRID)
    a = optics.shade(rec, flat, 30, roughness=0.3, theta_light_deg=60)
    b = optics.shade(rec, flat, 60, roughness=0.3, theta_light_deg=30)
    ca, cb = math.cos(math.radians(60)), math.cos(math.radians(30))
    for x, y in zip(a, b):
        assert abs(x / ca - y / cb) < 1e-9


def test_negative_controls_fail():
    """Check the checks: corrupted inputs must trip the validators and colour tests."""
    import copy
    rec = copy.deepcopy(M.get("gold"))
    rec["thermal"]["density"]["unit"] = "g/cm^3"
    rec["optics"]["n"]["value"] = rec["optics"]["n"]["value"][:-1]
    del rec["surface"]["water_contact_angle"]
    errs = M.schema.validate(rec, len(GRID))
    assert any("unit" in e for e in errs) and any("spectral" in e for e in errs) and any("absent" in e for e in errs)
    # A grey reflector (silver's spectrum) must fail the gold hue window.
    R = M.get("silver")["optics"]["reflectance_normal"]["value"]
    light = S.illuminant("D65")
    _, C, h = S.lch(S.xyz_to_lab(S.to_xyz(R, light), S.white_xyz(light)))
    assert not (70 <= h <= 95 and C > 25)


def _edge_nm(R):
    """Half-height wavelength of the rise between 450 and 650 nm (gold's yellow edge)."""
    lo, hi = R[GRID.index(450)], R[GRID.index(650)]
    mid = (lo + hi) / 2
    for i in range(GRID.index(450), GRID.index(650)):
        if R[i] <= mid < R[i + 1]:
            return GRID[i] + 5 * (mid - R[i]) / (R[i + 1] - R[i])
    return None


def _R_model(params):
    return [optics.normal_reflectance(*drude.lorentz_drude_nk(w, params)) for w in GRID]


# Tolerance, stated: the Drude-Lorentz edge lies within 5 nm of the measured edge (527.9 nm from
# Johnson and Christy), and |R_model - R_measured| <= 0.03 at every grid point from 450 to 650 nm.
def test_drude_lorentz_gold_reflectance_edge():
    rec = M.get("gold")
    R_meas = rec["optics"]["reflectance_normal"]["value"]
    R_dl = _R_model(rec["electromagnetic"]["drude_lorentz"]["value"])
    e_meas, e_dl = _edge_nm(R_meas), _edge_nm(R_dl)
    assert 500 <= e_meas <= 540, e_meas
    assert abs(e_dl - e_meas) <= 5, (e_dl, e_meas)
    worst = max(abs(a - b) for a, b, w in zip(R_dl, R_meas, GRID) if 450 <= w <= 650)
    assert worst <= 0.03, worst


def test_pure_drude_misses_the_gold_edge():
    """Negative control: the best-fit pure Drude model must fail the same edge test."""
    fits = json.loads((ROOT / "data" / "drude_lorentz.json").read_text(encoding="utf-8"))
    R_meas = M.get("gold")["optics"]["reflectance_normal"]["value"]
    R_d = _R_model(fits["metals"]["gold"]["drude_fit"])
    worst = max(abs(a - b) for a, b, w in zip(R_d, R_meas, GRID) if 450 <= w <= 650)
    e = _edge_nm(R_d)
    assert worst > 0.03 or e is None or abs(e - _edge_nm(R_meas)) > 5, (worst, e)


def test_drude_lorentz_beats_drude_on_seven_metals():
    fits = json.loads((ROOT / "data" / "drude_lorentz.json").read_text(encoding="utf-8"))["metals"]
    assert {"gold", "copper", "silver", "aluminium", "nickel", "platinum", "iron"} <= set(fits)
    for mid, m in fits.items():
        e = m["errors"]
        assert e["drude_lorentz"]["k_rms_rel"] <= e["drude_fit"]["k_rms_rel"], mid
        assert e["drude_lorentz"]["k_max_rel_vis"] < 0.05, (mid, e["drude_lorentz"])
    for mid in ("gold", "copper"):  # the study's finding: DC-fed Drude overshoots k by 40-80% here
        assert fits[mid]["errors"]["drude_dc"]["k_max_rel_vis"] > 0.4, mid


def test_literature_fields_carry_doi_and_open_licence():
    n = 0
    for r in M.all_materials():
        ca = r["surface"]["water_contact_angle"]
        if ca:
            n += 1
            assert ca["source"].startswith("doi:10.") and ca["licence"] == "CC-BY-4.0", ca
            assert 0 <= ca["value"] <= 180 and ca["unit"] == "deg", ca
        for g, k in (("surface", "surface_tension"), ("mechanical", "viscosity")):
            f = r[g][k]
            if f and f["source"].startswith("pubchem-hsdb"):
                assert f["licence"].startswith("US-Government") and f.get("as_read"), f
    assert n >= 20, n

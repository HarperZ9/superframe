# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Known-answer tests for the measured-data package. Each asserts a number printed in the source
or recomputable by hand, plus controls that a wrong reading must fail. Run: python -B -m pytest tests"""
import json
import math
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from measured import PrivateTable, field, load, p22, private_dir, rayleigh, tungsten, wet  # noqa: E402


def private(fn, *args):
    """Load a private table or field, or skip with the loader's reason when it is absent from this tree."""
    try:
        return fn(*args)
    except PrivateTable as e:
        pytest.skip(str(e))

STATUSES = {"measured", "derived", "fitted", "from_memory", "defined", "missing"}


def test_every_table_carries_provenance():
    tables = [p for p in (ROOT / "data").glob("*.json") if p.name != "PRIVATE.json"]
    tables += [p for p in private_dir().glob("*.json") if not p.name.endswith(".private.json")]
    for p in tables:
        d = json.loads(p.read_text(encoding="utf-8"))
        prov = d["provenance"]
        for h in prov.get("files", {}).values():
            assert re.fullmatch(r"[0-9a-f]{64}", h), p.name
        for r in d.get("rows", []) if isinstance(d.get("rows"), list) else []:
            st = r.get("status", prov.get("status"))
            assert st in STATUSES, (p.name, r)
            if "sha256" in r:
                assert re.fullmatch(r"[0-9a-f]{64}", r["sha256"]), (p.name, r["id"])


def test_tungsten_desai():
    assert tungsten.rho(293) == 5.28 and tungsten.rho(300) == 5.44  # Table 5 rows
    assert abs(tungsten.ratio(1000) - 4.565) < 0.002
    assert abs(tungsten.temperature(tungsten.ratio(1000)) - 1000) < 0.01
    assert 4.2e-3 < tungsten.alpha(296) < 4.4e-3  # the old 4.5e-3 sits outside
    assert abs(tungsten.exponent(296, 1000) - 1.25) < 0.01
    assert abs(tungsten.exponent(300, 3000) - 1.23) < 0.01
    # control: the linear law with alpha = 4.5e-3 misreads a 1000 K filament by more than 80 K
    assert 296 + (tungsten.ratio(1000) - 1) / 4.5e-3 - 1000 > 80


def test_rayleigh_bodhaine():
    assert abs(rayleigh.sigma_cm2(0.55) / 4.5105e-27 - 1) < 1e-4  # Table 3
    assert abs(rayleigh.sigma_cm2(0.25) / 1.2610e-25 - 1) < 1e-4
    assert abs(rayleigh.king(0.25) - 1.06308) < 1e-5
    assert abs(rayleigh.beta_per_m(0.55) - 1.149e-5) < 0.001e-5
    ratio = rayleigh.beta_per_m(0.45) / rayleigh.beta_per_m(0.65)
    assert ratio > (650 / 450) ** 4 * 1.03  # dispersion and King factor steepen lambda^-4
    assert abs(rayleigh.koschmieder(1.0) - 3.912) < 1e-3 and abs(rayleigh.koschmieder(1.0, 0.05) - 2.996) < 1e-3
    d = load("rayleigh_bodhaine1999")
    assert d["check"]["parsed_values_unmatched"] == 0 and d["check"]["rows_matched_within_2e-4"] >= 120


def test_kuhn_p22():
    r, g, b = p22.red(), p22.green(), p22.blue()
    assert abs(1 / (2 * math.pi * 360) - 0.442e-3) < 1e-6
    assert abs(g.power_only_t_to(0.1) - 39.1e-6) < 0.2e-6 and abs(b.power_only_t_to(0.1) - 34.8e-6) < 0.2e-6
    assert abs(r.F(1e-3) - 0.908) < 0.002
    for law in (r, g, b):
        f = [law.F(t) for t in (1e-7, 1e-5, 1e-3, 1e-1)]
        assert all(0 <= x <= 1 for x in f) and f == sorted(f)
    fig = load("p22_kuhn2002")["fig3_vs_model"]
    assert all(v["max_abs_log10_err"] < 0.01 for v in fig.values())  # figure reproduces the equations


def test_kuhn_control_without_pi_fails_the_figure():
    fig = private(field, "p22_kuhn2002", "fig3_digitised")
    m = load("p22_kuhn2002")["model"]["red"]
    pts = [(q["t_s"], q["I"]) for q in fig["red"] if 1e-5 < q["t_s"] < 1e-3]
    wrong = max(abs(math.log10(v / sum(e["a"] * math.exp(-e["f_hz"] * t) for e in m["exp"]))) for t, v in pts)
    assert wrong > 0.1


def test_wet_lekner_dorf():
    assert abs(wet.p_internal(4 / 3) - 0.475) < 0.001
    assert [round(wet.a_wet(1e-6, n) / 1e-6, 2) for n in (1.5, 2.0, 2.5)] == [1.07, 1.08, 1.10]
    assert abs(wet.rbar(1.0)) < 1e-12
    for dry in (0.3, 0.5, 0.8):
        assert wet.wet_albedo(dry) < dry  # darker when wet above the specular floor


def test_schott():
    g = {r["glass"]: r for r in private(load, "schott_glass")["rows"]}
    assert abs(g["N-BK7"]["vd_from_sellmeier"] - 64.17) < 0.01 and g["N-BK7"]["vd"] == 64.17
    assert g["N-BK7"]["K_stress_optical_1e-6_mm2_per_N"] == 2.76


def test_codata():
    c = {r["quantity"]: r for r in load("codata2022")["rows"]}
    assert c["electron mass"]["value"] == 9.1093837139e-31
    assert c["vacuum electric permittivity"]["value"] == 8.8541878188e-12
    assert c["Boltzmann constant"]["exact"]


def test_kodak_2383():
    assert load("kodak_2383")["base"]["thickness_um"] == 120
    assert "H-1-2383" in load("kodak_2383")["provenance"]["citation"]


def test_kodak_5219():
    k = private(load, "kodak_5219")
    gr = k["granularity"]
    assert max(gr["axis_fit"].values()) < 0.01
    assert abs(gr["at_net_density_1"]["G"]["sigmaD"] - 0.0071) < 0.0005
    s = k["spectral_sensitivity"]["summary"]
    assert 530 < s["magenta_forming_green_sensitive"]["peak_nm"] < 560
    assert k["mtf"]["freq_at_50pct_cyc_per_mm"]["B"] < k["mtf"]["freq_at_50pct_cyc_per_mm"]["R"]


def test_lwir():
    r = {x["material"]: x for x in load("lwir_emissivity_rii")["rows"]}
    assert all(r[m]["emissivity_normal_10um"] < 0.05 for m in ("tungsten", "copper", "aluminium"))
    assert r["soda_lime_glass"]["emissivity_normal_10um"] > 0.7 and r["pmma"]["emissivity_normal_10um"] > 0.9
    s = load("lwir_emissivity_slum")["rows"]
    assert len(s) == 74 and sum(1 for x in s if x["class"] == "PVC roofing sheet") == 6


def test_rain_against_marshall_palmer():
    d = load("rain_gid_vs_marshall_palmer")
    assert sum(r["minutes"] for r in d["rows"]) > 500000
    assert -0.3 < d["fit_Lambda_vs_R"]["Lambda_b"] < -0.15
    assert all(r["N0_median_m3_mm"] < 8000 for r in d["rows"])  # measured N0 sits below Marshall-Palmer's


def test_facts_and_merl():
    f = {r["id"]: r for r in load("facts")["rows"]}
    assert f["cs.clock_zeeman"]["value"] == 427.45 and f["mp1948.N0"]["value"] == 8000.0
    assert all(r.get("citation") for r in f.values())
    m = load("merl_ggx_fit")["rows"]
    assert len(m) == 100 and all(0 < r["alpha"] <= 1 for r in m)
    assert load("cie_check")["cmf_5nm_vs_1nm_max_abs_err"] == 0.0


def test_egan_hilgeman_fdr_matches_the_exact_integral():
    """packages/materials optics.py diffuse Fresnel fit against Stern's closed form (internal: 1 - (1 - Rbar)/n^2)."""
    for n in (1.2, 1.3, 1.4, 1.5, 1.6):
        fit = -1.440 / n ** 2 + 0.710 / n + 0.668 + 0.0636 * n
        assert abs(fit - (1 - (1 - wet.rbar(n)) / n ** 2)) < 1e-3

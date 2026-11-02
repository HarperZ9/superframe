# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Shop-side rules: glass catalogue, process limits, tolerance tiers, cement, moulded parts, test plates. Origins as in rules.SOURCES."""
import numpy as np

from . import design, glass
from .rules import DT_MATERIALS, PROCESSES, TIERS, bfs_departure_um, row


def glass_rules(d):
    out, cat = [], glass.catalog()
    for i, x in enumerate(d["surfaces"]):
        m = x.get("material")
        if m in (None, "air"):
            continue
        if isinstance(m, dict):
            nd, vd = m.get("nd"), m.get("vd")
            if m.get("class") == "polymer" and nd is not None and (nd > 1.72 or (vd or 99) < 18):
                out.append(row("polymer_range", "BLOCK", f"S{i+1}", f"polymer with nd {nd}, vd {vd} is outside known optical polymers by my reading", "RIN", "judgement", nd, 1.72))
            if nd is None or vd is None or not 1.3 <= nd <= 2.3 or not 15 <= vd <= 100:
                out.append(row("model_glass_range", "BLOCK", f"S{i+1}", f"nd {nd}, vd {vd} lies outside any optical glass I can find", "RIN", "judgement", nd, None))
                continue
            best = min((abs(r["nd"] - nd) / 0.002 + abs(r["vd"] - vd) / 0.5 for r in cat.values() if r.get("nd") and r.get("vd")), default=1e9)
            if best > 3:
                out.append(row("no_catalog_match", "FLAG", f"S{i+1}", f"no catalogue glass within 0.006 in nd or 1.5 in vd of ({nd}, {vd}); a melt would be needed", "RIN", "judgement", best, 3))
            continue
        row_ = cat.get(m)
        if row_ is None:
            out.append(row("glass_unknown", "BLOCK", f"S{i+1}", f"glass {m} is in no catalogue this tool holds", "RIN", "sourced", m, None))
            continue
        status = row_.get("comment", "").lower()
        if "obsolete" in status or "discontinu" in status or "inquiry" in status:
            out.append(row("glass_status", "FLAG", f"S{i+1}", f"glass {m}: catalogue note {row_['comment']!r}", "RIN", "sourced", row_["comment"], None))
        lo, hi = row_["range_um"]
        for nm in d["intent"]["wavelengths_nm"]:
            if not lo <= nm * 1e-3 <= hi:
                out.append(row("glass_range", "BLOCK", f"S{i+1}", f"{nm} nm outside {m}'s stated range", "RIN", "sourced", nm, [lo, hi]))
    return out


def process_rules(d):
    out = []
    dflt = d["intent"].get("process", "conventional_polish")
    for i, x in enumerate(d["surfaces"]):
        p = x.get("process", dflt)
        where = f"S{i+1}"
        aspheric = bool(x.get("aspheric")) or bool(x.get("conic"))
        m = x.get("material") if x.get("material") not in (None, "air") else (d["surfaces"][i - 1].get("material") if i else None)
        raw = m
        m = m if isinstance(m, str) else "model glass" if m else None
        dia = 2 * x["semi"]
        if p not in PROCESSES:
            out.append(row("process_unknown", "BLOCK", where, f"process {p} not known", "ME", "sourced", p, None))
            continue
        if x.get("stop") and m is None:
            continue
        if p == "conventional_polish" and dia < 2.0 and m is not None:
            out.append(row("polish_small", "FLAG", where, f"conventional polish on a {dia} mm part needs micro-optics handling", "ME", "judgement", dia, 2.0))
        h = x["semi"]
        dep = bfs_departure_um(x, h)
        if p == "conventional_polish" and aspheric:
            out.append(row("process_asphere", "BLOCK", where, "pitch or pad polishing makes spheres and planes; this surface is aspheric", "KU", "judgement", dep, 0))
        if p == "mrf_cnc":
            if dia >= 240:
                out.append(row("mrf_size", "BLOCK", where, f"diameter {dia} mm against MRF limit under 240", "KU", "sourced", dia, 240))
            if dia <= 10:
                out.append(row("mrf_small", "FLAG", where, f"diameter {dia} under twice the 4-5 mm lap footprint", "KU", "sourced", dia, 10))
            thick = max(x["t"], d["surfaces"][i - 1]["t"] if i else 0) if m else 0
            if thick >= 90:
                out.append(row("mrf_thick", "BLOCK", where, f"thickness {thick} against MRF limit under 90", "KU", "sourced", thick, 90))
            if aspheric and dep / max(dia, 1e-6) > 2.0:
                out.append(row("asphere_departure", "FLAG", where, f"{dep:.0f} um departure over {dia} mm is {dep/dia:.2f} um/mm, over Kumler's 2 um/mm", "KU", "sourced", dep / dia, 2.0))
        if p == "diamond_turn" and m is not None:
            cls = raw.get("class") if isinstance(raw, dict) else None
            if m == "model glass" and cls not in ("polymer", "crystal", "metal"):
                out.append(row("diamond_class", "FLAG", where, "diamond turning needs a stated material class; a bare nd and vd cannot show it is not glass", "SH", "judgement", None, None))
            elif m != "model glass" and m.upper() not in DT_MATERIALS and not glass.catalog().get(m, {}).get("crystal"):
                out.append(row("diamond_glass", "BLOCK", where, f"material {m} is a glass, and glass cannot be diamond turned", "SH", "sourced", m, None))
        if p == "moulded_glass":
            if dia > 52:
                out.append(row("mould_size", "BLOCK", where, f"diameter {dia} mm over the largest public moulding figure, 52 mm", "LP", "sourced", dia, 52))
            elif dia > 23:
                out.append(row("mould_size", "FLAG", where, f"diameter {dia} mm over LightPath's other published figure, 23 mm", "LP", "sourced", dia, 23))
            if m and m != "model glass" and not any(t in m.upper() for t in ("VC", "PG", "P-", "MP", "L-", "D-", "K-", "Q-")):
                out.append(row("mould_glass", "FLAG", where, f"glass {m} is not named as a low-Tg mould type; glass transition should be under about 500 C", "EOM", "judgement", m, 500))
        if p == "metalens":
            ar = x.get("meta", {}).get("aspect_ratio")
            feat = x.get("meta", {}).get("min_feature_nm")
            wl = d["intent"]["wavelengths_nm"]
            if i == 0 or "meta" in x:
                if (max(wl) - min(wl)) / np.mean(wl) > 0.1:
                    out.append(row("meta_broadband", "FLAG", where, f"a diffractive metalens across {min(wl)} to {max(wl)} nm has chromatic focal shift near f times the wavelength span; this tool has no phase model to check it", "ME", "judgement", max(wl) - min(wl), None))
            if (ar is None or feat is None) and not any("meta" in q for q in d["surfaces"]):
                out.append(row("meta_undefined", "BLOCK", where, "a metalens must state aspect_ratio and min_feature_nm on its surface", "ME", "sourced", None, None))
            elif ar is not None and feat is not None:
                if ar > 20:
                    out.append(row("meta_aspect", "BLOCK", where, f"pillar aspect ratio {ar}:1 over the 20:1 dielectric reports", "META", "sourced", ar, 20))
                elif ar > 15:
                    out.append(row("meta_aspect", "FLAG", where, f"pillar aspect ratio {ar}:1 over TiO2 free-standing 15:1", "META", "sourced", ar, 15))
                if feat < 100:
                    out.append(row("meta_feature", "FLAG", where, f"feature {feat} nm under my 100 nm DUV working line; no source I read states a limit", "ME", "judgement", feat, 100))
    return out


def tolerance_rules(d):
    out = []
    for i, x in enumerate(d["surfaces"]):
        t = design.tolerances(d, i)
        where = f"S{i+1}"
        solid = x.get("material") not in (None, "air")
        limit = TIERS["ct_mm"][2]
        if solid and t["ct_mm"] < limit:
            out.append(row("tol_ct", "BLOCK", where, f"CT tolerance {t['ct_mm']} mm tighter than the tightest published tier {limit}", "AV", "sourced", t["ct_mm"], limit))
        if solid and t["ct_mm"] >= x["t"] > 0:
            out.append(row("tol_ct_exceeds", "BLOCK", where, f"CT tolerance {t['ct_mm']} is as large as the thickness {x['t']}", "ME", "sourced", t["ct_mm"], x["t"]))
        if t["diameter_mm"] < TIERS["diameter_mm"][2]:
            out.append(row("tol_diameter", "BLOCK", where, f"diameter tolerance {t['diameter_mm']} tighter than {TIERS['diameter_mm'][2]}", "AV", "sourced", t["diameter_mm"], TIERS["diameter_mm"][2]))
        if t["irreg_fringes"] < 0.1:
            out.append(row("tol_irregularity", "BLOCK", where, f"irregularity {t['irreg_fringes']} fringes is finer than l/20", "AV", "sourced", t["irreg_fringes"], 0.1))
        if t["irreg_fringes"] > t["power_fringes"] and t["power_fringes"] > 0:
            out.append(row("tol_power_irr", "FLAG", where, "irregularity looser than power reads as a drawing error", "ME", "judgement", t["irreg_fringes"], t["power_fringes"]))
    return out


def cement_rules(d):
    """Cemented pairs with mismatched expansion. Needs CTE from the catalogue; a crystal cemented to glass is flagged regardless."""
    out, cat, s = [], glass.catalog(), d["surfaces"]
    for i in range(len(s) - 1):
        a, b = s[i].get("material"), s[i + 1].get("material")
        if a in (None, "air") or b in (None, "air") or isinstance(a, dict) or isinstance(b, dict):
            continue
        ra, rb = cat.get(a, {}), cat.get(b, {})
        ca, cb = ra.get("cte"), rb.get("cte")
        ca, cb = ca if isinstance(ca, (int, float)) else None, cb if isinstance(cb, (int, float)) else None
        if ra.get("crystal") or rb.get("crystal"):
            out.append(row("cement_crystal", "FLAG", f"S{i+2}", f"{a} cemented to {b}: crystal expansion is far from glass; a stress check is needed", "ME", "judgement"))
        elif ca and cb and abs(ca - cb) > 6e-6:
            out.append(row("cement_cte", "FLAG", f"S{i+2}", f"{a} and {b} differ by {abs(ca - cb) * 1e6:.1f} ppm/K", "RIN", "judgement", abs(ca - cb), 6e-6))
    return out


def moulded_tolerance_rules(d):
    out = []
    for i, x in enumerate(d["surfaces"]):
        p = x.get("process", d["intent"].get("process"))
        if p == "moulded_polymer" and x.get("material") not in (None, "air") and x["t"] > 8.0:
            out.append(row("polymer_thick", "FLAG", f"S{i+1}", f"{x['t']} mm thick moulded polymer risks sink and birefringence; 8 mm is my working line", "ME", "judgement", x["t"], 8.0))
        if p in ("moulded_polymer", "moulded_glass") and x.get("material") not in (None, "air"):
            lim = 0.025 if p == "moulded_glass" else 0.05
            ct = design.tolerances(d, i)["ct_mm"]
            if ct < lim:
                src, ori = ("LP", "sourced") if p == "moulded_glass" else ("ME", "judgement")
                out.append(row("mould_tolerance", "FLAG", f"S{i+1}", f"CT tolerance {ct} tighter than {lim}, the figure used for {p}", src, ori, ct, lim))
    return out


def test_plate_rule(d, plates=None):
    """Radius fit to a shop's test plate list. No public list was found, so with no list this says so and passes nothing."""
    if plates is None:
        return [row("test_plate", "INFO", "all", "test plate fit not checked: no shop list supplied and I found no public one", "ME", "sourced")]
    out, plates = [], np.array(plates, float)
    for i, x in enumerate(d["surfaces"]):
        if x["r"] is None or x.get("aspheric") or x.get("conic"):
            continue
        r = abs(x["r"])
        gap = float(np.min(np.abs(plates - r) / r))
        if gap > 0.001:
            out.append(row("test_plate", "FLAG", f"S{i+1}", f"radius {x['r']} is {gap*100:.2f} percent from the nearest plate; a new plate is likely", "ME", "judgement", gap, 0.001))
    return out

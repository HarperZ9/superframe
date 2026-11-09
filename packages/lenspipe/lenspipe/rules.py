# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Manufacturability rules with their origin. Severity: BLOCK cannot be made as drawn; FLAG costs or risks; INFO a note.

Each limit names where it came from. Origin 'sourced' means a public document stated it (mostly read through a search
summary, see SOURCES). Origin 'judgement' means I chose the number and no source I read gives it. No shop has reviewed
this table. It is a filter for obvious errors, far from a shop's real capability list.
"""
import math

import numpy as np

from . import design, optics
from .trace import paraxial

SOURCES = {
    "EO": "Edmund Optics, Keys to Cost Effective Optical Design and Tolerancing, via search summary (page refused a direct fetch)",
    "AV": "Avantier, Optical Tolerances: Impact and Costs (trade press): CT 200/50/10 um, diameter 100/25/6 um, figure l/4 to l/20",
    "OM": "Optimax tolerance chart description: scope f/1 or slower, cost about +50 percent per tier; chart values not retrieved",
    "KU": "Kumler, Designing and Specifying Aspheres for Manufacturability, via Desroches OPTI 521 synopsis: MRF under 240 mm dia, 90 mm thick, 2 um departure per mm, footprint 4-5 mm via Bryant report",
    "EOM": "Edmund Optics via Photonics: moulding needs glass transition under about 500 C; diamond turning suits crystals, plastics, metals",
    "LP": "LightPath pages: moulded lenses up to 23 mm on one page, 52 mm on another; conflict left open; CT +-0.025 mm, FL +-1 percent",
    "SH": "Shalom EO blog: glass cannot be diamond turned; moulding under 10 mm in its reading, contradicted by LP",
    "META": "Metalens aspect ratio summary, US 11860336 background and press: plasmonic about 5:1, dielectric about 20:1, TiO2 free-standing 15:1",
    "RIN": "refractiveindex.info CC0 catalogue, vendor snapshots mostly 2017 to 2019; comment fields carry vendor status",
    "ME": "this tool: physics or arithmetic, no outside source needed",
}
TIERS = dict(ct_mm=(0.2, 0.05, 0.01), diameter_mm=(0.1, 0.025, 0.006))
PLASTICS = {"PMMA", "POLYCARBONATE", "COC", "COP", "ZEONEX", "E48R", "OKP4"}
DT_MATERIALS = PLASTICS | {"CAF2", "ZNSE", "ZNS", "GERMANIUM", "SI", "AL6061"}
PROCESSES = ("conventional_polish", "mrf_cnc", "diamond_turn", "moulded_glass", "moulded_polymer", "metalens")


def row(rule, sev, where, msg, src, origin="sourced", value=None, limit=None):
    return dict(rule=rule, severity=sev, where=where, message=msg, source=src, origin=origin, value=value, limit=limit)


def sag(s, h):
    r = s["r"]
    c = 0.0 if r is None else 1.0 / r
    k = s.get("conic", 0.0)
    arg = 1 - (1 + k) * c * c * h * h
    if arg <= 0:
        return math.nan
    z = c * h * h / (1 + math.sqrt(arg))
    for j, a in enumerate(s.get("aspheric", [])):
        z += a * h ** (2 * j + 4)
    return z


def slope_deg(s, h):
    e = 1e-4
    a, b = sag(s, h), sag(s, h - e)
    return math.degrees(math.atan(abs(a - b) / e))


def bfs_departure_um(s, h):
    """Peak departure from the sphere through vertex and edge of the clear aperture, micrometres."""
    ze = sag(s, h)
    if not s.get("aspheric") and not s.get("conic"):
        return 0.0
    if not math.isfinite(ze) or ze == 0:
        return float("inf") if not math.isfinite(ze) else 0.0
    rb = (ze * ze + h * h) / (2 * ze)
    worst = 0.0
    for q in np.linspace(0, h, 41):
        sp = rb - math.copysign(math.sqrt(max(rb * rb - q * q, 0)), rb)
        worst = max(worst, abs(sag(s, float(q)) - sp))
    return worst * 1e3


def geometry_rules(d):
    out = []
    s = d["surfaces"]
    for key in d.get("tolerances", {}).get("by_surface", {}):
        if not str(key).isdigit() or int(key) >= len(s):
            out.append(row("tolerance_target", "BLOCK", f"by_surface {key}", f"tolerance names a surface that does not exist; the design has {len(s)}", "ME", "sourced", key, len(s)))
    for i, x in enumerate(s[:-1]):
        y = s[i + 1]
        if y.get("stop") and x.get("material") not in (None, "air") and y.get("material") not in (None, "air"):
            out.append(row("stop_in_glass", "BLOCK", f"S{i+2}", "stop sits on an interface with glass on both sides; no iris can sit there", "ME", "judgement"))
        if x.get("material") in (None, "air") and 0 <= x["t"] < design.tolerances(d, i)["air_mm"] and not x.get("stop") and not y.get("stop"):
            if x["t"] == 0 and x["r"] != y["r"]:
                out.append(row("cement_radii", "BLOCK", f"S{i+1}-S{i+2}", f"zero gap with unequal radii {x['r']} and {y['r']}: they touch at one point, so this is no cemented pair", "ME", "sourced", x["r"], y["r"]))
            elif x["t"] > 0:
                out.append(row("air_tolerance", "FLAG", f"S{i+1}", f"air gap {x['t']} is smaller than its own tolerance {design.tolerances(d, i)['air_mm']}", "ME", "sourced", x["t"], design.tolerances(d, i)["air_mm"]))
    for i, x in enumerate(s):
        if not math.isfinite(sag(x, x["semi"])):
            out.append(row("no_real_sag", "BLOCK", f"S{i+1}", f"surface has no real height at its clear semi-diameter {x['semi']}", "ME", "sourced", x["semi"], None))
        if x["t"] < 0 and i < len(s) - 1:
            out.append(row("negative_thickness", "BLOCK", f"S{i+1}", f"thickness {x['t']} mm is negative", "ME", "sourced", x["t"], 0))
        if x["r"] is not None and x["semi"] >= abs(x["r"]) and not x.get("conic"):
            out.append(row("beyond_hemisphere", "BLOCK", f"S{i+1}", f"semi-diameter {x['semi']} reaches past radius {x['r']}", "ME", "sourced", x["semi"], abs(x["r"])))
    for a, b in design.elements(d):
        for j in range(a, b):
            f, g, solid = s[j], s[j + 1], s[j]
            semi = max(f["semi"], g["semi"])
            ct = f["t"]
            sa, sb = sag(f, min(semi, f["semi"])), sag(g, min(semi, g["semi"]))
            if not (math.isfinite(sa) and math.isfinite(sb)):
                continue
            et = ct - sa + sb
            where = f"S{j+1}-S{j+2}"
            ratio = 2 * semi / ct if ct > 0 else float("inf")
            if et <= 0:
                out.append(row("edge_thickness", "BLOCK", where, f"edge thickness {et:.3f} mm: surfaces cross inside the part", "ME", "sourced", et, 0))
            elif et < min(1.0, 0.05 * 2 * semi + 0.2):
                out.append(row("edge_thickness", "FLAG", where, f"edge thickness {et:.3f} mm is thin for a {2*semi:.1f} mm part; 1 mm example minimum scaled down for small parts by my judgement", "EO", "judgement", et, 1.0))
            if ct < semi / 15 and ct > 0:
                out.append(row("centre_thickness", "FLAG", where, f"centre thickness {ct:.3f} under semi-diameter/15, an example minimum in a published study", "EO", "sourced", ct, semi / 15))
            if ratio > 30:
                out.append(row("aspect_ratio", "BLOCK", where, f"diameter to centre thickness {ratio:.1f}:1", "ME", "judgement", ratio, 30))
            elif ratio > 15:
                out.append(row("aspect_ratio", "FLAG", where, f"diameter to centre thickness {ratio:.1f}:1, cost climbs near 15:1", "EO", "sourced", ratio, 15))
            elif ratio > 10:
                out.append(row("aspect_ratio", "INFO", where, f"diameter to centre thickness {ratio:.1f}:1, over the 10:1 easy range", "EO", "sourced", ratio, 10))
    # air gaps: neighbouring glass surfaces may not touch or cross at the shared height
    for j in range(len(s) - 1):
        if s[j].get("material") in (None, "air") and j + 1 < len(s) and s[j]["t"] >= 0:
            h = min(s[j]["semi"], s[j + 1]["semi"])
            a, b = sag(s[j], h), sag(s[j + 1], h)
            if math.isfinite(a) and math.isfinite(b):
                gap = s[j]["t"] - a + b
                if gap < 0:
                    out.append(row("air_gap_cross", "BLOCK", f"S{j+1}-S{j+2}", f"air gap at height {h} is {gap:.3f} mm: parts collide", "ME", "sourced", gap, 0))
    return out


def intent_rules(d, lens=None):
    out = []
    it = d["intent"]
    lens = lens or design.to_lens(d)
    efl, _ = paraxial(lens)
    efl = float(np.real(efl))
    if "efl" in it:
        tol = it.get("efl_tol_pct", 1.0)
        err = 100 * abs(efl - it["efl"]) / abs(it["efl"])
        if err > tol:
            out.append(row("intent_efl", "BLOCK", "system", f"EFL {efl:.3f} against intent {it['efl']}, {err:.2f} percent off, limit {tol}", "ME", "sourced", efl, it["efl"]))
    bfd = float(np.real(paraxial(lens)[1]))
    gap = d["surfaces"][-1]["t"] - bfd
    try:
        # A fast lens may rightly sit at real best focus, away from paraxial focus. Measure from the nearer of the two.
        for flds in ((0.0,), tuple(it["half_field_deg"])):
            real = optics.best_focus(lens, flds, N=24)
            if np.isfinite(real) and abs(real) < abs(gap):
                gap = real
    except (ValueError, ZeroDivisionError):
        pass
    dof = 4 * lens.wl[lens.primary] * 1e-6 * it["fno"] ** 2
    if abs(gap) > max(0.01 * abs(efl), 100 * dof):
        out.append(row("focus_position", "BLOCK", "image", f"image plane {gap:+.3f} mm from paraxial focus; depth of focus is about {dof*1e3:.1f} um", "ME", "sourced", gap, 0))
    elif abs(gap) > max(0.002 * abs(efl), 20 * dof):
        out.append(row("focus_position", "FLAG", "image", f"image plane {gap:+.3f} mm from paraxial focus", "ME", "judgement", gap, 0))
    if len(lens.wl) >= 2:
        i_lo, i_hi = int(np.argmin(lens.wl)), int(np.argmax(lens.wl))
        shift = abs(float(np.real(paraxial(lens, i_lo)[1] - paraxial(lens, i_hi)[1])))
        if shift > abs(efl) / 60 and (max(lens.wl) - min(lens.wl)) > 100:
            out.append(row("chromatic", "FLAG", "system", f"focus moves {shift:.3f} mm across the band, worse than a crown singlet of this focal length at about f/60", "ME", "judgement", shift, abs(efl) / 60))
    r0 = optics.field_rays(lens, 0.0, 48)[lens.primary]
    if r0["live"].sum() < 8:
        return out + [row("no_rays", "BLOCK", "system", "no ray reaches the image on axis", "ME", "sourced", 0, None)]
    ep = 2 * float(np.real(r0["gx"][r0["live"]].max()))
    fno = efl / ep
    if fno > it["fno"] * 1.1:
        out.append(row("intent_fno", "BLOCK", "system", f"real stop gives f/{fno:.2f}, intent f/{it['fno']}", "ME", "sourced", fno, it["fno"]))
    if fno < it["fno"] / 1.3:
        out.append(row("intent_fno_fast", "FLAG", "system", f"stop gives f/{fno:.2f}, faster than intent f/{it['fno']}; stop is oversized", "ME", "judgement", fno, it["fno"]))
    for f in it["half_field_deg"]:
        r = optics.field_rays(lens, f, 48)[lens.primary]
        frac = r["live"].sum() / max(r0["live"].sum(), 1)
        if frac < 0.15:
            out.append(row("field_vignette", "BLOCK", f"{f} deg", f"only {frac*100:.0f} percent of the axial bundle passes", "ME", "judgement", frac, 0.15))
        bad = (~r["ok"] & r["clip"]).sum()
        if bad and r["ok"][r["clip"]].mean() < 0.98:
            out.append(row("ray_failure", "FLAG", f"{f} deg", f"{bad} unclipped rays fail or reflect internally", "ME", "sourced", int(bad), 0))
    return out


def check(d, plates=None):
    """All rules on one design. Returns rows, and a verdict string naming the first thing to change."""
    from .rules_shop import aperture_rules, cement_rules, glass_rules, moulded_tolerance_rules, process_rules, test_plate_rule, tolerance_rules
    rows = geometry_rules(d) + aperture_rules(d) + glass_rules(d) + process_rules(d) + tolerance_rules(d) + cement_rules(d) + moulded_tolerance_rules(d) + test_plate_rule(d, plates)
    blocking_glass = any(r["rule"] == "glass_unknown" for r in rows)
    if not blocking_glass:
        try:
            rows += intent_rules(d)
        except (KeyError, ValueError, FloatingPointError) as e:
            rows.append(row("trace_error", "BLOCK", "system", f"trace failed: {e}", "ME", "sourced"))
    return rows


def blockers(rows):
    return [r for r in rows if r["severity"] == "BLOCK"]


def flags(rows):
    return [r for r in rows if r["severity"] == "FLAG"]

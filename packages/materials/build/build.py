# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Build data/materials.json, data/sources.json and the simulator export.

Run: python -I build/build.py <study_folder>
<study_folder> holds ri_manifest.json and downloads/ (see the study notes).
"""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT))

import add_lit  # noqa: E402
import assemble as A  # noqa: E402
import constants as C  # noqa: E402
import ri_parse  # noqa: E402
import wd_values  # noqa: E402
from picks import MATERIALS  # noqa: E402

GRID = A.GRID
WD_MAP = [("P2054", "thermal", "density", "kg/m^3"), ("P2056", "thermal", "specific_heat", "J/(kg K)"),
          ("P2068", "thermal", "thermal_conductivity", "W/(m K)"), ("P2101", "thermal", "melting_point", "K"),
          ("P2102", "thermal", "boiling_point", "K"), ("P2055", "electromagnetic", "electrical_conductivity", "S/m"),
          ("P5675", "electromagnetic", "relative_permittivity", "1"), ("P5480", "mechanical", "youngs_modulus", "Pa"),
          ("P5593", "mechanical", "poisson_ratio", "1"), ("P3070", "mechanical", "viscosity", "Pa s"),
          ("P3013", "surface", "surface_tension", "N/m")]


def empty(mid, name, cls):
    phase = C.PHASE_OVERRIDE.get(mid, C.PHASE.get(cls, "solid"))
    return {
        "id": mid, "name": name, "class": cls, "phase": phase,
        "optics": {"conductor": cls == "metal", "n": None, "k": None, "scattering": None, "roughness": None},
        "electromagnetic": {"electrical_conductivity": None, "relative_permittivity": None},
        "thermal": {"density": None, "specific_heat": None, "thermal_conductivity": None,
                    "melting_point": None, "boiling_point": None},
        "mechanical": {"youngs_modulus": None, "poisson_ratio": None, "viscosity": None},
        "surface": {"surface_tension": None, "water_contact_angle": None},
        "render": {"layer_m": C.LAYER_OVERRIDE_M.get(mid, C.LAYER_M[cls])},
        "provenance": [],
    }


def add_ri(rec, man, study):
    path = study / "downloads" / "ri" / rec["id"] / Path(man["data_path"]).name
    ev = ri_parse.evaluate(path.read_text(encoding="utf-8"), GRID)
    src = f"refractiveindex.info:{man['book']}/{man['page']}"
    rec["optics"]["n"] = A.spectral_field(ev["n"], ev["n_extrapolated"], src, man["page_name"])
    if any(v is not None for v in ev["k"]):
        rec["optics"]["k"] = A.spectral_field(ev["k"], ev["k_extrapolated"], src, man["page_name"])
    rec["optics"]["reference"] = " ".join(ev["references"].split())[:400]
    rec["provenance"].append(src)


def add_wd(rec, qids, wd):
    for prop, group, key, unit in WD_MAP:
        for q in qids:
            ch = wd_values.choose(wd.get(q, {}).get(prop, []), rec["phase"], prop, rec["class"], q)
            if ch:
                rec[group][key] = A.field(A.sig(ch["value"]), unit, f"wikidata:{q}#{prop}", ch["confidence"],
                                          candidates=ch["candidates"], tier_spread=ch["tier_spread"],
                                          temperature_K=ch["temperature_K"], references=ch["references"] or None)
                break
    em = rec["electromagnetic"]
    if em["electrical_conductivity"] is None:
        for q in qids:
            ch = wd_values.choose(wd.get(q, {}).get("P5679", []), rec["phase"], "P5679", rec["class"], q)
            if ch and ch["value"] > 0:
                em["electrical_conductivity"] = A.field(A.sig(1 / ch["value"]), "S/m", f"wikidata:{q}#P5679",
                                                        ch["confidence"], note="derived as 1/resistivity")
                break
    rec["provenance"] += [f"wikidata:{q}" for q in qids]


def ideal_gas_density(rec):
    """Check gas densities against pM/(RT); replace a value that disagrees by more than 3%."""
    M_ = C.GAS_MOLAR_MASS.get(rec["id"])
    if not M_:
        return
    R, P = 8.314462618, 101325.0
    ideal = {T: P * M_ / (R * T) for T in (273.15, 293.15)}
    cur = rec["thermal"]["density"]
    if cur and any(abs(cur["value"] - d) / d <= 0.03 for d in ideal.values()):
        cur["corroborated_by"] = "ideal gas law pM/(RT) within 3%"
        return
    if cur:
        wd_values.REJECTED.append({"qid": cur["source"], "prop": "P2054", "value": cur["value"], "phase": "gas",
                                   "bounds": "ideal gas at 273-293 K, 101.325 kPa, +/-3%", "statement": None})
    rec["thermal"]["density"] = A.field(A.sig(ideal[273.15]), "kg/m^3", "derived:ideal gas law pM/(RT)", "moderate",
                                        temperature_K=[273.15], note="101.325 kPa; real-gas deviation under about 2%")


def add_pb(rec, pb):
    src = f"physicallybased.info:{pb['name']}"
    rec["provenance"].append(src)
    if pb.get("roughness") is not None:
        rec["optics"]["roughness"] = A.field(pb["roughness"], "1 (GGX-style, 0 smooth to 1 rough)", src, "low",
                                             note="one reference finish; real finishes vary")
    vc = pb.get("volumeCoefficients") or {}
    if vc.get("anisotropy"):
        g = vc["anisotropy"][0]["color"]
        rec["optics"]["scattering"] = {"anisotropy_g": A.field(round(sum(g) / 3, 4), "1", src, "moderate",
                                                               note="mean of the RGB-channel values")}
    th, me, su = rec["thermal"], rec["mechanical"], rec["surface"]
    if th["density"] is not None and pb.get("density"):
        v, _rng = A.pb_typical(pb["density"])
        if abs(v - th["density"]["value"]) <= 0.02 * v and th["density"]["confidence"] == "low":
            th["density"]["confidence"] = "moderate"
            th["density"]["corroborated_by"] = f"{src} ({v:g} kg/m^3, within 2%)"
    if th["density"] is None and pb.get("density"):
        v, rng = A.pb_typical(pb["density"])
        th["density"] = A.field(v, "kg/m^3", src, "moderate", range=rng)
    if me["viscosity"] is None and pb.get("viscosity"):
        v, rng = A.pb_typical(pb["viscosity"])
        me["viscosity"] = A.field(A.sig(v / 1000), "Pa s", src, "moderate", temperature_K=[293.15],
                                  range=[r / 1000 for r in rng] if rng else None)
    if su["surface_tension"] is None and pb.get("surfaceTension"):
        su["surface_tension"] = A.field(pb["surfaceTension"] / 1000, "N/m", src, "moderate", temperature_K=[293.15])
    if rec["optics"]["n"] is None:
        col = next((c["color"] for c in pb.get("color", []) if c["colorSpace"] == "srgb-linear"), None)
        if col:
            from materials import spectral
            rec["optics"]["srgb_preview"] = A.field([round(c, 4) for c in spectral.encode_srgb(col)],
                                                    "sRGB encoded", src, "low",
                                                    method="physicallybased sRGB-linear albedo; RGB only, not spectral")
        if pb.get("ior"):
            rec["optics"]["ior_single"] = A.field(pb["ior"], "1", src, "low", note="one value, no dispersion")


def add_wood(rec):
    sg, moe, nu, kth, ref = C.WOOD[rec["id"]]
    src = f"{C.WOOD_SRC}:{ref}"
    th = rec["thermal"]
    green = rec["id"] == "wood_balsa"
    th["density"] = A.field(A.sig(sg * 1000 * (1.0 if green else 1.12)), "kg/m^3", src, "moderate",
                            note="specific gravity x 1000 kg/m^3 x (1 + 0.12) at 12% moisture"
                            if not green else "green-volume specific gravity x 1000; 12% value not tabulated")
    th["specific_heat"] = A.field(A.sig(C.wood_cp_dry()), "J/(kg K)", f"{C.WOOD_SRC}:Eq. 4-18a",
                                  "moderate", note="dry wood at 298 K; moisture raises it", temperature_K=[298.15])
    if kth:
        th["thermal_conductivity"] = A.field(kth, "W/(m K)", src, "moderate", note="across the grain, 12% MC; "
                                             "along the grain is about 1.8 times higher")
    rec["mechanical"]["youngs_modulus"] = A.field(moe * 1e6, "Pa", src, "moderate", note="longitudinal, 12% MC")
    if nu:
        rec["mechanical"]["poisson_ratio"] = A.field(nu, "1", src, "moderate", note="mu_LR, 12% MC")
    rec["provenance"].append(src)


def main(study):
    study = Path(study)
    man = json.loads((study / "ri_manifest.json").read_text(encoding="utf-8"))
    pbs = {m["name"]: m for m in json.loads((study / "downloads/pb-materials/materials.json")
                                           .read_text(encoding="utf-8"))["data"]}
    wd = wd_values.load(sorted((study / "downloads/wikidata-3").glob("values_*.json")))
    dl = add_lit.load_drude_lorentz()
    records = []
    for mid, name, cls, ri, pb, wq in MATERIALS:
        rec = empty(mid, name, cls)
        if ri:
            add_ri(rec, man[mid], study)
        if wq:
            add_wd(rec, wq.split("|"), wd)
        if cls == "gas":
            ideal_gas_density(rec)
        if cls == "wood":
            add_wood(rec)
        if pb:
            add_pb(rec, pbs[pb])
        add_lit.add_hsdb(rec)
        add_lit.add_contact_angle(rec)
        A.derived_optics(rec)
        add_lit.add_maxwell_permittivity(rec)
        if mid in C.DRUDE:
            rec["electromagnetic"]["drude"] = A.drude_block(rec, *C.DRUDE[mid])
        add_lit.add_drude_lorentz(rec, dl)
        records.append(rec)
    out = {"schema": "materials/1", "grid_nm": GRID, "licences": {k: v[0] for k, v in C.LICENCES.items()},
           "materials": records}
    (ROOT / "data" / "materials.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    (ROOT / "data" / "rejections.json").write_text(json.dumps(wd_values.REJECTED, indent=1), encoding="utf-8")
    write_sources(study, man)
    import export
    export.write(out, ROOT / "data" / "export")
    print("records", len(records))


def write_sources(study, man):
    files = sorted(p for p in (study / "downloads").rglob("*") if p.is_file())
    rows = []
    for p in files:
        rel = p.relative_to(study / "downloads").as_posix()
        top = rel.split("/")[0]
        lic = {"ri": "CC0-1.0", "ri-catalog": "CC0-1.0", "ri-license": "CC0-1.0", "ri-doc": "CC0-1.0",
               "pb-materials": "CC0-1.0", "pb-lights": "CC0-1.0", "pb-license": "CC0-1.0", "pb-schema": "CC0-1.0",
               "wikidata": "CC0-1.0", "wikidata-2": "CC0-1.0", "wikidata-3": "CC0-1.0", "cie-cmf": "CC-BY-SA-4.0", "cie-d65": "CC-BY-SA-4.0",
               "usda-wood-handbook": "US-Government-work (17 USC 105)", "ri-rakic-ld": "CC0-1.0",
               "pubchem-hsdb": "US-Government-work (17 USC 105)", "crossref-licences": "CC0-1.0",
               "ca-s1-table": "CC-BY-4.0 (transcribed table of doi:10.3390/met12081274)",
               "ri-scripts": "GPL-3.0: read for the Rakic parameters' provenance, not shipped",
               "lic-agpl": "licence text, distributed verbatim", "lic-ccbysa": "licence text, distributed verbatim",
               "lic-cc0": "licence text, distributed verbatim", "lic-ccby": "licence text, distributed verbatim",
               "nist-water": "NIST SRD 69, copyright under the SRD Act: validation only, not shipped"}.get(top, "unknown")
        rows.append({"file": rel, "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "bytes": p.stat().st_size,
                     "licence": lic, "shipped": not top.startswith(("nist", "ri-scripts", "lic-"))})
    pages = {mid: {**m, "file": f"ri/{mid}/{Path(m['data_path']).name}"} for mid, m in man.items()}  # relative, never absolute
    meta = {"retrieved": "2026-10-29", "licence_pages_checked": {k: v[1] for k, v in C.LICENCES.items()},
            "refractiveindex_pages": pages, "files": rows}
    (ROOT / "data" / "sources.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1])

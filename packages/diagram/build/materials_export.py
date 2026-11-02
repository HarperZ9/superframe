# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Copy the material values the diagram engine reads out of packages/materials into data/materials.json.

    python -I build/materials_export.py           write data/materials.json
    python -I build/materials_export.py --check   exit 1 when data/materials.json differs from a fresh export

data/materials.json is generated and kept in the repo so the classic-script pages can inline it.
tests/test_materials_export.py pins it by sha256 to a fresh export and fails on drift.

Nothing here is a new value. Each field is the library's own value with its source and confidence, or a
value derived from one by a stated law. Long-wave infrared emissivity comes first from measured n, k at
10 um (packages/measured data/lwir_emissivity_rii.json, refractiveindex.info release v2026-05-24, 1 - R of a
smooth opaque body); where no measured set covers 10 um, a metal falls back to the Hagen-Rubens limit of
the library's own Drude module. A field neither source holds stays null.
"""
import json
import math
import sys
from pathlib import Path

PACKAGES = Path(__file__).resolve().parents[2]
LIB = PACKAGES / "materials"
sys.path.insert(0, str(LIB))
from materials import drude  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "data" / "materials.json"
LWIR = PACKAGES / "measured" / "data" / "lwir_emissivity_rii.json"
IDS = ["tungsten", "copper", "nickel", "iron", "aluminium", "brass", "stainless_steel", "soda_lime_glass",
       "fused_silica", "pmma", "kapton", "polycarbonate", "air", "argon", "graphite"]
LWIR_NM = 10000.0  # middle of the 8 to 14 um thermal-camera band


def field(rec, sec, name):
    v = (rec.get(sec) or {}).get(name)
    if not isinstance(v, dict) or isinstance(v.get("value"), list) or v.get("value") is None:
        return None
    return {"value": v["value"], "unit": v.get("unit"), "source": v.get("source"), "confidence": v.get("confidence")}


def n590(rec, grid):
    n = ((rec.get("optics") or {}).get("n") or {}).get("value")
    if not isinstance(n, list):
        return None
    i = grid.index(590) if 590 in grid else None
    return None if i is None else {"value": n[i], "unit": "1", "source": rec["optics"]["n"].get("source"), "confidence": rec["optics"]["n"].get("confidence")}


def lwir_emissivity(sigma):
    """Hagen-Rubens: n = k = sqrt(sigma / (2 eps0 w)); emissivity = 1 - R at normal incidence (Kirchhoff, opaque)."""
    k = drude.hagen_rubens_k(LWIR_NM, sigma)
    R = ((k - 1) ** 2 + k * k) / ((k + 1) ** 2 + k * k)
    return 1 - R


def build():
    d = json.loads((LIB / "data" / "materials.json").read_text(encoding="utf-8"))
    grid = d["grid_nm"]
    by = {r["id"]: r for r in d["materials"]}
    meas = json.loads(LWIR.read_text(encoding="utf-8"))
    rii = {r["material"]: r for r in meas["rows"] if r["status"] == "measured"}
    out = {"about": "Values copied from packages/materials (data/materials.json) and packages/measured (LWIR emissivity); null means neither holds a value.",
           "lwir_nm": LWIR_NM, "materials": {}}
    for i in IDS:
        r = by[i]
        sig = field(r, "electromagnetic", "electrical_conductivity")
        dr = (r.get("electromagnetic") or {}).get("drude")
        dr = dr.get("value") if isinstance(dr, dict) and isinstance(dr.get("value"), dict) else dr
        rec = {
            "name": r["name"], "class": r["class"], "phase": r["phase"],
            "sigma": sig, "density": field(r, "thermal", "density"), "specific_heat": field(r, "thermal", "specific_heat"),
            "thermal_conductivity": field(r, "thermal", "thermal_conductivity"), "melting_point": field(r, "thermal", "melting_point"),
            "youngs_modulus": field(r, "mechanical", "youngs_modulus"), "poisson_ratio": field(r, "mechanical", "poisson_ratio"),
            "n590": n590(r, grid),
            "drude": {"n_e": dr["electron_density_per_m3"], "tau_s": dr["collision_time_s"]} if isinstance(dr, dict) and "collision_time_s" in dr else None,
            "srgb": (r.get("optics") or {}).get("srgb_preview"),
            "emissivity_lwir": None,
        }
        m = rii.get(i)
        if m:
            rec["emissivity_lwir"] = {"value": m["emissivity_normal_10um"], "unit": "1", "n": round(m["n_10um"], 5), "k": round(m["k_10um"], 5),
                                      "band_8_14um": m["emissivity_normal_8_14um_planck300"],
                                      "source": "refractiveindex.info v2026-05-24 " + m["rii_record"] + " (measured n, k; 1 - R at normal incidence)",
                                      "sha256": meas["provenance"]["files"]["rii-database-2026-05-24.zip"], "status": "measured",
                                      "confidence": "low" if i == "graphite" else "moderate",
                                      "note": ("polished pyrolytic graphite (Querry); machined or rough graphite reads far higher" if i == "graphite"
                                               else "smooth opaque body at 10 um; oxide and roughness raise a metal's value")}
        elif sig and r["class"] == "metal":
            rec["emissivity_lwir"] = {"value": round(lwir_emissivity(sig["value"]), 5), "unit": "1",
                                      "source": "derived: Hagen-Rubens limit (materials/drude.py) from " + sig["source"],
                                      "confidence": "low", "status": "derived", "note": "polished bulk metal at 10 um; oxide and roughness raise it"}
        out["materials"][i] = rec
    return out


def text(out):
    return json.dumps(out, indent=1)


def main(argv):
    out = build()
    if "--check" in argv:
        same = OUT.exists() and OUT.read_text(encoding="utf-8") == text(out)
        print("data/materials.json", "matches a fresh export" if same else "differs from a fresh export: run without --check")
        return 0 if same else 1
    OUT.write_text(text(out), encoding="utf-8")
    print("wrote", OUT, len(out["materials"]), "materials")
    for i, m in out["materials"].items():
        print(f"  {i:16s} sigma={m['sigma'] and m['sigma']['value']} eps_lwir={m['emissivity_lwir'] and m['emissivity_lwir']['value']} srgb={m['srgb']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Compact export for the brackish-marbling simulator and the law-space page.

materials-export.json: SI scalars a solver needs, plus n, k and normal reflectance
on the 380-780 nm grid, sRGB preview, and the catalogue law ids each property
feeds. Null means unknown; consumers must not substitute defaults silently.
"""
import json
from pathlib import Path

# property -> (law-catalogue ids, law-space ids)
LAWS = {
    "n": (["snell", "fresnel_eq"], ["snell"]),
    "k": (["fresnel_eq", "beer_lambert", "drude"], ["beerlambert"]),
    "electrical_conductivity": (["ohm", "drude", "wiedemann_franz"], ["ohm"]),
    "thermal_conductivity": (["fourier_heat", "wiedemann_franz"], ["fourier"]),
    "youngs_modulus": (["hooke", "speed_of_sound"], ["hooke"]),
    "viscosity": (["navier_stokes", "stokes_flow"], ["navier", "stokes"]),
    "surface_tension": (["young_laplace"], []),
    "density": (["navier_stokes", "speed_of_sound"], ["navier"]),
}

SCALARS = [("thermal", "density"), ("thermal", "specific_heat"), ("thermal", "thermal_conductivity"),
           ("thermal", "melting_point"), ("thermal", "boiling_point"),
           ("electromagnetic", "electrical_conductivity"), ("electromagnetic", "relative_permittivity"),
           ("mechanical", "youngs_modulus"), ("mechanical", "poisson_ratio"), ("mechanical", "viscosity"),
           ("surface", "surface_tension"), ("surface", "water_contact_angle")]


def _v(f):
    return None if f is None else f["value"]


def write(lib, out_dir):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    units = {}
    rows = []
    for r in lib["materials"]:
        row = {"id": r["id"], "name": r["name"], "class": r["class"], "phase": r["phase"],
               "conductor": r["optics"]["conductor"]}
        for group, key in SCALARS:
            f = r[group].get(key)
            row[key] = _v(f)
            if f:
                units[key] = f["unit"]
        o = r["optics"]
        row["n"] = _v(o.get("n"))
        row["k"] = _v(o.get("k"))
        row["reflectance_normal"] = _v(o.get("reflectance_normal"))
        row["srgb_preview"] = _v(o.get("srgb_preview"))
        row["preview_is_spectral"] = bool(o.get("n"))
        dl = _v(r["electromagnetic"].get("drude_lorentz"))
        row["drude_lorentz"] = None if dl is None else {k: dl[k] for k in (
            "eps_inf", "plasma_eV", "gamma_eV", "oscillators", "fit_range_nm")}
        row["laws"] = sorted({law for p, (cat, _ls) in LAWS.items()
                              if row.get(p) is not None for law in cat})
        row["lawspace"] = sorted({law for p, (_cat, ls) in LAWS.items()
                                  if row.get(p) is not None for law in ls})
        rows.append(row)
    doc = {"schema": "materials-export/1", "grid_nm": lib["grid_nm"], "units": units,
           "law_links": {k: {"catalogue": v[0], "lawspace": v[1]} for k, v in LAWS.items()},
           "note": "Full provenance per field lives in materials.json. Null = unknown.",
           "materials": rows}
    (out_dir / "materials-export.json").write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8")
    # Fluid-only slice for the marbling solver: liquids with density and viscosity.
    fluids = [{k: row[k] for k in ("id", "name", "density", "viscosity", "surface_tension", "specific_heat",
                                   "thermal_conductivity", "srgb_preview", "n", "k")}
              for row in rows if row["phase"] == "liquid"]
    (out_dir / "fluids-for-marbling.json").write_text(
        json.dumps({"schema": "materials-fluids/1", "grid_nm": lib["grid_nm"], "units": units, "fluids": fluids},
                   separators=(",", ":")), encoding="utf-8")

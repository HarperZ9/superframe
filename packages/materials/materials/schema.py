# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""The record schema and a dependency-free validator.

A field is either null (unknown) or an object with value, unit, source, licence
and confidence. Spectral fields hold one value per grid point. data/schema.json
carries the same rules as JSON Schema for other languages.
"""

CLASSES = {"metal", "semiconductor", "dielectric", "liquid", "gas", "biological", "mineral", "wood", "pigment"}
PHASES = {"solid", "liquid", "gas"}
CONFIDENCE = {"high", "moderate", "low"}
GROUPS = {
    "electromagnetic": ["electrical_conductivity", "relative_permittivity"],
    "thermal": ["density", "specific_heat", "thermal_conductivity", "melting_point", "boiling_point"],
    "mechanical": ["youngs_modulus", "poisson_ratio", "viscosity"],
    "surface": ["surface_tension", "water_contact_angle"],
}
SPECTRAL = ["n", "k", "reflectance_normal", "absorption_coefficient"]
UNITS = {"density": "kg/m^3", "specific_heat": "J/(kg K)", "thermal_conductivity": "W/(m K)",
         "melting_point": "K", "boiling_point": "K", "electrical_conductivity": "S/m",
         "relative_permittivity": "1", "youngs_modulus": "Pa", "poisson_ratio": "1",
         "viscosity": "Pa s", "surface_tension": "N/m", "water_contact_angle": "deg"}


def _field_errors(path, f, n_grid=None, unit=None):
    if f is None:
        return []
    errs = []
    if not isinstance(f, dict):
        return [f"{path}: field must be an object or null"]
    for key in ("value", "unit", "source", "licence", "confidence"):
        if key not in f or f[key] in (None, ""):
            errs.append(f"{path}: missing {key}")
    if f.get("confidence") not in CONFIDENCE:
        errs.append(f"{path}: confidence {f.get('confidence')!r} not in {sorted(CONFIDENCE)}")
    if unit and f.get("unit") != unit:
        errs.append(f"{path}: unit {f.get('unit')!r} != {unit!r}")
    if n_grid is not None:
        v = f.get("value")
        if not isinstance(v, list) or len(v) != n_grid or not all(isinstance(x, (int, float)) for x in v):
            errs.append(f"{path}: spectral value must be {n_grid} numbers")
    elif isinstance(f.get("value"), (int, float)) and f["value"] != f["value"]:
        errs.append(f"{path}: NaN")
    return errs


def validate(rec, n_grid):
    """Return a list of error strings; empty means the record is valid."""
    errs = []
    for key in ("id", "name", "class", "phase", "optics", "provenance", "render"):
        if key not in rec:
            errs.append(f"missing {key}")
    if errs:
        return errs
    if rec["class"] not in CLASSES:
        errs.append(f"class {rec['class']!r}")
    if rec["phase"] not in PHASES:
        errs.append(f"phase {rec['phase']!r}")
    opt = rec["optics"]
    if not isinstance(opt.get("conductor"), bool):
        errs.append("optics.conductor must be boolean")
    for key in SPECTRAL:
        errs += _field_errors(f"optics.{key}", opt.get(key), n_grid=n_grid)
    if opt.get("k") is not None and opt.get("n") is None:
        errs.append("optics.k without optics.n")
    for key in ("srgb_preview", "roughness", "ior_single"):
        errs += _field_errors(f"optics.{key}", opt.get(key))
    for group, keys in GROUPS.items():
        if group not in rec:
            errs.append(f"missing group {group}")
            continue
        for key in keys:
            if key not in rec[group]:
                errs.append(f"{group}.{key} absent (use null for unknown)")
            else:
                errs += _field_errors(f"{group}.{key}", rec[group][key], unit=UNITS[key])
    if not rec["provenance"]:
        errs.append("provenance is empty")
    return errs

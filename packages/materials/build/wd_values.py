# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Turn Wikidata SPARQL rows into one SI value per material and property.

Selection, in order: reject values outside physical bounds (logged), keep
statements whose phase qualifier matches the record's phase, then, if any carry a
temperature qualifier, the one nearest 298.15 K (melting and boiling points take
all), then referenced statements. The median of the surviving tier is taken. Confidence:
high when referenced and the tier spread is under 5 percent, moderate under 20
percent, low otherwise. Every choice records how many candidates it saw.
"""
import json
import statistics
from collections import defaultdict

FIELD = {
    "P2054": "density", "P2056": "specific_heat", "P2068": "thermal_conductivity",
    "P2101": "melting_point", "P2102": "boiling_point", "P2055": "electrical_conductivity",
    "P5679": "electrical_resistivity", "P5480": "youngs_modulus", "P5593": "poisson_ratio",
    "P3070": "viscosity", "P3013": "surface_tension", "P5675": "relative_permittivity",
}
# raw unit QID -> factor to SI (temperatures handled separately)
UNIT = {
    "Q844211": 1.0, "Q13147228": 1000.0, "Q21604951": 1e-3,          # density
    "Q20966435": 1.0, "Q80842107": 1.0,                               # S/m
    "Q3085309": 1.0, "Q69423273": 1.0, "Q108834064": 1000.0,          # J/(kg K)
    "Q1463969": 1.0, "Q21016931": 1.0, "Q26156113": 1.0, "Q44395": 1.0,
    "Q1441459": 1.0, "Q199": 1.0,
}
DIMENSIONLESS = {"P5593", "P5675"}
PHASE_WORDS = {"solid": ("solid", "crystal"), "liquid": ("liquid",), "gas": ("gas",)}


def _kelvin(v, unit):
    return {"Q11579": v, "Q25267": v + 273.15}.get(unit, (v - 32) * 5 / 9 + 273.15 if unit == "Q42289" else None)


def _si(row, prop):
    ru = row["ru"]["value"].rsplit("/", 1)[-1]
    rv = float(row["rv"]["value"])
    if prop in ("P2101", "P2102"):
        if ru == "Q11579":
            return rv
        if ru == "Q25267":
            return rv + 273.15
        if ru == "Q42289":
            return (rv - 32) * 5 / 9 + 273.15
        return None
    if "v" in row and "unit" in row and row["unit"]["value"].rsplit("/", 1)[-1] != "Q199":
        return float(row["v"]["value"])
    if ru == "Q199" and prop not in DIMENSIONLESS:
        return None  # a unitless entry for a dimensioned quantity is a data error
    f = UNIT.get(ru)
    return rv * f if f is not None else None


def load(paths):
    """{qid: {prop: [candidate dicts]}} with one entry per statement."""
    by = defaultdict(lambda: defaultdict(dict))
    for path in paths:
        rows = json.load(open(path, encoding="utf-8"))["results"]["bindings"]
        for r in rows:
            qid = r["item"]["value"].rsplit("/", 1)[-1]
            prop = r["prop"]["value"].rsplit("/", 1)[-1]
            st = r["st"]["value"]
            v = _si(r, prop)
            if v is None:
                continue
            c = by[qid][prop].setdefault(st, {"value": v, "tempK": None, "phase": None,
                                               "refs": set(), "statement": st})
            if "tempK" in r:
                c["tempK"] = float(r["tempK"]["value"])
            elif "tRaw" in r:
                c["tempK"] = _kelvin(float(r["tRaw"]["value"]), r["tUnit"]["value"].rsplit("/", 1)[-1])
            if "phaseLabel" in r:
                c["phase"] = r["phaseLabel"]["value"].lower()
            for key in ("refurl", "statedLabel"):
                if key in r:
                    c["refs"].add(r[key]["value"])
    return {q: {p: list(sts.values()) for p, sts in props.items()} for q, props in by.items()}


# Plausibility bounds in SI. A candidate outside them is a unit or entry error
# (for example a g/cm^3 value stored as kg/m^3) and is rejected, never rescaled.
BOUNDS = {
    "P2054": {"gas": (0.05, 20), "liquid": (500, 14000), "solid": (50, 23000)},
    "P2056": (100, 20000), "P2068": (0.005, 3000), "P2101": (0.5, 7000), "P2102": (0.5, 7000),
    "P2055": (1e-20, 1e8), "P5679": (1e-9, 1e20), "P5675": (1, 1e5), "P5480": (1e5, 1.3e12),
    "P5593": (-1, 0.5), "P3013": (0.005, 2.5),
    "P3070": {"gas": (1e-6, 1e-4), "liquid": (1e-4, 1e4), "solid": (1e-4, 1e20)},
}
REJECTED = []


def _ok(c, prop, phase, qid):
    b = BOUNDS.get(prop)
    if isinstance(b, dict):
        b = b.get(phase)
    if prop == "P5593" and phase != "solid":
        b = (1, 0)  # an empty interval: Poisson ratio is a solid property, so fluids reject it
    if b and not (b[0] <= c["value"] <= b[1]):
        REJECTED.append({"qid": qid, "prop": prop, "value": c["value"], "phase": phase,
                         "bounds": list(b), "statement": c["statement"]})
        return False
    return True


def choose(cands, phase, prop, cls, qid=""):
    if not cands:
        return None
    pool = [c for c in cands if _ok(c, prop, phase, qid)]
    words = PHASE_WORDS.get(phase, ())
    tier = [c for c in pool if c["phase"] and any(w in c["phase"] for w in words)] or pool
    tagged = [c for c in tier if c["tempK"] is not None]
    if prop not in ("P2101", "P2102") and tagged:
        best = min(abs(c["tempK"] - 298.15) for c in tagged)
        tier = [c for c in tagged if abs(c["tempK"] - 298.15) == best]
    reffed = [c for c in tier if c["refs"]]
    tier = reffed or tier
    if not tier:
        return None
    vals = sorted(c["value"] for c in tier)
    med = statistics.median(vals)
    spread = (vals[-1] - vals[0]) / abs(med) if med else 0.0
    conf = "low" if not reffed else ("high" if spread < 0.05 else ("moderate" if spread < 0.2 else "low"))
    temps = sorted({round(c["tempK"], 2) for c in tier if c["tempK"] is not None})
    return {
        "value": med, "confidence": conf, "candidates": len(cands), "tier_size": len(tier),
        "tier_spread": round(spread, 4), "temperature_K": temps or None,
        "references": sorted({r for c in tier for r in c["refs"]})[:4],
        "statements": [c["statement"] for c in tier][:4],
    }

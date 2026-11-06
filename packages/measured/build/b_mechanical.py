# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Mechanical and acoustic material rows for the physical-model instruments (packages/daw).

Kaye and Laby (NPL, archived pages) give Young's modulus and Poisson's ratio (2.2.2), densities (2.2.1)
and rod-wave speeds c_E = sqrt(E / rho) (2.4.1). Every quoted row must be found again in the saved page
text at build time. Where one table lacks a value, the row is derived from two others and marked derived.
Leissa's clamped circular plate eigenvalues were read by eye from the page image (the OCR layer misreads
two digits). Loss factors are from memory, status from_memory, and must be replaced by measured rows.
Wikidata values are kept apart as an independent cross-check, never used as inputs.

    MEASURED_REFS=<root> python -I packages/measured/build/b_mechanical.py
"""
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

GPA, GCC = 1e9, 1000.0
KL = [  # (id, file, value, unit, quote in the page text, note)
    ("steel_mild.E", "kl_2_2_2.html", 211.9 * GPA, "Pa", "Steel (Mild) 211.9 82.2 0.291 169.2", "20 C"),
    ("steel_mild.nu", "kl_2_2_2.html", 0.291, "1", "Steel (Mild) 211.9 82.2 0.291 169.2", ""),
    ("aluminium.E", "kl_2_2_2.html", 70.3 * GPA, "Pa", "Aluminium 70.3 26.1 0.345 75.5", "20 C"),
    ("aluminium.nu", "kl_2_2_2.html", 0.345, "1", "Aluminium 70.3 26.1 0.345 75.5", ""),
    ("copper.E", "kl_2_2_2.html", 129.8 * GPA, "Pa", "Copper 129.8 48.3 0.343 137.8", "20 C"),
    ("copper.nu", "kl_2_2_2.html", 0.343, "1", "Copper 129.8 48.3 0.343 137.8", ""),
    ("brass.E", "kl_2_2_2.html", 100.6 * GPA, "Pa", "100.6 37.3 0.350 111.8", "row printed as Brass (70 Zn, 30 Cu)"),
    ("brass.nu", "kl_2_2_2.html", 0.350, "1", "100.6 37.3 0.350 111.8", "as above"),
    ("glass_crown.E", "kl_2_2_2.html", 71.3 * GPA, "Pa", "Glass (Crown) 71.3 29.2 0.22 41.2", "20 C"),
    ("glass_crown.nu", "kl_2_2_2.html", 0.22, "1", "Glass (Crown) 71.3 29.2 0.22 41.2", ""),
    ("steel_mild.rho", "kl_2_2_1.html", 7.9 * GCC, "kg/m^3", "Mild steel 7.9", "printed in g/cm^3"),
    ("brass.rho", "kl_2_2_1.html", 8.5 * GCC, "kg/m^3", "(70/30) 8.5", "brass 70/30, printed in g/cm^3"),
    ("glass_soda.rho", "kl_2_2_1.html", 2.5 * GCC, "kg/m^3", "Glass (soda) 2.5", "soda glass; used for crown glass"),
    ("oak.rho", "kl_2_2_1.html", 0.7 * GCC, "kg/m^3", "Oak 0.7", "timber, variable"),
    ("pine.rho", "kl_2_2_1.html", 0.5 * GCC, "kg/m^3", "Pine (white) 0.5", "timber, variable"),
    ("ash.rho", "kl_2_2_1.html", 0.75 * GCC, "kg/m^3", "Ash (timber) 0.75", "timber, variable"),
    ("aluminium.cE", "kl_2_4_1.html", 5102.0, "m/s", "Aluminium 6 374 5102 3111 2906", "rod (extensional) wave speed"),
    ("copper.cE", "kl_2_4_1.html", 3813.0, "m/s", "Copper 4759 3813 2325 2171", "rod wave speed"),
    ("brass.cE", "kl_2_4_1.html", 3451.0, "m/s", "Brass 4 372 3451 2100 1964", "rod wave speed"),
    ("steel_mild.cE", "kl_2_4_1.html", 5196.0, "m/s", "Steel (mild) 5960 5196 3235 2996", "rod wave speed"),
    ("glass_crown.cE", "kl_2_4_1.html", 5342.0, "m/s", "Glass (crown) 5660 5342 3420 3127", "rod wave speed"),
    ("oak.cE", "kl_2_4_1.html", 4100.0, "m/s", "(Oak) with grain \u2014 4100", "along the grain"),
    ("pine.cE", "kl_2_4_1.html", 3600.0, "m/s", "(Pine) with grain \u2014 3600", "along the grain"),
    ("ash.cE", "kl_2_4_1.html", 4670.0, "m/s", "Wood (Ash) with grain \u2014 4670", "along the grain"),
    ("air.c0", "kl_2_4_1.html", 331.46, "m/s", "331.46 ± 0.10", "dry air, 0.03 % CO2, 0 C, 101.325 kPa; +/- 0.10"),
    ("water.c20", "kl_2_4_1.html", 1482.36, "m/s", "1402.39 1447.28 1482.36", "distilled water at 20 C"),
    ("water.rho20", "kl_2_2_1.html", 998.20, "kg/m^3", "20 998.20 997.77", "pure air-free water, 20 C, 101 325 Pa"),
    ("helium.c0", "kl_2_4_1.html", 972.5, "m/s", "Helium 0 972.5", "0 C"),
]
AIR_RH = [10, 20, 30, 40, 50, 60, 70, 80, 90]
AIR = [  # Kaye and Laby 2.4.1: attenuation of sound in air, dB/km, 20 C, 101.325 kPa, from ISO 9613-1, +/- 10 %
    (1.0, "14 6.5 5 4.7 4.7 4.8 5 5.1 5.3"), (1.25, "21 9.4 6.7 5.9 5.7 5.7 5.9 6.1 6.3"),
    (1.6, "32 14 9.8 8.1 7.5 7.2 7.2 7.4 7.5"), (2.0, "45 22 14 11 9.9 9.3 9 9 9.1"),
    (2.5, "63 32 21 16 14 12 12 11 11"), (3.15, "85 49 32 24 20 17 16 15 15"),
    (4.0, "110 75 49 36 30 26 23 21 20"), (5.0, "130 110 74 55 44 38 33 31 28"),
    (6.3, "160 160 110 84 68 57 50 45 42"), (8.0, "180 220 170 130 110 89 78 69 63"),
    (10.0, "190 280 240 190 160 130 120 100 95"), (12.5, "210 360 340 280 240 200 180 160 140"),
]
LEISSA = [(0, 0, 10.2158), (0, 1, 21.26), (0, 2, 34.88), (0, 3, 51.04), (1, 0, 39.771), (1, 1, 60.82), (1, 2, 84.58)]
LOSS = [  # (material, loss factor eta, note); from memory, low confidence
    ("steel_mild", 2e-4, "audio band, small bars; order of magnitude"),
    ("aluminium", 1e-4, "alloy bars ring long; order of magnitude"),
    ("brass", 1e-3, "order of magnitude"),
    ("copper", 2e-3, "order of magnitude"),
    ("glass_crown", 1e-3, "order of magnitude"),
    ("oak", 1e-2, "hardwood, along the grain; order of magnitude"),
    ("pine", 1e-2, "softwood, along the grain; order of magnitude"),
    ("ash", 1e-2, "hardwood, along the grain; order of magnitude"),
]


def page_text(name):
    """The saved page as one line of text: tags removed, entities decoded, dot leaders and runs of space collapsed."""
    t = (prov.RAW / "kaye-laby" / name).read_text(encoding="utf-8", errors="replace")
    t = re.sub(r"<script.*?</script>", " ", t, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    t = re.sub(r"(\s\.)+", " ", t)
    return re.sub(r"\s+", " ", t)


def kl_rows():
    rows, cache = [], {}
    for rid, name, val, unit, quote, note in KL:
        if name not in cache:
            cache[name] = page_text(name)
        assert quote in cache[name], (rid, quote)
        rows.append({"id": rid, "value": val, "unit": unit, "source": "kaye-laby", "file": name,
                     "sha256": prov.verify("kaye-laby", name), "quote": quote, "status": "measured", "note": note})
    return rows


def air_rows():
    """The attenuation table, one row per frequency and humidity; each frequency's row of nine values is quoted."""
    text, sha, rows = page_text("kl_2_4_1.html"), prov.verify("kaye-laby", "kl_2_4_1.html"), []
    for khz, vals in AIR:
        quote = f"{khz:g} {vals}"
        assert quote in text, quote
        for rh, v in zip(AIR_RH, vals.split()):
            rows.append({"id": f"air.atten.{khz:g}kHz.rh{rh}", "value": float(v), "unit": "dB/km", "source": "kaye-laby",
                         "file": "kl_2_4_1.html", "sha256": sha, "quote": quote, "status": "derived",
                         "f_hz": khz * 1000, "rh_percent": rh, "celsius": 20.0, "kpa": 101.325,
                         "note": "NPL table computed from ISO 9613-1 (1993); stated uncertainty +/- 10 %"})
    return rows


def derived_rows(by):
    """rho = E / c_E^2 where 2.2.1 has no row; E = rho c_E^2 for woods, which 2.2.2 does not list."""
    out = []
    for m in ("aluminium", "copper"):
        e, c = by[f"{m}.E"], by[f"{m}.cE"]
        out.append({"id": f"{m}.rho", "value": round(e / c ** 2, 1), "unit": "kg/m^3", "status": "derived",
                    "from": [f"{m}.E", f"{m}.cE"], "note": "E / c_E^2; the two tables may describe different samples"})
    for m in ("oak", "pine", "ash"):
        r, c = by[f"{m}.rho"], by[f"{m}.cE"]
        out.append({"id": f"{m}.E", "value": round(r * c ** 2, -6), "unit": "Pa", "status": "derived",
                    "from": [f"{m}.rho", f"{m}.cE"], "note": "rho c_E^2 along the grain; wood is orthotropic"})
    return out


def other_rows():
    sha = prov.verify("leissa-sp160", "leissa-sp160.pdf")
    rows = [{"id": f"leissa.clamped_circular.s{s}n{n}", "value": v, "unit": "lambda^2 = omega a^2 sqrt(rho/D)",
             "source": "leissa-sp160", "file": "leissa-sp160.pdf", "sha256": sha, "status": "measured", "read_by_eye": True,
             "note": f"Table 2.1, s = {s} nodal circles, n = {n} nodal diameters; page image, printed page 8"} for s, n, v in LEISSA]
    rows += [{"id": f"{m}.eta", "value": v, "unit": "1", "status": "from_memory", "confidence": "low",
              "note": "loss factor; " + note} for m, v, note in LOSS]
    return rows


def crosscheck():
    """Wikidata values for the same materials, unit-converted; a test compares them with the rows above."""
    d = json.loads((prov.RAW / "wikidata-materials" / "extracted.json").read_text(encoding="utf-8"))
    units = {"Q844211": 1.0, "Q13147228": 1000.0, "Q53448922": 1e9, "1": 1.0}
    out = {}
    for name, key in (("steel", "steel_mild"), ("aluminium", "aluminium"), ("brass", "brass"), ("copper", "copper")):
        for prop in ("density", "youngs_modulus", "poisson_ratio"):
            for v in d[name][prop][:1]:
                if v["unit"] in units:
                    out[f"{key}.{prop}"] = float(v["amount"]) * units[v["unit"]]
    return out


def main():
    rows = kl_rows()
    by = {r["id"]: r["value"] for r in rows}
    rows += derived_rows(by) + other_rows() + air_rows()
    for r in rows:
        r.setdefault("citation", prov.SOURCES[r["source"]][0] if "source" in r else "")
    files = {"kaye-laby": sorted({r["file"] for r in rows if r.get("source") == "kaye-laby"})}
    write("mechanical", {"provenance": {
        "method": "Kaye and Laby rows re-found in the saved page text at build time; Leissa read from the page image; "
                  "derived rows computed here; loss factors from memory",
        "built_from": ["kaye-laby", "leissa-sp160", "wikidata-materials"],
        "files": {f: prov.verify("kaye-laby", f) for f in files["kaye-laby"]},
        "crosscheck_wikidata": crosscheck()}, "rows": rows})


if __name__ == "__main__":
    main()

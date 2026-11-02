# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""SCHOTT optical glass overview (xlsx) read with the standard library (zip + XML), no spreadsheet engine.

Kept per glass: nd, ne, vd, ve, Sellmeier B1-3 and C1-3 (C in um^2), stress optical coefficient K
(1e-6 mm^2/N), density, and the catalogue line indices nC, nd, nF. The Abbe number is recomputed from
the Sellmeier at the exact Fraunhofer lines as a check on our reading of the formula.
"""
import math
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
FILE = "schott-optical-glass-overview-excel-format-en.xlsx"
COLS = {"A": "glass", "B": "nd", "C": "ne", "D": "vd", "E": "ve", "G": "B1", "H": "B2", "I": "B3", "J": "C1", "K": "C2",
        "L": "C3", "AK": "K_stress_optical_1e-6_mm2_per_N", "CZ": "density_g_cm3", "DT": "nC", "DX": "nd_table", "DZ": "nF"}
LINES_UM = {"C": 0.6562725, "d": 0.5875618, "F": 0.4861327}


def sheet_rows(path):
    z = zipfile.ZipFile(path)
    ss = ["".join(t.text or "" for t in si.iter(M + "t")) for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(M + "si")]
    for r in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).iter(M + "row"):
        vals = {}
        for c in r.findall(M + "c"):
            v = c.find(M + "v")
            if v is not None:
                vals[re.match(r"[A-Z]+", c.get("r")).group()] = ss[int(v.text)] if c.get("t") == "s" else v.text
        yield vals


def sellmeier(g, lam):
    l2 = lam * lam
    return math.sqrt(1 + sum(g[f"B{i}"] * l2 / (l2 - g[f"C{i}"]) for i in (1, 2, 3)))


def main():
    path = prov.RAW / "schott-optical-glass" / FILE
    rows = []
    for v in sheet_rows(path):
        if "G" not in v or v.get("A") in (None, "Glass"):
            continue
        g = {"glass": v["A"]}
        for col, key in COLS.items():
            if key != "glass" and col in v:
                try:
                    g[key] = float(v[col])
                except ValueError:
                    g[key] = None
        if any(not isinstance(g.get(k), float) for k in ("B1", "B2", "B3", "C1", "C2", "C3")):
            continue
        nd, nF, nC = (sellmeier(g, LINES_UM[k]) for k in "dFC")
        g["vd_from_sellmeier"] = round((nd - 1) / (nF - nC), 3)
        g["status"] = "measured"
        rows.append(g)
    bk7 = next(r for r in rows if r["glass"] == "N-BK7")
    assert abs(bk7["vd_from_sellmeier"] - bk7["vd"]) < 0.02, bk7
    meta = prov.stamp("schott-optical-glass", [FILE], method="stdlib xlsx read; Abbe number recomputed from Sellmeier at C, d, F",
                      sellmeier="n^2 - 1 = sum B_i l^2 / (l^2 - C_i), l in um")
    write("schott_glass", {"provenance": meta, "rows": rows},
          private="manufacturer data, no terms stated on the download page (author decision 2026-10-31)")


if __name__ == "__main__":
    main()

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Long-wave infrared emissivity from measured data, two independent routes.

1. refractiveindex.info release v2026-05-24 (CC0): measured n, k of named sets. Normal emissivity of an
   opaque, smooth body is 1 - R, R = ((n-1)^2 + k^2) / ((n+1)^2 + k^2) (Kirchhoff). Reported at 10 um
   and as the 300 K Planck-weighted mean over 8-14 um (a thermal camera's band).
2. SLUM (Kotthaus et al. 2014, MPL-2.0): FTIR emissivity spectra, 8-14 um, of 74 urban samples, with
   the class, material, colour and state of each sample read from the library's data sheets.
Both are smooth or as-found surfaces; roughness and oxide change a real part's value.
"""
import csv
import io
import math
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

RII = "rii-database-2026-05-24.zip"
SETS = {  # material id in tools/diagram : rii record (measured set covering 8-14 um)
    "tungsten": "main/W/nk/Ordal.yml", "copper": "main/Cu/nk/Ordal.yml", "nickel": "main/Ni/nk/Ordal.yml",
    "iron": "main/Fe/nk/Ordal.yml", "aluminium": "main/Al/nk/Ordal.yml",
    "soda_lime_glass": "glass/misc/soda-lime/nk/Rubin-IR.yml", "fused_silica": "main/SiO2/nk/Popova.yml",
    "pmma": "organic/(C5H8O2)n - poly(methyl methacrylate)/nk/Zhang-Tomson.yml",
    "polycarbonate": "organic/(C16H14O3)n - polycarbonate/nk/Zhang.yml",
    "kapton": "other/commercial polymers/Kapton/nk/Zhang.yml",
    "graphite": "main/C/nk/Querry-Pyrolytic.yml",
}
H, C, KB = 6.62607015e-34, 299792458.0, 1.380649e-23


def tabulated(text):
    """Rows of (lambda_um, n, k) from the 'tabulated nk' block of a refractiveindex.info YAML record."""
    m = re.search(r"type:\s*tabulated nk\s*\n\s*data:\s*\|\s*\n(.*?)(?:\n\s*-\s*type:|\n[A-Z]+:|\Z)", text, re.S)
    if not m:
        return []
    rows = []
    for line in m.group(1).splitlines():
        p = line.split()
        if len(p) == 3:
            rows.append(tuple(float(v) for v in p))
    return rows


def lerp(rows, lam, col):
    for a, b in zip(rows, rows[1:]):
        if a[0] <= lam <= b[0]:
            f = (lam - a[0]) / (b[0] - a[0])
            return a[col] + f * (b[col] - a[col])
    return None


def emissivity(n, k):
    return 1 - ((n - 1) ** 2 + k * k) / ((n + 1) ** 2 + k * k)


def planck(lam_um, t=300.0):
    l = lam_um * 1e-6
    return 1 / (l ** 5 * (math.exp(H * C / (l * KB * t)) - 1))


def band(fn, lo=8.0, hi=14.0, steps=240):
    xs = [lo + (hi - lo) * i / steps for i in range(steps + 1)]
    w = [planck(x) for x in xs]
    v = [fn(x) for x in xs]
    if any(q is None for q in v):
        return None
    return sum(a * b for a, b in zip(v, w)) / sum(w)


def rii_rows():
    z = zipfile.ZipFile(prov.RAW / "rii-database" / RII)
    out = []
    for mid, rec in SETS.items():
        text = z.read("database/data/" + rec).decode("utf-8", "replace")
        t = tabulated(text)
        cover = (min(r[0] for r in t), max(r[0] for r in t)) if t else None
        e10 = emissivity(lerp(t, 10.0, 1), lerp(t, 10.0, 2)) if t and cover[0] <= 10 <= cover[1] else None
        eb = band(lambda x: emissivity(lerp(t, x, 1), lerp(t, x, 2)) if lerp(t, x, 1) is not None else None) if t else None
        ref = re.search(r"REFERENCES:\s*\|\s*\n(.*?)\n[A-Z]+:", text, re.S)
        out.append({"material": mid, "rii_record": rec, "coverage_um": cover,
                    "n_10um": lerp(t, 10.0, 1) if e10 is not None else None, "k_10um": lerp(t, 10.0, 2) if e10 is not None else None,
                    "emissivity_normal_10um": None if e10 is None else round(e10, 4),
                    "emissivity_normal_8_14um_planck300": None if eb is None else round(eb, 4),
                    "reference": re.sub(r"<[^>]+>|\s+", " ", ref.group(1)).strip()[:300] if ref else None,
                    "status": "measured" if e10 is not None else "missing",
                    "note": "1 - R of a smooth opaque body; a polymer film thinner than about 50 um is partly transparent at 10 um"})
    return out


def slum_meta():
    import subprocess
    txt = subprocess.run(["pdftotext", "-layout", str(prov.RAW / "slum-kotthaus" / "2013_LUMA_SLUM.pdf"), "-"],
                         capture_output=True, check=True).stdout.decode("utf-8", "replace")
    meta, cur = {}, None
    for l in txt.splitlines():
        m = re.match(r"^([A-Z/ ]+?)([A-Z]\d{3}[a-z]?)\s*$", l.strip())
        if m:
            cur = m.group(2)
            meta[cur] = {}
            continue
        m = re.match(r"^(Class|Material|Colour|Status|Dimension \[mm\])\s+(.*)$", l.strip())
        if m and cur:
            meta[cur][m.group(1).split()[0].lower()] = m.group(2).strip()
    return meta


def slum_rows():
    meta = slum_meta()
    raw = (prov.RAW / "slum-kotthaus" / "LUMA_SLUM_IR.csv").read_text(encoding="utf-8")
    rd = list(csv.reader(io.StringIO(raw)))
    head, data = rd[0], [[float(v) if v not in ("", "NA", "NaN") else None for v in r] for r in rd[1:] if r]
    out = []
    for j, sid in enumerate(head[1:], start=1):
        pts = [(r[0], r[j]) for r in data if r[j] is not None and 8.0 <= r[0] <= 14.0]
        w = [planck(x) for x, _ in pts]
        mean = sum(e * q for (_, e), q in zip(pts, w)) / sum(w)
        m = meta.get(sid, {})
        out.append({"sample": sid, "class": m.get("class"), "material": m.get("material"), "colour": m.get("colour"),
                    "state": m.get("status"), "emissivity_8_14um_planck300": round(mean, 4),
                    "emissivity_min": round(min(e for _, e in pts), 4), "emissivity_max": round(max(e for _, e in pts), 4),
                    "points": len(pts), "status": "measured"})
    return out


MPL_NOTICE = ("This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL "
              "was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. "
              "Derived from SLUM v1.0 (Kotthaus et al. 2014).")


def main():
    r = rii_rows()
    write("lwir_emissivity_rii", {"provenance": prov.stamp("rii-database", [RII], method="1 - R from tabulated n, k; Planck 300 K weights over 8-14 um"), "rows": r})
    s = slum_rows()
    write("lwir_emissivity_slum", {"provenance": prov.stamp("slum-kotthaus", ["LUMA_SLUM_IR.csv", "2013_LUMA_SLUM.pdf"],
                                                         method="Planck 300 K weighted mean of each FTIR emissivity spectrum over 8-14 um; sample metadata from the data sheets",
                                                         notice=MPL_NOTICE,
                                                         class_key="X quartzite, S stone, G granite (not glass), A asphalt, C concrete, B brick, L roofing shingle, R roofing tile (ceramic or cement), Z metal, V PVC"),
                                   "rows": s})


if __name__ == "__main__":
    main()

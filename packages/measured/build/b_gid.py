# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Marshall-Palmer against measured rain: Italian disdrometer network (GID V04, CC BY 4.0).

Each station folder holds yearly xlsx sheets of 1-minute drop size distributions N(D) in mm^-1 m^-3 on
the instrument's diameter classes (mid-values and widths from the station read_me). Read with the
standard library (zip + XML stream), never with a spreadsheet engine.

Per minute: rain rate R = 6 pi 1e-4 sum v(D) D^3 N(D) dD (mm/h), v(D) = 9.65 - 10.3 exp(-0.6 D) m/s
(Atlas, Srivastava and Sekhon 1973, a fit to Gunn and Kinzer 1949; from memory, high), so R is derived.
Exponential fit by moments M3 and M4: Lambda = 4 M3 / M4, N0 = Lambda^4 M3 / 6. Classes under 0.25 mm
are dropped (below the instruments' reliable range). Minutes with R < 0.1 mm/h or fewer than 3 occupied
classes are skipped. Output: the median Lambda and N0 per rain-rate bin, and a power-law fit of
Lambda against R, beside Marshall-Palmer's Lambda = 4.1 R^-0.21 mm^-1 and N0 = 8000 m^-3 mm^-1.
"""
import io
import math
import re
import statistics
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

ZIP = "GID_database_unitll_Dec2024_V04.zip"
M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
BINS = [0.1, 0.3, 1, 3, 10, 30, 100]


def classes(readme):
    def arr(label):
        m = re.search(label + r"[^\[]*\[([^\]]*)\]", readme, re.S | re.I)
        if not m:
            return None
        return [float(v) for v in re.split(r"[,\s;]+", m.group(1).strip()) if v]
    return arr("Mid-value"), arr("width")


def minutes(xbytes, ncls):
    x = zipfile.ZipFile(io.BytesIO(xbytes))
    for _, el in ET.iterparse(io.BytesIO(x.read("xl/worksheets/sheet1.xml"))):
        if el.tag != M + "row":
            continue
        if el.get("r") != "1":
            vals = {}
            for c in el.findall(M + "c"):
                v = c.find(M + "v")
                if v is not None and c.get("t") != "s":
                    col = re.match(r"[A-Z]+", c.get("r")).group()
                    vals[col] = float(v.text)
            yield [vals.get(colname(5 + i), 0.0) for i in range(ncls)]
        el.clear()


def colname(i):
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def fit_minute(nd, mids, widths):
    use = [(d, w, n) for d, w, n in zip(mids, widths, nd) if d >= 0.25 and n > 0]
    if len(use) < 3:
        return None
    R = 6 * math.pi * 1e-4 * sum((9.65 - 10.3 * math.exp(-0.6 * d)) * d ** 3 * n * w for d, w, n in use)
    m3 = sum(d ** 3 * n * w for d, w, n in use)
    m4 = sum(d ** 4 * n * w for d, w, n in use)
    if R < 0.1 or m4 <= 0:
        return None
    lam = 4 * m3 / m4
    return R, lam, lam ** 4 * m3 / 6


def main():
    z = zipfile.ZipFile(prov.RAW / "gid-disdrometer" / ZIP)
    names = z.namelist()
    per_bin = {i: [] for i in range(len(BINS) - 1)}
    stations = {}
    for st in sorted({n.split("/")[1] for n in names if n.count("/") >= 2 and n.split("/")[1]}):
        rm = next((n for n in names if n.startswith(f"GID_database_unitll_Dec2024_V04/{st}/read_me")), None)
        if not rm:
            continue
        txt = z.read(rm).decode("latin-1")
        mids, widths = classes(txt)
        if not mids or not widths or len(mids) != len(widths):
            stations[st] = {"skipped": "class table not found in read_me"}
            print(st, "skipped", flush=True)
            continue
        mi = re.search(r"disdrometer type:\s*(.+)", txt, re.I)
        inst = mi.group(1).strip() if mi else "not stated"
        cnt = 0
        for n in names:
            if n.startswith(f"GID_database_unitll_Dec2024_V04/{st}/") and n.endswith(".xlsx"):
                for nd in minutes(z.read(n), len(mids)):
                    f = fit_minute(nd, mids, widths)
                    if f:
                        cnt += 1
                        for i in range(len(BINS) - 1):
                            if BINS[i] <= f[0] < BINS[i + 1]:
                                per_bin[i].append(f)
        stations[st] = {"instrument": inst, "rain_minutes": cnt}
        print(st, inst, cnt, flush=True)
    rows = []
    for i, fs in per_bin.items():
        if len(fs) < 30:
            continue
        rmed = statistics.median(f[0] for f in fs)
        rows.append({"R_bin_mm_h": [BINS[i], BINS[i + 1]], "minutes": len(fs), "R_median": round(rmed, 3),
                     "Lambda_median_per_mm": round(statistics.median(f[1] for f in fs), 3),
                     "N0_median_m3_mm": round(statistics.median(f[2] for f in fs), 1),
                     "Lambda_MP": round(4.1 * rmed ** -0.21, 3), "status": "measured"})
    xs = [math.log(r["R_median"]) for r in rows]
    ys = [math.log(r["Lambda_median_per_mm"]) for r in rows]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    fitted = {"Lambda_a": round(math.exp(my - b * mx), 3), "Lambda_b": round(b, 3)}
    meta = prov.stamp("gid-disdrometer", [ZIP], status="measured",
                      method="moments M3/M4 exponential fit per minute; R derived with the Atlas 1973 velocity fit",
                      derived_parts="R uses v(D) from Atlas et al. 1973 (fit to Gunn-Kinzer), from memory, high")
    write("rain_gid_vs_marshall_palmer", {"provenance": meta, "stations": stations, "fit_Lambda_vs_R": fitted,
                                          "marshall_palmer": {"Lambda_a": 4.1, "Lambda_b": -0.21, "N0": 8000}, "rows": rows})


if __name__ == "__main__":
    main()

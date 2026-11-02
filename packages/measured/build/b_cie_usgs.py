# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""CIE 1 nm tables checked against what packages/materials computes, and an index of the USGS splib07a
artificial-material spectra (names, sample ids, file), kept for later cross-checks."""
import csv
import io
import json
import math
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

MAT = Path(__file__).resolve().parents[2] / "materials"  # sibling package packages/materials


def cie():
    def rd(name):
        return [[float(v) for v in r] for r in csv.reader(io.StringIO((prov.RAW / "cie-datasets" / name).read_text(encoding="utf-8"))) if r]
    A = {int(r[0]): r[1] for r in rd("CIE_std_illum_A_1nm.csv")}
    xyz = {int(r[0]): r[1:] for r in rd("CIE_xyz_1931_2deg.csv")}
    c2 = 1.435e-2

    def planck(nm):
        l = nm * 1e-9
        return 1 / (l ** 5 * (math.exp(c2 / (l * 2848)) - 1))
    s560 = 100 / planck(560)
    errA = max(abs(planck(n) * s560 - A[n]) / A[n] for n in range(380, 781))
    sys.path.insert(0, str(MAT))
    from materials import spectral as S
    grid = list(S.GRID)
    ours = S.cmf()
    cmf_err = max(abs(float(ours[i][k]) - xyz[int(g)][k]) for i, g in enumerate(grid) for k in range(3))
    return {"illuminant_A_planck_c2_1.435e-2_max_rel_err_380_780": float(f"{errA:.3g}"),
            "cmf_5nm_vs_1nm_max_abs_err": cmf_err,
            "note": "CIE illuminant A is defined as Planck at 2848 K with c2 = 1.435e-2 m K, normalised to 100 at 560 nm; the 1 nm CSV is that definition tabulated"}


def usgs():
    z = zipfile.ZipFile(prov.RAW / "usgs-splib07" / "ASCIIdata_splib07a.zip")
    rows = []
    for n in z.namelist():
        if "/ChapterA_ArtificialMaterials/" in n and n.endswith(".txt"):
            base = n.rsplit("/", 1)[1][len("splib07a_"):-4]
            m = re.match(r"(.*?)_?((?:GDS|[A-Z]{2,})\d+[A-Za-z]*)?_(\w+?)_(AREF|RREF|TRAN)?$", base)
            rows.append({"file": n.rsplit("/", 1)[1], "name": base.replace("_", " "), "status": "measured"})
    return rows


def main():
    c = cie()
    write("cie_check", {"provenance": prov.stamp("cie-datasets", ["CIE_std_illum_A_1nm.csv", "CIE_xyz_1931_2deg.csv", "CIE_std_illum_D65.csv", "CIE_sle_photopic.csv"],
                                                 status="defined", method="recompute and compare"), **c})
    u = usgs()
    write("usgs_splib07a_artificial_index", {"provenance": prov.stamp("usgs-splib07", ["ASCIIdata_splib07a.zip"], method="file index of Chapter A"), "rows": u})


if __name__ == "__main__":
    main()

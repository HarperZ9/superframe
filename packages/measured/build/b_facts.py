# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Single values read from primary documents, one row each, in our own words with a citation.

Every value here was read on 2026-10-30 from the named file (sha256 in the provenance block) and is
re-checked at build time against the document's text layer where it has one: the build fails if the
quoted string is no longer found. Scanned documents with no usable text layer are marked read_by_eye.
"""
import subprocess
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import PKG, prov, write  # noqa: E402

sys.path.insert(0, str(PKG))
from measured import wet  # noqa: E402

FACTS = [
    # (id, source, file, value, unit, quote that must appear in the text layer, note)
    ("cs.clock_zeeman", "steck-cesium", "cesiumnumbers.pdf", 427.45, "Hz/G^2", "427.45 Hz/G",
     "second-order Zeeman shift of the Cs clock transition, listed as 2 pi x 427.45 Hz/G^2 (angular)"),
    ("opa1642.en_1kHz", "ti-opa1642", "opa1642.pdf", 5.1, "nV/rtHz", "Input voltage noise density", "typical at 1 kHz; 5.8 at 100 Hz"),
    ("opa1642.in_1kHz", "ti-opa1642", "opa1642.pdf", 0.8, "fA/rtHz", "Input current noise density", "typical at 1 kHz"),
    ("mp1948.N0", "marshall-palmer1948", "marshall-palmer-1948.pdf", 8000.0, "m^-3 mm^-1", "0.08",
     "printed as N0 = 0.08 cm^-4 (the scan's text layer drops the exponent sign); 0.08 cm^-4 = 8000 m^-3 mm^-1"),
    ("mp1948.Lambda", "marshall-palmer1948", "marshall-palmer-1948.pdf", 4.1, "mm^-1 at R^-0.21", "41R",
     "printed as Lambda = 41 R^-0.21 cm^-1 with R in mm/h; = 4.1 R^-0.21 mm^-1"),
    ("rca1961.P31_t10", "rca-tpm1508a", "TPM-1508A_RCA_Phosphors_Oct61.pdf", 38e-6, "s", "38 microsec",
     "ZnS:Cu (P31), time for initial brightness to decay to 10%, 'approx. 38 microsec'"),
    ("rca1961.P11_t10", "rca-tpm1508a", "TPM-1508A_RCA_Phosphors_Oct61.pdf", 34e-6, "s", "34 micro",
     "ZnS:Ag (P11), 10% time 34 microsec"),
    ("kodak2383.base_um", "kodak-2383", "KODAK-VISION-Color-Print-Film-2383-3383-data-sheet.pdf", 120.0, "um", "120",
     "print film on 120 um (0.0047 in) ESTAR polyester base, no rem-jet"),
    ("kodak5219.base", "kodak-5219", "VISION3-500T-7219-TECHNICAL-DATA.pdf", None, "", "acetate safety base with rem-jet",
     "camera negative 5219/7219: acetate safety base with rem-jet backing; thickness not printed"),
]
ITU = [
    ("ntsc.datum_to_active", 9.2e-6, "s", "time datum (sync leading edge) to back edge of line blanking, M/NTSC, +0.2/-0.1 us"),
    ("ntsc.front_porch", 1.5e-6, "s", "front porch 1.5 +/- 0.1 us"),
    ("ntsc.sync", 4.7e-6, "s", "line sync pulse 4.7 +/- 0.1 us"),
    ("ntsc.line_blanking_range", [10.5e-6, 11.0e-6], "s", "line-blanking interval 10.5 to 11.0 us"),
    ("ntsc.line_period", 63.555e-6, "s", "nominal line period 63.555 us (1/fH)"),
]
# Rows from these sources go to the private overlay facts.private.json (author decision 2026-10-31).
PRIVATE_SOURCES = {"ti-opa1642", "rca-tpm1508a", "itu-r-bt"}
LD = [  # Lekner and Dorf 1988 known answers, read by eye from the scan (no text layer worth trusting)
    ("lekner_dorf.p_water", 0.475, "", "eq. 9 for water; Angstrom's 1 - 1/n^2 gives 0.437"),
    ("lekner_dorf.aw_ad_1.5", 1.07, "", "a_w/a_d for small a_d, n_l = 4/3, n_r = 1.5"),
    ("lekner_dorf.aw_ad_2.0", 1.08, "", "n_r = 2"),
    ("lekner_dorf.aw_ad_2.5", 1.10, "", "n_r = 2.5"),
]


def text(source, name):
    out = subprocess.run(["pdftotext", "-layout", str(prov.RAW / source / name), "-"], capture_output=True, check=True).stdout
    return out.decode("latin-1")


def main():
    rows, files = [], {}
    for fid, src, name, val, unit, quote, note in FACTS:
        t = text(src, name)
        assert quote in t, (fid, quote)
        files.setdefault(src, set()).add(name)
        rows.append({"id": fid, "value": val, "unit": unit, "source": src, "citation": prov.SOURCES[src][0], "file": name, "sha256": prov.verify(src, name),
                     "licence": prov.SOURCES[src][1], "status": "measured", "note": note})
    z = zipfile.ZipFile(prov.RAW / "itu-r-bt" / "R-REC-BT.1700-0-200502-I-ZPF-E.zip")
    assert "1700-e.pdf" in z.namelist()
    for fid, val, unit, note in ITU:
        rows.append({"id": fid, "value": val, "unit": unit, "source": "itu-r-bt", "citation": prov.SOURCES["itu-r-bt"][0], "file": "R-REC-BT.1700-0-200502-I-ZPF-E.zip:1700-e.pdf",
                     "sha256": prov.verify("itu-r-bt", "R-REC-BT.1700-0-200502-I-ZPF-E.zip"), "licence": prov.SOURCES["itu-r-bt"][1],
                     "status": "defined", "note": "ITU-R BT.1700 Table 2, " + note})
    ours = {"lekner_dorf.p_water": wet.p_internal(4 / 3), "lekner_dorf.aw_ad_1.5": wet.a_wet(1e-6, 1.5) / 1e-6,
            "lekner_dorf.aw_ad_2.0": wet.a_wet(1e-6, 2.0) / 1e-6, "lekner_dorf.aw_ad_2.5": wet.a_wet(1e-6, 2.5) / 1e-6}
    for fid, val, unit, note in LD:
        assert abs(ours[fid] - val) <= 0.006, (fid, ours[fid], val)
        rows.append({"id": fid, "value": val, "ours": round(ours[fid], 4), "unit": unit, "source": "lekner-dorf1988",
                     "citation": prov.SOURCES["lekner-dorf1988"][0], "file": "darkerwhenwet.pdf",
                     "sha256": prov.verify("lekner-dorf1988", "darkerwhenwet.pdf"), "licence": prov.SOURCES["lekner-dorf1988"][1],
                     "status": "measured", "read_by_eye": True, "note": note + "; reproduced by measured/wet.py"})
    pub = [r for r in rows if r["source"] not in PRIVATE_SOURCES]
    priv = [r for r in rows if r["source"] in PRIVATE_SOURCES]
    method = "values read from primary documents; quotes re-found in the text layer at build time"
    write("facts", {"provenance": {"method": method, "built_from": sorted({r["source"] for r in pub}),
                                   "private_overlay": "facts.private.json (see data/PRIVATE.json)"}, "rows": pub})
    write("facts", {"provenance": {"method": method, "built_from": sorted({r["source"] for r in priv})}, "rows": priv},
          private="rows marked internal (ti-opa1642, rca-tpm1508a) and ITU-R BT rows (author decision 2026-10-31)", field="rows")


if __name__ == "__main__":
    main()

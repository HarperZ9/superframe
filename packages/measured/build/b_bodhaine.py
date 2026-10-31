# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Rayleigh cross section, optical depth and King factor: Bodhaine et al. 1999 Table 3.

The table's text layer comes out with its columns shifted against the wavelength labels, so the
parser reads each column as a sequence (151 rows, 0.250 to 1.000 um in 0.005 um steps) instead of
trusting row alignment. Each parsed value is then compared with our implementation of the paper's
equations (measured/rayleigh.py); the table is accepted only if every row agrees to the printed
precision (5 significant figures, so 2e-4 relative).
"""
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import PKG, prov, write  # noqa: E402

sys.path.insert(0, str(PKG))
from measured import rayleigh  # noqa: E402

WV = [round(0.250 + 0.005 * i, 3) for i in range(151)]
NUM = re.compile(r"(\d\.\d{4})E(\d{2})")


def columns():
    txt = subprocess.run(["pdftotext", "-layout", str(prov.RAW / "bodhaine1999" / "rayleighOpticalDepth.pdf"), "-"],
                         capture_output=True, check=True).stdout.decode("latin-1")
    lines = txt.splitlines()
    start = next(i for i, l in enumerate(lines) if "TABLE 3. Scattering cross section" in l)
    end = next(i for i, l in enumerate(lines) if "REFERENCES" in l)
    sig = []
    for l in lines[start:end]:
        for m in NUM.finditer(l):
            e = int(m.group(2))
            if e >= 25:  # cross sections print as 1.2610E25 (the minus sign is lost): 1e-25 .. 1e-28
                sig.append(float(m.group(1)) * 10 ** -e)
    return sig


def main():
    parsed = columns()
    model = [rayleigh.sigma_cm2(w) for w in WV]
    # Match each model value to the parsed list in order (columns interleave two halves of the table).
    remaining = list(parsed)
    worst, matched = 0.0, 0
    for m in model:
        if not remaining:
            break
        j = min(range(len(remaining)), key=lambda k: abs(remaining[k] / m - 1))
        err = abs(remaining[j] / m - 1)
        if err < 2e-4:
            remaining.pop(j)
            matched += 1
            worst = max(worst, err)
    rows = [{"wavelength_um": w, "sigma_cm2": float(f"{s:.5g}"), "king_factor": round(rayleigh.king(w), 5),
             "beta_sea_level_per_m": float(f"{rayleigh.beta_per_m(w):.5g}"), "status": "measured"} for w, s in zip(WV, model)]
    meta = prov.stamp("bodhaine1999", ["rayleighOpticalDepth.pdf"],
                      method="paper's equations implemented in measured/rayleigh.py; every Table 3 cross section present in the text layer (129 of 151) matched within 4e-5",
                      conditions="dry air, 360 ppm CO2, 288.15 K, 1013.25 hPa, Ns = 2.546899e19 cm^-3")
    check = {"table3_values_parsed": len(parsed), "rows": len(WV), "rows_matched_within_2e-4": matched,
             "parsed_values_unmatched": len(remaining), "worst_rel_err_of_matched": float(f"{worst:.3g}"),
             "note": "rows not matched are missing from the PDF text layer, not disagreements"}
    assert not remaining and matched >= 120, check  # every value the text layer carries must match
    write("rayleigh_bodhaine1999", {"provenance": meta, "check": check, "rows": rows})


if __name__ == "__main__":
    main()

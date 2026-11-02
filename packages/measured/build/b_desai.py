# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Tungsten resistivity, Desai, James and Ho 1984 Table 5 (recommended values, 99.99% W).

Transcribed by hand from the text layer of the NIST reprint (pdftotext -layout), where the two-column
table comes out interleaved. Reconstruction: the uncorrected column has 30 values for the 30
temperatures 0 to 1000 K and 19 values for 1100 to 3660 K (solid); alignment checked against the
residual-resistivity formula on the same page (rho = 0.000015 + 7e-7 T^2 at 1 K gives 0.0000157)
and against the paper's text values at 293, 298 and 300 K. "Uncorrected" means not corrected for
thermal expansion, which is the quantity proportional to a filament's measured resistance.
Stated uncertainty: 3% 100-300 K, 5% low temperature; higher above 1500 K (see the table footnote).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

T = [0, 1, 4, 7, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 250, 273, 293, 298, 300,
     400, 500, 600, 700, 800, 900, 1000,
     1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600]
RHO = [0.0000150, 0.0000157, 0.0000267, 0.0000580, 0.000137, 0.000567, 0.00196, 0.00553, 0.0133, 0.0544,
       0.142, 0.266, 0.423, 0.606, 0.809, 1.021, 2.090, 3.18, 4.30, 4.82, 5.28, 5.40, 5.44,
       7.83, 10.34, 12.98, 15.73, 18.56, 21.47, 24.43,
       27.46, 30.54, 33.68, 36.86, 40.09, 43.36, 46.67, 50.02, 53.41, 56.83, 63.76, 70.81, 77.98, 85.26,
       92.66, 100.2, 107.8, 115.6]


def unc(t):
    if t < 100:
        return "5%"
    if t <= 300:
        return "3%"
    return "see Table 5 footnote (larger above 1500 K)"


def main():
    assert len(T) == len(RHO)
    assert all(b > a for a, b in zip(RHO[1:], RHO[2:])), "monotonic above 1 K"
    rows = [{"T_K": t, "rho_1e-8_ohm_m": r, "uncertainty": unc(t), "status": "measured"} for t, r in zip(T, RHO)]
    meta = prov.stamp("desai1984", ["1.555723.pdf"], method="hand transcription of Table 5, uncorrected column")
    write("tungsten_desai1984", {"provenance": meta, "quantity": "electrical resistivity of tungsten, not corrected for thermal expansion",
                                 "unit": "1e-8 ohm m", "rows": rows})


if __name__ == "__main__":
    main()

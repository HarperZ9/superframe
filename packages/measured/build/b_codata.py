# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""CODATA 2022 constants from NIST's allascii.txt (fixed-width: name to col 60, value, uncertainty, unit)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402


def num(s):
    s = s.replace(" ", "").replace("...", "")
    return float(s.replace("e", "E")) if s else None


def main():
    lines = (prov.RAW / "codata2022" / "allascii.txt").read_text(encoding="latin-1").splitlines()
    i = next(k for k, l in enumerate(lines) if l.startswith("-----")) + 1
    rows = []
    for l in lines[i:]:
        if not l.strip():
            continue
        name, val, unc, unit = l[:60].strip(), l[60:85].strip(), l[85:110].strip(), l[110:].strip()
        exact = unc == "(exact)"
        rows.append({"quantity": name, "value": num(val), "value_text": val, "uncertainty": None if exact else num(unc),
                     "exact": exact, "unit": unit, "status": "defined" if exact else "measured"})
    assert len(rows) > 300, len(rows)
    meta = prov.stamp("codata2022", ["allascii.txt"], method="fixed-width parse of the NIST complete listing")
    write("codata2022", {"provenance": meta, "adjustment": "2022", "rows": rows})


if __name__ == "__main__":
    main()

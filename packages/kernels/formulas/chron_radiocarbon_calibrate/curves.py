# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Radiocarbon calibration curves as versioned, hashed inputs.

A curve is named by an id such as "intcal20". Each id records where the file is published, its SHA-256, the
paper to cite and what the publisher says about reuse. The curve files are not stored in this repository:
intcal.org states no terms of use for them (read 2026-11-16), so the repository keeps the fetch step and the
hash, and a file whose hash differs is refused.

    python packages/kernels/formulas/chron_radiocarbon_calibrate/curves.py fetch intcal20

The files go to the folder named by RADIOCARBON_CURVES, else `curves/` next to this file (ignored by git).
"""
import hashlib
import os
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent

CURVES = {
    "intcal20": {
        "name": "IntCal20 Northern Hemisphere atmospheric radiocarbon calibration curve, 0 to 55 cal kBP",
        "version": "2020",
        "url": "https://intcal.org/curves/intcal20.14c",
        "sha256": "974a66649f2ac8a53e6c99e256b019ac6982f999b12dcf7193162d4c1c09168e",
        "points": 9501,
        "cite": "Reimer P, Austin WEN, Bard E, et al. 2020. The IntCal20 Northern Hemisphere radiocarbon age "
                "calibration curve (0-55 cal kBP). Radiocarbon 62(4): 725-757. doi:10.1017/RDC.2020.41",
        "terms": "intcal.org/curves.html and intcal.org state no licence or terms of use for the curve files "
                 "(read 2026-11-16). The paper is open access under CC BY 4.0 (Cambridge Core article page, "
                 "read 2026-11-16) and says the curve on its calendar grid is available for download at "
                 "intcal.org; the file itself carries no licence line. Stored here as a fetch step and a hash.",
        "fetched": "2026-11-16",
    },
}


class CurveError(RuntimeError):
    pass


def folder():
    return Path(os.environ.get("RADIOCARBON_CURVES") or HERE / "curves")


def path(curve_id):
    if curve_id not in CURVES:
        raise CurveError(f"unknown curve id {curve_id!r}; known: {', '.join(sorted(CURVES))}")
    return folder() / f"{curve_id}.14c"


def sha256(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def fetch(curve_id):
    """Download the curve file, check its hash, and keep it only if the hash matches."""
    p = path(curve_id)
    rec = CURVES[curve_id]
    if p.exists() and sha256(p) == rec["sha256"]:
        return p
    p.parent.mkdir(parents=True, exist_ok=True)
    data = urllib.request.urlopen(rec["url"], timeout=60).read()
    got = hashlib.sha256(data).hexdigest()
    if got != rec["sha256"]:
        raise CurveError(f"{rec['url']} has SHA-256 {got}, the recorded hash is {rec['sha256']}; not kept")
    p.write_bytes(data)
    return p


def parse(text):
    """(cal_bp, c14_age, c14_sigma) tuples from a .14c file, in file order (decreasing cal BP)."""
    cal, age, sig = [], [], []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(",")
        cal.append(float(parts[0]))
        age.append(float(parts[1]))
        sig.append(float(parts[2]))
    return tuple(cal), tuple(age), tuple(sig)


_LOADED = {}


def load(curve_id):
    """The curve as (cal_bp, c14_age, c14_sigma), after its hash is checked. Raises CurveError with the fetch
    command when the file is missing or its hash differs."""
    if curve_id in _LOADED:
        return _LOADED[curve_id]
    p = path(curve_id)
    if not p.exists():
        raise CurveError(f"curve {curve_id} is not present at {p}; run: python {Path(__file__).as_posix()} "
                         f"fetch {curve_id}")
    got = sha256(p)
    if got != CURVES[curve_id]["sha256"]:
        raise CurveError(f"{p} has SHA-256 {got}, the recorded hash for {curve_id} is "
                         f"{CURVES[curve_id]['sha256']}")
    curve = parse(p.read_text(encoding="latin-1"))
    if len(curve[0]) != CURVES[curve_id]["points"]:
        raise CurveError(f"{p} has {len(curve[0])} points, {CURVES[curve_id]['points']} recorded")
    _LOADED[curve_id] = curve
    return curve


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] != "fetch":
        sys.exit("usage: curves.py fetch <curve id>")
    print(fetch(sys.argv[2]))

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""The constants modules are generated from CODATA 2022, and no package keeps a hand copy.

A hand copy drifts: before this test, perceive carried the CODATA 2018 mu0 and Coulomb constant.
"""
import re
import subprocess
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
PACKAGES = PKG.parent
DIGITS = ("6.62607015", "1.380649", "1.602176634", "299792458", "2.99792458", "8.854187", "1.256637",
          "8.987551", "6.02214076", "5.670374", "2.897771", "9.1093837", "1.054571", "1.66053906")
SKIP_DIRS = {"tests", "data", "generated", "build", "node_modules", "_vectors"}
pattern = re.compile("|".join(re.escape(d) for d in DIGITS))


def test_generated_modules_are_fresh():
    out = subprocess.run([sys.executable, str(PKG / "build" / "gen_constants.py"), "--check"], capture_output=True, text=True)
    assert out.returncode == 0, out.stdout + out.stderr


def test_generated_values_are_the_codata_rows():
    sys.path.insert(0, str(PKG / "generated"))
    import constants as k
    assert k.c == 299792458.0 and k.h == 6.62607015e-34 and k.kB == 1.380649e-23
    assert abs(k.ke * 4 * 3.141592653589793 * k.eps0 - 1) < 1e-15


def test_no_package_keeps_a_hand_copy_of_a_constant():
    hits = []
    for path in PACKAGES.rglob("*"):
        if path.suffix not in {".py", ".js", ".mjs", ".cjs"} or SKIP_DIRS & set(path.relative_to(PACKAGES).parts):
            continue
        for n, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if pattern.search(line):
                hits.append(f"{path.relative_to(PACKAGES).as_posix()}:{n}: {line.strip()[:90]}")
    assert not hits, "import packages/measured/generated/constants instead:\n" + "\n".join(hits)

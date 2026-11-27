# SPDX-License-Identifier: MIT
"""Self-test for tools/check_vendored.py: a true copy matches, a renamed copy
matches through --as, a CRLF copy and an edited copy fail, and the CRLF cause
is named. Usage: python tests/test_check_vendored.py"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOL = ROOT / "tools" / "check_vendored.py"
SUMS = ROOT / "SHA256SUMS"


def run(*args):
    r = subprocess.run([sys.executable, str(TOOL), *map(str, args)], capture_output=True, text=True)
    return r.returncode, r.stdout


def main():
    failures = []
    code, _ = run(*(ROOT / f for f in ("superstack.py", "superstack.mjs", "superstack.hpp")), "--sums", SUMS)
    if code != 0:
        failures.append("the repository's own files do not match SHA256SUMS")
    with tempfile.TemporaryDirectory() as tmp:
        src = (ROOT / "superstack.mjs").read_bytes()
        renamed = Path(tmp) / "contracts.mjs"
        renamed.write_bytes(src)
        if run(renamed, "--sums", SUMS, "--as", "superstack.mjs")[0] != 0:
            failures.append("renamed true copy did not match")
        if run(renamed, "--sums", SUMS)[0] != 1:
            failures.append("renamed copy without --as should have no pin and fail")
        crlf = Path(tmp) / "superstack.mjs"
        crlf.write_bytes(src.replace(b"\n", b"\r\n"))
        code, out = run(crlf, "--sums", SUMS)
        if code != 1 or "CRLF" not in out:
            failures.append("CRLF copy should fail and name the cause")
        edited = Path(tmp) / "superstack.py"
        edited.write_bytes((ROOT / "superstack.py").read_bytes() + b"\n")
        if run(edited, "--sums", SUMS)[0] != 1:
            failures.append("edited copy should fail")
        if run(edited)[0] != 2:
            failures.append("missing --expect and --sums should be a usage error")
    for f in failures:
        print("FAIL", f)
    print("check_vendored:", "6/6 cases passed" if not failures else f"{len(failures)} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

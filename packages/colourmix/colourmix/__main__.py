# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Run every check and print the counts as one JSON document.

    python -m colourmix            (run from packages/colourmix)

Equality suites compare the compiled BuildLang kernels with the reference. Controls rebuild the kernels
with one planted defect each and count the mismatches the same suites then report. The fuzz run feeds
out-of-range and malformed inputs from a recorded seed. Exit code 0 means: no mismatch, every planted
defect caught, every malformed value refused.
"""
import json
import sys

from . import check, controls, fuzz, native


def main():
    why = native.unavailable()
    if why:
        print(json.dumps({"available": False, "reason": why}))
        return 2
    impl = native.kernels()
    report = {"available": True, "sample_seed": check.SAMPLE_SEED, "equality": {}, "controls": []}
    for name, suite in check.SUITES.items():
        cases, mismatches = suite(impl).result()
        report["equality"][name] = {"cases": cases, "mismatches": mismatches}
    for defect in controls.DEFECTS:
        cases, mismatches = controls.run(defect)
        report["controls"].append({"defect": defect[0], "cases": cases, "mismatches": mismatches})
    report["fuzz"] = fuzz.run(60000, fuzz.FUZZ_SEED)
    print(json.dumps(report, indent=1))
    clean = all(v["mismatches"] == 0 for v in report["equality"].values())
    caught = all(c["mismatches"] > 0 for c in report["controls"])
    refused = report["fuzz"]["malformed_tried"] == report["fuzz"]["malformed_refused"]
    return 0 if clean and caught and refused and report["fuzz"]["mismatches"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

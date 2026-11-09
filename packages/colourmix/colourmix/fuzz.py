# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Fuzz target: out-of-range and malformed inputs from a fixed, recorded seed.

    python -m colourmix.fuzz [cases] [seed]        (run from packages/colourmix)

The contract under test: every export either accepts an input and agrees with the reference, or rejects it
with a status code and writes nothing. No input may trap or crash the process, so a test runs this file in
a child process and reads the exit code. Values that are not 64-bit integers never reach a kernel: the
Python layer refuses them with TypeError or ValueError. Prints one JSON line with the counts.
"""
import json
import sys

from . import I64_MAX, I64_MIN, MAX_PARTS, native, reference
from .check import Rng, _bits

FUZZ_SEED = 0x1775_1772_1872
EDGES = [I64_MIN, I64_MIN + 1, -(1 << 32), -(1 << 31), -MAX_PARTS, -2, -1, 0, 1, 2, 3, 6, 7, 8, 12, 13,
         MAX_PARTS - 1, MAX_PARTS, MAX_PARTS + 1, (1 << 31) - 1, 1 << 31, 1 << 32, I64_MAX - 1, I64_MAX]
MALFORMED = [None, 1.5, float("nan"), float("inf"), "3", b"3", [1], (1,), {}, True, 1 << 63, -(1 << 63) - 1, 1 << 200]
ARITY = {"mayer_count": 1, "mayer_mix": 3, "mayer_index": 3, "mayer_cell": 2, "lambert_side": 1,
         "lambert_count": 1, "lambert_mix": 3, "benson_count": 1, "benson_section": 5, "benson_complement": 4,
         "benson_corner": 4, "modern_benson_linear_rgb": 4}


def value(rng):
    """One 64-bit integer: an edge value, a raw 64-bit pattern, or a small number near the valid ranges."""
    kind = rng.below(4)
    if kind == 0:
        return EDGES[rng.below(len(EDGES))]
    if kind == 1:
        return rng.next() - (1 << 63)
    return rng.span(-3, 16) if kind == 2 else rng.span(-3, MAX_PARTS + 3)


def case(rng):
    """(function name, arguments) for one fuzz case."""
    names = sorted(ARITY) + ["benson_line"]
    name = names[rng.below(len(names))]
    if name == "benson_line":
        return name, (value(rng), [value(rng) for _ in range(3)], [value(rng) for _ in range(3)], value(rng), value(rng))
    return name, tuple(value(rng) for _ in range(ARITY[name]))


def rejected(result):
    return result == -1 if isinstance(result, int) else result[0] != 0


def malformed(impl):
    """Count malformed values the Python layer refused; return (tried, refused)."""
    tried = refused = 0
    for name, arity in sorted(ARITY.items()):
        for slot in range(arity):
            for bad in MALFORMED:
                args = [1] * arity
                args[slot] = bad
                tried += 1
                try:
                    getattr(impl, name)(*args)
                except (TypeError, ValueError):
                    refused += 1
    for bad in MALFORMED + [[0, 0], [0, 0, 0, 0], [0, 0, None]]:
        for ends in ((bad, [0, 0, 0]), ([0, 0, 0], bad)):
            tried += 1
            try:
                impl.benson_line(2, *ends, 1, 0)
            except (TypeError, ValueError):
                refused += 1
    return tried, refused


def run(cases, seed):
    impl, rng = native.kernels(), Rng(seed)
    out = {"seed": seed, "cases": cases, "accepted": 0, "rejected": 0, "mismatches": 0, "first_mismatch": None}
    for _ in range(cases):
        name, args = case(rng)
        got, want = getattr(impl, name)(*args), getattr(reference, name)(*args)
        if _bits(got) != _bits(want):
            out["mismatches"] += 1
            out["first_mismatch"] = out["first_mismatch"] or repr((name, args, got, want))
        out["rejected" if rejected(got) else "accepted"] += 1
    out["malformed_tried"], out["malformed_refused"] = malformed(impl)
    return out


def main(argv):
    cases = int(argv[1]) if len(argv) > 1 else 60000
    seed = int(argv[2], 0) if len(argv) > 2 else FUZZ_SEED
    out = run(cases, seed)
    print(json.dumps(out))
    clean = out["mismatches"] == 0 and out["malformed_tried"] == out["malformed_refused"]
    return 0 if clean else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))

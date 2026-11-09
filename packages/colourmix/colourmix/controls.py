# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Planted defects: each one is a small wrong edit to a kernel source that the equality suite must catch.

A check that passes on a wrong kernel proves nothing, so every suite is run against these as well. Each
entry is (name, kernel, text to find, replacement). The text must occur exactly once in the source.
"""
from . import check, native

DEFECTS = [
    ("mayer: yellow and blue swapped", "mayer", "o[1] = col;\n    o[2] = row - col;",
     "o[1] = row - col;\n    o[2] = col;"),
    ("mayer: each row loses its last cell", "mayer", "col >= 0 && col <= row", "col >= 0 && col < row"),
    ("mayer: cell count one row short", "mayer", "(n + 1) * (n + 2) / 2\n}", "n * (n + 1) / 2\n}"),
    ("lambert: six triangles in place of seven", "lambert", "tier < 1 || tier > 7", "tier < 1 || tier > 6"),
    ("lambert: upper sides one part too long", "lambert", "    7 - tier\n", "    8 - tier\n"),
    ("lambert: yellow and red swapped", "lambert", "o[1] = row - col;\n    o[2] = col;",
     "o[1] = col;\n    o[2] = row - col;"),
    ("lambert: white share one eighth too large", "lambert", "o[3] = 8 - s;", "o[3] = 9 - s;"),
    ("benson: section taken across the wrong axis", "benson", "if axis == 0 {", "if axis == 1 {"),
    ("benson: red and green corner letters swapped", "benson", "r / n * 4 + g / n * 2", "r / n * 2 + g / n * 4"),
    ("benson: line stops one step short", "benson", "k < 0 || k > steps", "k < 0 || k >= steps"),
    ("modern: green read from blue", "modern", "o[1] = (g as f64) / d;", "o[1] = (b as f64) / d;"),
    ("modern: multiply by a reciprocal, one rounding too many", "modern", "o[0] = (r as f64) / d;",
     "o[0] = (r as f64) * (1.0 / d);"),
]


def mutated(defect):
    """The kernel sources with one defect planted."""
    _, kernel, old, new = defect
    texts = native.sources()
    if texts[kernel].count(old) != 1:
        raise ValueError(f"defect text must occur exactly once in {kernel}.bld: {old!r}")
    texts[kernel] = texts[kernel].replace(old, new)
    return texts


def run(defect):
    """(cases, mismatches) of the defect's own suite against a library built with the defect planted."""
    impl = native.Kernels(native.compile_library(mutated(defect)))
    return check.SUITES[defect[1]](impl).result()

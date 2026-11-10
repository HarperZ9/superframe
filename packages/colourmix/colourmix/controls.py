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
    ("lambert: six triangles in place of seven", "lambert", "tier > 7 {\n        return -1;",
     "tier > 6 {\n        return -1;"),
    ("lambert: upper sides one part too long", "lambert", "    7 - tier\n", "    8 - tier\n"),
    ("lambert: yellow and red swapped", "lambert", "o[1] = row - col;\n    o[2] = col;",
     "o[1] = col;\n    o[2] = row - col;"),
    ("lambert: white one portion too large", "lambert", "o[0] = 8 - cm_lambert_side(tier);",
     "o[0] = 9 - cm_lambert_side(tier);"),
    ("lambert: an amount of white invented for triangle 4", "lambert", "if tier == 4 || tier == 6 {",
     "if tier == 6 {"),
    ("lambert: base numbered row by row", "lambert", "9 * col - col * (col - 1) / 2 + (row - col) + 1",
     "row * (row + 1) / 2 + col + 1"),
    ("lambert: a repeated mixture given a new number", "lambert", "row % 3 == 0 && col % 3 == 0",
     "row % 6 == 0 && col % 6 == 0"),
    ("mayer: Tab. II read from the blue side", "mayer", "o[0] = row - col;\n    o[1] = n - row;\n    o[2] = col;",
     "o[0] = col;\n    o[1] = n - row;\n    o[2] = row - col;"),
    ("mayer: red weighed like blue in the editor's table", "mayer", "o[0] = 3 * (6 - row);", "o[0] = 6 * (6 - row);"),
    ("benson: section taken across the wrong axis", "benson", "if axis == 0 {", "if axis == 1 {"),
    ("benson: red and green corner letters swapped", "benson", "r / n * 4 + g / n * 2", "r / n * 2 + g / n * 4"),
    ("benson: line stops one step short", "benson", "k < 0 || k > steps", "k < 0 || k >= steps"),
    ("modern: green read from blue", "modern", "o[1] = (g as f64) / d;", "o[1] = (b as f64) / d;"),
    ("modern: multiply by a reciprocal, one rounding too many", "modern", "o[0] = (r as f64) / d;",
     "o[0] = (r as f64) * (1.0 / d);"),
    ("modern: encoded red left in the blue place", "modern", "    o[2] = o[0];\n", "    o[1] = o[0];\n"),
    ("rgbspace: sRGB green primary moved by 0.001", "rgbspace", "[6400, 3300, 3000, 6000,", "[6400, 3300, 3010, 6000,"),
    ("rgbspace: D50 white with a rounded Z", "rgbspace", "cm_tenk(8249)", "cm_tenk(8250)"),
    ("rgbspace: one Bradford entry with the wrong sign", "rgbspace", "367, 389, 0 - 685", "367, 389, 685"),
    ("rgbspace: adaptation run the wrong way", "rgbspace", "* (dst / src)", "* (src / dst)"),
    ("transfer: sRGB joint at the encoded threshold", "transfer", "v <= cm_frac(31308, 10000000)",
     "v <= cm_frac(4045, 100000)"),
    ("transfer: Rec. 2020 offset from the 10-bit constants", "transfer",
     "cm_ratpow(v, 9, 20) - cm_frac(993, 10000)", "cm_ratpow(v, 9, 20) - cm_frac(99, 1000)"),
    ("transfer: root stopped after 6 steps", "transfer", "while i < 48 {", "while i < 6 {"),
]
SUITE_OF = {"rgbspace": "spaces", "transfer": "spaces"}   # kernels checked by a suite of another name


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
    return check.SUITES[SUITE_OF.get(defect[1], defect[1])](impl).result()

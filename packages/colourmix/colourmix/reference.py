# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The reference for the kernels in bld/: plain Python, standard library only, one rule per line.

Every function takes 64-bit signed integers and follows the contract in docs/. A function that fills an
output buffer in BuildLang returns (status, values) here, with values None when the status is not 0.
"""
from . import I64_MAX, I64_MIN, MAX_PARTS

OK, BAD_PARTS, OUTSIDE, BAD_AXIS, OFF_LATTICE, NOT_STATED, BAD_NAME = 0, 1, 2, 3, 4, 5, 6
LAMBERT_SIDES = {1: 8, 2: 6, 3: 4, 4: 3, 5: 2, 6: 1, 7: 0}   # parts per pigment in each triangle, base first
# White as sections 81 to 86 state it: (portions of white, portions of the whole). Triangles 4 and 6 are absent
# because sections 83 and 85 print no amount.
LAMBERT_WHITE = {1: (0, 8), 2: (2, 8), 3: (4, 8), 5: (6, 8), 7: (1, 1)}
# The numbered leaf of section 87, transcribed from the page image: triangle, then rows from the blue corner
# down, each row from the yellow side.
LAMBERT_NUMBERS = {
    1: [[1], [2, 10], [3, 11, 18], [4, 12, 19, 25], [5, 13, 20, 26, 31], [6, 14, 21, 27, 32, 36],
        [7, 15, 22, 28, 33, 37, 40], [8, 16, 23, 29, 34, 38, 41, 43], [9, 17, 24, 30, 35, 39, 42, 44, 45]],
    2: [[1], [46, 50], [47, 51, 56], [5, 52, 57, 31], [48, 53, 58, 61, 63], [49, 54, 59, 62, 64, 66],
        [9, 55, 60, 35, 65, 67, 45]],
    3: [[1], [3, 18], [5, 20, 31], [7, 22, 33, 40], [9, 24, 35, 42, 45]],
    4: [[1], [47, 56], [48, 58, 63], [9, 60, 65, 45]],
    5: [[1], [5, 31], [9, 35, 45]],
    6: [[1], [9, 45]],
    7: [[0]],   # the white cell carries no number
}
# Lichtenberg's table of weights (appendix, p. 99), transcribed from the page image as (red, blue, yellow)
# exponents, rows from the red corner. The three corners are printed as letters; their weights follow the
# rule of the other cells.
LICHTENBERG_TABLE = [
    [(18, 0, 0)],
    [(15, 6, 0), (15, 0, 1)],
    [(12, 12, 0), (12, 6, 1), (12, 0, 2)],
    [(9, 18, 0), (9, 12, 1), (9, 6, 2), (9, 0, 3)],
    [(6, 24, 0), (6, 18, 1), (6, 12, 2), (6, 6, 3), (6, 0, 4)],
    [(3, 30, 0), (3, 24, 1), (3, 18, 2), (3, 12, 3), (3, 6, 4), (3, 0, 5)],
    [(0, 36, 0), (0, 30, 1), (0, 24, 2), (0, 18, 3), (0, 12, 4), (0, 6, 5), (0, 0, 6)],
]
BENSON_LETTERS = {(0, 0, 0): "Z", (1, 0, 0): "R", (0, 1, 0): "G", (0, 0, 1): "B",
                  (1, 1, 0): "Y", (0, 1, 1): "S", (1, 0, 1): "P", (1, 1, 1): "W"}


def i64(x):
    """x when it is a 64-bit signed integer; TypeError for another type, ValueError out of range."""
    if type(x) is not int:
        raise TypeError(f"expected an integer, got {type(x).__name__}")
    if x < I64_MIN or x > I64_MAX:
        raise ValueError("integer outside the 64-bit signed range")
    return x


def point(p):
    """p as three 64-bit levels; TypeError when it is not a sequence of integers, ValueError on a wrong length."""
    levels = tuple(i64(x) for x in p)
    if len(levels) != 3:
        raise ValueError("a point needs three levels")
    return levels


def _parts_ok(n):
    return 1 <= n <= MAX_PARTS


def _triangle_count(n):
    """Cells in a triangle of n parts, counted row by row: row r holds r + 1 cells."""
    return sum(row + 1 for row in range(n + 1))


def mayer_count(n):
    return _triangle_count(n) if _parts_ok(i64(n)) else -1


def mayer_mix(n, row, col):
    """(status, (red, yellow, blue)): row from the red corner, column from the blue side of the row."""
    if not _parts_ok(i64(n)):
        return BAD_PARTS, None
    if not (0 <= i64(row) <= n and 0 <= i64(col) <= row):
        return OUTSIDE, None
    red = n - row
    yellow = col
    blue = n - red - yellow
    return OK, (red, yellow, blue)


def mayer_index(n, row, col):
    status, _ = mayer_mix(n, row, col)
    if status != OK:
        return -1
    return sum(r + 1 for r in range(row)) + col


def mayer_cell(n, index):
    """(status, (row, col)) for the cell at position index in reading order."""
    if not _parts_ok(i64(n)):
        return BAD_PARTS, None
    if not 0 <= i64(index) < (n + 1) * (n + 2) // 2:
        return OUTSIDE, None
    row = 0
    while index >= row + 1:
        index -= row + 1
        row += 1
    return OK, (row, index)


def mayer_tab2(n, row, col):
    """(status, (red, yellow, blue)) in the layout of Tab. II: row from the yellow corner, column from red."""
    if not _parts_ok(i64(n)):
        return BAD_PARTS, None
    if not (0 <= i64(row) <= n and 0 <= i64(col) <= row):
        return OUTSIDE, None
    yellow = n - row
    blue = col
    red = n - yellow - blue
    return OK, (red, yellow, blue)


def lichtenberg_mass(row, col):
    """(status, (red, yellow, blue)) weights of the cell, read from the printed table."""
    if not (0 <= i64(row) <= 6 and 0 <= i64(col) <= row):
        return OUTSIDE, None
    red, blue, yellow = LICHTENBERG_TABLE[row][col]
    return OK, (red, yellow, blue)


def lambert_side(tier):
    return LAMBERT_SIDES.get(i64(tier), -1)


def lambert_count(tier):
    side = lambert_side(tier)
    return -1 if side < 0 else _triangle_count(side)


def lambert_total():
    return sum(lambert_count(t) for t in LAMBERT_SIDES)


def lambert_mix(tier, row, col):
    """(status, (blue, yellow, red)) out of lambert_side(tier): row from the blue corner, column from yellow."""
    side = lambert_side(tier)
    if side < 0:
        return BAD_PARTS, None
    if not (0 <= i64(row) <= side and 0 <= i64(col) <= row):
        return OUTSIDE, None
    blue = side - row
    red = col
    yellow = side - blue - red
    return OK, (blue, yellow, red)


def lambert_white(tier):
    """(status, (white portions, whole portions)); NOT_STATED where the book prints no amount."""
    if lambert_side(tier) < 0:
        return BAD_PARTS, None
    if tier not in LAMBERT_WHITE:
        return NOT_STATED, None
    return OK, LAMBERT_WHITE[tier]


def lambert_number(tier, row, col):
    """The number printed in the cell on the numbered leaf, 0 for the white cell, -1 when rejected."""
    status, _ = lambert_mix(tier, row, col)
    if status != OK:
        return -1
    return LAMBERT_NUMBERS[tier][row][col]


def _in_cube(n, *levels):
    return all(0 <= i64(v) <= n for v in levels)


def benson_count(n):
    return (n + 1) ** 3 if _parts_ok(i64(n)) else -1


def benson_section(n, axis, level, u, v):
    """(status, (red, green, blue)): light `axis` held at `level`, the other two at u and v in R, G, B order."""
    if not _parts_ok(i64(n)):
        return BAD_PARTS, None
    if i64(axis) not in (0, 1, 2):
        return BAD_AXIS, None
    if not _in_cube(n, level, u, v):
        return OUTSIDE, None
    point = [u, v]
    point.insert(axis, level)
    return OK, tuple(point)


def benson_complement(n, r, g, b):
    if not _parts_ok(i64(n)):
        return BAD_PARTS, None
    if not _in_cube(n, r, g, b):
        return OUTSIDE, None
    return OK, (n - r, n - g, n - b)


def benson_corner(n, r, g, b):
    """ASCII code of the corner letter, 0 for a point that is not a corner, -1 when rejected."""
    if not _parts_ok(i64(n)) or not _in_cube(n, r, g, b):
        return -1
    if any(v not in (0, n) for v in (r, g, b)):
        return 0
    return ord(BENSON_LETTERS[(r // n, g // n, b // n)])


def benson_line(n, a, b, steps, k):
    """(status, (red, green, blue)): point k of the line from a to b cut into `steps` equal steps."""
    a, b = point(a), point(b)
    if not _parts_ok(i64(n)):
        return BAD_PARTS, None
    if not _parts_ok(i64(steps)) or not 0 <= i64(k) <= steps:
        return OFF_LATTICE, None
    if not _in_cube(n, *a, *b):
        return OUTSIDE, None
    if any(((q - p) * k) % steps for p, q in zip(a, b)):
        return OFF_LATTICE, None
    return OK, tuple(p + (q - p) * k // steps for p, q in zip(a, b))


def modern_benson_linear_rgb(n, r, g, b):
    """(status, three floats): each level as the fraction level / n, one IEEE 754 double division each."""
    if not _parts_ok(i64(n)):
        return BAD_PARTS, None
    if not _in_cube(n, r, g, b):
        return OUTSIDE, None
    return OK, (r / n, g / n, b / n)


from .reference_modern import (modern_decode, modern_encode, modern_rgb_to_xyz,  # noqa: E402,F401
                               modern_xyz_to_rgb)


def modern_benson_xyz(space, white, n, r, g, b):
    """(status, (X, Y, Z)): the cube point as linear RGB of a named space, under the chosen white."""
    status, rgb = modern_benson_linear_rgb(n, r, g, b)
    if status != OK:
        i64(space), i64(white)
        return status, None
    return modern_rgb_to_xyz(space, white, *rgb)


def modern_benson_encoded(space, n, r, g, b):
    """(status, three floats): the cube point as encoded RGB of a named space."""
    status, rgb = modern_benson_linear_rgb(n, r, g, b)
    if status != OK:
        i64(space)
        return status, None
    if i64(space) not in (0, 1, 2):
        return BAD_NAME, None
    return OK, tuple(modern_encode(space, v)[1] for v in rgb)

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The reference for the kernels in bld/: plain Python, standard library only, one rule per line.

Every function takes 64-bit signed integers and follows the contract in docs/. A function that fills an
output buffer in BuildLang returns (status, values) here, with values None when the status is not 0.
"""
from . import I64_MAX, I64_MIN, MAX_PARTS

OK, BAD_PARTS, OUTSIDE, BAD_AXIS, OFF_LATTICE = 0, 1, 2, 3, 4
LAMBERT_SIDES = {1: 8, 2: 6, 3: 4, 4: 3, 5: 2, 6: 1, 7: 0}   # parts per pigment in each triangle, base first
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


def lambert_side(tier):
    return LAMBERT_SIDES.get(i64(tier), -1)


def lambert_count(tier):
    side = lambert_side(tier)
    return -1 if side < 0 else _triangle_count(side)


def lambert_total():
    return sum(lambert_count(t) for t in LAMBERT_SIDES)


def lambert_mix(tier, row, col):
    """(status, (blue, yellow, red, white)) in eighths: row from the blue corner, column from the yellow side."""
    side = lambert_side(tier)
    if side < 0:
        return BAD_PARTS, None
    if not (0 <= i64(row) <= side and 0 <= i64(col) <= row):
        return OUTSIDE, None
    blue = side - row
    red = col
    yellow = side - blue - red
    return OK, (blue, yellow, red, 8 - side)


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

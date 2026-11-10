# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Benson 1872: equality with the reference, and the properties the source states."""
from collections import Counter
from itertools import product

from colourmix import check

CORNERS = {"Z": (0, 0, 0), "R": (1, 0, 0), "G": (0, 1, 0), "B": (0, 0, 1),
           "Y": (1, 1, 0), "S": (0, 1, 1), "P": (1, 0, 1), "W": (1, 1, 1)}


def test_buildlang_equals_reference(kernels):
    tally = check.benson(kernels)
    assert tally.mismatches == 0, tally.first
    assert tally.cases == 102385


def test_modern_mapping_equals_reference(kernels):
    tally = check.modern(kernels)
    assert tally.mismatches == 0, tally.first
    assert tally.cases == 73964


def test_nine_sections_of_nine_cover_the_cube(impl):
    assert impl.benson_count(2) == 27
    seen = Counter()
    for axis, level in product(range(3), repeat=2):
        block = [impl.benson_section(2, axis, level, u, v) for u, v in product(range(3), repeat=2)]
        assert all(status == 0 for status, _ in block)
        points = {point for _, point in block}
        assert len(points) == 9 and all(point[axis] == level for point in points)
        seen.update(points)
    assert len(seen) == 27 and set(seen.values()) == {3}      # each point lies in one section per axis
    assert sum(seen.values()) == 81                           # the plate: nine blocks of nine discs


def test_corner_letters(impl):
    for n in (1, 2, 5):
        for letter, unit in CORNERS.items():
            assert impl.benson_corner(n, *(n * x for x in unit)) == ord(letter)
    assert impl.benson_corner(2, 1, 0, 2) == 0 and impl.benson_corner(2, 3, 0, 0) == -1


def test_complementary_pairs(impl):
    def letter_of(point):
        return chr(impl.benson_corner(2, *point))
    pairs = {letter: letter_of(impl.benson_complement(2, *(2 * x for x in unit))[1]) for letter, unit in CORNERS.items()}
    assert (pairs["R"], pairs["G"], pairs["B"], pairs["Z"]) == ("S", "P", "Y", "W")     # page 14
    for point in product(range(4), repeat=3):
        status, other = impl.benson_complement(3, *point)
        assert status == 0 and tuple(a + b for a, b in zip(point, other)) == (3, 3, 3)
        assert impl.benson_complement(3, *other)[1] == point


def test_a_line_through_the_cube_is_a_uniform_gradation(impl):
    for a, b in product(product(range(0, 9, 4), repeat=3), repeat=2):
        points = [impl.benson_line(8, a, b, 4, k) for k in range(5)]
        assert all(status == 0 for status, _ in points)
        steps = {tuple(q - p for p, q in zip(points[k][1], points[k + 1][1])) for k in range(4)}
        assert len(steps) == 1 and points[0][1] == a and points[4][1] == b
    assert impl.benson_line(2, (0, 0, 0), (2, 2, 1), 2, 1) == (4, None)       # the midpoint is off the lattice


def test_relabelling_the_lights_moves_the_section_axis(impl):
    for level, u, v in product(range(3), repeat=3):
        red_cut = impl.benson_section(2, 0, level, u, v)[1]
        assert impl.benson_section(2, 1, level, u, v)[1] == (red_cut[1], red_cut[0], red_cut[2])
        assert impl.benson_section(2, 2, level, u, v)[1] == (red_cut[1], red_cut[2], red_cut[0])


def test_modern_mapping_is_exact_at_the_plate_levels(impl):
    for point in product(range(3), repeat=3):
        assert impl.modern_benson_linear_rgb(2, *point) == (0, tuple(x / 2 for x in point))
    assert impl.modern_benson_linear_rgb(7, 0, 7, 0) == (0, (0.0, 1.0, 0.0))


def test_rejects_by_status_code(impl):
    assert impl.benson_section(0, 0, 0, 0, 0) == (1, None) and impl.benson_section(2, 3, 0, 0, 0) == (3, None)
    assert impl.benson_section(2, 0, 3, 0, 0) == (2, None) and impl.benson_complement(2, -1, 0, 0) == (2, None)
    assert impl.benson_line(2, (0, 0, 0), (2, 2, 2), 0, 0) == (4, None) and impl.benson_count(4097) == -1
    assert impl.modern_benson_linear_rgb(0, 0, 0, 0) == (1, None)

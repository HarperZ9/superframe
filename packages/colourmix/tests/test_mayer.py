# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Mayer 1775: equality with the reference, and the properties the source states."""
from itertools import permutations

from colourmix import check, reference


def cells(impl, n):
    out = []
    for row in range(n + 1):
        for col in range(row + 1):
            status, mix = impl.mayer_mix(n, row, col)
            assert status == 0
            out.append(mix)
    return out


def test_buildlang_equals_reference(kernels):
    tally = check.mayer(kernels)
    assert tally.mismatches == 0, tally.first
    assert tally.cases == 39899


def test_cell_counts_match_the_plate_and_the_text(impl):
    assert impl.mayer_count(6) == 28          # Tab. III as painted: rows of 1 to 7 hexagons
    assert impl.mayer_count(12) == 91         # section 17: the triangular number with side 13
    rows = [sum(1 for col in range(-1, 9) if impl.mayer_mix(6, row, col)[0] == 0) for row in range(-1, 9)]
    assert rows == [0, 1, 2, 3, 4, 5, 6, 7, 0, 0]
    assert len(cells(impl, 6)) == 28 and len(set(cells(impl, 12))) == 91


def test_tally_of_simple_binary_and_ternary_mixtures(impl):
    kinds = [sum(1 for part in mix if part > 0) for mix in cells(impl, 12)]
    assert (kinds.count(1), kinds.count(2), kinds.count(3)) == (3, 33, 55)   # section 16


def test_parts_sum_to_the_whole(impl):
    for n in (1, 6, 12, 24):
        assert all(sum(mix) == n and min(mix) >= 0 for mix in cells(impl, n))


def test_corners_are_the_pure_primaries(impl):
    for n in (6, 12):
        assert impl.mayer_mix(n, 0, 0) == (0, (n, 0, 0))      # top: red
        assert impl.mayer_mix(n, n, 0) == (0, (0, 0, n))      # bottom left: blue
        assert impl.mayer_mix(n, n, n) == (0, (0, n, 0))      # bottom right: yellow


def test_relabelling_the_primaries_keeps_the_figure(impl):
    for n in (6, 12):
        figure = set(cells(impl, n))
        for order in permutations(range(3)):
            assert {tuple(mix[i] for i in order) for mix in figure} == figure
        for row in range(n + 1):                              # mirror a row: yellow and blue change places
            for col in range(row + 1):
                red, yellow, blue = impl.mayer_mix(n, row, col)[1]
                assert impl.mayer_mix(n, row, row - col)[1] == (red, blue, yellow)


def test_neighbours_in_a_row_differ_by_one_part(impl):
    for row in range(1, 13):
        for col in range(row):
            a, b = impl.mayer_mix(12, row, col)[1], impl.mayer_mix(12, row, col + 1)[1]
            assert sorted(y - x for x, y in zip(a, b)) == [-1, 0, 1]


def test_index_and_cell_are_inverse(impl):
    for n in (6, 12):
        for index in range(impl.mayer_count(n)):
            status, (row, col) = impl.mayer_cell(n, index)
            assert status == 0 and impl.mayer_index(n, row, col) == index


def test_rejects_by_status_code(impl):
    assert impl.mayer_mix(0, 0, 0) == (1, None) and impl.mayer_mix(4097, 0, 0) == (1, None)
    assert impl.mayer_mix(6, 7, 0) == (2, None) and impl.mayer_mix(6, 3, 4) == (2, None)
    assert impl.mayer_count(0) == -1 and impl.mayer_index(6, -1, 0) == -1
    assert impl.mayer_cell(6, 28) == (2, None)


def test_tab2_follows_the_engraved_plate(impl):
    assert impl.mayer_tab2(12, 0, 0) == (0, (0, 12, 0))       # apex: G^12, yellow
    assert impl.mayer_tab2(12, 12, 0) == (0, (12, 0, 0))      # bottom left: R^12
    assert impl.mayer_tab2(12, 12, 12) == (0, (0, 0, 12))     # bottom right: B^12
    assert [impl.mayer_tab2(12, 1, col)[1] for col in range(2)] == [(1, 11, 0), (0, 11, 1)]   # r1 g11 | g11 b1
    assert impl.mayer_tab2(12, 12, 1)[1] == (11, 0, 1)        # bottom row, second cell: r11 b1
    tab2 = {impl.mayer_tab2(12, row, col)[1] for row in range(13) for col in range(row + 1)}
    assert tab2 == set(cells(impl, 12))                       # the same 91 mixtures in another order
    assert impl.mayer_tab2(0, 0, 0) == (1, None) and impl.mayer_tab2(12, 13, 0) == (2, None)


def test_editors_weights_follow_the_printed_table(impl):
    for row in range(7):
        for col in range(row + 1):
            red, blue, yellow = reference.LICHTENBERG_TABLE[row][col]
            assert impl.lichtenberg_mass(row, col) == (0, (red, yellow, blue))
            parts = impl.mayer_mix(6, row, col)[1]            # p. 98: red 3, yellow 1, blue 6 per part
            assert (red, yellow, blue) == (3 * parts[0], parts[1], 6 * parts[2])
    assert impl.lichtenberg_mass(2, 1) == (0, (12, 1, 6))     # printed r12 b6 g1
    assert impl.lichtenberg_mass(7, 0) == (2, None) and impl.lichtenberg_mass(3, 4) == (2, None)

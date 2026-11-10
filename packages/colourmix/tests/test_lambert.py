# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Lambert 1772: equality with the reference, and the properties the source states."""
from itertools import permutations
from math import gcd

from colourmix import check, reference

TIERS = range(1, 8)


def cells(impl, tier):
    side = impl.lambert_side(tier)
    out = []
    for row in range(side + 1):
        for col in range(row + 1):
            status, mix = impl.lambert_mix(tier, row, col)
            assert status == 0
            out.append(mix)
    return out


def ratio(mix):
    """The pigment parts of a mixture in lowest terms."""
    blue, yellow, red = mix
    d = gcd(blue, gcd(yellow, red))
    return (blue // d, yellow // d, red // d)


def test_buildlang_equals_reference(kernels):
    tally = check.lambert(kernels)
    assert tally.mismatches == 0, tally.first
    assert tally.cases == 3214


def test_cell_counts_match_the_text_and_the_plate(impl):
    assert [impl.lambert_count(t) for t in TIERS] == [45, 28, 15, 10, 6, 3, 1]   # sections 80 to 86
    assert impl.lambert_total() == 108                                           # section 87
    assert [len(cells(impl, t)) for t in TIERS] == [45, 28, 15, 10, 6, 3, 1]
    front = [sum(1 for col in range(-1, 11) if impl.lambert_mix(t, impl.lambert_side(t), col)[0] == 0) for t in TIERS]
    assert front == [9, 7, 5, 4, 3, 2, 1]                                        # front rows on the plate


def test_pigment_parts_sum_to_the_side(impl):
    for tier in TIERS:
        side = impl.lambert_side(tier)
        assert all(sum(mix) == side and min(mix) >= 0 for mix in cells(impl, tier))


def test_white_is_given_only_where_the_book_states_it(impl):
    assert impl.lambert_white(1) == (0, (0, 8))              # section 80: the base has no white
    assert impl.lambert_white(2) == (0, (2, 8))              # section 81
    assert impl.lambert_white(3) == (0, (4, 8))              # section 82
    assert impl.lambert_white(5) == (0, (6, 8))              # section 84
    assert impl.lambert_white(7) == (0, (1, 1))              # section 86: one cell, wholly white
    assert impl.lambert_white(4) == (5, None)                # section 83 prints no amount
    assert impl.lambert_white(6) == (5, None)                # section 85 prints no amount
    assert impl.lambert_white(0) == (1, None) and impl.lambert_white(8) == (1, None)


def test_stated_white_and_pigment_make_eight_portions(impl):
    for tier in (1, 2, 3, 5):
        white, whole = impl.lambert_white(tier)[1]
        assert white + impl.lambert_side(tier) == whole == 8


def test_numbers_follow_the_numbered_leaf(impl):
    for tier in TIERS:
        side = impl.lambert_side(tier)
        rows = [[impl.lambert_number(tier, row, col) for col in range(row + 1)] for row in range(side + 1)]
        assert rows == reference.LAMBERT_NUMBERS[tier]
    assert [impl.lambert_number(2, 6, col) for col in range(7)] == [9, 55, 60, 35, 65, 67, 45]
    assert impl.lambert_number(7, 0, 0) == 0 and impl.lambert_number(7, 1, 0) == -1
    assert impl.lambert_number(0, 0, 0) == -1 and impl.lambert_number(1, 3, 4) == -1


def test_one_number_for_one_mixture(impl):
    by_number = {}
    for tier in range(1, 7):
        side = impl.lambert_side(tier)
        for row in range(side + 1):
            for col in range(row + 1):
                mix = ratio(impl.lambert_mix(tier, row, col)[1])
                assert by_number.setdefault(impl.lambert_number(tier, row, col), mix) == mix
    assert sorted(by_number) == list(range(1, 68))           # section 87: 67 numbers
    assert len(set(by_number.values())) == 67


def test_sixty_seven_distinct_mixtures_and_white(impl):
    pigment = {ratio(mix) for tier in range(1, 7) for mix in cells(impl, tier)}
    assert len(pigment) == 67                                                    # section 87
    assert cells(impl, 7) == [(0, 0, 0)] and len(pigment) + 1 == 68


def test_upper_tiers_repeat_lower_ones(impl):
    def pigments(tier, times):
        return {tuple(times * part for part in mix) for mix in cells(impl, tier)}
    assert pigments(3, 2) <= pigments(1, 1)      # section 82: the third triangle doubled lies in the base
    assert pigments(4, 2) <= pigments(2, 1)      # section 83: the fourth doubled lies in the second


def test_corners_are_the_pure_pigments(impl):
    for tier in range(1, 7):
        s = impl.lambert_side(tier)
        assert impl.lambert_mix(tier, 0, 0)[1] == (s, 0, 0)          # apex: blue
        assert impl.lambert_mix(tier, s, 0)[1] == (0, s, 0)          # yellow corner
        assert impl.lambert_mix(tier, s, s)[1] == (0, 0, s)          # red corner


def test_relabelling_the_pigments_keeps_each_triangle(impl):
    for tier in TIERS:
        figure = set(cells(impl, tier))
        for order in permutations(range(3)):
            assert {tuple(mix[i] for i in order) for mix in figure} == figure


def test_rejects_by_status_code(impl):
    assert impl.lambert_mix(0, 0, 0) == (1, None) and impl.lambert_mix(8, 0, 0) == (1, None)
    assert impl.lambert_mix(7, 1, 0) == (2, None) and impl.lambert_mix(1, 9, 0) == (2, None)
    assert impl.lambert_side(8) == -1 and impl.lambert_count(0) == -1

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The named RGB spaces: equality with the reference, published values, and round trips."""
import math
from itertools import product

import pytest

from colourmix import check

SPACES, WHITES = range(3), range(2)
# Luminance of full red, green and blue as each standard prints it, to four places.
LUMINANCE = {0: (0.2126, 0.7152, 0.0722), 1: (0.2290, 0.6917, 0.0793), 2: (0.2627, 0.6780, 0.0593)}
GRID = [i / 8 for i in range(9)]


def test_buildlang_equals_reference(kernels):
    cube, named = check.modern(kernels), check.spaces(kernels)
    assert cube.mismatches == 0, cube.first
    assert named.mismatches == 0, named.first
    assert (cube.cases, named.cases) == (73964, 74150)


def test_luminance_of_the_primaries_matches_the_standards(impl):
    for space, want in LUMINANCE.items():
        got = [impl.modern_rgb_to_xyz(space, 0, *rgb)[1][1] for rgb in ((1, 0, 0), (0, 1, 0), (0, 0, 1))]
        assert got == pytest.approx(want, abs=5e-5)
        assert sum(got) == pytest.approx(1.0, abs=1e-12)


def test_white_lands_on_the_stated_white_point(impl):
    for space in SPACES:
        x, y, z = impl.modern_rgb_to_xyz(space, 0, 1, 1, 1)[1]
        assert (x / (x + y + z), y / (x + y + z)) == pytest.approx((0.3127, 0.3290), abs=1e-12)   # D65
        assert impl.modern_rgb_to_xyz(space, 1, 1, 1, 1)[1] == pytest.approx((0.9642, 1.0, 0.8249), abs=1e-12)


def test_srgb_red_matches_the_published_matrix(impl):
    # First column of the sRGB to XYZ matrix in IEC 61966-2-1, four places.
    assert impl.modern_rgb_to_xyz(0, 0, 1, 0, 0)[1] == pytest.approx((0.4124, 0.2126, 0.0193), abs=5e-5)


def test_xyz_round_trip(impl):
    for space, white in product(SPACES, WHITES):
        for rgb in product((0.0, 0.25, 0.6, 1.0), repeat=3):
            xyz = impl.modern_rgb_to_xyz(space, white, *rgb)[1]
            assert impl.modern_xyz_to_rgb(space, white, *xyz)[1] == pytest.approx(rgb, abs=1e-12)


def test_transfer_round_trip(impl):
    for space in SPACES:
        for v in [i / 1000 for i in range(1001)]:
            back = impl.modern_decode(space, impl.modern_encode(space, v)[1])[1]
            # Rec. 2020's rounded constants leave a small step where its two branches meet, at 0.0181.
            near_joint = space == 2 and abs(v - 0.0181) < 2e-4
            assert back == pytest.approx(v, abs=1e-6 if near_joint else 1e-12)


def test_transfer_matches_a_library_power(impl):
    for v in [i / 500 for i in range(501)]:
        srgb = 12.92 * v if v <= 0.0031308 else 1.055 * math.pow(v, 1 / 2.4) - 0.055
        rec = 4.5 * v if v < 0.0181 else 1.0993 * math.pow(v, 0.45) - 0.0993
        assert impl.modern_encode(0, v)[1] == pytest.approx(srgb, abs=1e-13)
        assert impl.modern_encode(1, v)[1] == impl.modern_encode(0, v)[1]      # Display P3 uses the sRGB curve
        assert impl.modern_encode(2, v)[1] == pytest.approx(rec, abs=1e-13)


def test_transfer_fixed_points_and_order(impl):
    for space in SPACES:
        assert impl.modern_encode(space, 0.0) == (0, 0.0)
        assert impl.modern_encode(space, 1.0)[1] == pytest.approx(1.0, abs=1e-15)
        curve = [impl.modern_encode(space, v)[1] for v in GRID]
        assert curve == sorted(curve) and len(set(curve)) == len(curve)


def test_cube_mappings_agree_with_their_parts(impl):
    for space, n in product(SPACES, (1, 6)):
        for r, g, b in product(range(n + 1), repeat=3):
            linear = impl.modern_benson_linear_rgb(n, r, g, b)[1]
            assert impl.modern_benson_encoded(space, n, r, g, b)[1] == tuple(
                impl.modern_encode(space, v)[1] for v in linear)
            for white in WHITES:
                assert impl.modern_benson_xyz(space, white, n, r, g, b) == impl.modern_rgb_to_xyz(space, white, *linear)


def test_rejects_by_status_code(impl):
    nan, inf = float("nan"), float("inf")
    assert impl.modern_encode(3, 0.5) == (6, None) and impl.modern_decode(-1, 0.5) == (6, None)
    assert impl.modern_encode(0, 1.5) == (2, None) and impl.modern_decode(0, -0.1) == (2, None)
    assert impl.modern_encode(0, nan) == (2, None) and impl.modern_decode(2, inf) == (2, None)
    assert impl.modern_rgb_to_xyz(3, 0, 0, 0, 0) == (6, None) and impl.modern_rgb_to_xyz(0, 2, 0, 0, 0) == (6, None)
    assert impl.modern_rgb_to_xyz(0, 0, nan, 0, 0) == (2, None) and impl.modern_xyz_to_rgb(0, 1, 0, inf, 0) == (2, None)
    assert impl.modern_benson_xyz(0, 0, 0, 0, 0, 0) == (1, None) and impl.modern_benson_xyz(0, 0, 6, 7, 0, 0) == (2, None)
    assert impl.modern_benson_xyz(5, 0, 6, 1, 2, 3) == (6, None) and impl.modern_benson_encoded(9, 6, 1, 2, 3) == (6, None)
    with pytest.raises(TypeError):
        impl.modern_encode(0, "0.5")
    with pytest.raises(TypeError):
        impl.modern_rgb_to_xyz(0.0, 0, 0.1, 0.2, 0.3)

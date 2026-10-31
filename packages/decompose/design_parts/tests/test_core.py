# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Known-answer tests for the palette, geometry, shape and texture extractors."""
import numpy as np
import pytest

from design_parts import geometry, palette, shape, synth, texture
from design_parts.imageio import lightness, to_array


def test_golden_section_focal_point():
    rgb = to_array(synth.golden_disk())
    f = geometry.focal_point(rgb)
    assert abs(f["focal_x"] - 0.618) < 0.03 and abs(f["focal_y"] - 0.382) < 0.03
    assert f["focal_d_golden"] < 0.03 < f["focal_d_thirds"]


@pytest.mark.parametrize("n", [3, 4, 5, 6, 8])
def test_rotational_symmetry_order(n):
    r = geometry.rotational_symmetry(lightness(synth.rosette(n)))
    assert r["rot_order"] == n
    assert r["rot_strength_order"] > 0.9


def test_mirror_scores():
    a = synth.disk_at(0.5, 0.3)
    m = geometry.mirror_scores(lightness(a))
    assert m["sym_lr"] > 0.95 and m["sym_ud"] < 0.5


def test_known_palette_count_and_complement():
    four = [(200, 30, 40), (20, 60, 200), (240, 220, 40), (20, 20, 20)]
    assert palette.measure(synth.palette_blocks(four))["palette_count"] == 4
    comp = palette.hue_stats(synth.palette_blocks([(220, 40, 40), (20, 170, 160)]))
    assert comp["harm_m2"] > 0.8 and comp["harm_m2"] - comp["harm_m1"] > 0.4
    mono = palette.hue_stats(synth.palette_blocks([(200, 40, 40), (120, 20, 20)]))
    assert mono["harm_m1"] > 0.9


def test_value_structure_range():
    v = palette.value_structure(synth.palette_blocks([(0, 0, 0), (255, 255, 255)]))
    assert v["L_range"] > 95 and v["value_levels"] == 2


def test_line_weight_known_stroke():
    for w in (3, 6, 10):
        assert abs(texture.line_weight(lightness(synth.stripes(w)))["line_weight"] - w) <= 1


def test_spectrum_slope_known_beta():
    for beta in (1.0, 2.0, 3.0):
        s = texture.spectrum_slope(lightness(synth.power_noise(beta)))["spec_slope"]
        assert abs(s + beta) < 0.25


def test_negative_space_share():
    ns = texture.negative_space(synth.figure_on_ground(0.1))["neg_space"]
    assert 0.8 < ns < 0.92


def test_rhythm_period():
    r = texture.rhythm(lightness(synth.dot_grid(period=32)))
    assert abs(r["rhythm_period"] - 32) < 2 and r["rhythm"] > 0.15
    assert texture.rhythm(lightness(synth.power_noise(2.0)))["rhythm"] < 0.1
    assert texture.self_similarity(lightness(synth.dot_grid()))["self_sim"] > 0.8
    assert texture.self_similarity(lightness(synth.power_noise(2.0)))["self_sim"] < 0.5


def test_primitive_counts():
    p = shape.primitives(to_array(synth.shapes(3, 2, 1), side=384))
    assert (p["prim_circle"], p["prim_quad"], p["prim_tri"]) == (3, 2, 1)


def test_straight_versus_curved():
    sq = shape.curvature(lightness(synth.outline("square")))["straight_share"]
    ci = shape.curvature(lightness(synth.outline("circle")))["straight_share"]
    assert sq > 0.6 and ci < 0.4

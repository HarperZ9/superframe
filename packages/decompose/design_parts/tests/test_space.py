# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Known-answer tests for Part 5: wallpaper groups, perspective, figure-ground, impossible figures and
the space generators."""
import numpy as np
import pytest
from PIL import Image, ImageDraw

from design_parts import geometry, impossible, perspective, spacegen, synth, wallpaper
from design_parts.imageio import lightness


@pytest.mark.parametrize("g", wallpaper.GROUPS)
def test_wallpaper_group_clean(g):
    assert wallpaper.classify(wallpaper.render_group(g, seed=0))["group"] == g


def test_wallpaper_rotated_noisy_mostly_right():
    rng = np.random.default_rng(0)
    hits = 0
    for g in wallpaper.GROUPS:
        L = wallpaper.render_group(g, seed=10, cell=34, angle=17.0)
        hits += wallpaper.classify(L + rng.normal(0, 0.05, L.shape))["group"] == g
    assert hits >= 16


def test_noise_is_not_periodic():
    r = wallpaper.classify(lightness(synth.power_noise(2.0)) / 100)
    assert not r["periodic"]


def _floor(w=384, h=256, vx=0.62, vy=0.35):
    im = Image.new("RGB", (w, h), (235, 235, 230))
    d = ImageDraw.Draw(im)
    V = (vx * w, vy * h)
    for k in range(-6, 16):
        d.line([V, (k * w / 9, h * 1.0)], fill=(30, 30, 30), width=2)
    for yy in (0.45, 0.55, 0.68, 0.85):
        d.line([(0, yy * h), (w, yy * h)], fill=(30, 30, 30), width=2)
    d.rectangle([0, 0, w, V[1] - 2], fill=(200, 210, 225))
    return np.asarray(im, float) / 255


def test_vanishing_point_and_horizon():
    m, extra = perspective.measure(_floor())
    vp = [v for v in extra["vps"] if v["finite"]][0]
    assert abs(vp["x"] - 0.62) < 0.03 and abs(vp["y"] - 0.35) < 0.03
    assert abs(m["horizon_y"] - 0.35) < 0.04
    assert any(not v["finite"] and min(v["dir"], 180 - v["dir"]) < 3 for v in extra["vps"])  # horizontals: at infinity


def test_figure_ground_reversibility():
    fg_checker = perspective.figure_ground(lightness(synth.checker()))
    fg_disk = perspective.figure_ground(lightness(synth.figure_on_ground(0.1)))
    assert fg_checker["fg_reversibility"] > 0.8
    assert fg_disk["fg_reversibility"] < 0.3 and abs(fg_disk["fg_ratio"] - 0.1) < 0.02


def test_penrose_tribar_local_but_not_global():
    r = impossible.check(*impossible.penrose_tribar())
    assert r["local_ok"] and not r["global_ok"]
    assert abs(abs(r["cycle_depth_gaps"][0]) - 3 * np.sqrt(3)) < 1e-6  # depth gap = L (1,1,1).v summed


@pytest.mark.parametrize("fig", [impossible.real_square, impossible.cube_corner])
def test_possible_figures_close(fig):
    r = impossible.check(*fig())
    assert r["local_ok"] and r["global_ok"]
    assert all(abs(g) < 1e-9 for g in r["cycle_depth_gaps"])


def test_hyperbolic_tiling_symmetry():
    img, info = spacegen.hyperbolic(7, 3, size=384)
    rs = geometry.rotation_scores(img, (384 - 1) / 2, (384 - 1) / 2, orders=(6, 7, 8))
    assert rs[7] > 0.75 and rs[6] < 0.2 and rs[8] < 0.2
    with pytest.raises(ValueError):
        spacegen.hyperbolic(4, 4)


def test_droste_self_similarity():
    img, info = spacegen.droste(size=256, s=4.0)
    rng = np.random.default_rng(0)
    r = rng.uniform(0.15, 0.3, 400)
    t = rng.uniform(0, 2 * np.pi, 400)
    z = r * np.exp(1j * t)
    beta = info["beta"]
    f = lambda zz: spacegen.nested_squares(np.exp(np.log(zz) / beta), 4.0)  # noqa: E731
    same = np.mean(np.isclose(f(z), f(z * info["step"]), atol=1e-6))
    assert same > 0.97
    assert abs(abs(info["step"]) - 1) > 0.05  # the step scales as it turns


def test_metamorphosis_square_to_hex():
    L = spacegen.metamorphosis(width=2048, height=256, cell=40)
    left = geometry.rotation_scores(L, 80, 80, orders=(4, 6))
    # a hex lattice point near the right end: x = 40 (i + j/2), y = 40 j sqrt3/2
    i, j = 48, 2
    right = geometry.rotation_scores(L, 40 * j * np.sqrt(3) / 2, 40 * (i + j / 2), orders=(4, 6))
    assert left[4] > 0.8 and left[6] < left[4] - 0.3
    assert right[6] > 0.8 and right[4] < right[6] - 0.3

# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""One call that measures every design axis of an image and returns flat numeric features.

measure_all(rgb, wallpaper=True) -> (features: dict[str, float], extra: dict)
extra holds the regions, segments and vanishing points so channel renders reuse them.
Feature families (FAMILIES) name which axis each feature belongs to.
"""
import numpy as np

from . import geometry, palette, perspective, shape, texture, wallpaper
from .imageio import lightness

FAMILIES = {
    "palette": ["palette_count", "palette_top_share", "chroma_mean", "chromatic_share", "hue_entropy", "harm_m1",
                "harm_m2", "harm_m3", "hue_cos", "hue_sin", "L_p5", "L_p50", "L_p95", "L_range", "L_key",
                "dark_share", "value_levels"],
    "shape": ["prim_count", "prim_circle", "prim_quad", "prim_tri", "prim_irregular", "prim_size_cv",
              "straight_share", "curv_median", "edge_density"],
    "geometry": ["sym_lr", "sym_ud", "rot_order", "rot_strength", "orth_share", "grid_peak_x", "grid_peak_y",
                 "aspect", "split_x", "split_y", "split_x_golden_d", "split_y_golden_d", "split_x_thirds_d",
                 "split_y_thirds_d", "focal_x", "focal_y", "focal_strength", "focal_d_center", "focal_d_thirds",
                 "focal_d_golden"],
    "space": ["neg_space", "flat_share", "line_weight", "ink_share"],
    "motif": ["self_sim", "rhythm", "rhythm_period", "wp_strength"],
    "spectrum": ["spec_slope"],
    "perspective": ["n_segments", "n_vp", "n_vp_finite", "vp1_x", "vp1_y", "vp_weight", "horizon_y",
                    "seg_oblique_share", "fg_ratio", "fg_border_gap", "fg_reversibility", "framing_ratio",
                    "frame_cx", "frame_cy"],
}
ALL = [k for v in FAMILIES.values() for k in v]


def measure_all(rgb, do_wallpaper=True):
    f = {}
    C, _ = palette.palette(rgb)
    p = palette.measure(rgb)
    f.update({k: v for k, v in p.items() if k != "harmony"})
    f["hue_cos"], f["hue_sin"] = float(np.cos(p["hue_mean"])), float(np.sin(p["hue_mean"]))
    regs = shape.regions(rgb, C)
    counts = {"circle": 0, "quad": 0, "tri": 0, "irregular": 0}
    for r in regs:
        counts[r["kind"]] += 1
    a = np.array([r["area"] for r in regs], float)
    f["prim_count"] = len(regs)
    f.update({f"prim_{k}": v for k, v in counts.items()})
    f["prim_size_cv"] = float(a.std() / a.mean()) if len(a) > 1 else 0.0
    L = lightness(rgb)
    f.update(shape.curvature(L))
    f.update(geometry.measure(rgb))
    f.update(texture.measure(rgb))
    pm, pextra = perspective.measure(rgb)
    f.update(pm)
    wp = {"group": None, "strength": 0.0, "periodic": False}
    if do_wallpaper:
        h, w = L.shape
        n = min(h, w)
        sq = L[(h - n) // 2:(h - n) // 2 + n, (w - n) // 2:(w - n) // 2 + n]
        try:
            wp = wallpaper.classify(sq / 100.0)
        except Exception as e:  # report, keep measuring the rest
            wp = {"group": None, "strength": 0.0, "periodic": False, "error": repr(e)}
    f["wp_strength"] = float(wp.get("strength", 0.0))
    out = {k: (float(f[k]) if f.get(k) is not None else np.nan) for k in ALL}
    return out, {"regions": regs, "segments": pextra["segments"], "vps": pextra["vps"], "wallpaper": wp,
                 "harmony": p["harmony"]}

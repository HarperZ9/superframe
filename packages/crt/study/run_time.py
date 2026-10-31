# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Time behaviour: a camera shutter against the raster, and phosphor trails behind a moving ball.
    python -B study/run_time.py
"""
import json

import numpy as np

from common import OUT, Tube, beam, dump, eye, backend, png, scene, screen, white_levels

SHUTTERS = [1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 90, None, 1 / 50, 1 / 30, "2T", 1 / 15]


def shutter_curves(xp, res, phases=16):
    t = Tube(diagonal_in=6.0)
    src = scene.flat(0.5)
    steady = beam.frame(t, src, 0, t.T, xp=xp).sum()
    rows = []
    for s in SHUTTERS:
        L = t.T if s is None else 2 * t.T if s == "2T" else s
        vals, band = [], None
        for k in range(phases):
            a = k * t.T / phases
            Q = beam.frame(t, src, a, a + L, xp=xp)
            vals.append(float(Q.sum() / (steady * L / t.T)))
            if k == 0:
                prof = Q.sum(axis=(1, 2))[t.rows // 20:-t.rows // 20]
                band = float(prof.min() / prof.max())
        v = np.array(vals)
        rows.append(dict(exposure_s=L, label="1/%d" % round(1 / L), fields=L / t.T, mean=float(v.mean()),
                         flicker_pp=float((v.max() - v.min()) / v.mean()), row_min_over_max=band, by_phase=vals))
    res["shutter"] = dict(field_s=t.T, scene="flat 0.5", phases=phases, rows=rows)


def shutter_images(xp, res):
    t = Tube()
    wmean, _ = white_levels(t, xp)
    still = scene.dungeon(1)(0)
    out = []
    for L, a, name in ((1 / 1000, 0.45, "1000"), (1 / 250, 0.30, "250"), (1 / 125, 0.20, "125"),
                       (None, 0.0, "field"), (1 / 50, 0.0, "50")):
        L = t.T if L is None else L
        xyz, _ = eye(t, lambda f: still, xp, a * t.T, a * t.T + L)
        tri = screen.downsample(xyz * (t.T / L), 3, 3)
        png(OUT / f"shutter-{name}.png", screen.to_display(tri, wmean))
        out.append(dict(file=f"shutter-{name}.png", exposure_s=L, start_s=a * t.T))
    frames = []
    for k in range(16):
        a = k * t.T / 16
        xyz, _ = eye(t, lambda f: still, xp, a, a + 1 / 250)
        tri = screen.downsample(xyz * (t.T * 250), 3, 3)
        png(OUT / f"_roll-{k:02d}.png", screen.to_display(tri, wmean))
        frames.append(f"_roll-{k:02d}.png")
    res["shutter_images"] = dict(stills=out, roll_frames=frames)


def trail_metrics(t, xyz, cx_src, speed, radius):
    def col(sx):
        x = (sx + 0.5) / 320 * t.raster_w - t.raster_w / 2
        return int((x + t.face_w / 2) / t.dx)
    y = (120.5 / 240) * t.raster_h - t.raster_h / 2
    r = int((y + t.face_h / 2) / t.dx)
    band = slice(r - 40, r + 40)
    ball = xyz[band, col(cx_src - radius - 1):col(cx_src + radius + 1)].sum(axis=(0, 1))
    tail = xyz[band, col(cx_src - 6 * speed - radius):col(cx_src - radius - 2)].sum(axis=(0, 1))
    return (tail / ball).tolist(), r, col(cx_src)


def trails(xp, res):
    out = {}
    speed, radius, f0 = 6, 10, 20
    ball = scene.ball(speed, radius)
    for decay in ("kuhn2002", "patent", "ast", "raw-native"):
        t = Tube(decay=decay)
        wmean, _ = white_levels(t, xp)
        xyz, _ = eye(t, lambda f: ball(f + f0), xp, static=False, history=6)
        ratio, r, c = trail_metrics(t, xyz, 60 + speed * f0, speed, radius)
        crop = screen.downsample(xyz[r - 60:r + 60, c - 210:c + 75], 3, 3)
        png(OUT / f"trail-{decay}.png", screen.to_display(crop, wmean))
        png(OUT / f"trail-{decay}-plus3stops.png", screen.to_display(crop * 8, wmean))
        out[decay] = dict(tail_over_ball_XYZ=ratio, grade=t.ph["grade"])
    res["trails"] = dict(speed_px_per_field=speed, history_fields=6, presets=out)


def trail_gif_frames(xp, res):
    t = Tube(decay="patent")
    wmean, _ = white_levels(t, xp)
    ball = scene.ball(6, 10)
    names = []
    for k in range(16):
        f0 = 14 + k
        xyz, _ = eye(t, lambda f, f0=f0: ball(f + f0), xp, static=False, history=6)
        y = int(((120.5 / 240) * t.raster_h - t.raster_h / 2 + t.face_h / 2) / t.dx)
        crop = screen.downsample(xyz[y - 60:y + 60, 330:1230], 3, 3)
        png(OUT / f"_ball-{k:02d}.png", screen.to_display(crop * 8, wmean))
        names.append(f"_ball-{k:02d}.png")
    res["trail_gif_frames"] = names


if __name__ == "__main__":
    xp, res = backend(), {}
    shutter_curves(xp, res)
    shutter_images(xp, res)
    trails(xp, res)
    trail_gif_frames(xp, res)
    dump("results-time.json", res)
    print(json.dumps({"shutter": [(r["label"], round(r["flicker_pp"], 4), r["row_min_over_max"]) for r in res["shutter"]["rows"]],
                      "trails": res["trails"]}, indent=1, default=float))


def shutter_bands(xp, res):
    """Light per band of six scan lines for a flat field, shutter opening at
    0.45 of the field: the share of lines above half the brightest, and the dimmest over the brightest."""
    t = Tube(diagonal_in=6.0)
    src = scene.flat(0.5)
    y = t.y_rows()
    line = np.clip(((y + t.raster_h / 2) / t.line_mm).astype(int) // 6, 0, t.active_lines // 6 - 1)
    out, ref = [], None
    for L in (t.T, 1 / 4000, 1 / 1000, 1 / 250, 1 / 125, t.T, 1 / 50):
        a = 0.0 if ref is None else 0.45 * t.T
        prof = beam.frame(t, src, a, a + L, xp=xp).sum(axis=(1, 2))
        per = np.bincount(line, weights=prof, minlength=t.active_lines // 6)[1:-1]
        if ref is None:
            ref = per
            continue
        per = per / ref
        out.append(dict(exposure_s=L, lit_share=float((per > 0.5 * per.max()).mean()),
                        min_over_max=float(per.min() / per.max()), profile=(per / per.max()).round(4).tolist()))
    res["shutter_bands"] = out

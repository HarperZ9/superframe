# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Still frames: the dungeon through the physical tube, the spectral frame, the spot growth, the
cost per frame, and raw-native style_crt on the same source. Run with the CUDA venv:
    python -B study/run_frames.py <style_crt_root> <node_runner>
"""
import json
import subprocess
import sys
import time

import numpy as np

from common import OUT, Tube, beam, dump, eye, backend, png, scene, screen, upscale, white_levels
from crt import colour
from crt.backend import make


def cell_of(tube, sx, sy):
    x = (sx + 0.5) / 320 * tube.raster_w - tube.raster_w / 2
    y = (sy + 0.5) / 240 * tube.raster_h - tube.raster_h / 2
    return int((y + tube.face_h / 2) / tube.dx), int((x + tube.face_w / 2) / tube.dx)


def stills(tube, xp, res):
    wmean, wmax = white_levels(tube, xp)
    still = scene.dungeon(1)(0)
    xyz, co = eye(tube, lambda f: still, xp)
    png(OUT / "dungeon-stripes.png", screen.to_display(xyz, wmax))
    tri = screen.downsample(xyz, 3, 3)
    png(OUT / "dungeon-display.png", screen.to_display(tri, wmean))
    r, c = cell_of(tube, 101, 84)
    crop = xyz[r - 75:r + 75, c - 100:c + 100]
    png(OUT / "dungeon-torch-zoom.png", upscale(screen.to_display(crop, wmax), 4))
    sp = colour.expand(tube, co[r - 24:r + 24, c - 24:c + 24]).astype(np.float32)
    np.savez_compressed(OUT / "dungeon-spectral.npz", coeff=co.astype(np.float32), basis=colour.basis(tube),
                        grid_nm=np.arange(380, 781, 5), torch_cube=sp)
    res["white"] = dict(mean_cd_m2=wmean, brightest_stripe_cd_m2=wmax,
                        primaries_xy=colour.chromaticities(tube), gains=tube.gains.tolist())
    res["torch_spectrum_peak_nm"] = int(380 + 5 * np.argmax(sp.sum(axis=(0, 1))))
    return still, tri, wmean


def spot(tube, xp, res):
    src, rows = scene.drive_lines()
    Q = beam.frame(tube, src, 0, tube.T, xp=xp)
    y, prof = tube.y_rows(), Q[:, tube.triads // 2, 1]
    out = []
    for r, v in zip(rows, (0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0)):
        yc = tube.line_y()[r]
        w = np.abs(y - yc) < 4 * tube.line_mm
        p, yy = prof[w], y[w]
        m = (p * yy).sum() / p.sum()
        s = float(np.sqrt(max((p * (yy - m) ** 2).sum() / p.sum() - tube.dx ** 2 / 12, 0)))
        out.append(dict(drive=v, sigma_mm=s, fwhm_mm=2.3548 * s, peak_norm=float(p.max()),
                        profile=(p / p.max()).round(4).tolist(), y_mm=(yy - yc).round(3).tolist()))
    res["spot"] = dict(line_mm=tube.line_mm, lines=out)
    co = screen.cells(tube, Q, halo=False)
    xyz = screen.luminance(tube, co, tube.T)
    r0 = int((tube.line_y()[rows[0]] + tube.face_h / 2) / tube.dx) - 8
    r1 = int((tube.line_y()[rows[-1]] + tube.face_h / 2) / tube.dx) + 8
    crop = xyz[r0:r1, tube.cols // 2 - 40:tube.cols // 2 + 40]
    png(OUT / "spot-growth.png", upscale(screen.to_display(crop, float(crop[..., 1].max())), 5))


def cost(tube, res):
    src = scene.dungeon(1)
    t = {}
    for name in ("cpu", "cuda"):
        xp = make(name)
        beam.frame(tube, src, 0, tube.T, xp=xp)
        runs = []
        for _ in range(3):
            s = time.perf_counter()
            Q = beam.frame(tube, src, 0, tube.T, xp=xp)
            screen.cells(tube, Q)
            runs.append(time.perf_counter() - s)
        t[name] = dict(seconds=runs, median=float(np.median(runs)))
    res["cost"] = dict(cells=tube.rows * tube.cols, history_fields=8, **t)


def style_crt(tube, still, ours_tri, wmean, root, runner, res):
    over = {"tube": {"diagonalIn": tube.diagonal_in, "overscan": tube.overscan, "corner": 0.5, "gamma": tube.gamma},
            "view": {"border": 0}, "curvature": {"rx": 1e9, "ry": 1e9},
            "spot": {"lo": tube.spot_lo, "hi": tube.spot_hi, "exponent": tube.spot_exp},
            "mask": {"type": "grille", "pitch": tube.pitch_mm, "fill": 1.0},
            "signal": {"rgbMHz": 100}, "glass": {"thickness": 12, "transmission": 0.56, "albedo": 0.5, "n": 1.52},
            "room": {"ambient": 0, "reflection": 0, "bezel": [0, 0, 0]}}
    out = {}
    for name, img, W, H in (("dungeon", still, tube.cols, tube.rows), ("white", np.ones_like(still), 474, 356)):
        f = OUT / f"_src-{name}.f32"
        rgba = np.concatenate([img, np.ones(img.shape[:2] + (1,))], -1).astype(np.float32)
        f.write_bytes(rgba.tobytes())
        lin_path = OUT / f"_style_crt-{name}.f32"
        p = subprocess.run(["node", runner, root, str(f), str(lin_path), str(W), str(H), "3", json.dumps(over)],
                           capture_output=True, text=True, check=True)
        out[name] = json.loads(p.stdout.strip().splitlines()[-1])
        out[name]["lin"] = np.frombuffer(lin_path.read_bytes(), np.float32).reshape(H, W, 4)[..., :3]
        f.unlink()
        lin_path.unlink()
    M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    theirs = screen.downsample(out["dungeon"]["lin"].astype(np.float64), 3, 3) @ M.T
    wy = float((out["white"]["lin"][100:250, 150:320] @ M.T)[..., 1].mean())
    w = (0.95047, 1.0, 1.08883)
    lab_t = colour.to_lab(theirs / wy, w)
    lab_o = colour.to_lab(ours_tri / wmean, w)
    h = min(lab_t.shape[0], lab_o.shape[0])
    dE = np.linalg.norm(lab_t[:h] - lab_o[:h], axis=-1)
    png(OUT / "style_crt-display.png", screen.to_display(theirs, wy))
    stripes = out["dungeon"]["lin"].astype(np.float64) @ M.T
    r, c = cell_of(tube, 101, 84)
    crop = stripes[r - 75:r + 75, c - 100:c + 100]
    png(OUT / "style_crt-torch-zoom.png", upscale(screen.to_display(crop, float(np.percentile(stripes[..., 1], 99.9))), 4))
    res["style_crt"] = dict(ms_per_frame_dungeon_1422x1067=out["dungeon"]["ms_per_frame"],
                            ms_per_frame_white_474x356=out["white"]["ms_per_frame"],
                            dE76_mean=float(dE.mean()), dE76_p95=float(np.percentile(dE, 95)),
                            dE76_max=float(dE.max()), L_ours_mean=float(lab_o[..., 0].mean()),
                            L_theirs_mean=float(lab_t[..., 0].mean()), overrides=over,
                            source="raw-native origin/main b444c35, web/shaders/crt (CPU reference, node)")
    dmap = np.clip(dE[..., None] / 20.0, 0, 1)
    png(OUT / "deltaE-map.png", (np.concatenate([dmap, dmap * 0.6, 1 - dmap], -1) * 255).astype(np.uint8))


if __name__ == "__main__":
    root, runner = sys.argv[1], sys.argv[2]
    tube, xp, res = Tube(), backend(), {}
    still, tri, wmean = stills(tube, xp, res)
    spot(tube, xp, res)
    cost(tube, res)
    style_crt(tube, still, tri, wmean, root, runner, res)
    res["tube"] = dict(face_mm=[tube.face_w, tube.face_h], cells=[tube.rows, tube.cols], triads=tube.triads,
                       pitch_mm=tube.pitch_mm, line_mm=tube.line_mm, field_s=tube.T, line_s=tube.H,
                       decay=tube.decay, decay_grade=tube.ph["grade"])
    dump("results-frames.json", res)
    print(json.dumps({k: v for k, v in res.items() if k != "spot"}, indent=1, default=float)[:3000])

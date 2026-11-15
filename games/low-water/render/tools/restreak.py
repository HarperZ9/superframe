# Lens streaks tied to their sources (coordinator review, 2026-10-21: full-width orange lines read as
# artefacts). The bake's streak layer gave every 16 px tile over threshold an exponential streak
# reaching about 2,300 plate px each way, so lit rows of windows and walls summed into lines across
# the whole frame. This rebuilds <variant>-streak.png from the place's own light list:
#   - a streak starts only at a lamp the place declares (place.json lights for the variant), never at
#     a window, a candle row or a lit wall: flat areas get none;
#   - its strength is the lamp's intensity times how bright the painting is at the lamp's head (a
#     hidden or dark lamp gives little or nothing), its colour the painting's there;
#   - its length grows with the strength, 30 to 100 plate px each way, with a gaussian fall-off cut
#     at 2.2 lengths, and a gaussian section about 1 px thick;
#   - the layer is the display-space difference, as the bake wrote it (added over plate and people).
# Original code. Run it at Idle priority (start /low).
#   python render/tools/restreak.py --src <content with plates> --dst <content to write> [--only quay/night,...]
import argparse, json, math, os, sys
import numpy as np
from PIL import Image

KINDS_WITH_STREAK = {"sodium", "white", "arc", "beam"}
GROUPS_WITH_STREAK = {"lantern", "standing", "sodium", "gutter"}
GROUPS_WITHOUT = {"window", "candle", "candles", "fire", "white"}

def lin(u8):
    v = u8.astype(np.float32) / 255.0
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)

def enc(v):
    v = np.clip(v, 0, 1)
    return np.where(v <= 0.0031308, 12.92 * v, 1.055 * np.power(v, 1 / 2.4) - 0.055) * 255.0

def project(cam, W, H, P):   # the plate's bake camera, orthographic (as world/camera.mjs projectPlate)
    yaw, el = math.radians(cam["yawDeg"]), math.radians(cam["elevDeg"])
    f = [-math.sin(yaw) * math.cos(el), -math.sin(el), -math.cos(yaw) * math.cos(el)]
    rl = math.hypot(f[2], f[0]); right = [-f[2] / rl, 0, f[0] / rl]
    up = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]]
    t, dist = cam["target"], cam.get("dist", 40)
    pos = [t[i] - f[i] * dist for i in range(3)]; r = [P[i] - pos[i] for i in range(3)]
    a = sum(r[i] * right[i] for i in range(3)); b = sum(r[i] * up[i] for i in range(3))
    sc = cam.get("scale", 8); u = a / (sc * W / H); v = b / sc
    return ((u + 1) / 2) * W - 0.5, ((1 - v) / 2) * H - 0.5

def streak_layer(img, lights, cam, gain=0.022, thick=1.3):
    L = lin(img[..., :3]); Y = L @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    H, W = Y.shape
    acc = np.zeros((H, W, 3), np.float32); n = 0
    for Lt in lights:
        kind, group = Lt.get("kind"), Lt.get("group")
        if group in GROUPS_WITHOUT or not (kind in KINDS_WITH_STREAK or group in GROUPS_WITH_STREAK):
            continue
        sx, sy = project(cam, W, H, Lt["at"])
        if not (0 <= sx < W and 0 <= sy < H):
            continue
        x0, x1, y0, y1 = max(0, int(sx) - 8), min(W, int(sx) + 9), max(0, int(sy) - 8), min(H, int(sy) + 9)
        win = Y[y0:y1, x0:x1]; k = np.unravel_index(np.argmax(win), win.shape)
        peak = float(win[k]); cy, cx = y0 + k[0] + 0.5, x0 + k[1] + 0.5
        if peak < 0.25:
            continue   # the lamp's head is hidden or dark in the painting
        col = L[y0 + k[0], x0 + k[1]] / max(peak, 1e-6)
        s = float(Lt.get("I", 1)) * peak * (0.6 if kind == "paraffin" else 1.0)   # a flame is softer than a discharge lamp
        Ls = float(np.clip(30 + 18 * s, 30, 100))
        rx, ry = int(2.2 * Ls) + 1, int(4 * thick) + 1
        a0, a1, b0, b1 = max(0, int(cx) - rx), min(W, int(cx) + rx + 1), max(0, int(cy) - ry), min(H, int(cy) + ry + 1)
        gx = (np.arange(a0, a1) + 0.5 - cx) / Ls; gy = (np.arange(b0, b1) + 0.5 - cy) / thick
        prof = np.exp(-3.0 * gx ** 2)[None, :] * np.exp(-0.5 * gy ** 2)[:, None]
        acc[b0:b1, a0:a1] += prof[..., None] * (gain * s) * col[None, None, :]
        n += 1
    d = enc(L + acc) - enc(L)
    return np.clip(np.round(d), 0, 255).astype(np.uint8), n

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True); ap.add_argument("--dst", required=True); ap.add_argument("--only", default="")
    a = ap.parse_args()
    only = set(x for x in a.only.split(",") if x)
    for place in sorted(os.listdir(a.src)):
        d = os.path.join(a.src, place); pj = os.path.join(d, "place.json")
        if not os.path.isfile(pj):
            continue
        P = json.load(open(pj, encoding="utf-8"))
        for f in sorted(os.listdir(d)):
            if not f.endswith("-streak.png"):
                continue
            v = f[: -len("-streak.png")]
            if only and f"{place}/{v}" not in only:
                continue
            plate = os.path.join(d, v + ".png")
            if not os.path.exists(plate):
                continue
            img = np.asarray(Image.open(plate).convert("RGB"))
            lay, n = streak_layer(img, (P.get("lights") or {}).get(v, []), P["camera"])
            os.makedirs(os.path.join(a.dst, place), exist_ok=True)
            _tmp = os.path.join(a.dst, place, f + ".part.png"); Image.fromarray(np.dstack([lay, np.full(lay.shape[:2], 255, np.uint8)]), "RGBA").save(_tmp); os.replace(_tmp, os.path.join(a.dst, place, f))   # atomic: a reader never sees half a file
            print(f"{place}/{v}: {n} streaks, max {int(lay.max())}, {int((lay.max(axis=2) > 2).sum())} px", flush=True)

if __name__ == "__main__":
    sys.exit(main())

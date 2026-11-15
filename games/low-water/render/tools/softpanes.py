# Lit panes in the painted value range (coordinator review, 2026-10-21: the Brine's window rendered as a
# blown pure white rectangle). The bake clips large lit panes to white; a painter never does: a lit pane
# is a bright warm field with structure. For every near-clipped region of a plate (all channels 228 or more)
# larger than a lamp head (MIN_AREA plate px), this repaints it:
#   - value: brightest in the middle, falling toward the frame (distance to the region's edge), held
#     under PEAK, so nothing in it is pure white;
#   - colour: the warm of a lamp-lit pane, a little cooler at the top (the glass catching the room);
#   - structure: glazing bars (one upright, one cross bar, as a sash window), and horizontal brush
#     marks of a painter's lay-in, from a fixed seed so the plate is the same every bake;
#   - the region's rim blends into the painting round it over two pixels.
# Lamp heads and small highlights (under MIN_AREA) are left as they are: a light source may be white.
# Only panes are touched (the region's plate samples are mostly glass or window, from geo-id.u8): a lit
# white wall stays a wall; blackout and fog plates are paper-white dither by design and are skipped.
# Original code. Run at Idle priority (start /low).
#   python render/tools/softpanes.py --src <content> --dst <content> [--only brine/night,...] [--backup <dir>]
import argparse, json, os, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage

MIN_AREA = 3000
P_SKIP = {"floor": ("fog",)}
PEAK, EDGE = np.array([238.0, 214.0, 156.0]), np.array([206.0, 160.0, 92.0])
FIRE_PEAK, FIRE_EDGE = np.array([250.0, 188.0, 64.0]), np.array([198.0, 76.0, 18.0])

WINDOW_IDS = {44, 73, 74}   # render/kit/ids.mjs: glass, window, windowdim
FIRE_IDS = {78}             # stovefire: a firebox's opening, painted as a grate of fire

def soften(img, seed=7, ids=None, gscale=0.5):
    a = img.astype(np.float32)
    m = ndimage.binary_dilation(a.min(axis=2) >= 228, iterations=1)   # clipped or all but clipped, and the antialiased rim
    lab, n = ndimage.label(m)
    if not n:
        return img, 0
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    rng = np.random.default_rng(seed); done = 0
    for i, s in enumerate(sizes):
        if s < MIN_AREA:
            continue
        reg = lab == i + 1
        if ids is not None:   # only a pane: most of the region's plate samples are glass or window (a lit white wall is left alone)
            ys_, xs_ = np.nonzero(reg); gy = np.clip((ys_ * gscale).astype(int), 0, ids.shape[0] - 1); gx = np.clip((xs_ * gscale).astype(int), 0, ids.shape[1] - 1)
            kinds = ids[gy, gx]; fire = np.isin(kinds, list(FIRE_IDS)).mean() >= 0.5
            if not fire and np.isin(kinds, list(WINDOW_IDS)).mean() < 0.5: continue
        else:
            fire = False
        ys, xs = np.nonzero(reg); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        sub = reg[y0:y1, x0:x1]
        d = ndimage.distance_transform_edt(sub); dmax = max(1.0, d.max())
        t = np.clip(d / dmax, 0, 1) ** 0.6                       # 0 at the frame, 1 in the middle
        h, w = sub.shape; yy, xx = np.mgrid[0:h, 0:w]
        cool = 1 - 0.08 * (1 - yy / max(1, h - 1))              # the top of the glass a touch cooler
        pk, ed = (FIRE_PEAK, FIRE_EDGE) if fire else (PEAK, EDGE)
        if fire: t = np.clip(t * (0.6 + 0.4 * (yy / max(1, h - 1))), 0, 1)   # a fire is hottest low in the box
        col = ed[None, None, :] + (pk - ed)[None, None, :] * t[..., None]
        col[..., 2] *= 1 + 0.12 * (1 - cool)
        col[..., 0] *= cool
        # glazing bars: one upright and one cross bar, darker, two to three pixels wide
        bw = max(2, int(round(min(w, h) * 0.03)))
        # (each bar follows the pane's own slant: its edges fitted as straight lines over the middle half,
        # so a corner cut by something in front does not bend them)
        cols_ok = sub.any(axis=0); rows_ok = sub.any(axis=1)
        top = sub.argmax(axis=0).astype(float); bot = (h - 1 - sub[::-1].argmax(axis=0)).astype(float)
        lef = sub.argmax(axis=1).astype(float); rig = (w - 1 - sub[:, ::-1].argmax(axis=1)).astype(float)
        def fit(v, ok):
            idx = np.nonzero(ok)[0]; q = idx[len(idx) // 4: max(len(idx) // 4 + 2, 3 * len(idx) // 4)]
            k = np.polyfit(q, v[q], 1) if len(q) >= 2 else (0.0, float(np.median(v[ok]) if ok.any() else 0))
            return np.polyval(k, np.arange(len(v)))
        T_, B_, L_, R_ = fit(top, cols_ok), fit(bot, cols_ok), fit(lef, rows_ok), fit(rig, rows_ok)
        if fire:   # a grate: five uprights across the opening, following its slant
            # uprights parallel to the far edge (the near one may be cut by what stands in front), evenly spaced
            wid = float(np.median((R_ - L_)[rows_ok])) if rows_ok.any() else w; bar = np.zeros_like(sub)
            for k in range(1, 6): bar |= np.abs(xx - (R_ - k * wid / 6)[:, None]) < bw * 0.8
        else:
            bar = (np.abs(yy - (T_ + 0.42 * (B_ - T_))[None, :]) < bw) | (np.abs(xx - ((L_ + R_) / 2)[:, None]) < bw)
        col[bar] *= 0.62
        # a painter's lay-in: horizontal marks of slightly different value
        rows = rng.normal(0, 1, size=(h // 3 + 2,))
        marks = np.repeat(rows, 3)[:h][:, None] * 5.0 + rng.normal(0, 2.0, size=(h, w))
        col += marks[..., None] * np.array([1.0, 0.9, 0.6])[None, None, :]
        col = np.clip(col, 0, pk.max())
        # blend the rim into the painting over two pixels
        k = np.clip(d / 2.0, 0, 1)[..., None]
        patch = a[y0:y1, x0:x1]
        a[y0:y1, x0:x1] = np.where(sub[..., None], patch * (1 - k) + col * k, patch)
        done += 1
    return np.clip(np.round(a), 0, 255).astype(np.uint8), done

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True); ap.add_argument("--dst", required=True); ap.add_argument("--only", default=""); ap.add_argument("--backup", default="")
    a = ap.parse_args(); only = set(x for x in a.only.split(",") if x)
    for place in sorted(os.listdir(a.src)):
        d = os.path.join(a.src, place)
        if not os.path.isfile(os.path.join(d, "place.json")):
            continue
        P = json.load(open(os.path.join(d, "place.json"), encoding="utf-8"))
        for f in sorted(os.listdir(d)):
            if not f.endswith(".png") or "-" in f:
                continue   # plates only (night.png, dark.png), not the lens layers
            v = f[:-4]
            if only and f"{place}/{v}" not in only:
                continue
            if v == "dark" or v in P_SKIP.get(place, ()):
                continue   # the blackout plates and fog variants are paper-white dither by design
            src = os.path.join(d, f); img = np.asarray(Image.open(src).convert("RGB"))
            gs = float(P.get("geoScale", 1)); gw, gh = round(P["width"] * gs), round(P["height"] * gs)
            ids, gsc = None, gs
            if os.path.exists(os.path.join(d, "geo-id.u8")):
                raw = np.fromfile(os.path.join(d, "geo-id.u8"), dtype=np.uint8)
                if raw.size == gw * gh: ids = raw.reshape(gh, gw)
                elif raw.size == P["width"] * P["height"]: ids, gsc = raw.reshape(P["height"], P["width"]), 1.0   # some places keep ids at the plate's size
            out, n = soften(img, ids=ids, gscale=gsc)
            if not n:
                continue
            if a.backup:
                b = os.path.join(a.backup, place); os.makedirs(b, exist_ok=True)
                if not os.path.exists(os.path.join(b, f)): shutil.copy2(src, os.path.join(b, f))
            os.makedirs(os.path.join(a.dst, place), exist_ok=True)
            _tmp = os.path.join(a.dst, place, f + ".part.png"); Image.fromarray(out).save(_tmp); os.replace(_tmp, os.path.join(a.dst, place, f))   # atomic: a reader never sees half a file
            print(f"{place}/{v}: {n} panes repainted", flush=True)

if __name__ == "__main__":
    sys.exit(main())

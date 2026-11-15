# Figure readability at play size (design/RENDER-TARGET.md T10), from a still and each figure drawn
# alone (capture.mjs writes <view>.png and <view>.mask-<who>.png). Per figure, in linear luminance:
#   ratio  the figure's mean over the plate's mean in a ring 4 to 14 px outside it (the visual check's
#          band is 0.25 to 1.6)
#   edge   per point along the silhouette: Michelson contrast between the plate 4 px outside and the
#          figure 3 px inside along the same line (so ink, rim and the coat beside it all count), mean
#   found  the share of silhouette points whose contrast is 0.2 or more (how much of the outline reads)
#   region the figure's mask (grown 2 px) against the ring 4 to 14 px out, as mean values: Michelson
#          (it reads a glyph image as well as a painted one, where a pixel profile would read type strokes)
#   peak, peakFound  the same along the whole profile: the strongest contrast between the plate 4 px out
#          and any figure pixel 1 to 4 px in (so a rim or an ink line at the edge counts, as the eye counts it)
# Other figures are kept out of every ring. Original code.
#   python game/engine/paint/tools/readability.py <capture dir> [<capture dir> ...]
import glob, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

def lin(u8):
    v = u8.astype(np.float32) / 255.0
    return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)

def measure(d):
    out = {}
    for still in sorted(glob.glob(os.path.join(d, "*.png"))):
        name = os.path.basename(still)
        if ".mask-" in name or name.startswith(("crop", "zoom", "small", "sheet")):
            continue
        view = name[:-4]
        masks = {os.path.basename(m).split(".mask-")[1][:-4]: np.asarray(Image.open(m).convert("RGBA"))[..., 3] > 128 for m in glob.glob(os.path.join(d, f"{view}.mask-*.png"))}
        if not masks:
            continue
        img = np.asarray(Image.open(still).convert("RGB"))
        Y = lin(img) @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        anyfig = np.zeros(Y.shape, bool)
        for m in masks.values():
            if m.shape == Y.shape: anyfig |= m
        res = {}
        for who, m in masks.items():
            if m.shape != Y.shape or m.sum() < 50:
                continue
            ring = ndimage.binary_dilation(m, iterations=14) & ~ndimage.binary_dilation(m, iterations=4) & ~anyfig
            dist, ind = ndimage.distance_transform_edt(~m, return_indices=True)
            oy, ox = np.nonzero((dist >= 3.5) & (dist < 4.5) & ~anyfig)
            if ring.sum() < 20 or len(oy) < 20:
                continue
            by, bx = ind[0][oy, ox], ind[1][oy, ox]
            vy, vx = (by - oy) / dist[oy, ox], (bx - ox) / dist[oy, ox]
            iy = np.clip(np.round(by + vy * 3).astype(int), 0, Y.shape[0] - 1); ix = np.clip(np.round(bx + vx * 3).astype(int), 0, Y.shape[1] - 1)
            ok = m[iy, ix]
            a, b = Y[iy, ix][ok], Y[oy, ox][ok]
            mich = np.abs(a - b) / np.maximum(a + b, 1e-6)
            best = np.zeros(len(oy))
            for dep in (1, 2, 3, 4):
                jy = np.clip(np.round(by + vy * dep).astype(int), 0, Y.shape[0] - 1); jx = np.clip(np.round(bx + vx * dep).astype(int), 0, Y.shape[1] - 1)
                ins = m[jy, jx]; c = np.abs(Y[jy, jx] - Y[oy, ox]) / np.maximum(Y[jy, jx] + Y[oy, ox], 1e-6)
                best = np.maximum(best, np.where(ins, c, 0))
            fm, rm = float(Y[m].mean()), float(Y[ring].mean())
            mg = ndimage.binary_dilation(m, iterations=2); fg = float(Y[mg].mean())
            region = abs(fg - rm) / max(fg + rm, 1e-6)
            res[who] = {"region": round(region, 3), "px": int(m.sum()), "ratio": round(fm / max(rm, 1e-6), 3), "edge": round(float(mich.mean()), 3), "found": round(float((mich >= 0.2).mean()), 3), "peak": round(float(best.mean()), 3), "peakFound": round(float((best >= 0.3).mean()), 3), "figure": round(fm, 4), "plate": round(rm, 4)}
        out[view] = res
    return out

if __name__ == "__main__":
    for d in sys.argv[1:]:
        print(d); print(json.dumps(measure(d), indent=1))

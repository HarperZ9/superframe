# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Provenance on every sample: a time by frequency map of what is original, restored or inferred.

Cells are 0.1 s by eight bands. Each stage marks the cells it touched with its kind and confidence; a later, more
invasive mark wins (original < restored < inferred < resynthesized), and confidence is the minimum seen. A
reconstruction is never shown as recovered original: "inferred" and "resynthesized" cells say the content there
was made by the tool from evidence elsewhere. The plate draws original as a pale ground, restored as solid blue,
inferred as orange with diagonal hatching and resynthesized as red with cross-hatching (colour and texture both
carry the class), with opacity from confidence.
"""
import numpy as np

BANDS = [0, 250, 1000, 4000, 8000, 12000, 16000, 20000, 96000]
KINDS = ["original", "restored", "inferred", "resynthesized"]
CELL_S = 0.1


class Map:
    def __init__(self, seconds):
        self.n = int(np.ceil(seconds / CELL_S))
        self.kind = np.zeros((len(BANDS) - 1, self.n), np.int8)
        self.conf = np.ones((len(BANDS) - 1, self.n), np.float32)
        self.stages = []

    def mark(self, t0, t1, kind, confidence, stage, f0=0.0, f1=1e9):
        k = KINDS.index(kind)
        a, b = int(t0 / CELL_S), max(int(t0 / CELL_S) + 1, int(np.ceil(t1 / CELL_S)))
        rows = [i for i in range(len(BANDS) - 1) if BANDS[i + 1] > f0 and BANDS[i] < f1]
        for r in rows:
            self.kind[r, a:b] = np.maximum(self.kind[r, a:b], k)
            self.conf[r, a:b] = np.minimum(self.conf[r, a:b], confidence)
        self.stages.append({"stage": stage, "t0": t0, "t1": t1, "f0": f0, "f1": min(f1, BANDS[-1]), "kind": kind,
                            "confidence": confidence})

    def add_regions(self, regions, stage, f0=0.0, f1=1e9):
        for t0, t1, kind, conf in regions:
            self.mark(t0, t1, kind, conf, stage, f0, f1)

    def summary(self):
        tot = self.kind.size
        return {k: round(float((self.kind == i).sum() / tot), 4) for i, k in enumerate(KINDS)} | \
            {"mean_confidence": round(float(self.conf.mean()), 3)}

    def to_json(self):
        return {"cell_s": CELL_S, "bands_hz": BANDS, "kinds": KINDS, "kind": self.kind.tolist(),
                "confidence": np.round(self.conf, 3).tolist(), "stages": self.stages, "summary": self.summary()}


COLOURS = {0: (236, 233, 226), 1: (46, 104, 196), 2: (230, 140, 30), 3: (200, 40, 50)}


def plate(m, path, width=1600, row_h=40, title=""):
    """Draw the map as a PNG plate (pillow)."""
    from PIL import Image, ImageDraw
    rows = m.kind.shape[0]
    pad_l, pad_t = 110, 40
    img = Image.new("RGB", (width + pad_l + 20, rows * row_h + pad_t + 70), (250, 249, 246))
    d = ImageDraw.Draw(img)
    cw = width / max(1, m.n)
    for r in range(rows):
        y0 = pad_t + (rows - 1 - r) * row_h
        d.text((8, y0 + row_h / 2 - 6), f"{BANDS[r] / 1000:g}-{BANDS[r + 1] / 1000:g} kHz", fill=(40, 40, 40))
        for c in range(m.n):
            k = int(m.kind[r, c])
            a = float(m.conf[r, c]) if k else 1.0
            base = np.array(COLOURS[k])
            col = tuple(int(v) for v in base * a + np.array((250, 249, 246)) * (1 - a))
            x0 = pad_l + c * cw
            d.rectangle([x0, y0, x0 + cw, y0 + row_h - 2], fill=col)
        for c in range(m.n):
            k = int(m.kind[r, c])
            if k >= 2:
                x0 = pad_l + c * cw
                for s in range(0, row_h, 8):
                    d.line([x0, y0 + s, x0 + min(cw, row_h - s), y0 + s + min(cw, row_h - s)], fill=(60, 30, 10))
                    if k == 3:
                        d.line([x0, y0 + row_h - s, x0 + min(cw, s), y0 + row_h - s - min(cw, s)], fill=(60, 30, 10))
    d.text((pad_l, 12), title or "provenance: original, restored, inferred, resynthesized", fill=(20, 20, 20))
    ly = pad_t + rows * row_h + 18
    for i, k in enumerate(KINDS):
        x = pad_l + i * 260
        d.rectangle([x, ly, x + 30, ly + 18], fill=COLOURS[i])
        d.text((x + 38, ly + 3), k, fill=(20, 20, 20))
    secs = m.n * CELL_S
    d.text((pad_l, ly + 30), f"0 s to {secs:.1f} s, cells of {CELL_S} s; opacity is confidence", fill=(60, 60, 60))
    img.save(path)
    return path

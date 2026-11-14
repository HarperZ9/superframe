// Displacement layers on the head, authored per level of detail and kept below the alias limit
// (ART-DIRECTION 7.1: the quay test showed a 3 cm bump aliasing into moire at hero distance).
// Two limits, the lower one wins:
//   mesh: the surface is sampled at the LOD's cell and its normals by central differences on that
//         grid, so a period shorter than four cells comes back as noise: f <= 1 / (4 cell).
//   screen: the LOD is drawn at up to PPM_MAX pixels a metre (render/figure.mjs lodFor, with the
//         2x supersample the bakes use): a period under three pixels moires: f <= ppm / 3.
// A layer gives { t, amp, freq } and may give per-LOD overrides { lod: { far: { amp, freq } } }.
// Any layer still above the limit at an LOD is dropped there, and the drop is reported.
// Layers: creases (forehead, horizontal), prune (vertical wrinkles of waterlogged skin), crows (fans
// at the eye corners), lines (deep lines: forehead, between the brows, mouth corners), pores (noise).
import { noise } from "./sdf.mjs";

export const HEAD_CELL = { near: 0.003, mid: 0.007, far: 0.016 };
export const PPM_MAX = { near: 1600, mid: 700, far: 220 };
export const limit = (lod) => Math.min(1 / (4 * HEAD_CELL[lod]), PPM_MAX[lod] / 3);
const sm = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const band = (lo, hi, w, t) => sm(lo - w, lo, t) * (1 - sm(hi, hi + w, t));

// resolve the layers for one LOD: [{ ...layer, amp, freq }] and the dropped ones
export function layersFor(list = [], lod) {
  const keep = [], dropped = [], L = limit(lod);
  for (const d of list) {
    const o = { ...d, ...(d.lod?.[lod] || {}) };
    if (!(o.amp > 0)) continue;
    if (o.freq > L) dropped.push({ t: d.t, freq: o.freq, limit: +L.toFixed(1), lod }); else keep.push(o);
  }
  return { keep, dropped };
}

// the displacement function for one LOD (head-local metres, s applied; P the merged record)
export function headDetail(P, list, lod) {
  const { keep, dropped } = layersFor(list, lod), s = P.s;
  if (!keep.length) return { D: null, dropped };
  const browY = P.brow[1] * s, eyeX = P.eye_x * s, eyeY = P.eye_y * s, eyeZ = P.eye_z * s, my = P.mouth_y * s, mw = P.mouth_w * s, top = (P.cran_c[1] + P.cran[1] * 0.75) * s;
  const fs = keep.map((d) => {
    const A = d.amp, w = 2 * Math.PI * d.freq;
    if (d.t === "creases") return (x, y, z) => -A * band(browY + 0.008 * s, top, 0.01 * s, y) * sm(0.02 * s, 0.06 * s, z) * Math.max(0, Math.sin(y * w + 0.6 * Math.sin(x * 40 / s)));
    if (d.t === "prune") return (x, y, z) => -A * sm(0.0, 0.05 * s, z) * sm(0.012 * s, 0.024 * s, Math.hypot(Math.abs(x) - eyeX, y - eyeY)) * Math.max(0, Math.sin(x * w + 1.5 * noise(y * 30 / s, z * 30 / s, 1)));
    if (d.t === "crows") { const n = Math.max(2, Math.round(d.freq * 0.012 * s * 1.6)); return (x, y, z) => { let v = 0; for (const sx of [-1, 1]) { const dx = x - sx * (eyeX + 0.02 * s), dy = y - eyeY, r = Math.hypot(dx, dy); v += band(0.004 * s, 0.022 * s, 0.006 * s, r) * sm(-0.02 * s, 0.02 * s, sx * dx) * Math.max(0, Math.sin(Math.atan2(dy, Math.abs(dx)) * n)); } return -A * v * sm(0.03 * s, 0.06 * s, z); }; }
    if (d.t === "lines") return (x, y, z) => {
      const between = Math.exp(-((x / (0.006 * s)) ** 2)) * band(browY - 0.004 * s, browY + 0.025 * s, 0.006 * s, y);   // the vertical pair between the brows
      const corner = Math.max(...[-1, 1].map((sx) => Math.exp(-(((x - sx * (mw + 0.008 * s)) / (0.004 * s)) ** 2)) * band(my - 0.03 * s, my + 0.004 * s, 0.006 * s, y)));
      return -A * (between * Math.max(0, Math.cos(x * w)) + corner) * sm(0.03 * s, 0.07 * s, z);
    };
    if (d.t === "pores") return (x, y, z) => A * (noise(x * d.freq, y * d.freq, z * d.freq) - 0.5);
    throw new Error(`head detail: unknown layer ${d.t}`);
  });
  return { D: (x, y, z) => { let v = 0; for (const f of fs) v += f(x, y, z); return v; }, dropped, amp: keep.reduce((a, d) => a + d.amp, 0) };
}

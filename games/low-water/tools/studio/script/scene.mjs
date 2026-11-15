// A scripted paint-over for everything round the face: the ground cut against the silhouette (lighter
// behind the shadow side, darker behind the lit side, so each edge reads by counterchange), the coat's
// folds with their dark troughs and lit ridges, the collar in two crisp values, and one strong light:
// the shadow side and the lower canvas pushed down with thin dark scumbles, a few thick lights where the
// form meets the key.
//   groundStrokes(ref, lm, pal) clothStrokes(ref, lm) lightStrokes(ref, lm) -> [record]
import { mix as kmMix } from "../../../game/engine/paint/km.mjs";
import { rnd } from "../core/brush.mjs";
import { IDS } from "./landmarks.mjs";
import { rec, colAt, path, flowField } from "./face.mjs";

const swatch = (pal, name, fb) => (pal.find((s) => s.name.startsWith(name)) || { c: fb }).c;

export function groundStrokes(ref, lm, pal, { count = 70 } = {}) {
  const out = [], rand = rnd(21), { w, h } = lm, light = swatch(pal, "ground light", [0.3, 0.31, 0.34]), dark = swatch(pal, "ground dark", [0.12, 0.11, 0.13]);
  const kx = lm.key[0] < 0 ? -1 : 1, cx = lm.face ? lm.face.cx : w / 2, size = w / 14;
  for (let k = 0; k < count; k++) {
    const x = rand() * w, y = rand() * h * 0.85, i = Math.round(y) * w + Math.round(x); if (ref.G.id[i]) continue;
    const behindShadow = (x - cx) * kx > 0, t = Math.min(1, Math.max(0, 0.25 + y / h * 0.6 + (behindShadow ? -0.3 : 0.25)));
    const c = kmMix(light, dark, t).map((q) => q * (behindShadow ? 1.12 : 0.95));
    out.push(rec(ref, "ground", { colour: c, size: size * (0.7 + rand() * 0.6), flow: 0.5, load: 0.8, pickup: 0.25, bristles: 26, impasto: 0.2, depletion: 0.015 }, path(x, y, [0.82, -0.57 + (rand() - 0.5) * 0.3], size * (2.5 + rand() * 2), (rand() - 0.5) * 0.2, 8, 0.7), 7000 + k));
  }
  return out;
}

export function clothStrokes(ref, lm, { foldsOnly = false } = {}) {
  const out = [], rand = rnd(31), coat = lm.mask(IDS.coat), flow = flowField(lm), step = Math.max(10, Math.round(lm.w / 40));
  if (foldsOnly) return foldStrokes(ref, lm, coat);
  for (let y = step; y < lm.h - 2; y += step) for (let x = step; x < lm.w - step; x += step) {
    const jx = x + (rand() - 0.5) * step, jy = Math.min(lm.h - 3, y + (rand() - 0.5) * step), i = Math.round(jy) * lm.w + Math.round(jx); if (!coat[i]) continue;
    const v = lm.ndl[i], base = colAt(ref, jx, jy), ridge = v > 0.45, c = ridge ? base.map((q) => Math.min(1, q * 1.45 + 0.02)) : v < 0.15 ? base.map((q) => q * 0.6) : base;
    out.push(rec(ref, "cloth", { colour: c, size: step * (ridge ? 0.6 : 0.95), flow: ridge ? 0.6 : 0.45, pickup: 0.35, bristles: 22, spread: 1.4, impasto: ridge ? 0.6 : 0.2, depletion: 0.012 }, path(jx, jy, flow(jx, jy), step * (2 + rand() * 2), (rand() - 0.5) * 0.4, 7, 0.65), 8000 + out.length));
  }
  return [...out, ...foldStrokes(ref, lm, coat)];
}
// folds: long curved troughs from the shoulders toward the middle of the chest and down the sleeve, each
// with a lit lip on the side toward the key
function foldStrokes(ref, lm, coat) {
  const out = [], b = lm.coat; if (!b) return out;
  const sx = lm.key[0] < 0 ? -1 : 1, top = b.y0 + (b.y1 - b.y0) * 0.12, cx = b.cx, half = (b.x1 - b.x0) / 2, len = (b.y1 - b.y0) * 0.45, sz = Math.max(4, lm.w / 110);
  const folds = [[cx - half * 0.5, top, [0.45, 1]], [cx + half * 0.45, top, [-0.4, 1]], [cx - half * 0.1, top + len * 0.4, [0.15, 1]]];
  folds.forEach(([x, y, d], k) => {
    const m = Math.hypot(...d), dir = [d[0] / m, d[1] / m], pts = path(x + dir[0] * len * 0.5, y + dir[1] * len * 0.5, dir, len, 0.12 * (k % 2 ? 1 : -1), 10, 0.75).filter(([px, py]) => coat[Math.round(py) * lm.w + Math.round(px)]);
    if (pts.length < 3) return;
    const base = colAt(ref, pts[1][0], pts[1][1]), lip = pts.map(([px, py, p]) => [px - sx * sz * 1.6, py, p * 0.6]);
    out.push(rec(ref, "cloth", { colour: base.map((q) => q * 0.8), size: sz * 3.4, flow: 0.3, pickup: 0.45, bristles: 26, spread: 2.5, impasto: 0.2, depletion: 0.008 }, pts, 8500 + k * 2));
    out.push(rec(ref, "cloth", { colour: base.map((q) => Math.min(1, q * 1.5 + 0.02)), size: sz * 1.2, flow: 0.45, pickup: 0.3, bristles: 16, spread: 1.6, impasto: 0.7, depletion: 0.015 }, lip, 8501 + k * 2));
  });
  return out;
}

export function lightStrokes(ref, lm, { accents = true } = {}) {
  const out = [], rand = rnd(41), { w, h } = lm, size = w / 16;
  // the shadow side of the figure and the foot of the canvas, pushed down with thin dark scumbles
  for (let k = 0; k < 110; k++) {   // laid everywhere below the brow line; the shade's mask (apply.mjs) says where it shows
    const x = rand() * w, y = h * 0.2 + rand() * h * 0.8;
    out.push(rec(ref, "shade", { colour: [0.06, 0.045, 0.05], size: size * (0.6 + rand() * 0.6), flow: 0.14 + (y / h) * 0.1, load: 0.8, pickup: 0.05, bristles: 30, spread: 2.5, impasto: 0, depletion: 0.004, dry: 0.05 }, path(x, y, [1, 0.25 * (rand() - 0.5)], size * 3, 0.1, 8, 0.6), 9000 + k));
  }
  if (!accents) return out;
  // thick lights where the form faces the key square on: the brightest skin, collar and ear points
  const skin = lm.mask(IDS.skin), cand = [];
  for (let i = 0; i < w * h; i += 3) if (skin[i] && lm.ndl[i] > 0.82) cand.push(i);
  cand.sort((a, b) => lm.ndl[b] - lm.ndl[a]);
  const picked = []; for (const i of cand) { const x = i % w, y = (i / w) | 0; if (picked.every(([px, py]) => Math.hypot(px - x, py - y) > w / 14)) picked.push([x, y]); if (picked.length >= 4) break; }
  picked.forEach(([x, y], k) => out.push(rec(ref, "lights", { colour: colAt(ref, x, y).map((q) => Math.min(1, q * 1.22 + 0.03)), size: w / 150, flow: 0.6, bristles: 12, spread: 1.8, impasto: 0.8, pickup: 0.25, depletion: 0.01 }, path(x, y, flowField(lm)(x, y), w / 40, 0.15, 7, 0.7), 9500 + k)));
  return out;
}

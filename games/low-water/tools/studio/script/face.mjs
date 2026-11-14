// A scripted paint-over for a portrait's face: what a painter does over an underpainting, written as
// stroke records (author "script") the Studio replays through its own brush engine. Skin is restated
// plane by plane, warm where it turns to the key and cool where it turns away; brows, nose and mouth get
// their darks and their one light each; each eye gets its white, iris and pupil, the upper lid's dark and
// its cast shadow, the lower lid's thin light, and a catch-light toward the key.
//   skinStrokes(ref, lm, pal) eyeStrokes(ref, lm) featureStrokes(ref, lm, pal) -> [record]
import { mix as kmMix } from "../../../game/engine/paint/km.mjs";
import { rnd, BRUSH } from "../core/brush.mjs";
import { blur1 } from "../core/passes.mjs";
import { IDS } from "./landmarks.mjs";
import { mouthStrokes } from "./mouth.mjs";

export function rec(ref, layer, brush, pts, seed) {
  return { tool: brush.tool || "brush", layer, author: "script", seed, size: [ref.G.w, ref.G.h], brush: { ...BRUSH, wetUnder: true, ...brush, colour: brush.colour.map((v) => +Math.max(0, Math.min(1, v)).toFixed(4)) }, pts: pts.map(([x, y, p]) => [+x.toFixed(2), +y.toFixed(2), +p.toFixed(3)]) };
}
export const colAt = (ref, x, y) => { const i = (Math.round(y) * ref.G.w + Math.round(x)) * 4; return [ref.colour[i], ref.colour[i + 1], ref.colour[i + 2]]; };
const swatch = (pal, name, fb) => (pal.find((s) => s.name.startsWith(name)) || { c: fb }).c;
// a stroke from (x, y) along direction d for length len, gently curved, pressure swelling then easing
export function path(x, y, d, len, bend = 0, n = 8, p0 = 0.75) {
  const out = [], nx = -d[1], ny = d[0];
  for (let k = 0; k <= n; k++) { const t = k / n - 0.5, s = t * len, b = bend * len * (0.25 - t * t); out.push([x + d[0] * s + nx * b, y + d[1] * s + ny * b, p0 * (0.35 + 0.65 * Math.sin(Math.PI * (0.08 + 0.84 * k / n)))]); }
  return out;
}
// a small round patch scrubbed in: a short spiral, for an iris, a pupil, a catch-light
export function disc(x, y, r, p = 0.8) {
  const out = []; for (let k = 0; k <= 14; k++) { const a = k * 0.9, rr = r * (1 - k / 16); out.push([x + Math.cos(a) * rr * 0.6, y + Math.sin(a) * rr * 0.6, p]); }
  return out;
}
// the form's contour direction: across the gradient of how the surface turns to the light
export function flowField(lm) {
  const { w, h } = lm, f = blur1(lm.ndl, w, h, Math.max(2, Math.round(w / 120)));
  return (x, y) => { const i = Math.round(y) * w + Math.round(x), gx = f[i + 1] - f[i - 1], gy = f[i + w] - f[i - w], m = Math.hypot(gx, gy); return m < 1e-5 ? [1, 0] : [-gy / m, gx / m]; };
}

// skin in four passes, as a painter blocks a head: the light as one shape, the shadow as one cool mass,
// the half-tone where the form turns, the light's planes laid across the form; each pass coarse, so the
// face reads as a few big shapes before any detail. passes chooses which (the targeted paint-over keeps
// only the shadow, and leaves the light side to the underpainting's own strokes)
export function skinStrokes(ref, lm, pal, { passes: only = ["light", "shadow", "turn", "planes"] } = {}) {
  const skin = lm.mask(IDS.skin), flow = flowField(lm), step = Math.max(6, Math.round(lm.w / 80)), out = [];
  const warm = swatch(pal, "skin light", [0.9, 0.7, 0.55]), cool = swatch(pal, "skin shadow", [0.35, 0.3, 0.33]), grey = swatch(pal, "skin turning", [0.55, 0.5, 0.48]);
  const shadowMass = meanWhere(ref, skin, lm.ndl, (v) => v < 0.15), lightMass = kmMix(kmMix(meanWhere(ref, skin, lm.ndl, (v) => v >= 0.5), warm, 0.35), [0.62, 0.6, 0.58], 0.18).map((q) => Math.min(1, q * 1.08));   // tempered: a lamp-lit face is not orange
  const passes = [
    { test: (v) => v >= 0.42, grid: step * 2.2, colour: () => lightMass, size: 2.4, across: true, imp: 0.25, pickup: 0.1 },   // the light as one shape first
    { test: (v) => v < 0.15, grid: step * 1.6, colour: () => kmMix(shadowMass, cool, 0.45).map((q) => q * 0.8), size: 2.2, across: false, imp: 0.15, pickup: 0.15 },
    { test: (v) => v >= 0.15 && v < 0.5, grid: step * 1.2, colour: (b) => kmMix(b, grey, 0.3), size: 1.5, across: false, imp: 0.3, pickup: 0.35 },
    { test: (v) => v >= 0.5, grid: step * 1.2, colour: (b) => kmMix(kmMix(b, lightMass, 0.6), warm, 0.2), size: 1.5, across: true, imp: 0.5, pickup: 0.3, flow: 0.32 },   // then its planes, close in value
  ];
  passes.forEach((P, k) => {
    if (!only.includes(["light", "shadow", "turn", "planes"][k])) return;
    const rand = rnd(11 + k);
    for (let y = P.grid; y < lm.h - P.grid; y += P.grid) for (let x = P.grid; x < lm.w - P.grid; x += P.grid) {
      const jx = x + (rand() - 0.5) * P.grid, jy = y + (rand() - 0.5) * P.grid, i = Math.round(jy) * lm.w + Math.round(jx);
      if (!skin[i] || !P.test(lm.ndl[i])) continue;
      const f = flow(jx, jy), d = P.across ? [f[1], -f[0]] : f;
      out.push(rec(ref, "skin", { colour: P.colour(colAt(ref, jx, jy)), size: P.grid * P.size * 0.6, flow: P.flow ?? 0.5, load: 0.95, pickup: P.pickup, bristles: 30, spread: 2.4, impasto: P.imp, depletion: 0.006 },
        path(jx, jy, d, P.grid * (1.3 + rand()), (rand() - 0.5) * 0.3, 6, 0.6 + rand() * 0.25), 1000 + out.length));
    }
  });
  return out;
}
// the mean reference colour over the pixels of a mask whose N.L passes a test
function meanWhere(ref, m, ndl, test) {
  const s = [0, 0, 0]; let n = 0;
  for (let i = 0; i < m.length; i++) if (m[i] && test(ndl[i])) { for (let k = 0; k < 3; k++) s[k] += ref.colour[i * 4 + k]; n++; }
  return n ? s.map((v) => v / n) : [0.3, 0.2, 0.18];
}

export function eyeStrokes(ref, lm) {
  const out = [], kx = lm.key[0] < 0 ? -1 : 1, near = lm.eyes.length > 1 ? (kx < 0 ? 0 : 1) : 0;
  lm.eyes.forEach((e, k) => {
    const lit = k === near ? 1 : 0.8, rx = e.rx * 0.9, ry = e.ry, [ix, iy] = [e.iris[0], e.cy + ry * 0.05], s = (n) => 3000 + k * 100 + n;
    const L = (layer, brush, pts, n) => out.push(rec(ref, layer, brush, pts, s(n)));
    L("eyes", { colour: [0.62 * lit, 0.58 * lit, 0.53 * lit], size: ry * 0.75, flow: 0.65, bristles: 14, spread: 2, impasto: 0.1, pickup: 0.25 }, [[e.cx - rx * 0.8, e.cy, 0.6], [e.cx, e.cy + ry * 0.1, 0.7], [e.cx + rx * 0.8, e.cy, 0.6]], 0);   // the white, never paper white
    L("eyes", { colour: [0.2, 0.13, 0.09], size: ry * 0.5, flow: 0.85, bristles: 12, spread: 2.2, impasto: 0.15, depletion: 0, pickup: 0.05 }, disc(ix, iy, ry * 0.85), 1);   // the iris
    L("eyes", { colour: [0.05, 0.035, 0.035], size: ry * 0.28, flow: 1, bristles: 8, spread: 2.2, impasto: 0, depletion: 0, pickup: 0 }, disc(ix, iy, ry * 0.35), 2);   // the pupil
    const lid = []; for (let t = -1; t <= 1.001; t += 0.25) lid.push([e.cx + t * rx * 1.05, e.cy - ry * 0.85 * (1 - 0.6 * t * t) - ry * 0.15, 0.9 - 0.4 * Math.abs(t)]);
    L("eyes", { colour: [0.09, 0.055, 0.05], size: ry * 0.45, flow: 0.95, bristles: 12, spread: 2, impasto: 0.3, depletion: 0.004, pickup: 0.05 }, lid, 3);   // the upper lid's dark line
    L("eyes", { colour: [0.12, 0.08, 0.07], size: ry * 0.5, flow: 0.35, bristles: 12, spread: 2, impasto: 0, pickup: 0.1 }, lid.map(([x, y, p]) => [x, y + ry * 0.35, p * 0.8]), 4);   // its shadow on the eyeball
    const crease = lid.map(([x, y, p]) => [x, y - ry * 0.7, p * 0.7]), skinLit = colAt(ref, e.cx, e.cy - ry * 2.2).map((q) => Math.min(1, q * (1.1 + 0.15 * lit)));
    L("eyes", { colour: skinLit, size: ry * 0.6, flow: 0.5, bristles: 14, spread: 2, impasto: 0.4, pickup: 0.3 }, crease, 5);   // the lid's lit fold
    const low = []; for (let t = -0.8; t <= 0.801; t += 0.2) low.push([e.cx + t * rx, e.cy + ry * 0.95 * (1 - 0.5 * t * t), 0.5]);
    L("eyes", { colour: colAt(ref, e.cx, e.cy + ry * 1.6).map((q) => Math.min(1, q * 1.15)), size: ry * 0.3, flow: 0.5, bristles: 8, spread: 2, impasto: 0.25, pickup: 0.2 }, low, 6);   // the lower lid's thin light
    L("eyes", { colour: [0.1, 0.06, 0.06], size: ry * 0.35, flow: 0.8, bristles: 3, pickup: 0 }, [[e.cx - kx * rx * 1.0, e.cy, 0.6], [e.cx - kx * rx * 0.75, e.cy + 0.5, 0.6]], 7);   // the inner corner's dark
    const cx = ix + lm.key[0] * ry * 0.35, cy = iy - Math.abs(lm.key[1]) * ry * 0.45 - ry * 0.12;
    L("eyes", { colour: [0.97, 0.95, 0.9].map((q) => q * (0.85 + 0.15 * lit)), size: Math.max(1.4, ry * 0.14), flow: 1, bristles: 5, spread: 2.5, impasto: 1.2, depletion: 0, pickup: 0 }, disc(cx, cy, Math.max(1.2, ry * 0.16), 1), 8);   // the catch-light
  });
  return out;
}

export function featureStrokes(ref, lm, pal) {
  const out = [], dark = swatch(pal, "darkest", [0.07, 0.045, 0.05]), L = (layer, brush, pts, n) => out.push(rec(ref, layer, brush, pts, 5000 + n));
  if (lm.brow) {   // the brows: hair laid with the growth, outward and a little down
    for (const [k, e] of lm.eyes.entries()) {
      const y = e.cy - e.ry * 2.6, base = colAt(ref, e.cx, Math.max(lm.brow.y0 + 2, y)), c = kmMix(base, dark, 0.35);
      for (let j = 0; j < 4; j++) L("features", { colour: c, size: e.ry * 0.7, flow: 0.6, bristles: 9, impasto: 0.35, pickup: 0.3 }, path(e.cx + (j - 1.5) * e.rx * 0.45, y + j * 0.6, [1, 0.12 * (j - 1.5)], e.rx * 1.1, 0.15, 6, 0.6), k * 10 + j);
    }
  }
  mouthStrokes(ref, lm, dark, L);   // lips, not a bar (mouth.mjs)
  noseStrokes(ref, lm, dark, L);
  return out;
}
// the nose: its lit ridge in one thick stroke and the dark under the tip (found as the skin pixel nearest
// the key-facing brightest point between the eyes and the mouth)
function noseStrokes(ref, lm, dark, L) {
  if (lm.eyes.length < 1 || !lm.mouth) return;
  const top = lm.eyes.reduce((a, e) => a + e.cy, 0) / lm.eyes.length, bot = lm.mouth.y0, skin = lm.mask(IDS.skin); let best = null, bv = -1;
  for (let y = Math.round(top + 4); y < bot - 4; y++) for (let x = lm.face.x0; x < lm.face.x1; x++) { const i = y * lm.w + x; if (skin[i] && lm.ndl[i] > bv) { bv = lm.ndl[i]; best = [x, y]; } }
  if (!best) return;
  const ridge = colAt(ref, best[0], best[1]).map((q) => Math.min(1, q * 1.25 + 0.03)), len = (bot - top) * 0.45;
  L("features", { colour: ridge, size: Math.max(3, len * 0.12), flow: 0.7, bristles: 10, impasto: 1.2, pickup: 0.2, depletion: 0.005 }, path(best[0], best[1] - len * 0.3, [0.08, 1], len, 0.05, 6, 0.7), 40);
  const under = [lm.mouth.cx, bot - (bot - top) * 0.18];
  L("features", { colour: kmMix(colAt(ref, under[0], under[1]), dark, 0.55), size: Math.max(3, len * 0.18), flow: 0.6, bristles: 8, impasto: 0.1, pickup: 0.3 }, path(under[0], under[1], [1, 0], len * 0.7, -0.2, 6, 0.6), 41);
}

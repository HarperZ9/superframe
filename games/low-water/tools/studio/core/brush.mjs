// The loaded brush: a row of bristles, each carrying its own colour and its own load of paint. Every dab
// each bristle lays a little paint, takes up a little of the wet colour it passes through (pigment mixing,
// Kubelka-Munk), and runs drier, so a long stroke starts solid and breaks up on the canvas tooth at its
// end. Paint layers gain height where paint goes on thick; the composite lights that height.
// Also the eraser and the mask brush (alpha only). The knife and the smudge are in knife.mjs.
//   makeBristles(brush, rand) dabBristles(S, cx, cy, dir, p) -> rect | null
import { mix as kmMix } from "../../../game/engine/paint/km.mjs";
import { formNormalAt, formLight } from "./form.mjs";

export const BRUSH = { tool: "brush", size: 14, colour: [0.6, 0.45, 0.35], load: 1, flow: 0.55, pickup: 0.35, bristles: 22, spread: 0.8, wetUnder: false, light: 0, impasto: 0.5, dry: 0.3, spacing: 0.14, sizeCurve: 0.8, depletion: 0.012, jitter: 0.03 };
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const hash = (x, y) => { let h = Math.imul((x | 0) * 374761393 + (y | 0) * 668265263, 1274126177) >>> 0; h ^= h >>> 15; return (h & 1023) / 1023; };
function vnoise(x, y) {
  const gx = Math.floor(x), gy = Math.floor(y), fx = x - gx, fy = y - gy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return (hash(gx, gy) * (1 - sx) + hash(gx + 1, gy) * sx) * (1 - sy) + (hash(gx, gy + 1) * (1 - sx) + hash(gx + 1, gy + 1) * sx) * sy;
}
// the canvas tooth: two octaves of value noise on rotated axes (a grain with no rows), 0..1
export function tooth(x, y) {
  const u = x * 0.8 + y * 0.6, v = -x * 0.6 + y * 0.8;
  return clamp(vnoise(u / 2.3, v / 2.3) * 0.55 + vnoise(u / 6.1 + 17, v / 6.1 + 5) * 0.45);
}
export function makeBristles(brush, rand) {
  const n = Math.max(1, brush.bristles | 0), out = [];
  for (let k = 0; k < n; k++) {
    const off = n === 1 ? 0 : -1 + (2 * (k + 0.5)) / n + (rand() - 0.5) * (1.6 / n);
    const j = 1 + (rand() - 0.5) * 2 * brush.jitter;
    // the outer bristles trail and carry less paint, so a stroke has a rounded front and soft sides
    out.push({ off, lag: (rand() - 0.5) * 0.15 - 0.35 * off * off, col: brush.colour.map((c) => clamp(c * j)), load: brush.load * (0.75 + 0.25 * rand()) * (1 - 0.45 * off * off), r: 0.7 + 0.5 * rand() });
  }
  return out;
}

// one bristle's footprint: a small disc at (bx, by), radius rb
function bristleDab(S, b, bx, by, rb, flow) {
  const { doc, layer: L } = S, { w, h } = doc, x0 = Math.max(0, Math.floor(bx - rb)), x1 = Math.min(w - 1, Math.ceil(bx + rb)), y0 = Math.max(0, Math.floor(by - rb)), y1 = Math.min(h - 1, Math.ceil(by + rb));
  const tool = S.brush.tool, take = ((S.k ?? 1) * S.brush.pickup * 0.6) / (Math.PI * rb * rb), dryness = b.load < S.brush.dry ? b.load / S.brush.dry : 1, wet = [0, 0, 0], c = [0, 0, 0];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d2 = ((x - bx) ** 2 + (y - by) ** 2) / (rb * rb); if (d2 >= 1) continue;
    let a = flow * (1 - d2) * Math.min(1, b.load * 2.2);
    if (dryness < 1 && tooth(x, y) < 1 - dryness) continue;   // a dry brush only touches the tooth's tops
    if (S.k && S.k < 1) a = 1 - Math.pow(1 - Math.min(0.999, a), S.k);   // finer spacing: the same cover over the same length
    if (a <= 0.002) continue;
    const i = y * w + x, i4 = i * 4;
    if (tool === "eraser") { L.rgba[i4 + 3] *= 1 - a; if (L.height) L.height[i] *= 1 - a; continue; }
    if (L.kind === "mask") { L.rgba[i4 + 3] = clamp(L.rgba[i4 + 3] + (1 - L.rgba[i4 + 3]) * a); continue; }
    if (L.kind === "form") { if (a > 0.05) { L.rgba[i4] = S.formRGB[0]; L.rgba[i4 + 1] = S.formRGB[1]; L.rgba[i4 + 2] = S.formRGB[2]; } L.rgba[i4 + 3] = clamp(L.rgba[i4 + 3] + (1 - L.rgba[i4 + 3]) * Math.min(1, a * 3)); continue; }   // a plane: one direction, laid flat and solid (a decision, not a glaze)
    // pickup: the bristle takes some of the wet colour it passes through; the layers below are dry unless
    // the brush is told wet-under, so then only this layer's own paint is wet
    const src = S.brush.wetUnder ? doc.flat : L.rgba; wet[0] = src[i4]; wet[1] = src[i4 + 1]; wet[2] = src[i4 + 2];
    kmMix(b.col, wet, Math.min(0.5, take * a * (S.brush.wetUnder ? 1 : L.rgba[i4 + 3])), b.col);
    const La = L.rgba[i4 + 3], Na = La + (1 - La) * a;
    c[0] = L.rgba[i4]; c[1] = L.rgba[i4 + 1]; c[2] = L.rgba[i4 + 2];
    kmMix(La > 0.001 ? c : b.col, b.col, Na > 0 ? a / Na : 1, c);
    L.rgba[i4] = c[0]; L.rgba[i4 + 1] = c[1]; L.rgba[i4 + 2] = c[2]; L.rgba[i4 + 3] = Na;
    // keep the composite's wet colour current, so the next bristle picks up what this one laid
    for (let k = 0; k < 3; k++) doc.flat[i4 + k] = doc.flat[i4 + k] * (1 - a) + c[k] * a;
    if (L.height) {   // the paint's body approaches a level set by the load, ridged across the bristle, even along the stroke
      const ac = ((x - bx) * -S.dir[1] + (y - by) * S.dir[0]) / rb, T = S.brush.impasto * (0.4 + b.load) * (1 - 0.35 * ac * ac);
      L.height[i] = Math.min(4, L.height[i] + (T - L.height[i]) * a * 0.6);
    }
  }
  if (tool !== "eraser") b.load = Math.max(0, b.load - S.brush.depletion * flow * (S.k ?? 1));
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

// The light-stroke brush (light 0..1): at its first touch it loads with the colour already on the canvas
// there, lifted toward the key's colour, the way the underpainting lays its lit strokes; its preset keeps
// the load low and the tooth high, so the edges break.
export const LIGHT = { light: 0.8, size: 10, load: 0.7, flow: 0.6, dry: 0.55, depletion: 0.03, bristles: 16, spread: 1.1, impasto: 0.9, pickup: 0.15, wetUnder: true };
function loadLight(S, cx, cy) {
  const { doc, brush: B } = S, k = doc.meta.keyColour || [1.25, 0.9, 0.58], km = Math.max(...k), c = [0, 0, 0]; let n = 0;
  for (let y = Math.round(cy) - 2; y <= Math.round(cy) + 2; y++) for (let x = Math.round(cx) - 2; x <= Math.round(cx) + 2; x++) {
    if (x < 0 || y < 0 || x >= doc.w || y >= doc.h) continue; const i = (y * doc.w + x) * 4; c[0] += doc.flat[i]; c[1] += doc.flat[i + 1]; c[2] += doc.flat[i + 2]; n++;
  }
  // where a form layer holds the planes, the light comes from them and the key, not from the sculpt
  const fn = formNormalAt(doc, Math.max(0, Math.min(doc.h - 1, Math.round(cy))) * doc.w + Math.max(0, Math.min(doc.w - 1, Math.round(cx))));
  const lit = fn ? formLight(doc, fn).map((v, j) => clamp(v * (1 + 0.12 * B.light) + (k[j] / km) * 0.05 * B.light))
    : c.map((v, j) => clamp((v / Math.max(1, n)) * (1 + 0.35 * B.light) + (k[j] / km) * 0.08 * B.light));
  for (const b of S.bristles) b.col = lit.map((v) => clamp(v * (1 + (S.rand() - 0.5) * 2 * B.jitter)));
  S.lit = true;
}
// all bristles at one point of the stroke: across the direction of travel, width from the pressure
export function dabBristles(S, cx, cy, dir, p) {
  const B = S.brush, width = B.size * (0.15 + 0.85 * Math.pow(clamp(p), B.sizeCurve)), flow = B.flow * (0.45 + 0.55 * clamp(p));
  const nx = -dir[1], ny = dir[0], rb = Math.max(0.8, ((2 * width) / S.bristles.length) * (B.spread ?? 0.8));   // spread under 1: bristles apart, the stroke streaks; over 1: they overlap, it blends
  if (B.light > 0 && !S.lit) loadLight(S, cx, cy);
  let rect = null;
  for (const b of S.bristles) {
    const bx = cx + nx * b.off * width + dir[0] * b.lag * width, by = cy + ny * b.off * width + dir[1] * b.lag * width;
    const r = bristleDab(S, b, bx, by, rb * b.r, flow);
    rect = rect ? { x0: Math.min(rect.x0, r.x0), y0: Math.min(rect.y0, r.y0), x1: Math.max(rect.x1, r.x1), y1: Math.max(rect.y1, r.y1) } : r;
  }
  return rect;
}
// the area a dab will touch (for undo tiles, taken before any write)
export function dabBounds(S, cx, cy) {
  const r = Math.ceil(S.brush.size * 1.5) + 3;
  return { x0: Math.max(0, Math.floor(cx) - r), y0: Math.max(0, Math.floor(cy) - r), x1: Math.min(S.doc.w, Math.ceil(cx) + r + 1), y1: Math.min(S.doc.h, Math.ceil(cy) + r + 1) };
}

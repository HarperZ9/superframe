// Cleanup of the underpainting's stray darks: small hard dark squares the portrait painter leaves on the
// skin (at the mouth's corners, beside the nose) where the reference itself is not dark. Each is found as a
// small connected patch of very dark underpainting on skin that the lit reference shows as mid or light,
// and covered by one soft stroke of the skin round it. Records only (author script), on a "cleanup" layer
// just above the underpainting, so a painter can hide or erase any one of them.
//   cleanupStrokes(ref, under, doc) -> { strokes, found }
import { IDS } from "./landmarks.mjs";
import { rec } from "./face.mjs";
import { lum } from "../core/passes.mjs";

function blobs(ref, under, w, h) {
  const skin = new Set(IDS.skin), bad = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!skin.has(ref.G.id[i])) continue;
    const u = lum(under[i * 4], under[i * 4 + 1], under[i * 4 + 2]), r = lum(ref.colour[i * 4], ref.colour[i * 4 + 1], ref.colour[i * 4 + 2]);
    if (u < 0.14 && u < r * 0.55) bad[i] = 1;   // much darker than the reference there: not a shadow the form has
  }
  const seen = new Uint8Array(w * h), out = [];
  for (let s = 0; s < w * h; s++) {
    if (!bad[s] || seen[s]) continue; const stack = [s], px = []; seen[s] = 1;
    while (stack.length) { const i = stack.pop(); px.push(i); for (const j of [i - 1, i + 1, i - w, i + w]) if (j >= 0 && j < w * h && bad[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
    if (px.length < 4 || px.length > 900) continue;   // a stray square, not a real dark (a nostril, a mouth line)
    let x0 = w, x1 = 0, y0 = h, y1 = 0; for (const i of px) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const fill = px.length / ((x1 - x0 + 1) * (y1 - y0 + 1));
    if (fill > 0.6) out.push({ x0, x1, y0, y1 });   // squares are solid; brush marks are not
  }
  return out;
}
// the skin just round a blob, from the underpainting (what it should have been)
function ring(under, ref, b, w, h) {
  const c = [0, 0, 0]; let n = 0, pad = 4;
  for (let y = Math.max(0, b.y0 - pad); y <= Math.min(h - 1, b.y1 + pad); y++) for (let x = Math.max(0, b.x0 - pad); x <= Math.min(w - 1, b.x1 + pad); x++) {
    if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) continue; const i = y * w + x;
    if (!IDS.skin.includes(ref.G.id[i]) || lum(under[i * 4], under[i * 4 + 1], under[i * 4 + 2]) < 0.12) continue;
    for (let k = 0; k < 3; k++) c[k] += under[i * 4 + k]; n++;
  }
  return n ? c.map((v) => v / n) : null;
}
export function cleanupStrokes(ref, under, doc) {
  const out = [], found = blobs(ref, under, doc.w, doc.h);
  for (const b of found) {
    const c = ring(under, ref, b, doc.w, doc.h); if (!c) continue;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, r = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 + 3;
    out.push(rec(ref, "cleanup", { tool: "brush", colour: c, size: r * 1.3, flow: 0.9, load: 1, pickup: 0.3, bristles: 24, spread: 2.6, impasto: 0.1, dry: 0, depletion: 0, wetUnder: true }, [[cx - r * 0.5, cy, 0.8], [cx, cy + 0.5, 1], [cx + r * 0.5, cy, 0.8]], 19000 + out.length));
  }
  return { strokes: out, found: found.length };
}

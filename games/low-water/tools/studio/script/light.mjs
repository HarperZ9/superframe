// The light side, kept (the author, 2026-10-21: "a cool combination of both"): the underpainting's own lit
// strokes stay; a warm glaze unifies them (hue moves, value stays); a few strokes of the light-stroke brush
// add to them the way they were laid: along the form, loaded with the canvas colour lifted to the key.
//   glazeStrokes(ref, lm) keyStrokes(ref, lm, { count }) -> [record]
import { rnd, LIGHT } from "../core/brush.mjs";
import { IDS } from "./landmarks.mjs";
import { rec, path, flowField } from "./face.mjs";

export function glazeStrokes(ref, lm) {
  const out = [], f = lm.face; if (!f) return out;
  const tint = (ref.meta.keyColour || [1.25, 0.9, 0.58]).map((v, k, a) => v / Math.max(...a)), size = (f.x1 - f.x0) / 5;
  for (let k = 0; k < 7; k++) {   // broad, thin, overlapping: one temperature over the whole lit side
    const y = f.y0 + ((k + 0.5) / 7) * (f.y1 - f.y0);
    out.push(rec(ref, "light glaze", { colour: tint, size, flow: 0.22, load: 1, pickup: 0, bristles: 30, spread: 3, impasto: 0, depletion: 0, wetUnder: false }, path(f.cx, y, [1, 0.05], f.x1 - f.x0, 0.05, 8, 0.7), 9700 + k));
  }
  return out;
}
export function keyStrokes(ref, lm, { count = 8 } = {}) {
  const out = [], rand = rnd(51), skin = lm.mask(IDS.skin), flow = flowField(lm), cand = [], { w } = lm;
  for (let i = 0; i < lm.w * lm.h; i += 2) if (skin[i] && lm.ndl[i] > 0.6) cand.push(i);
  cand.sort((a, b) => lm.ndl[b] - lm.ndl[a]);
  const picked = [];
  for (const i of cand) { const x = i % w, y = (i / w) | 0; if (picked.every(([px, py]) => Math.hypot(px - x, py - y) > w / 16)) picked.push([x, y]); if (picked.length >= count) break; }
  picked.forEach(([x, y], k) => out.push(rec(ref, "light strokes", { ...LIGHT, colour: [1, 1, 1], size: w / 70 }, path(x, y, flow(x, y), w / 16 * (0.8 + rand() * 0.6), (rand() - 0.5) * 0.3, 7, 0.75), 9800 + k)));
  return out;
}

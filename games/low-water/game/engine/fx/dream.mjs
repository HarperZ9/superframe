// Dreams (effects queue 7), beside the painted lead's dream look (paint/dream.mjs, which loosens the painter's strokes):
// the frame comes apart in stroke-sized pieces and goes back together; a possible future shows through as a ghost
// underpainting (the same place as it will be, laid under where a slow field lets it); and in type the marks print
// ahead of the action: faint letters where the figures are about to be. Original code.
//   loosen(img, k, t)              pieces displaced along a slow field by k (0..1), recomposing and coming loose with t
//   ghost(img, future, k, seed)    the future frame showing through
//   foretell (an effect)           ctx.future = [{ at }] -> faint marks ahead of the figures
import { registerEffect } from "./core.mjs";
const hh = (a, b, c = 0) => { let x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return ((x ^ (x >>> 13)) >>> 0) / 4294967296; };
export function loosen(img, k, t = 0, { piece = 7 } = {}) {
  const W = img.width, H = img.height, S = img.data.slice(), D = img.data, pw = Math.round(piece * 2.2);
  for (let by = 0; by < H; by += piece) for (let bx = 0; bx < W; bx += pw) {
    const ph = hh(bx, by) * 6.283, amp = k * (0.4 + 0.6 * hh(bx, by, 2)) * piece * 1.6 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph)), a = hh(bx >> 5, by >> 5, 3) * 6.283;
    const dx = Math.round(Math.cos(a) * amp), dy = Math.round(Math.sin(a) * amp * 0.5);
    for (let y = by; y < Math.min(H, by + piece); y++) for (let x = bx; x < Math.min(W, bx + pw); x++) {
      const X = Math.max(0, Math.min(W - 1, x - dx)), Y = Math.max(0, Math.min(H - 1, y - dy)), q = (y * W + x) * 4, s = (Y * W + X) * 4; for (let c = 0; c < 3; c++) D[q + c] = S[s + c];
    }
  }
  return img;
}
export function ghost(img, future, k = 0.35, seed = 1) {
  const W = img.width, H = img.height, D = img.data, G = future.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = 0.5 + 0.5 * Math.sin(x * 0.021 + seed + Math.sin(y * 0.017) * 2) * Math.cos(y * 0.019 - seed), a = k * Math.max(0, n * 1.6 - 0.5); if (a <= 0) continue;
    const q = (y * W + x) * 4; for (let c = 0; c < 3; c++) D[q + c] = D[q + c] * (1 - a) + G[q + c] * a;
  }
  return img;
}
registerEffect({ id: "foretell", group: "dream", story: "a dream's premonition: where the figures will be", cost: { low: 0.01, high: 0.02 },
  step(ctx, out, set) {
    for (const [k, f] of (ctx.future || []).entries()) for (let j = 0; j < 6; j++) {
      const p = [f.at[0], 0.3 + j * 0.25, f.at[2]], [px, py] = ctx.toPlate(p);
      out.push({ k: "print", x: px, y: py, d: ctx.depth(p) - 0.5, r: 0.12 * ctx.ppm, a: 0.35 + 0.1 * Math.sin(ctx.t * 2 + k), rgb: [0.75, 0.72, 0.9], ang: 0, len: 0, ahead: true, glyphOnly: true });   // the painted dream shows the future as the ghost underpainting instead
    }
  } });
export const DREAM = true;

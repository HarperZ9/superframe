// How the propaganda is printed, era by era (the UI art lead's, 2026-10-22): each process turns an ink drawing
// (propaganda/figure.mjs, or the painted lead's) into the marks that process makes, as ink with alpha to lay
// over the era's paper. Pure pixels: { w, h, data } in, { w, h, data RGBA } out.
//   woodcut   eras 1 and 2: black masses with white gouges cut along the form, edges that chatter
//   engraving eras 1 and 2: hatching whose weight follows the tone, crossed in the darks
//   litho     era 3: a crayon black over flat spot colours a little out of register
//   halftone  era 4: a screen of dots, for the cut-out photographs of the collage
//   meme      era 5: compressed past saving, the 8-pixel blocks showing
import { U, hash4 } from "../../paint/strokes.mjs";

const lum = (d, i) => (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function out(w, h) { return { w, h, data: new Uint8ClampedArray(w * h * 4) }; }
function put(o, i, [r, g, b], a) { const k = i * 4, a0 = o.data[k + 3] / 255, A = a + a0 * (1 - a); if (A <= 0) return; o.data[k] = (r * a + o.data[k] * a0 * (1 - a)) / A; o.data[k + 1] = (g * a + o.data[k + 1] * a0 * (1 - a)) / A; o.data[k + 2] = (b * a + o.data[k + 2] * a0 * (1 - a)) / A; o.data[k + 3] = A * 255; }

export function woodcut(src, { ink = [24, 18, 14], seed = 1 } = {}) {
  const { w, h, data } = src, o = out(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, L = lum(data, i * 4), n = U(hash4(x >> 1, y >> 1, seed, 3), 0);
    const solid = L < 0.5 + (n - 0.5) * 0.18;                                       // the edge chatters where the knife wandered
    const gouge = Math.sin((y + x * 0.35) * 0.42 + U(hash4(x >> 4, y >> 4, seed, 4), 0) * 2) > 0.82 && L > 0.08;   // white cuts through the grey masses
    if (solid && !gouge) put(o, i, ink, 0.96);
  }
  return o;
}

export function engraving(src, { ink = [28, 22, 18], seed = 1, pitch = 4 } = {}) {
  const { w, h, data } = src, o = out(w, h), c1 = Math.cos(0.5), s1 = Math.sin(0.5);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, L = lum(data, i * 4), d = 1 - L;
    if (L < 0.25) { put(o, i, ink, 0.95); continue; }                                // the line itself
    const u = (x * c1 + y * s1) / pitch, v = (x * c1 - y * s1) / pitch, fu = u - Math.floor(u), fv = v - Math.floor(v);
    const a = (fu < d * 0.7 ? 0.9 : 0) + (d > 0.55 && fv < (d - 0.5) * 0.9 ? 0.9 : 0);
    if (a) put(o, i, ink, Math.min(0.95, a * (0.85 + U(hash4(x, y, seed, 5), 0) * 0.15)));
  }
  return o;
}

export function litho(src, { inks = [[28, 22, 26], [176, 42, 32], [204, 156, 52]], seed = 1, shift = 3 } = {}) {
  const { w, h, data } = src, o = out(w, h);
  // the drawing's ground: a spot colour under every inked area and its near neighbours, a few pixels out of register
  const near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (lum(data, (y * w + x) * 4) < 0.6) for (let dy = -6; dy <= 6; dy += 3) for (let dx = -6; dx <= 6; dx += 3) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) near[Y * w + X] = 1; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, sx = x - shift, sy = y - Math.round(shift / 2), si = sy >= 0 && sx >= 0 ? sy * w + sx : -1, grain = 0.7 + U(hash4(x, y, seed, 6), 0) * 0.3;
    if (y > h * 0.86) put(o, i, inks[2], 0.9 * grain);                                // a flat band of the second colour
    if (si >= 0 && near[si]) put(o, i, inks[1], 0.75 * grain);
    if (lum(data, i * 4) < 0.45) put(o, i, inks[0], 0.9 * grain);                     // the crayon black on top
  }
  return o;
}

export function halftone(src, { ink = [20, 20, 20], cell = 5, seed = 1 } = {}) {
  const { w, h, data } = src, o = out(w, h), c = Math.SQRT1_2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, d = 1 - lum(data, i * 4), u = (x * c + y * c) / cell, v = (x * c - y * c) / cell;
    const fu = u - Math.round(u), fv = v - Math.round(v), r = Math.sqrt(d) * 0.62;
    if (Math.hypot(fu, fv) < r) put(o, i, ink, 0.92 * (0.9 + U(hash4(x, y, seed, 7), 0) * 0.1));
  }
  return o;
}

export function meme(src, { ink = [16, 16, 16], q = 5 } = {}) {
  const { w, h, data } = src, o = out(w, h);
  for (let by = 0; by < h; by += 8) for (let bx = 0; bx < w; bx += 8) {
    let m = 0, n = 0; for (let y = by; y < Math.min(h, by + 8); y++) for (let x = bx; x < Math.min(w, bx + 8); x++) { m += lum(data, (y * w + x) * 4); n++; } m /= n;
    for (let y = by; y < Math.min(h, by + 8); y++) for (let x = bx; x < Math.min(w, bx + 8); x++) {
      const L = lum(data, (y * w + x) * 4), Lq = Math.round((L * 0.65 + m * 0.35) * q) / q;   // the block's mean bleeding in, the tones crushed
      if (Lq < 0.98) put(o, y * w + x, ink, clamp(1 - Lq, 0, 1) * 0.95);
    }
  }
  return o;
}

export const PROCESS = { 1: "woodcut", 2: "woodcut", 3: "litho", 4: "halftone", 5: "meme" };
export const PROCESSES = { woodcut, engraving, litho, halftone, meme };

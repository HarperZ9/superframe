// Is a face legibly lit? The face's own value range (the terminator and the planes the light finds) and its
// separation from the ground behind it, in CIE L* (0 black .. 100 white) on display values. Original code.
//   Lstar(r, g, b)                         display sRGB 0..1 -> L*
//   faceStats(rgba, w, h, ids, faceIds)    -> { n, p10, p50, p90, range }
//   ringStats(img, cx, cy, r0, r1)         -> { n, p50 } the ground in a ring about a point (8-bit RGBA image)
//   legible(face, ground, LIMITS[size])    -> { ok, range, sep, why }
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function Lstar(r, g, b) { const Y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; }
const pct = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0);

// rgba Float32 (0..1, straight alpha) as characters/render/shade.mjs compose writes it, ids the G-buffer's
// CIE a* b* (D65) of a display colour: a* green to red, b* blue to yellow; an orange face has both high
export function abOf(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b), f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089;
  return [500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
export function faceStats(rgba, w, h, ids, faceIds) {
  const v = [], A = [], Bv = [];
  for (let i = 0; i < w * h; i++) if (faceIds.has(ids[i]) && rgba[i * 4 + 3] > 0.5) {
    const r = Math.min(1, rgba[i * 4]), g = Math.min(1, rgba[i * 4 + 1]), b = Math.min(1, rgba[i * 4 + 2]); v.push(Lstar(r, g, b)); const ab = abOf(r, g, b); A.push(ab[0]); Bv.push(ab[1]);
  }
  v.sort((a, b) => a - b); A.sort((a, b) => a - b); Bv.sort((a, b) => a - b);
  return { n: v.length, p10: pct(v, 0.1), p50: pct(v, 0.5), p90: pct(v, 0.9), range: pct(v, 0.9) - pct(v, 0.1), a: pct(A, 0.5), b: pct(Bv, 0.5) };
}
export function ringStats(img, cx, cy, r0, r1) {
  const v = [];
  for (let y = Math.max(0, Math.floor(cy - r1)); y < Math.min(img.height, cy + r1); y++) for (let x = Math.max(0, Math.floor(cx - r1)); x < Math.min(img.width, cx + r1); x++) {
    const d = Math.hypot(x - cx, y - cy); if (d < r0 || d > r1) continue; const p = (y * img.width + x) * 4; v.push(Lstar(img.data[p] / 255, img.data[p + 1] / 255, img.data[p + 2] / 255));
  }
  v.sort((a, b) => a - b); return { n: v.length, p50: pct(v, 0.5) };
}
// pass lines, set before the first measurement (design/art/LIGHT.md section 6): a face shows at least this
// much range of its own, and sits this far in value from the ground behind it (either way: a lit face on
// dark ground, or a dark face against a lit wall)
export const LIMITS = { play: { range: 8, sep: 8 }, portrait: { range: 15, sep: 10 } };
export function legible(face, ground, lim) {
  const sep = Math.abs(face.p50 - ground.p50), why = [];
  if (face.n < 4) why.push("no face pixels");
  if (face.range < lim.range) why.push(`range ${face.range.toFixed(1)} < ${lim.range}`);
  if (sep < lim.sep) why.push(`separation ${sep.toFixed(1)} < ${lim.sep}`);
  return { ok: !why.length, range: +face.range.toFixed(1), sep: +sep.toFixed(1), a: +(face.a || 0).toFixed(1), b: +(face.b || 0).toFixed(1), why };
}

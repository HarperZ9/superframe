// raster.mjs: the cartoon renderer's pixels. A canvas is linear-light RGB in Float32. Shapes become coverage
// buffers clipped to their own bounding box (nonzero winding, 4 sub-rows per pixel, exact horizontal coverage per
// span), so a 4K frame with a few hundred shapes never allocates a full-frame buffer per shape. Coverage buffers
// combine (clip, cut) before they are painted, which is how a cel shadow stays inside its part.
import { rngFrom } from '../seed.mjs';

export const toLin = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const toSrgb = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
export function lin(hex) {
  if (Array.isArray(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => toLin(v / 255));
}
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export function canvas(w, h, ground = '#000000') {
  const px = new Float32Array(w * h * 3), g = lin(ground);
  for (let i = 0; i < w * h; i++) { px[3 * i] = g[0]; px[3 * i + 1] = g[1]; px[3 * i + 2] = g[2]; }
  return { w, h, px };
}

function edgesOf(contours) {
  const E = [];
  for (const P of contours) for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length];
    if (y0 !== y1 && Number.isFinite(x0 + y0 + x1 + y1)) E.push(y0 < y1 ? [x0, y0, x1, y1, 1] : [x1, y1, x0, y0, -1]);
  }
  return E;
}

// Coverage of closed contours under nonzero winding, inside the W x H frame. Returns { x0, y0, w, h, a } or null.
export function coverage(contours, W, H, sub = 4) {
  const E = edgesOf(contours); if (!E.length) return null;
  let ex0 = Infinity, ey0 = Infinity, ex1 = -Infinity, ey1 = -Infinity;
  for (const e of E) { ex0 = Math.min(ex0, e[0], e[2]); ex1 = Math.max(ex1, e[0], e[2]); ey0 = Math.min(ey0, e[1]); ey1 = Math.max(ey1, e[3]); }
  const x0 = Math.max(0, Math.floor(ex0)), y0 = Math.max(0, Math.floor(ey0)), x1 = Math.min(W, Math.ceil(ex1) + 1), y1 = Math.min(H, Math.ceil(ey1) + 1);
  if (x1 <= x0 || y1 <= y0) return null;
  const w = x1 - x0, h = y1 - y0, a = new Float32Array(w * h), rows = Array.from({ length: h }, () => []), wt = 1 / sub;
  for (const e of E) { const r0 = Math.max(0, Math.floor(e[1]) - y0), r1 = Math.min(h - 1, Math.floor(e[3]) - y0); for (let r = r0; r <= r1; r++) rows[r].push(e); }
  const xs = [];
  for (let r = 0; r < h; r++) {
    const R = rows[r]; if (!R.length) continue;
    for (let s = 0; s < sub; s++) {
      const sy = y0 + r + (s + 0.5) / sub; xs.length = 0;
      for (const [ax, ay, bx, by, d] of R) if (sy >= ay && sy < by) xs.push(ax + (bx - ax) * (sy - ay) / (by - ay), d);
      if (xs.length < 4) continue;
      const order = []; for (let k = 0; k < xs.length; k += 2) order.push(k);
      order.sort((p, q) => xs[p] - xs[q]);
      let wind = 0;
      for (let k = 0; k < order.length - 1; k++) {
        wind += xs[order[k] + 1]; if (wind === 0) continue;
        span(a, w, r, Math.max(0, xs[order[k]] - x0), Math.min(w, xs[order[k + 1]] - x0), wt);
      }
    }
  }
  for (let i = 0; i < a.length; i++) if (a[i] > 1) a[i] = 1;
  return { x0, y0, w, h, a };
}
function span(a, w, r, l, rr, wt) {
  if (rr <= l) return;
  const il = Math.floor(l), ir = Math.floor(rr), row = r * w;
  if (il === ir) { if (il < w) a[row + il] += (rr - l) * wt; return; }
  a[row + il] += (il + 1 - l) * wt;
  for (let x = il + 1; x < ir && x < w; x++) a[row + x] += wt;
  if (ir < w) a[row + ir] += (rr - ir) * wt;
}

// Coverage of B read at a frame pixel (0 outside B's box).
const at = (B, X, Y) => { const x = X - B.x0, y = Y - B.y0; return x < 0 || y < 0 || x >= B.w || y >= B.h ? 0 : B.a[y * B.w + x]; };
// A x B (clip) or A x (1 - B) (cut). Either may be null.
export function clip(A, B) {
  if (!A || !B) return null;
  const out = { ...A, a: new Float32Array(A.a.length) };
  for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) { const i = y * A.w + x; if (A.a[i]) out.a[i] = A.a[i] * at(B, x + A.x0, y + A.y0); }
  return out;
}
export function cut(A, B) {
  if (!A) return null; if (!B) return A;
  const out = { ...A, a: new Float32Array(A.a.length) };
  for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) { const i = y * A.w + x; if (A.a[i]) out.a[i] = A.a[i] * (1 - at(B, x + A.x0, y + A.y0)); }
  return out;
}
export const covArea = A => { if (!A) return 0; let s = 0; for (const v of A.a) s += v; return s; };

// Paint a coverage buffer onto the canvas in one flat colour ("over", linear light).
export function paint(C, A, rgb, opacity = 1) {
  if (!A) return C;
  const col = lin(rgb);
  for (let y = 0; y < A.h; y++) { const row = (y + A.y0) * C.w + A.x0;
    for (let x = 0; x < A.w; x++) { const k = A.a[y * A.w + x] * opacity; if (k <= 0) continue; const p = 3 * (row + x);
      C.px[p] += (col[0] - C.px[p]) * k; C.px[p + 1] += (col[1] - C.px[p + 1]) * k; C.px[p + 2] += (col[2] - C.px[p + 2]) * k; } }
  return C;
}
export const fill = (C, contours, rgb, opacity = 1, clipTo = null) => {
  let A = coverage(contours, C.w, C.h); if (clipTo) A = clip(A, clipTo);
  paint(C, A, rgb, opacity); return A;
};

// Box blur of a coverage buffer, grown by r on every side: soft shadows and halos.
export function blurCov(A, r) {
  if (!A || r < 1) return A;
  const w = A.w + 2 * r, h = A.h + 2 * r, t = new Float32Array(w * h), o = new Float32Array(w * h), k = 1 / (2 * r + 1);
  for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) t[(y + r) * w + x + r] = A.a[y * A.w + x];
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x < w + r; x++) { s += (x + r < w ? t[y * w + x + r] : 0) - (x - r - 1 >= 0 ? t[y * w + x - r - 1] : 0); if (x >= 0 && x < w) o[y * w + x] = s * k; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y < h + r; y++) { s += (y + r < h ? o[(y + r) * w + x] : 0) - (y - r - 1 >= 0 ? o[(y - r - 1) * w + x] : 0); if (y >= 0 && y < h) t[y * w + x] = s * k; } }
  }
  return { x0: A.x0 - r, y0: A.y0 - r, w, h, a: t };
}
// Shift a coverage buffer by whole pixels.
export const shiftCov = (A, dx, dy) => (A ? { ...A, x0: A.x0 + Math.round(dx), y0: A.y0 + Math.round(dy) } : A);

// Paint a buffer that may sit partly off the frame (shifted or blurred).
export function paintSafe(C, A, rgb, opacity = 1) {
  if (!A) return C;
  const col = lin(rgb);
  for (let y = 0; y < A.h; y++) { const Y = y + A.y0; if (Y < 0 || Y >= C.h) continue;
    for (let x = 0; x < A.w; x++) { const X = x + A.x0; if (X < 0 || X >= C.w) continue; const k = Math.min(1, A.a[y * A.w + x] * opacity); if (k <= 0) continue;
      const p = 3 * (Y * C.w + X); for (let c = 0; c < 3; c++) C.px[p + c] += (col[c] - C.px[p + c]) * k; } }
  return C;
}

// Linear float to 8-bit sRGB, RGB or RGBA, with a seeded TPDF dither of one code value (QUALITY-SPEC R2).
const LUT_N = 4096, LUT = Float32Array.from({ length: LUT_N + 1 }, (_, i) => toSrgb(i / LUT_N) * 255);
export function bytes(C, { seed = 'toon', alpha = false } = {}) {
  const r = rngFrom(seed), ch = alpha ? 4 : 3, out = new Uint8ClampedArray(C.w * C.h * ch);
  for (let i = 0; i < C.w * C.h; i++) {
    for (let c = 0; c < 3; c++) { const v = C.px[3 * i + c]; const q = LUT[Math.round((v <= 0 ? 0 : v >= 1 ? 1 : v) * LUT_N)]; out[ch * i + c] = q + (r() - r()); }
    if (alpha) out[4 * i + 3] = 255;
  }
  return out;
}

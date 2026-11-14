// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// raster.mjs: a small HDR frame for the Seattle scenes. { w, h, d: Float32Array(w*h*3) } in linear light, values may
// exceed 1 (a lamp is thousands of times brighter than the sky). Drawing here is plain pixel work, with no
// antialiasing unless asked: the output is pixel art, and hard edges are the medium.
import { make } from '../types.mjs';

export const frame = (w, h) => ({ w, h, d: new Float32Array(w * h * 3) });
export const clone = F => ({ w: F.w, h: F.h, d: F.d.slice() });

export function fill(F, rgb) { for (let i = 0; i < F.w * F.h; i++) F.d.set(rgb, 3 * i); return F; }

export function add(F, x, y, rgb, k = 1) {
  x |= 0; y |= 0; if (x < 0 || y < 0 || x >= F.w || y >= F.h) return;
  const i = 3 * (y * F.w + x); F.d[i] += rgb[0] * k; F.d[i + 1] += rgb[1] * k; F.d[i + 2] += rgb[2] * k;
}
export function set(F, x, y, rgb, a = 1) {
  x |= 0; y |= 0; if (x < 0 || y < 0 || x >= F.w || y >= F.h) return;
  const i = 3 * (y * F.w + x); for (let c = 0; c < 3; c++) F.d[i + c] = F.d[i + c] * (1 - a) + rgb[c] * a;
}
export function get(F, x, y) {
  x = Math.max(0, Math.min(F.w - 1, x | 0)); y = Math.max(0, Math.min(F.h - 1, y | 0));
  const i = 3 * (y * F.w + x); return [F.d[i], F.d[i + 1], F.d[i + 2]];
}
export function sample(F, x, y) {
  const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
  const a = get(F, x0, y0), b = get(F, x0 + 1, y0), c = get(F, x0, y0 + 1), e = get(F, x0 + 1, y0 + 1);
  return [0, 1, 2].map(k => (a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + e[k] * fx) * fy);
}

// a filled disc; soft > 0 gives a linear edge ramp that many px wide (used for light, never for outlines)
export function disc(F, cx, cy, r, rgb, { soft = 0, mode = 'set', k = 1 } = {}) {
  const R = r + soft;
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d > R) continue;
    const a = soft > 0 ? Math.min(1, (R - d) / soft) : 1;
    if (mode === 'add') add(F, x, y, rgb, a * k); else set(F, x, y, rgb, a * k);
  }
}
export function rect(F, x0, y0, x1, y1, rgb, a = 1) {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(F.h, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(F.w, Math.ceil(x1)); x++) set(F, x, y, rgb, a);
}
// a 1 px line (DDA); fn(x, y, t) may return a colour per pixel instead of rgb
export function line(F, x0, y0, x1, y1, rgb, { a = 1, mode = 'set' } = {}) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, c = typeof rgb === 'function' ? rgb(t) : rgb;
    if (mode === 'add') add(F, x, y, c, a); else set(F, x, y, c, a);
  }
}
// scanline polygon fill, even-odd
export function poly(F, pts, rgb, a = 1) {
  let y0 = Infinity, y1 = -Infinity; for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(F.h - 1, Math.ceil(y1)); y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= yc) !== (by <= yc)) xs.push(ax + (yc - ay) * (bx - ax) / (by - ay));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(F.w, Math.round(xs[k + 1])); x++) set(F, x, y, rgb, a);
  }
}
export function scale(F, k) { for (let i = 0; i < F.d.length; i++) F.d[i] *= k; return F; }
export function mulRGB(F, rgb) { for (let i = 0; i < F.w * F.h; i++) for (let c = 0; c < 3; c++) F.d[3 * i + c] *= rgb[c]; return F; }

// separable box blur, repeated: three passes approximate a Gaussian of sigma ~ r * 0.58 * sqrt(3)
export function boxBlur(F, r, passes = 2) {
  if (r < 1) return F;
  const { w, h } = F, tmp = new Float32Array(F.d.length);
  for (let p = 0; p < passes; p++) { pass(F.d, tmp, w, h, r, 1, w); pass(tmp, F.d, h, w, r, w, 1); }
  return F;
}
function pass(src, dst, n, m, r, step, stride) {
  // n samples along the blur direction, m lines; step between samples, stride between lines (in pixels)
  for (let j = 0; j < m; j++) for (let c = 0; c < 3; c++) {
    let s = 0; const at = i => 3 * (j * stride + Math.max(0, Math.min(n - 1, i)) * step) + c;
    for (let i = -r; i <= r; i++) s += src[at(i)];
    for (let i = 0; i < n; i++) { dst[3 * (j * stride + i * step) + c] = s / (2 * r + 1); s += src[at(i + r + 1)] - src[at(i - r)]; }
  }
}

// to a superframe raster (linear RGBA), with an exposure scale
export function toRaster(F, exposure = 1) {
  const R = make.raster(F.w, F.h);
  for (let i = 0; i < F.w * F.h; i++) { for (let c = 0; c < 3; c++) R.data[4 * i + c] = F.d[3 * i + c] * exposure; R.data[4 * i + 3] = 1; }
  return R;
}
export function fromRaster(R) { const F = frame(R.w, R.h); for (let i = 0; i < R.w * R.h; i++) for (let c = 0; c < 3; c++) F.d[3 * i + c] = R.data[4 * i + c]; return F; }

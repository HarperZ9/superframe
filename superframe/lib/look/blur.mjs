// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// blur.mjs: Gaussian filtering for interleaved float pictures (stride channels per pixel). Small sigmas use an exact
// separable kernel; the pyramid helpers halve and double with a binomial pre-filter, so no box shapes survive (the old
// bloom used box blurs and left a rectangular halo you can see on a dark ground).
export function gaussKernel(sigma) {
  const r = Math.max(1, Math.ceil(3 * sigma)), k = new Float32Array(2 * r + 1);
  let s = 0; for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); s += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return k;
}
// Separable Gaussian, clamp-to-edge. Returns a new array.
export function gauss(src, w, h, sigma, stride = 3) {
  if (!(sigma > 0.05)) return Float32Array.from(src);
  const k = gaussKernel(sigma), r = (k.length - 1) >> 1, tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < stride; c++) {
    let s = 0; for (let j = -r; j <= r; j++) { const xx = x + j < 0 ? 0 : x + j >= w ? w - 1 : x + j; s += src[(y * w + xx) * stride + c] * k[j + r]; }
    tmp[(y * w + x) * stride + c] = s;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < stride; c++) {
    let s = 0; for (let j = -r; j <= r; j++) { const yy = y + j < 0 ? 0 : y + j >= h ? h - 1 : y + j; s += tmp[(yy * w + x) * stride + c] * k[j + r]; }
    out[(y * w + x) * stride + c] = s;
  }
  return out;
}
// Halve with a [1 3 3 1] binomial (a 2 x 2 average after the 1-2-1 pre-blur): one pyramid level, sigma about 1 coarse px.
export function half(src, w, h, stride = 3) {
  const W = Math.max(1, w >> 1), H = Math.max(1, h >> 1), out = new Float32Array(W * H * stride), wt = [1, 3, 3, 1];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < stride; c++) {
    let s = 0, n = 0;
    for (let j = 0; j < 4; j++) { const yy = Math.min(h - 1, Math.max(0, 2 * y - 1 + j)); for (let i = 0; i < 4; i++) { const xx = Math.min(w - 1, Math.max(0, 2 * x - 1 + i)), q = wt[i] * wt[j]; s += src[(yy * w + xx) * stride + c] * q; n += q; } }
    out[(y * W + x) * stride + c] = s / n;
  }
  return { px: out, w: W, h: H };
}
// Bilinear upsample of a coarse level to w x h (pixel centres aligned).
export function upTo(src, sw, sh, w, h, stride = 3) {
  const out = new Float32Array(w * h * stride), kx = sw / w, ky = sh / h;
  for (let y = 0; y < h; y++) {
    const fy = Math.min(sh - 1.001, Math.max(0, (y + 0.5) * ky - 0.5)), y0 = fy | 0, ay = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(sw - 1.001, Math.max(0, (x + 0.5) * kx - 0.5)), x0 = fx | 0, ax = fx - x0;
      const i00 = (y0 * sw + x0) * stride, i01 = i00 + stride, i10 = i00 + sw * stride, i11 = i10 + stride;
      for (let c = 0; c < stride; c++) out[(y * w + x) * stride + c] = (src[i00 + c] * (1 - ax) + src[i01 + c] * ax) * (1 - ay) + (src[i10 + c] * (1 - ax) + src[i11 + c] * ax) * ay;
    }
  }
  return out;
}

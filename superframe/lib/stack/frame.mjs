// frame.mjs: the pixel containers the section stack reads and writes. A frame is linear-light RGB in Float32 (three
// values per pixel, 0..1 nominal). A layer is a frame plus coverage alpha, stored premultiplied, so the Porter-Duff
// "over" operator is one multiply-add per channel. 8-bit output rounds to the nearest code, so a value read back from
// an 8-bit frame is off by at most 0.5/255.
export const frame = (w, h, rgb = [0, 0, 0]) => {
  const px = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { px[3 * i] = rgb[0]; px[3 * i + 1] = rgb[1]; px[3 * i + 2] = rgb[2]; }
  return { w, h, px };
};
export const layer = (w, h) => ({ w, h, px: new Float32Array(w * h * 3), a: new Float32Array(w * h) });
export const clone = F => ({ w: F.w, h: F.h, px: F.px.slice(), ...(F.a ? { a: F.a.slice() } : {}) });

// Rec. 709 luma weights on linear values.
export const LUMA = [0.2126, 0.7152, 0.0722];
export function luma(F) {
  const n = F.w * F.h, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = LUMA[0] * F.px[3 * i] + LUMA[1] * F.px[3 * i + 1] + LUMA[2] * F.px[3 * i + 2];
  return out;
}

// dst = src over dst, src premultiplied with alpha a, scaled by opacity k.
export function over(dst, src, k = 1) {
  const n = dst.w * dst.h;
  for (let i = 0; i < n; i++) {
    const a = src.a[i] * k; if (a <= 0) continue;
    for (let c = 0; c < 3; c++) dst.px[3 * i + c] = src.px[3 * i + c] * k + dst.px[3 * i + c] * (1 - a);
    if (dst.a) dst.a[i] = a + dst.a[i] * (1 - a);
  }
  return dst;
}

// Emissive light adds: dst += k * src (no occlusion), the law of a long exposure of lights in the dark.
export function addInto(dst, src, k = 1) { for (let i = 0; i < dst.px.length; i++) dst.px[i] += k * src.px[i]; return dst; }
export function scaleInto(F, k) { for (let i = 0; i < F.px.length; i++) F.px[i] *= k; return F; }

// Round to 8-bit codes and back: the frame a file would hold.
export function to8(F) {
  const out = new Uint8ClampedArray(F.w * F.h * 3);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.min(1, Math.max(0, F.px[i])) * 255);
  return { w: F.w, h: F.h, b: out };
}
export const from8 = Q => ({ w: Q.w, h: Q.h, px: Float32Array.from(Q.b, v => v / 255) });

// RGBA bytes for PNG or the plate renderer, optionally upscaled by an integer factor with nearest neighbour so pixel
// structure stays visible on a 4K plate.
export function rgbaOf(F, scale = 1) {
  const Q = F.b ? F : to8(F), W = Q.w * scale, H = Q.h * scale, rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = 3 * (Math.floor(y / scale) * Q.w + Math.floor(x / scale)), d = 4 * (y * W + x);
    rgba[d] = Q.b[s]; rgba[d + 1] = Q.b[s + 1]; rgba[d + 2] = Q.b[s + 2]; rgba[d + 3] = 255;
  }
  return { w: W, h: H, rgba };
}

// Display encoding for viewing: linear to sRGB transfer, applied only when a plate is drawn.
export function toDisplay(F) {
  const out = clone(F);
  for (let i = 0; i < out.px.length; i++) { const v = Math.min(1, Math.max(0, out.px[i])); out.px[i] = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; }
  return out;
}
export const maxAbsDiff = (A, B) => { let m = 0; for (let i = 0; i < A.px.length; i++) m = Math.max(m, Math.abs(A.px[i] - B.px[i])); return m; };

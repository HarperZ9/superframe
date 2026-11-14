// patterns.mjs: surface patterns painted inside a part's coverage (pinstripes, checks, ruled paper). They run in
// screen space at a spacing set in model units, so they scale with the character. Stripes are an authored look.
import { lin } from '../raster.mjs';

// Stripes every `gap` model units, `w` units wide, at angle `deg` from vertical. k: pixels per model unit.
export function stripes(color, { gap = 26, w = 3, deg = 0 } = {}) {
  return (K, A, _C, k) => {
    const col = lin(color), G = gap * k, W = Math.max(0.8, w * k), ca = Math.cos(deg * Math.PI / 180), sa = Math.sin(deg * Math.PI / 180);
    for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
      const a = A.a[y * A.w + x]; if (a <= 0) continue;
      const X = x + A.x0, Y = y + A.y0, u = X * ca + Y * sa, d = Math.abs(((u % G) + G) % G - G / 2);
      const t = a * Math.max(0, Math.min(1, W / 2 + 0.5 - d));
      if (t <= 0) continue;
      const p = 3 * (Y * K.w + X); for (let c = 0; c < 3; c++) K.px[p + c] += (col[c] - K.px[p + c]) * t;
    }
  };
}

// A grid of dots (polka, halftone-ish print texture) inside the part.
export function dots(color, { gap = 40, r = 6 } = {}) {
  return (K, A, _C, k) => {
    const col = lin(color), G = gap * k, rr = r * k;
    for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
      const a = A.a[y * A.w + x]; if (a <= 0) continue;
      const X = x + A.x0, Y = y + A.y0, row = Math.floor(Y / G), ox = (row % 2) * G / 2;
      const dx = ((X - ox) % G + G) % G - G / 2, dy = (Y % G + G) % G - G / 2, t = a * Math.max(0, Math.min(1, rr - Math.hypot(dx, dy) + 0.5));
      if (t <= 0) continue;
      const p = 3 * (Y * K.w + X); for (let c = 0; c < 3; c++) K.px[p + c] += (col[c] - K.px[p + c]) * t;
    }
  };
}

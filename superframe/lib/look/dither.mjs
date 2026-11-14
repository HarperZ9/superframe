// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// dither.mjs: the last step. Display transform (tone.mjs), then 8-bit sRGB with a seeded TPDF dither of one code
// value peak per channel (QUALITY-SPEC R2), or 16-bit without dither.
import { display, agx } from './tone.mjs';
const toSrgb = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const hash = (i, c, s) => { let h = (i * 374761393 + c * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// tone: 'display' (hue-preserving shoulder, default), 'agx' (scene-referred), or 'none' (already display-ready).
export function encode8(I, { seed = 1, tone = 'display', exposure = 0, punch = 1 } = {}) {
  const { w, h } = I, px = Float32Array.from(I.px), out = new Uint8ClampedArray(w * h * 4);
  if (tone === 'agx') agx(px, { exposure, punch }); else if (tone !== 'none') display(px);
  for (let i = 0; i < w * h; i++) {
    for (let c = 0; c < 3; c++) out[4 * i + c] = Math.round(toSrgb(Math.min(1, Math.max(0, px[3 * i + c]))) * 255 + hash(i, c, seed) - hash(i, c + 7, seed));
    out[4 * i + 3] = 255;
  }
  return out;
}

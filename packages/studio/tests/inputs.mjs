// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
// inputs.mjs: the seeded pixel buffers the eye goldens and the eye tests share. Neither the source module nor
// the port lives here, so the goldens and the tests read the same bytes without the port touching them.
import { renderImage, toRGBA } from '../../../studio/lib/lanes/image.mjs';
import { byId } from '../../../studio/lib/materials.mjs';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth seeded structure plus noise, so the dHash bits are not all coin flips.
export function seededPixels(w, h, ch, seed) {
  const r = mulberry32(seed), px = new Uint8Array(w * h * ch);
  const fx = 1 + r() * 5, fy = 1 + r() * 5, ph = r() * 6.283;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const base = 127 + 100 * Math.sin((x / w) * fx * 6.283 + ph) * Math.cos((y / h) * fy * 6.283);
    for (let c = 0; c < ch; c++) px[(y * w + x) * ch + c] = Math.max(0, Math.min(255, Math.round(base + (r() - 0.5) * 60 + c * 9)));
  }
  return px;
}

export const PIXEL_CASES = Object.freeze([
  { name: 'rgba-64x48-s1', w: 64, h: 48, ch: 4, seed: 1 },
  { name: 'rgba-64x48-s2', w: 64, h: 48, ch: 4, seed: 2 },
  { name: 'rgb-37x23-s3', w: 37, h: 23, ch: 3, seed: 3 },
  { name: 'gray-20x20-s4', w: 20, h: 20, ch: 1, seed: 4 },
  { name: 'graya-33x17-s5', w: 33, h: 17, ch: 2, seed: 5 },
  { name: 'rgba-9x8-s6', w: 9, h: 8, ch: 4, seed: 6 },
  { name: 'rgba-640x400-s7', w: 640, h: 400, ch: 4, seed: 7 },
]);

// Studio image-lane renders: the eye reading what the studio makes.
export const RENDER_CASES = Object.freeze([
  { name: 'raked-concrete-s4', material: 'raked-concrete', w: 160, h: 100, seed: 4 },
  { name: 'raked-concrete-s5', material: 'raked-concrete', w: 160, h: 100, seed: 5 },
  { name: 'chladni-s4', material: 'chladni', w: 160, h: 100, seed: 4 },
]);

export function casePixels(c) {
  if (c.material) {
    const m = byId(c.material);
    return { px: toRGBA(renderImage(m, { w: c.w, h: c.h, seed: c.seed, marks: false }), m), w: c.w, h: c.h, ch: 4 };
  }
  return { px: seededPixels(c.w, c.h, c.ch, c.seed), w: c.w, h: c.h, ch: c.ch };
}

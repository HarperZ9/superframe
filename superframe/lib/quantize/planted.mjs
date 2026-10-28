// planted.mjs: the planted inputs the PREREG names (smooth ramps whose answer is known), the two renders reduced by
// area averaging, and flat fields for the noise floor.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodePNG } from '../../adapters/core.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function image(w, h, fn) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x / (w - 1), y / (h - 1)); rgba.set([c[0], c[1], c[2], 255], 4 * (y * w + x)); }
  return { w, h, rgba };
}

export const RAMPS = {
  grey: (w = 512, h = 128) => image(w, h, t => [255 * t, 255 * t, 255 * t]),
  'red-cyan': (w = 512, h = 128) => image(w, h, t => [255 * (1 - t), 255 * t, 255 * t]),
  dark: (w = 512, h = 128) => image(w, h, t => [64 * t, 64 * t, 64 * t]),
};

export const flat = (w, h, rgb) => image(w, h, () => rgb);

// Area-average reduction by an integer factor.
export function reduce({ w, h, rgba }, k) {
  const W = Math.floor(w / k), H = Math.floor(h / k), out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = [0, 0, 0];
    for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) { const p = 4 * ((y * k + j) * w + x * k + i); s[0] += rgba[p]; s[1] += rgba[p + 1]; s[2] += rgba[p + 2]; }
    out.set([...s.map(v => Math.round(v / (k * k))), 255], 4 * (y * W + x));
  }
  return { w: W, h: H, rgba: out };
}

export const RENDERS = { bow: 'out/refraction/bow-3840.png', rings: 'out/rings/rings-3840.png' };
// the renders are made by tools/refraction-study.mjs and tools/rings-render.mjs; tests on them skip until they exist
export const hasRenders = () => Object.values(RENDERS).every(r => existsSync(ROOT + r));
export const loadRender = (name, k = 4) => { const img = decodePNG(readFileSync(ROOT + RENDERS[name])); return k > 1 ? reduce(img, k) : img; };

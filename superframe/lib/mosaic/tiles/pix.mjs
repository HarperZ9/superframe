// tiles/pix.mjs: the pure pixel helpers the merged tile library needs, from name-art/lib/img.mjs (the
// same functions, unchanged), without that module's node:fs and node:zlib imports, so lib/mosaic loads in a browser.
import { boxBlur } from '../../../../glass/lib/raster.js';
import { rng, srgbToLinear, linearToSrgb } from '../../../../substrate/lib/vendor/superstack.mjs';
export { srgbToLinear, linearToSrgb, boxBlur };
export const img = (w, h) => ({ w, h, px: new Float32Array(w * h * 3) });
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const TAU = Math.PI * 2;
export function random(seed) { const r = rng(String(seed)); return () => r.nextFloat(); }
export function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()); }
export const hash2 = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function lin(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}
// Film grain, clumped (QUALITY-SPEC R4: correlation width 1.9 to 3.1 px, monochrome, surface SD 0.3 to 6 codes).
// amount is the SD in sRGB code values at mid grey; it scales with sqrt of the local tone so shadows stay clean.
export function grain(I, { amount = 3, seed = 'grain', radius = 1, chroma = 0.12 } = {}) {
  const { w, h, px } = I, n = w * h, R = random(seed);
  const g = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const m = gauss(R); g[i * 3] = m + chroma * gauss(R); g[i * 3 + 1] = m + chroma * gauss(R); g[i * 3 + 2] = m + chroma * gauss(R); }
  const b = boxBlur(g, w, h, radius, { stride: 3, passes: 2 });
  let sd = 0; for (let i = 0; i < n; i++) sd += b[i * 3 + 1] ** 2; sd = Math.sqrt(sd / n) || 1;
  const k = amount / 255 / sd;
  for (let i = 0; i < n * 3; i++) {
    const v = px[i], s = linearToSrgb(clamp(v)), t = Math.sqrt(clamp(s * (1 - s) * 4, 0.05, 1));
    px[i] = srgbToLinear(clamp(s + b[i] * k * t)) + (v > 1 ? v - 1 : 0);
  }
  return I;
}

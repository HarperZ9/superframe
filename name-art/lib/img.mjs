// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// img.mjs: the float picture every name piece renders into. { w, h, px: Float32Array(w*h*3) } in linear light
// (the playbook png16 surface shape), plus grain, dither, blur, resampling and PNG export (8-bit with seeded TPDF
// dither, 16-bit with an sRGB chunk). Pure; node only for the file helpers.
import { writeFileSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { encodePNG, decodePNG } from '../../playbook/lib/png.js';
import { encodePNG16 } from '../../feed-24/build/png16.js';
import { boxBlur } from '../../glass/lib/raster.js';
import { rng, xmur3, srgbToLinear, linearToSrgb } from '../../substrate/lib/vendor/superstack.mjs';
import { filmGrain } from '../../superframe/lib/look/grain.mjs';
import { bloom as scatter } from '../../superframe/lib/look/bloom.mjs';
import { shoulder as shoulder1, displayPixel } from '../../superframe/lib/look/tone.mjs';

export { srgbToLinear, linearToSrgb, boxBlur };
export const img = (w, h) => ({ w, h, px: new Float32Array(w * h * 3) });
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const fract = x => x - Math.floor(x);
export const TAU = Math.PI * 2;

export function random(seed) { const r = rng(String(seed)); return () => r.nextFloat(); }
export function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()); }
export const hash2 = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function lin(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}
export function fill(I, c) { for (let i = 0; i < I.w * I.h; i++) { I.px[i * 3] = c[0]; I.px[i * 3 + 1] = c[1]; I.px[i * 3 + 2] = c[2]; } return I; }
// Composite colour c over pixel i with coverage a.
export function over(I, i, c, a) { if (a <= 0) return; const p = I.px, k = i * 3; p[k] += (c[0] - p[k]) * a; p[k + 1] += (c[1] - p[k + 1]) * a; p[k + 2] += (c[2] - p[k + 2]) * a; }
export function mul(I, i, c, a = 1) { const p = I.px, k = i * 3; p[k] *= 1 + (c[0] - 1) * a; p[k + 1] *= 1 + (c[1] - 1) * a; p[k + 2] *= 1 + (c[2] - 1) * a; }
export function add(I, i, c, a = 1) { const p = I.px, k = i * 3; p[k] += c[0] * a; p[k + 1] += c[1] * a; p[k + 2] += c[2] * a; }

// Seeded value noise and fbm on a lattice, smooth (quintic), in [0, 1]. Periodic in x and y when period is set.
export function vnoise(x, y, s = 0, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const P = v => (period ? ((v % period) + period) % period : v);
  const a = hash2(P(xi), P(yi), s), b = hash2(P(xi + 1), P(yi), s), c = hash2(P(xi), P(yi + 1), s), d = hash2(P(xi + 1), P(yi + 1), s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm(x, y, s = 0, oct = 5, lac = 2.03, gain = 0.5) {
  let v = 0, a = 0.5, n = 0;
  for (let o = 0; o < oct; o++) { v += a * vnoise(x, y, s + o * 17); n += a; x = x * lac + 3.1; y = y * lac + 1.7; a *= gain; }
  return v / n;
}
// 3D value noise (for volumes and looping drifts).
export function vnoise3(x, y, z, s = 0) {
  const zi = Math.floor(z), fz = z - zi, uz = fz * fz * (3 - 2 * fz);
  return mix(vnoise(x + zi * 31.7, y + zi * 17.3, s), vnoise(x + (zi + 1) * 31.7, y + (zi + 1) * 17.3, s), uz);
}

// Film grain (QUALITY-SPEC R4), from the shared finishing core: three dye layers sharing a common field, coarse
// crystals in the shadows and fine ones in the highlights, amplitude on the print's density envelope. amount is the
// SD in sRGB code values at the peak; radius is the fine grain's size in px; chroma is the share of per-layer grain.
// (Effects pass 2026-10-28: the old field was one box-blurred white noise at 1 px, which measured 1.1 to 1.4 px
// correlation, under the R4 floor, and was masked by the per-channel dither, so it read as colour noise.)
export function grain(I, { amount = 3, seed = 'grain', radius = 1, chroma = 0.12 } = {}) {
  return filmGrain(I, { amount, seed, size: Math.max(0.8, 0.9 * radius), mono: Math.sqrt(1 - Math.min(0.9, 2.5 * chroma) ** 2) });
}

// Highlight shoulder, hue-preserving (lib/look/tone.mjs): linear to 0.85 on the largest channel, smooth roll above,
// all three channels scaled together, light past 1.0 going to white. The old per-channel shoulder rolled each channel
// on its own, which pushed hot amber toward lemon and flattened every glow core into one plateau.
export const shoulder = v => shoulder1(v);

// A picture flagged toned (already through AgX or another display transform) skips the shoulder.
// 8-bit sRGB with a seeded TPDF dither of one code peak. One dither value per pixel, shared by the three channels,
// so the dither adds no chroma noise (R4 chroma_ratio; the per-channel dither had out-measured the grain itself).
export function toRGBA8(I, seed = 'dither') {
  const { w, h, px } = I, out = new Uint8ClampedArray(w * h * 4), s = xmur3(String(seed));
  for (let i = 0; i < w * h; i++) {
    const o = I.toned ? [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]] : displayPixel(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]), d = hash2(i, 0, s) - hash2(i, 7, s);
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(linearToSrgb(clamp(o[c])) * 255 + d);
    out[i * 4 + 3] = 255;
  }
  return out;
}
export function savePNG(I, path, seed) { writeFileSync(path, encodePNG(I.w, I.h, toRGBA8(I, seed))); }
export async function savePNG16(I, path) {
  const n = I.w * I.h, out = new Uint16Array(n * 3);
  for (let i = 0; i < n; i++) { const o = I.toned ? [I.px[i * 3], I.px[i * 3 + 1], I.px[i * 3 + 2]] : displayPixel(I.px[i * 3], I.px[i * 3 + 1], I.px[i * 3 + 2]); for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(linearToSrgb(clamp(o[c])) * 65535); }
  writeFileSync(path, await encodePNG16(out, I.w, I.h, b => deflateSync(b, { level: 6 })));
}
export function loadPNG(path) {
  const { w, h, data } = decodePNG(readFileSync(path)), I = img(w, h);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) I.px[i * 3 + c] = srgbToLinear(data[i * 4 + c] / 255);
  return I;
}

// Bilinear sample of channel c, pixel centres at +0.5.
export function sample(I, x, y, c) {
  const { w, h, px } = I;
  x = clamp(x - 0.5, 0, w - 1.001); y = clamp(y - 0.5, 0, h - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = (y0 * w + x0) * 3 + c;
  return (px[i] + (px[i + 3] - px[i]) * fx) * (1 - fy) + (px[i + w * 3] + (px[i + w * 3 + 3] - px[i + w * 3]) * fx) * fy;
}
export function sampleF(F, w, h, x, y) {
  x = clamp(x - 0.5, 0, w - 1.001); y = clamp(y - 0.5, 0, h - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
  return (F[i] + (F[i + 1] - F[i]) * fx) * (1 - fy) + (F[i + w] + (F[i + w + 1] - F[i + w]) * fx) * fy;
}
// Box-filter downsample by an integer factor (for contact sheets and supersampled renders).
export function down(I, k) {
  const w = Math.floor(I.w / k), h = Math.floor(I.h / k), O = img(w, h), n = k * k;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    let s = 0; for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) s += I.px[((y * k + j) * I.w + x * k + i) * 3 + c];
    O.px[(y * w + x) * 3 + c] = s / n;
  }
  return O;
}
// Bloom: light above the threshold scatters through a multi-scale Gaussian spread that conserves energy
// (lib/look/bloom.mjs). radius is the widest sigma in px; strength is the share of the hot light that moves. The old
// version added two box blurs on top: energy grew with strength and every hot spot drew a rectangle on a dark ground.
export function bloom(I, { threshold = 0.8, radius = 12, strength = 0.35, tint = [1, 1, 1], tail = 0.65 } = {}) {
  return scatter(I, { threshold, radius: Math.max(2, radius), strength, tint, tail });
}
// Vignette and lens falloff (cos^4-ish), in linear light.
export function vignette(I, k = 0.25) {
  const { w, h, px } = I, d = Math.hypot(w, h) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const r = Math.hypot(x - w / 2, y - h / 2) / d, f = 1 - k * r * r; const i = (y * w + x) * 3; px[i] *= f; px[i + 1] *= f; px[i + 2] *= f; }
  return I;
}

// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// grain.mjs: film grain modelled on a colour print, not white noise.
//   - Three dye layers, each its own field, sharing a common component (`mono`, 0..1): real colour stock shows some
//     chroma in its grain but mostly luminance. QUALITY-SPEC R4 wants chroma_ratio under 0.45 by default.
//   - Two grain sizes per layer. The print's shadows come from the thin parts of the negative, where only the large,
//     fast crystals developed, so shadows carry the coarse field and highlights the fine one. `size` is the fine
//     grain's sigma in output px; the coarse one is 2.2x that.
//   - Amplitude follows the print's density response: largest in the low midtones, near zero at paper white and in
//     the deepest black (amp x sqrt(4 s (1 - s)) with a shadow bias), in the display encoding, per channel.
//   - It is applied in the display encoding and mapped back to linear, so its strength in code values is what the
//     eye and the R4 measurement see. Values past 1 (scene light) pass through untouched.
// Parameters: amount (SD in 8-bit code values at the peak), size (px), mono (0..1), seed. Deterministic per seed.
import { gauss } from './blur.mjs';
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const toSrgb = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const toLin = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hashSeed = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// A unit-SD Gaussian noise field blurred to correlation sigma, renormalised so the SD is exactly 1.
function field(n, w, h, sigma, r) {
  const g = new Float32Array(n);
  for (let i = 0; i < n; i += 2) { const u = r() || 1e-12, v = r(), m = Math.sqrt(-2 * Math.log(u)); g[i] = m * Math.cos(6.2831853 * v); if (i + 1 < n) g[i + 1] = m * Math.sin(6.2831853 * v); }
  const b = gauss(g, w, h, sigma, 1);
  let s = 0; for (let i = 0; i < n; i++) s += b[i] * b[i];
  const k = 1 / Math.sqrt(s / n || 1); for (let i = 0; i < n; i++) b[i] *= k;
  return b;
}

export function filmGrain(I, { amount = 3, size = 1, mono = 0.8, seed = 'grain', shadowBias = 0.35 } = {}) {
  const { w, h, px } = I, n = w * h, r = mulberry(hashSeed(seed));
  const fine = Math.max(0.5, size), coarse = 2.2 * fine;
  const shared = [field(n, w, h, fine, r), field(n, w, h, coarse, r)];
  const a = amount / 255, cm = Math.sqrt(1 - mono * mono);
  for (let c = 0; c < 3; c++) {
    const own = [field(n, w, h, fine, r), field(n, w, h, coarse, r)];
    for (let i = 0; i < n; i++) {
      const v = px[3 * i + c]; if (!(v >= 0) || v > 1) continue;
      const s = toSrgb(v), t = clamp(s), lo = 1 - t;
      // shadow-biased density envelope, and the fine/coarse mix by tone
      const env = Math.sqrt(clamp(4 * t * lo)) * (1 + shadowBias * (lo - 0.5));
      const f = mono * shared[0][i] + cm * own[0][i], g = mono * shared[1][i] + cm * own[1][i];
      const z = g + (f - g) * smoothstep(0.15, 0.75, t);
      px[3 * i + c] = toLin(clamp(s + a * env * z));
    }
  }
  return I;
}
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

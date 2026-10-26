// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// spectral.mjs: combine() on spectra, and the observer (BLEED sections 18, 21, 22). The spectral medium is the
// superframe's lib/medium/spectral.mjs (16 bands, 400 to 700 nm; CIE 1931 observer; D65 and A; Kubelka-Munk;
// glazes; Jakob-Hanika upsampling; metameric blacks), imported, never duplicated. This file applies each layer's
// law band by band and only turns light into colour at the observer, so a colour tick keeps more dimensions than any
// readout taken from it (the reason an RGB IR cannot hold metamers).
//   combineSpectral(layers, weights, { paper, illum })  -> { w, h, spec: Float32Array(16 n), rgb (observer), illum }
//   observe(spec, n, illum)                              -> linear rgb, the readout
//   lab(rgb) / deltaE(a, b)                              -> CIELAB (D65 white) and CIE76 distance
//   assimilate(rgb, w, h, { alpha, radius })             -> the Bezold effect: a perceptual context law at the reader
//   mixPigment(a, b) / mixLight(a, b)                    -> Bezold plate I: one pair, two laws
import { BANDS, LAMBDA, toXYZ, toLinearRGB, spectrumRGB, upsample, absorbance, mixKM } from '../../../superframe/lib/medium/spectral.mjs';
import { F32, sample, clamp, hexLin, blur } from './layer.mjs';
import { cauchy } from '../gen/glass.mjs';

export { BANDS, LAMBDA, spectrumRGB, upsample, mixKM };
const cache = new Map();
// a linear rgb colour's smooth spectrum, memoised to 1/256 (upsampling is a small Gauss-Newton fit)
export function specOf(rgb) { const key = rgb.map(v => Math.round(clamp(v, 0, 1) * 255)).join(','); let s = cache.get(key); if (!s) { s = upsample(rgb.map(v => clamp(v, 0.002, 0.998))); cache.set(key, s); } return s; }
export const specOfHex = hex => specOf(hexLin(hex));

export function combineSpectral(layers, weights = null, { paper = '#efe9dc', illum = 'D65', w = layers[0].w, h = layers[0].h } = {}) {
  const n = w * h, S = F32(BANDS * n), P = Array.isArray(paper) ? paper : specOfHex(paper), E = F32(3 * n);
  for (let k = 0; k < n; k++) for (let b = 0; b < BANDS; b++) S[k * BANDS + b] = P[b];
  const Wt = layers.map((L, i) => (weights ? weights[i] ?? 1 : 1)), wAt = (i, k) => { const v = Wt[i]; return typeof v === 'number' ? v : v[k]; };
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i], sh = L.law.shape, A = L.fields.amount, str = L.law.params?.strength ?? 1;
    const inkSpec = L.spectrum ?? (L.ink ? specOf(L.ink) : null), ab = inkSpec ? absorbance(inkSpec) : null;
    if (sh === 'absorb' || sh === 'sheet') {
      const lawName = L.law.params?.law, weber = sh === 'sheet' && lawName === 'weber', screen = sh === 'sheet' && lawName === 'screen';
      for (let k = 0; k < n; k++) {
        const own = L.state?.absorbSpectrum?.(k), s = wAt(i, k) * (sh === 'sheet' ? clamp(A[k], 0, 1) : A[k] * str);
        if (!s && !own) continue;
        for (let b = 0; b < BANDS; b++) {
          const q = k * BANDS + b;
          if (screen) { S[q] = 1 - (1 - S[q]) * (1 - s * inkSpec[b]); continue; }
          let d = 3.9 * (own ? own[b] * wAt(i, k) : s * ab[b]);
          if (weber) d = Math.log1p(29.75 * d) / Math.log1p(29.75);     // the Albers stack's perceived density
          S[q] *= Math.exp(-d);
        }
      }
    } else if (sh === 'cover' || sh === 'tiles' || sh === 'paper') {
      const R = L.fields.rgb;
      for (let k = 0; k < n; k++) { const s = clamp(wAt(i, k) * A[k], 0, 1); if (!s) continue; const sp = L.state?.reflectSpectrum?.(k) ?? (R ? specOf([R[3 * k], R[3 * k + 1], R[3 * k + 2]]) : inkSpec); for (let b = 0; b < BANDS; b++) S[k * BANDS + b] += (sp[b] - S[k * BANDS + b]) * s; }
    } else if (sh === 'emit' || sh === 'screen') {
      const R = L.fields.rgb, I = L.ink ?? [1, 1, 1];
      for (let k = 0; k < n; k++) { const s = wAt(i, k); for (let c = 0; c < 3; c++) E[3 * k + c] += s * (sh === 'emit' ? (R ? R[3 * k + c] : A[k] * I[c]) * (L.law.params?.exposure ?? 1) : A[k] * I[c] * 0.6); }
    } else if (sh === 'refract') refractBands(S, L, i, wAt, w, h);
  }
  return { w, h, spec: S, rgb: observe(S, n, illum, E), illum };
}

function refractBands(S, L, i, wAt, w, h) {
  const H = L.fields.height, G = cauchy(L.weights.nd, L.weights.abbe), depth = L.weights.depth, src = Float32Array.from(S), band = F32(w * h);
  for (let b = 0; b < BANDS; b++) {
    const dn0 = (G.n(LAMBDA[b] / 1000) - 1) * depth;
    for (let k = 0; k < w * h; k++) band[k] = src[k * BANDS + b];
    for (let j = 0; j < h; j++) for (let x = 0; x < w; x++) {
      const k = j * w + x, s = wAt(i, k); if (!s) continue;
      const l = H[j * w + Math.max(0, x - 1)], r = H[j * w + Math.min(w - 1, x + 1)], u = H[Math.max(0, j - 1) * w + x], d = H[Math.min(h - 1, j + 1) * w + x], dn = dn0 * s;
      S[k * BANDS + b] = sample(band, w, h, x - dn * (r - l) / 2, j - dn * (d - u) / 2) * clamp(1 / (1 + dn * (l + r + u + d - 4 * H[k])), 0.35, 2.5);
    }
  }
}

// the observer: spectra to linear rgb under an illuminant (adapted), plus any emitted light
export function observe(S, n, illum = 'D65', E = null) {
  const out = F32(3 * n), R = new Array(BANDS);
  for (let k = 0; k < n; k++) { for (let b = 0; b < BANDS; b++) R[b] = S[k * BANDS + b]; const c = toLinearRGB(toXYZ(R, illum), illum); for (let q = 0; q < 3; q++) out[3 * k + q] = c[q] + (E ? E[3 * k + q] : 0); }
  return out;
}

// CIELAB from linear sRGB (D65), and CIE76
export function lab([r, g, b]) {
  const X = 0.4124 * r + 0.3576 * g + 0.1805 * b, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116), fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export const deltaE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
export const chroma = c => { const [, a, b] = lab(c); return Math.hypot(a, b); };
export const hueDeg = c => { const [, a, b] = lab(c); return ((Math.atan2(b, a) * 180 / Math.PI) + 360) % 360; };

// Bezold plate I: the same two colorants mixed as pigments (Kubelka-Munk, subtractive) and as lights (additive)
export const mixPigment = (Ra, Rb, c = 0.5) => mixKM([{ R: Ra, c }, { R: Rb, c: 1 - c }]);
export const mixLight = (Ra, Rb, c = 0.5) => Ra.map((v, i) => c * v + (1 - c) * Rb[i]);

// The Bezold effect (assimilation): at fine scale a colour is pulled toward its interleaved surround. A context law of
// the reader, applied after the observer: rgb' = rgb + alpha (local mean - rgb), the local mean a gaussian of radius r.
// It changes the reading, never the light (BLEED section 21: keep carrier and reader apart).
export function assimilate(rgb, w, h, { alpha = 0.35, radius = 1.5 } = {}) {
  const out = F32(rgb.length), ch = F32(w * h);
  for (let c = 0; c < 3; c++) { for (let k = 0; k < w * h; k++) ch[k] = rgb[3 * k + c]; const m = blur(ch, w, h, radius); for (let k = 0; k < w * h; k++) out[3 * k + c] = rgb[3 * k + c] + alpha * (m[k] - rgb[3 * k + c]); }
  return out;
}

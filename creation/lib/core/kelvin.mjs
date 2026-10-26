// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// kelvin.mjs: vendored from Low Water (game/engine/light/kelvin.mjs, 2026-10-26) so the engine stands alone; the
// function bodies are unchanged. Low Water keeps its own copy.
//
// Colour of light, from physics: a black body at a temperature, or a spectral line, through the CIE 1931
// colour matching functions to linear sRGB. The matching functions are the multi-lobe Gaussian fit of
// Wyman, Sloan and Shirley (2013, "Simple Analytic Approximations to the CIE XYZ Color Matching Functions",
// JCGT 2(2)), a published formula written here from the paper's coefficients. Original code.
//   kelvinRgb(K)            -> [r, g, b] linear sRGB, the brightest channel 1
//   lineRgb(nm)             -> [r, g, b] for a monochrome line, out-of-gamut parts clipped, brightest 1
//   spectrumRgb(parts)      -> a mix: parts [{ K | nm, w }] weighted by luminance share
//   mired(K) / fromMired(m) -> 1e6 / K and back (temperatures average in mired, not kelvin)

const g = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
export function cmf(nm) {
  return [
    1.056 * g(nm, 599.8, 37.9, 31.0) + 0.362 * g(nm, 442.0, 16.0, 26.7) - 0.065 * g(nm, 501.1, 20.4, 26.2),
    0.821 * g(nm, 568.8, 46.9, 40.5) + 0.286 * g(nm, 530.9, 16.3, 31.1),
    1.217 * g(nm, 437.0, 11.8, 36.0) + 0.681 * g(nm, 459.0, 26.0, 13.8),
  ];
}
const XYZ2RGB = [[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.204, 1.057]];
export function xyzToRgb(X, Y, Z) { return XYZ2RGB.map((r) => r[0] * X + r[1] * Y + r[2] * Z); }
const norm = (c) => { const p = c.map((v) => Math.max(0, v)), m = Math.max(...p) || 1; return p.map((v) => v / m); };

// Planck's law (relative; constants folded): spectral radiance at wavelength nm for temperature K
const planck = (nm, K) => { const l = nm * 1e-9; return 1 / (l ** 5 * (Math.exp(1.4388e-2 / (l * K)) - 1)); };
function blackbodyXyz(K) {
  let X = 0, Y = 0, Z = 0;
  for (let nm = 380; nm <= 780; nm += 5) { const p = planck(nm, K), c = cmf(nm); X += p * c[0]; Y += p * c[1]; Z += p * c[2]; }
  return [X / Y, 1, Z / Y];
}
const KCACHE = new Map();
export function kelvinRgb(K) {
  const k = Math.round(Math.max(800, Math.min(20000, K)) / 10) * 10;
  let c = KCACHE.get(k); if (!c) { c = norm(xyzToRgb(...blackbodyXyz(k))); KCACHE.set(k, c); }
  return c.slice();
}
export function lineRgb(nm) { const c = cmf(nm); return norm(xyzToRgb(c[0] / (c[1] || 1e-6), 1, c[2] / (c[1] || 1e-6))); }
// luminance (Rec. 709 weights on linear sRGB)
export const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export function spectrumRgb(parts) {
  const acc = [0, 0, 0];
  for (const p of parts) { const c = p.nm ? lineRgb(p.nm) : kelvinRgb(p.K), L = lum(c) || 1; for (let k = 0; k < 3; k++) acc[k] += (c[k] / L) * p.w; }
  return norm(acc);
}
export const mired = (K) => 1e6 / K;
export const fromMired = (m) => 1e6 / Math.max(m, 1);
// the correlated temperature a colour reads as, by the nearest black body in r/b ratio (enough to label a mix)
export function warmthOf(rgb) {
  const e = 0.02, f = (c) => [Math.log((c[0] + e) / (c[1] + e)), Math.log((c[1] + e) / (c[2] + e))], t = f(rgb); let best = 6500, bd = Infinity;
  for (let K = 1000; K <= 12000; K += 50) { const q = f(kelvinRgb(K)), d = (q[0] - t[0]) ** 2 + (q[1] - t[1]) ** 2; if (d < bd) { bd = d; best = K; } }
  return best;
}

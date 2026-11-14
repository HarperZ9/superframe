// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// colour.mjs: grading moves in OKLab on linear pictures, in place.
//   chroma(I, k, { protect })  scale chroma by k; `protect` (0..1) eases the boost off already-saturated pixels so
//                              they do not leave the gamut (a vibrance move, not a flat saturation knob)
//   duotone(I, dark, light, accent?)  map lightness onto a two-ink ramp (linear RGB triples), optional accent band
const cbrt = Math.cbrt, clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export function toOklab(r, g, b) {
  const l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export function fromOklab(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
export function chroma(I, k, { protect = 0.6 } = {}) {
  const p = I.px;
  for (let i = 0; i < p.length; i += 3) {
    const [L, a, b] = toOklab(Math.max(0, p[i]), Math.max(0, p[i + 1]), Math.max(0, p[i + 2])), C = Math.hypot(a, b);
    const kk = 1 + (k - 1) * (1 - protect * clamp(C / 0.25));
    const o = fromOklab(L, a * kk, b * kk); p[i] = Math.max(0, o[0]); p[i + 1] = Math.max(0, o[1]); p[i + 2] = Math.max(0, o[2]);
  }
  return I;
}
export function duotone(I, dark, light, { gamma = 1, accent = null, at = 0.55, width = 0.08 } = {}) {
  const p = I.px;
  for (let i = 0; i < p.length; i += 3) {
    const L = clamp(toOklab(Math.max(0, p[i]), Math.max(0, p[i + 1]), Math.max(0, p[i + 2]))[0]), t = L ** gamma;
    const band = accent ? clamp(1 - Math.abs(t - at) / width) : 0;
    for (let c = 0; c < 3; c++) { let v = dark[c] + (light[c] - dark[c]) * t; if (accent) v += (accent[c] - v) * band * band * (3 - 2 * band); p[i + c] = v; }
  }
  return I;
}

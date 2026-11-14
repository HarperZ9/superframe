// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// spd.mjs: the light sources of the Seattle night scenes, as spectral power distributions at 1 nm, 380 to 780 nm,
// and the step from a spectrum to display colour through the CIE 1931 2-degree observer in lib/medium/spectral.mjs.
//
//   hps()            high-pressure sodium street lamp. A parametric model shaped to published features, not a
//                    measured table: the sodium D doublet (589.0 and 589.6 nm) pressure-broadened into wings, the red
//                    wing wider than the blue, with a self-reversed dip at the line centre from absorption in the cooler
//                    outer arc (reversal width about 10 nm in standard lamps), plus the weaker sodium lines near 498,
//                    515, 568 and 616 nm and faint mercury lines (436, 546 nm) from the amalgam. Calibrated so its
//                    chromaticity gives a correlated colour temperature near 2000 K, inside the 1900 to 2200 K that
//                    lamp data sheets give for standard HPS. See tests/seattle-spd.test.mjs.
//   planckSPD(T)     a blackbody; a household or street incandescent filament runs near 2400 to 2850 K.
//   moonSPD()        sunlight (5772 K blackbody) reddened by the lunar albedo, which rises toward the red. The slope
//                    is calibrated so the result sits near 4100 K, the figure usually quoted for moonlight (from
//                    memory, moderate confidence).
//   bands(spd)       integrate a 1 nm SPD into the 16 bands of lib/medium/spectral.mjs (20 nm, 400 to 700 nm).
//   lightRGB(spd)    the colour of the light itself in linear sRGB, luminance 1, with no chromatic adaptation
//                    (a viewer, or camera, balanced for daylight; the night eye adapts only part of the way).
//   litRGB(R, spd)   a reflectance spectrum lit by the source, same convention.
//   xy, cctMcCamy    chromaticity and McCamy's (1992) correlated colour temperature approximation.
import { LAMBDA, BANDS, toXYZ, toLinearRGB } from '../medium/spectral.mjs';

export const NM = Array.from({ length: 401 }, (_, i) => 380 + i);
const gauss = (l, c, s) => Math.exp(-0.5 * ((l - c) / s) ** 2);
const lor = (l, c, w) => 1 / (1 + ((l - c) / w) ** 2);
const planck = (nm, K) => { const l = nm * 1e-9; return 1 / (l ** 5 * (Math.exp(1.4387769e-2 / (l * K)) - 1)); };

// Na I and Hg I line centres in nm (NIST atomic spectra database values, from memory, high confidence for these).
export const LINES = { naD: 589.3, na498: 498.3, na515: 515.3, na568: 568.5, na616: 615.8, hg436: 435.8, hg546: 546.1 };

export const HPS_DEFAULT = { blueWing: 10, redWing: 14, reversalDepth: 0.93, reversalSigma: 2.6, side: 0.25, hg: 0.06, continuum: 0.05 };

export function hps(p = {}) {
  const q = { ...HPS_DEFAULT, ...p }, L = LINES;
  return NM.map(l => {
    const wing = l < L.naD ? lor(l, L.naD, q.blueWing) : lor(l, L.naD, q.redWing);
    const d = wing * (1 - q.reversalDepth * gauss(l, L.naD, q.reversalSigma));
    const side = q.side * (0.9 * gauss(l, L.na568, 2.2) + 0.55 * gauss(l, L.na616, 2.6) + 0.12 * gauss(l, L.na498, 1.2) + 0.1 * gauss(l, L.na515, 1.2));
    const hg = q.hg * (gauss(l, L.hg436, 0.8) + gauss(l, L.hg546, 0.8));
    return d + side + hg + q.continuum * planck(l, 2100) / planck(600, 2100);
  });
}

export const planckSPD = (K = 2700) => NM.map(l => planck(l, K) / planck(560, K));

// lunar albedo slope: reflectance grows roughly linearly with wavelength over the visible (from memory, moderate)
export const moonSPD = () => NM.map(l => (planck(l, 5772) / planck(560, 5772)) * (0.25 + 0.75 * (l - 380) / 400));

// a 1 nm spectrum into the 16 bands, each the mean over its 20 nm window (band centre +- 10 nm)
export function bands(spd) {
  return LAMBDA.map(c => {
    let s = 0, n = 0;
    for (let l = c - 10; l < c + 10; l++) { const i = l - 380; if (i >= 0 && i < spd.length) { s += spd[i] + spd[i + 1]; n += 2; } }
    return s / n;
  });
}

const ONES = new Array(BANDS).fill(1);
export const xyzOf = spd => toXYZ(ONES, bands(spd));
export function xy(spd) { const [X, Y, Z] = xyzOf(spd), s = X + Y + Z; return [X / s, Y / s]; }

// McCamy (1992): n = (x - 0.3320) / (0.1858 - y); CCT = 449 n^3 + 3525 n^2 + 6823.3 n + 5520.33. Good to a few
// kelvin from 2000 to 12500 K near the locus.
export function cctMcCamy([x, y]) { const n = (x - 0.332) / (0.1858 - y); return 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33; }

// adapt: the degree of chromatic adaptation, 0 keeps daylight balance (the light shows its own colour), 1 adapts fully
// to the source. Von Kries scaling in Bradford cone space (Lam 1985; matrix from memory, high confidence), with the
// partial degree applied as a power of the per-cone gain, as CIECAM02's degree D does linearly. The night eye under
// sodium adapts only part of the way; the scenes use 0.3.
const BRAD = [[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]];
const mv = (M, v) => M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
function inv3(M) {
  const [[a, b, c], [d, e, f], [g, h, i]] = M, A = e * i - f * h, B = f * g - d * i, C = d * h - e * g, det = a * A + b * B + c * C;
  return [[A, c * h - b * i, b * f - c * e], [B, a * i - c * g, c * d - a * f], [C, b * g - a * h, a * e - b * d]].map(r => r.map(v => v / det));
}
const BRAD_INV = inv3(BRAD), D65W = [0.95047, 1, 1.08883];
export function litRGB(R, spd, { adapt = 0 } = {}) {
  const S = bands(spd), X = toXYZ(R, S), W = toXYZ(ONES, S), Wn = W.map(v => v / W[1]);
  const lms = mv(BRAD, X), lw = mv(BRAD, Wn), ld = mv(BRAD, D65W);
  const XYZ = mv(BRAD_INV, lms.map((v, k) => v * (ld[k] / lw[k]) ** adapt));
  return toLinearRGB(XYZ, 'D65').map(v => Math.max(0, v));
}
export const lightRGB = (spd, o) => litRGB(ONES, spd, o);

// Colour spread: the mean distance between every pair of surfaces in the CIELAB a*b* plane, each surface scaled to
// the same luminance first, so the measure is hue and chroma only. At the scenes' partial adaptation (0.3) it says how
// far apart a red car, a green hedge and a blue door still look under the lamp. Under full von Kries adaptation this
// 16-band model returns most of the spread even for sodium, which is a limit of the model (the measured colour
// rendering index of standard HPS is about 20 to 25, from memory, moderate confidence); SCENE.md reports both.
export function colourSpread(reflectances, spd, labOf, adapt = 0.3) {
  const L = reflectances.map(R => litRGB(R, spd, { adapt })).map(v => { const y = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; return labOf(v.map(c => c * 0.2 / Math.max(1e-9, y))); });
  let s = 0, n = 0;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { s += Math.hypot(L[i][1] - L[j][1], L[i][2] - L[j][2]); n++; }
  return s / n;
}

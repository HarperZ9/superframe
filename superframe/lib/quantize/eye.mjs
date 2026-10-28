// eye.mjs: a reduced S-CIELAB (Zhang and Wandell 1996). Linear RGB goes to XYZ, then to Poirson-Wandell opponent
// channels; each channel is blurred by its sum of Gaussians, whose spreads are in degrees of visual angle and so in
// pixels once the viewing distance (pixels per degree, ppd) is known. Back to XYZ, then CIELAB, then CIEDE2000.
// Constants are the published S-CIELAB filter table as remembered (moderate confidence). The 7 degree negative
// luminance lobe is dropped and the remaining weights renormalised: a stated simplification, which makes this model
// slightly more forgiving of very low-frequency error than the full one.
import { dE00 } from './ciede.mjs';
import { xyzToLab } from '../study/cmath.mjs';

const RAD = Math.PI / 180;
const XYZ2OPP = [[0.2787336, 0.7218031, -0.1065520], [-0.4487736, 0.2898056, 0.0771569], [0.0859513, -0.5899859, 0.5011089]];
const RGB2XYZ = [[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]];
// [spread in degrees, weight]; kernel exp(-x^2 / s^2), so sigma = s / sqrt 2.
export const FILTERS = [[[0.05, 1.00327], [0.225, 0.114416]], [[0.0685, 0.616725], [0.826, 0.383275]], [[0.0920, 0.567885], [0.6451, 0.432115]]];

const mul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
function inv3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m, A = e * i - f * h, B = f * g - d * i, C = d * h - e * g, det = a * A + b * B + c * C;
  return [[A, c * h - b * i, b * f - c * e], [B, a * i - c * g, c * d - a * f], [C, b * g - a * h, a * e - b * d]].map(r => r.map(v => v / det));
}
const RGB2OPP = mul(XYZ2OPP, RGB2XYZ), OPP2XYZ = inv3(XYZ2OPP);

// Pixels per degree for a pixel pitch and viewing distance in the same unit.
export const ppdFrom = ({ pitch, dist }) => 1 / (2 * Math.atan(pitch / (2 * dist)) / RAD);

// Box widths whose 3-fold cascade has the variance of a Gaussian of the given sigma (integer widths, odd).
function boxes(sigma, n = 3) {
  const ideal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(ideal); if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  return Array.from({ length: n }, (_, i) => (i < m ? wl : wl + 2));
}

// Mirror index into [0, len): reflected edges keep a texture's local statistics (a halftone's coverage), where
// extended edges repeat one row and bias every wide kernel near the border (found 2026-10-28 by check P6).
const mirror = (k, len) => { const p = 2 * len; k = ((k % p) + p) % p; return k < len ? k : p - 1 - k; };

// One box pass along rows (stride 1) or columns (stride w), edges mirrored.
function boxPass(src, dst, w, h, r, horiz) {
  const len = horiz ? w : h, lines = horiz ? h : w, step = horiz ? 1 : w, inv = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const base = horiz ? l * w : l, at = k => src[base + mirror(k, len) * step];
    let s = 0; for (let k = -r; k <= r; k++) s += at(k);
    for (let k = 0; k < len; k++) { dst[base + k * step] = s * inv; s += at(k + r + 1) - at(k - r); }
  }
}

export function gaussBlur(plane, w, h, sigma) {
  if (sigma < 0.3) return Float32Array.from(plane);
  let a = Float32Array.from(plane), b = new Float32Array(plane.length);
  for (const bw of boxes(sigma)) { const r = (bw - 1) >> 1; boxPass(a, b, w, h, r, true); boxPass(b, a, w, h, r, false); }
  return a;
}

// Linear RGB (3 per pixel) to eye-filtered CIELAB (3 per pixel) at a viewing distance in ppd.
export function eyeLab(linRGB, w, h, ppd) {
  const n = w * h, opp = [0, 1, 2].map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) opp[c][i] = RGB2OPP[c][0] * linRGB[3 * i] + RGB2OPP[c][1] * linRGB[3 * i + 1] + RGB2OPP[c][2] * linRGB[3 * i + 2];
  const filt = opp.map((P, c) => {
    const W = FILTERS[c].reduce((s, [, wt]) => s + wt, 0), acc = new Float32Array(n);
    for (const [s, wt] of FILTERS[c]) { const B = gaussBlur(P, w, h, (s * ppd) / Math.SQRT2); for (let i = 0; i < n; i++) acc[i] += (wt / W) * B[i]; }
    return acc;
  });
  const lab = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    const o = [filt[0][i], filt[1][i], filt[2][i]], xyz = OPP2XYZ.map(r => Math.max(0, r[0] * o[0] + r[1] * o[1] + r[2] * o[2]));
    const L = xyzToLab(xyz); lab[3 * i] = L[0]; lab[3 * i + 1] = L[1]; lab[3 * i + 2] = L[2];
  }
  return lab;
}

// Per-pixel CIEDE2000 between two eye-filtered images, and its summary.
// Also returns the mean |dL*|: the fair score for a one-axis codebook (1-bit, four greens, one ink), which cannot
// hold chroma and so is judged on lightness.
export function deMap(srcLin, outLin, w, h, ppd) {
  const A = eyeLab(srcLin, w, h, ppd), B = eyeLab(outLin, w, h, ppd), m = new Float32Array(w * h), dl = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { m[i] = dE00([A[3 * i], A[3 * i + 1], A[3 * i + 2]], [B[3 * i], B[3 * i + 1], B[3 * i + 2]]); dl[i] = Math.abs(A[3 * i] - B[3 * i]); }
  return { m, dl };
}
export function deStats(srcLin, outLin, w, h, ppd) {
  const { m, dl } = deMap(srcLin, outLin, w, h, ppd), s = Float32Array.from(m).sort();
  let sum = 0, sl = 0; for (let i = 0; i < m.length; i++) { sum += m[i]; sl += dl[i]; }
  return { mean: sum / m.length, p95: s[Math.floor(0.95 * (s.length - 1))], max: s[s.length - 1], meanDL: sl / m.length };
}

// Banding ratio on a horizontal ramp: the largest column-to-column step of row-averaged, eye-filtered L*, over the
// source's mean step. A dither that is a metamer stays near 1; contour bands make one step much larger than the rest.
export function bandingRatio(srcLin, outLin, w, h, ppd, margin = 16) {
  const prof = lab => { const p = new Float64Array(w); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p[x] += lab[3 * (y * w + x)] / h; return p; };
  const ps = prof(eyeLab(srcLin, w, h, ppd)), po = prof(eyeLab(outLin, w, h, ppd));
  let maxOut = 0, sumSrc = 0, n = 0;
  for (let x = margin + 1; x < w - margin; x++) { maxOut = Math.max(maxOut, Math.abs(po[x] - po[x - 1])); sumSrc += Math.abs(ps[x] - ps[x - 1]); n++; }
  return maxOut / (sumSrc / n);
}

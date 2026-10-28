// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// metamers.mjs: the set of spectra one observer cannot tell apart, and the prism that takes a picture into spectra and
// back out under another light. Builds on spectral.mjs (16 bands, CIE 1931 observer, D65, A, candle).
//
// Newton's mixture rule (a mixture sits at the weighted centre of its parts on his colour circle) implies metamers:
// different spectra with the same readout. Here the readout is linear: an observer is a few rows (X, Y, Z for the CIE
// standard observer; two cone rows for a dichromat), each a colour-matching function times the illuminant. The
// metamer set of a target is every reflectance R with those rows' readings equal to the target's and every band in
// [lo, hi]: a convex polytope in 16 dimensions, 13-dimensional for a trichromat. It is sampled by hit-and-run (a
// random direction in the rows' null space, a uniform step along the chord inside the bounds), which converges to the
// uniform distribution over the polytope.
//
// Cone rows come from XYZ through the Hunt-Pointer-Estevez matrix (L, M, S); values recalled, moderate confidence.
// A protanope lacks L, a deuteranope M, a tritanope S. Lab is CIE 1976 relative to the illuminant's own white.
import { BANDS, LAMBDA, ILLUMINANTS, toXYZ, upsample } from './spectral.mjs';

// CIE 1931 colour matching functions at the bands, rebuilt from toXYZ (unit spikes), so this file holds no copy
const CMF = [0, 1, 2].map(c => LAMBDA.map((_, i) => { const e = new Array(BANDS).fill(0); e[i] = 1; return toXYZ(e, new Array(BANDS).fill(1))[c] * BANDS; }));
const HPE = [[0.38971, 0.68898, -0.07868], [-0.22981, 1.1834, 0.04641], [0, 0, 1]];

// an observer's rows under an illuminant, scaled so a perfect white reads its white point
export function observerRows(observer = 'standard', illum = 'D65') {
  const S = ILLUMINANTS[illum] ?? illum, N = S.reduce((a, s, i) => a + s * CMF[1][i], 0);
  const xyz = CMF.map(row => row.map((v, i) => v * S[i] / N));
  if (observer === 'standard') return xyz;
  const lms = HPE.map(h => LAMBDA.map((_, i) => h[0] * xyz[0][i] + h[1] * xyz[1][i] + h[2] * xyz[2][i]));
  const drop = { protan: 0, deutan: 1, tritan: 2 }[observer];
  if (drop === undefined) throw new Error(`metamers: unknown observer "${observer}"`);
  return lms.filter((_, k) => k !== drop);
}
export const read = (rows, R) => rows.map(r => r.reduce((s, v, i) => s + v * R[i], 0));

// CIE 1976 Lab relative to a white, and the colour difference between two XYZ under that white
const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
export function lab(XYZ, white) { const [x, y, z] = XYZ.map((v, i) => f(v / white[i])); return [116 * y - 16, 500 * (x - y), 200 * (y - z)]; }
export const deltaE = (a, b, white) => { const p = lab(a, white), q = lab(b, white); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
export const whiteOf = illum => read(observerRows('standard', illum), new Array(BANDS).fill(1));

// orthonormal basis of the rows' span (Gram-Schmidt), for projecting directions into the null space
function span(rows) {
  const Q = [];
  for (const r of rows) { let u = r.slice(); for (const q of Q) { const d = u.reduce((s, x, i) => s + x * q[i], 0); u = u.map((x, i) => x - d * q[i]); } const n = Math.hypot(...u); if (n > 1e-12) Q.push(u.map(x => x / n)); }
  return Q;
}
const gauss = rng => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// sample n spectra from the metamer set of `start` (a feasible spectrum) for an observer and illuminant
export function metamerSet(start, { observer = 'standard', illum = 'D65', n = 64, lo = 0.001, hi = 0.999, burn = 200, thin = 20, rng }) {
  const Q = span(observerRows(observer, illum)), R = start.map(v => Math.min(hi, Math.max(lo, v))), out = [];
  for (let step = 0; out.length < n; step++) {
    let d = LAMBDA.map(() => gauss(rng));
    for (const q of Q) { const k = d.reduce((s, x, i) => s + x * q[i], 0); d = d.map((x, i) => x - k * q[i]); }
    // the chord through R along d inside the box
    let tmin = -Infinity, tmax = Infinity;
    for (let i = 0; i < BANDS; i++) {
      if (Math.abs(d[i]) < 1e-12) continue;
      const a = (lo - R[i]) / d[i], b = (hi - R[i]) / d[i];
      tmin = Math.max(tmin, Math.min(a, b)); tmax = Math.min(tmax, Math.max(a, b));
    }
    if (tmax > tmin) { const t = tmin + (tmax - tmin) * rng(); for (let i = 0; i < BANDS; i++) R[i] = Math.min(hi, Math.max(lo, R[i] + t * d[i])); }
    if (step >= burn && (step - burn) % thin === 0) out.push(R.slice());
  }
  return out;
}

// how far a set comes apart under another light: every member's XYZ under illum2, and the largest pairwise delta E
export function spread(set, illum2 = 'A') {
  const rows = observerRows('standard', illum2), W = whiteOf(illum2), xyz = set.map(R => read(rows, R));
  let max = 0, pair = [0, 0];
  for (let i = 0; i < xyz.length; i++) for (let j = i + 1; j < xyz.length; j++) { const e = deltaE(xyz[i], xyz[j], W); if (e > max) { max = e; pair = [i, j]; } }
  return { max, pair, xyz };
}

// the largest delta E from the target under the set's own light: the acceptance number
export function matchError(set, target, illum = 'D65') {
  const rows = observerRows('standard', illum), W = whiteOf(illum), t = read(rows, target);
  return Math.max(...set.map(R => deltaE(read(rows, R), t, W)));
}

// the prism: a linear sRGB colour as a smooth reflectance, cached on a 6-bit grid per channel (the upsampling is an
// iterative fit), and relit under another illuminant with the viewer adapted to it (spectrumRGB's von Kries step)
const CACHE = new Map();
export function reflectanceOf(rgb) {
  const q = rgb.map(v => Math.min(63, Math.max(0, Math.round(Math.max(0, v) ** (1 / 2.2) * 63))));
  const key = (q[0] << 12) | (q[1] << 6) | q[2];
  let R = CACHE.get(key);
  if (!R) { R = upsample(q.map(v => (v / 63) ** 2.2)); CACHE.set(key, R); }
  return R;
}

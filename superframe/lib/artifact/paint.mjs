// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// paint.mjs: the elements as pigment on paper. Each element layer is laid down through the creation engine's
// combineSpectral (16 bands, Kubelka-Munk absorbance, cover laws for elements that carry their own colour), with
// its paint weight. The observer reads the result twice: under D65 and under illuminant A. Two inks that match
// under D65 can split under A (metamers, BLEED section 18); the difference is kept as a map, not thrown away.
// The full-resolution picture is the D65 readout, upsampled, lit by the material's normals (impasto) and given
// the detail grain, which tints toward the paper so the grain reads as tooth, not noise.
import { combineSpectral, deltaE } from '../../../creation/lib/core/spectral.mjs';
import { hexLin } from '../../../creation/lib/core/layer.mjs';
import { weightOf, upsample, sharpen } from './common.mjs';
import { shade } from './material.mjs';

export function paintSim(r, layers, illum = 'D65') {
  const L = layers.map(o => o.layer), wts = layers.map(o => weightOf(r, o, 'paint'));
  if (!L.length) { const [w, h] = r.sim, p = hexLin(r.palette.paper), rgb = new Float32Array(3 * w * h); for (let k = 0; k < w * h; k++) rgb.set(p, 3 * k); return rgb; }
  return combineSpectral(L, wts, { paper: r.palette.paper, illum, w: r.sim[0], h: r.sim[1] }).rgb;
}

export function paint(r, layers, mat, D) {
  const [w, h] = r.sim, [W, H] = r.size, d65 = paintSim(r, layers, 'D65'), A = paintSim(r, layers, 'A');
  const shift = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) shift[k] = deltaE([d65[3 * k], d65[3 * k + 1], d65[3 * k + 2]], [A[3 * k], A[3 * k + 1], A[3 * k + 2]]);
  const up = sharpen(upsample(d65, w, h, W, H, 3), W, H, 3, Math.max(1, Math.round(3 * W / 3840))), paper = hexLin(r.palette.paper), g = 0.03 + 0.07 * r.detail, imp = 0.28 * r.media.material;
  for (let k = 0; k < W * H; k++) {
    const s = 1 + imp * (shade(mat.N, k) - 1), t = g * D[k] * Math.min(1.5, mat.dm[k] * 1.6);
    for (let c = 0; c < 3; c++) up[3 * k + c] = Math.max(0, (up[3 * k + c] + t * (paper[c] - up[3 * k + c])) * s);
  }
  return { W, H, rgb: up, sim: { d65, A, shift } };
}

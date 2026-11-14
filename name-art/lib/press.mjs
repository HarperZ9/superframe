// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// press.mjs: the press finish on a float picture, the same emboss family BuildTeX sets on the CV, the resumes and
// the papers (buildlang typeset/engine/emboss.py): a height map where emboss shapes rise and deboss shapes sink,
// each edge softened over a bevel, lit from the upper left on a laid-paper fibre normal; foil areas take gold with a
// specular lobe. Plus the halftone dot rule of the press theme. Works in linear light on img.mjs pictures.
import { boxBlur } from '../../glass/lib/raster.js';
import { lin } from './img.mjs';

// Laid-paper fibre: value noise stretched along x (long thin features), as emboss.py paper_normal, in pixel units
// scaled by `u` so the fibre keeps its size at any render width.
function fibre(u, seed = 7) {
  const hsh = (i, j) => { let n = (i * 374761393 + j * 668265263 + seed * 2147483647) >>> 0; n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0; return (n & 0xffff) / 65535; };
  const noise = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    return (hsh(i, j) * (1 - fx) + hsh(i + 1, j) * fx) * (1 - fy) + (hsh(i, j + 1) * (1 - fx) + hsh(i + 1, j + 1) * fx) * fy; };
  return (x, y) => { const X = x / (9 * u), Y = y / (2.2 * u), e = 0.5;
    return [(noise(X + e, Y) - noise(X - e, Y)) * 0.08, (noise(X, Y + e) - noise(X, Y - e)) * 0.08]; };
}

/**
 * press(I, { up, down, foil, u, relief, bevel, light, foilColour })
 *   up, down, foil  Float32Array(w*h) coverage 0..1 (emboss, deboss, foil)
 *   u               render scale (px per 1280-wide unit)
 * Multiplies the picture by the lit relief, keeping flat paper at its own colour (match_paper), and lays foil.
 */
export function press(I, { up, down, foil = null, u = 1, relief = 1, bevel = 1.6, light = [-0.45, -0.55, 0.7], foilColour = [0.83, 0.69, 0.22] } = {}) {
  const { w, h, px } = I, r = Math.max(1, Math.round(bevel * u));
  const hu = boxBlur(up, w, h, r), hd = boxBlur(down, w, h, r), H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = relief * (hu[i] - 0.7 * hd[i]);
  let [lx, ly, lz] = light; const ln = Math.hypot(lx, ly, lz); lx /= ln; ly /= ln; lz /= ln;
  let hx = lx, hy = ly, hz = lz + 1; const hn = Math.hypot(hx, hy, hz); hx /= hn; hy /= hn; hz /= hn;
  const k = 0.9 * 2.1 * u, gain = 1 / (0.55 + 0.5 * Math.max(0, lz)), fib = fibre(u), gold = foilColour.map((c) => c ** 2.2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const dx = H[x + 1 < w ? i + 1 : i] - H[x > 0 ? i - 1 : i], dy = H[y + 1 < h ? i + w : i] - H[y > 0 ? i - w : i];
    const [fx, fy] = fib(x, y);
    let nx = -dx * k + fx, ny = -dy * k + fy, nz = 1; const nn = Math.hypot(nx, ny, nz); nx /= nn; ny /= nn; nz /= nn;
    const diff = Math.max(0, nx * lx + ny * ly + nz * lz), sp = Math.max(0, nx * hx + ny * hy + nz * hz);
    const lit = (0.55 + 0.5 * diff) * gain, sheen = sp ** 24 * 0.08, f = foil ? foil[i] : 0, p = i * 3;
    for (let c = 0; c < 3; c++) {
      let v = px[p + c] * lit + sheen * 0.5;
      if (f > 0) v = v * (1 - f) + f * Math.min(1, gold[c] * (sp ** 40 * 1.4 + 0.3 * diff + 0.7));
      px[p + c] = v;
    }
  }
  return I;
}

/** The press theme's halftone dot rule: a band of round cells, `cell` px apart, alpha-composited in `colour`. */
export function dotRule(I, { x0, y0, x1, y1, cell, colour = '#b8862e', alpha = 0.7 }) {
  const { w, px } = I, c = lin(colour), r = cell * 0.32;
  for (let cy = y0 + cell / 2; cy < y1; cy += cell) for (let cx = x0 + cell / 2; cx < x1; cx += cell) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const a = Math.min(1, Math.max(0, r + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy))) * alpha;
      if (a <= 0) continue; const p = (y * w + x) * 3;
      for (let k = 0; k < 3; k++) px[p + k] += (px[p + k] * c[k] - px[p + k]) * a;   // ink multiplies the paper
    }
  }
  return I;
}

// twoink.mjs: two-ink separation and screened overprint. For two inks of transmittance T1, T2 on paper P, a pixel
// with coverages c1, c2 reflects P * (1 - c1 k1) * (1 - c2 k2) per channel, k = 1 - T (Neugebauer with Demichel
// weights, which factorises for two inks). The separation picks, for each source colour, the coverages whose
// reflectance is closest in a cube-root space (a stand-in for perceptual distance); colours outside the two-ink
// gamut land on its nearest edge. Coverages are solved on a 17^3 lattice of sRGB codes and read trilinearly.
import { lin8 } from '../study/cmath.mjs';
import { linOf, screenCover, inksToImage } from './print.mjs';

const G = 17, STEP = 255 / (G - 1);

function solve(t, P, k1, k2) {
  const tc = t.map(Math.cbrt), err = (a, b) => { let e = 0; for (let c = 0; c < 3; c++) e += (Math.cbrt(P[c] * (1 - a * k1[c]) * (1 - b * k2[c])) - tc[c]) ** 2; return e; };
  let best = [0, 0], be = Infinity, span = 0.5, ca = 0.5, cb = 0.5;
  for (const n of [32, 10, 10, 10]) {
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const a = Math.min(1, Math.max(0, ca - span + (2 * span * i) / n)), b = Math.min(1, Math.max(0, cb - span + (2 * span * j) / n)), e = err(a, b);
      if (e < be) { be = e; best = [a, b]; }
    }
    [ca, cb] = best; span = (2 * span) / n * 1.5;
  }
  return best;
}

export function separation({ paper, ink1, ink2 }) {
  const P = linOf(paper), k1 = linOf(ink1).map((v, c) => 1 - v / P[c]), k2 = linOf(ink2).map((v, c) => 1 - v / P[c]);
  const lut = new Float32Array(G * G * G * 2);
  for (let b = 0; b < G; b++) for (let g = 0; g < G; g++) for (let r = 0; r < G; r++) {
    const s = solve([r, g, b].map(v => lin8(Math.round(v * STEP))), P, k1, k2), o = 2 * (r + G * (g + G * b));
    lut[o] = s[0]; lut[o + 1] = s[1];
  }
  return { P, T: [k1.map(k => 1 - k), k2.map(k => 1 - k)], lut };
}

// Trilinear read of the coverage lattice for an 8-bit colour.
export function coverOf(sep, r8, g8, b8) {
  const f = [r8, g8, b8].map(v => v / STEP), i0 = f.map(v => Math.min(G - 2, Math.floor(v))), d = f.map((v, k) => v - i0[k]), out = [0, 0];
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const wt = (dx ? d[0] : 1 - d[0]) * (dy ? d[1] : 1 - d[1]) * (dz ? d[2] : 1 - d[2]), o = 2 * (i0[0] + dx + G * (i0[1] + dy + G * (i0[2] + dz)));
    out[0] += wt * sep.lut[o]; out[1] += wt * sep.lut[o + 1];
  }
  return out;
}

// Screened two-ink print: each ink on its own screen angle (15 and 75 degrees by default, 60 apart to keep moire low).
export function twoInk({ w, h, rgba }, { paper = '#f4efe2', ink1 = '#1fa3c8', ink2 = '#e0462e', cell = 8, angles = [15, 75], ss = 4, screened = true, sep = null } = {}) {
  const S = sep ?? separation({ paper, ink1, ink2 }), c1 = new Float32Array(w * h), c2 = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, [a, b] = coverOf(S, rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]);
    c1[i] = screened ? screenCover(x, y, a, { cell, angle: angles[0], ss }) : a;
    c2[i] = screened ? screenCover(x, y, b, { cell, angle: angles[1], ss }) : b;
  }
  return { ...inksToImage(w, h, S.P, S.T, [c1, c2]), sep: S };
}

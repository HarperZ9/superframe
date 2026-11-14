// print.mjs: the weird-print pass for the PSA card, built on the era quantizer's two-ink separation and its
// area-true screen (lib/quantize/twoink.mjs, print.mjs). Comic printing adds two things the quantizer leaves out:
//   - a black key plate: the ink line is printed solid, never screened, as line art always was;
//   - misregistration: each plate lands a little off, and differently every frame (print boil), so the colour
//     slides against the key line the way cheap four-colour newsprint did. Offsets are authored, seeded per frame.
// Ink film physics stays the quantizer's: reflectance = paper x product of (1 - coverage x (1 - transmittance)).
import { separation, coverOf } from '../quantize/twoink.mjs';
import { screenCover, linOf } from '../quantize/print.mjs';
import { toSrgb, canvas } from './raster.mjs';
import { rngFrom } from '../seed.mjs';
import { noise2 } from './ink.mjs';

const SEPS = new Map();
const sepOf = (paper, ink1, ink2) => { const k = `${paper}${ink1}${ink2}`; if (!SEPS.has(k)) SEPS.set(k, separation({ paper, ink1, ink2 })); return SEPS.get(k); };

export function comicPrint(K, { f = 0, paper = '#f1e7cf', ink1 = '#1aa0c4', ink2 = '#e43f2a', key = '#16110f', cell = 11, angles = [15, 75], ss = 2, misreg = 5, keyLuma = 0.012, seed = 'print' } = {}) {
  const S = sepOf(paper, ink1, ink2), r = rngFrom(`${seed}/${f}`), off = [[(r() - 0.5) * misreg, (r() - 0.5) * misreg], [(r() - 0.5) * misreg, (r() - 0.5) * misreg]];
  const { w, h } = K, q = new Uint8Array(w * h * 3), Y = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { for (let c = 0; c < 3; c++) q[3 * i + c] = Math.round(255 * toSrgb(Math.min(1, Math.max(0, K.px[3 * i + c])))); Y[i] = 0.2126 * K.px[3 * i] + 0.7152 * K.px[3 * i + 1] + 0.0722 * K.px[3 * i + 2]; }
  const at = (x, y) => { const X = Math.min(w - 1, Math.max(0, Math.round(x))), Yy = Math.min(h - 1, Math.max(0, Math.round(y))), j = 3 * (Yy * w + X); return coverOf(S, q[j], q[j + 1], q[j + 2]); };
  const P = S.P, T1 = S.T[0], T2 = S.T[1], TK = linOf(key).map((v, c) => v / P[c]), grain = noise2(`${seed}/paper`), O = canvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = at(x + off[0][0], y + off[0][1])[0], b = at(x + off[1][0], y + off[1][1])[1];
    const c1 = screenCover(x, y, a, { cell, angle: angles[0], ss }), c2 = screenCover(x, y, b, { cell, angle: angles[1], ss });
    const k = Math.min(1, Math.max(0, (keyLuma * 1.6 - Y[i]) / (keyLuma * 1.2))), fib = 1 + 0.035 * grain(x / 3, y / 11);
    for (let c = 0; c < 3; c++) O.px[3 * i + c] = P[c] * fib * (1 - c1 * (1 - T1[c])) * (1 - c2 * (1 - T2[c])) * (1 - k * (1 - TK[c]));
  }
  return O;
}

// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// contour: the contour eye (lead reading of the 2026-10-26 batch's "Observing Mind", inferred). Nested closed contours
// of one shape, shrinking inward, with grain: tone by line, the same law as the Burin cut. From first principles:
//   shape     an almond (two circular arcs: the eye) or a context source's mask
//   levels    the distance inward from the shape's edge D(x) (chamfer), normalised by the shape's depth; `count`
//             lines sit at levels (q + phase) / count, so the line count is the weight and sets the tone
//   breath    phase advances on its own timing (or a timing layer), so the contours travel inward and are reborn at
//             the edge: the shape breathes without changing (a conformational motion)
//   grain     a seeded value noise thins and thickens each line slightly (film grain, after the batch)
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, smooth, rngFrom } from '../core/layer.mjs';

export const contour = defineGen({
  id: 'contour',
  kind: 'conformational',
  law: { shape: 'absorb', params: { strength: 2.4, rule: 'tone by line' } },
  weights: { count: 'lines (the weight: more lines, darker)', width: 'line half-width, cells (fixed: the count sets the tone)', speed: 'inward travel, spacings per second', grain: 'width jitter 0..1' },
  inputs: { source: 'optional: the shape', timing: 'optional: the breath' },
  mechanism: 'line where |frac(count * D/Dmax - phase) - 0.5| > 0.5 - width; phase = speed t (or timing progress)',
  credits: ['the Observing Mind reference (2026-10-26 batch, lead reading)', 'Goltzius and the Burin cut (tone by line)', 'chamfer distance (Borgefors 1986)'],
  create({ w = 160, h = 100, count = 14, width = 0.45, speed = 0.4, grain = 0.35, seed = 'contour', shape = null } = {}) {
    const n = w * h, M = shape ? Float32Array.from(shape) : almond(w, h), D = chamferIn(M, w, h); let dmax = 0; for (const v of D) dmax = Math.max(dmax, v);
    const r = rngFrom(seed), G = Float32Array.from({ length: n }, () => r());
    const L = makeLayer('contour', { w, h, law: { shape: 'absorb', params: { strength: 2.4 } }, weights: { count, width, speed, grain }, ink: [0.07, 0.07, 0.09], state: { M, D, dmax: dmax || 1, G: smoothNoise(G, w, h) } });
    paint(L, 0); return L;
  },
  step(L, dt, ctx) { paint(L, ctx.timing?.state ? ctx.timing.state.progress * 3 : L.t * L.weights.speed); },
});

function paint(L, phase) {
  const S = L.state, W = L.weights, A = L.fields.amount;
  for (let k = 0; k < L.n; k++) {
    if (S.M[k] < 0.5) { A[k] = 0; continue; }
    // the line keeps its width in cells while the spacing shrinks with count: more lines, more ink (tone by line)
    const sp = S.dmax / W.count, u = W.count * S.D[k] / S.dmax + phase, gap = (0.5 - Math.abs(((u % 1) + 1) % 1 - 0.5)) * sp, half = W.width * (1 + W.grain * (S.G[k] - 0.5));
    A[k] = smooth(half + 0.5, half - 0.3, gap);
  }
}
function almond(w, h) { const m = F32(w * h), R = Math.min(w, h) * 0.62, off = R * 0.62; for (let k = 0; k < m.length; k++) { const x = k % w - w / 2, y = (k / w | 0) - h / 2; m[k] = Math.hypot(x, y - off) < R && Math.hypot(x, y + off) < R ? 1 : 0; } return m; }
function chamferIn(M, w, h) {
  const D = F32(w * h).fill(1e6); for (let k = 0; k < D.length; k++) if (M[k] < 0.5) D[k] = 0;
  const pass = fw => { for (let jj = 0; jj < h; jj++) { const j = fw ? jj : h - 1 - jj; for (let ii = 0; ii < w; ii++) { const i = fw ? ii : w - 1 - ii, k = j * w + i, s = fw ? -1 : 1; for (const [a, b, c] of [[s, 0, 3], [0, s, 3], [s, s, 4], [-s, s, 4]]) { const x = i + a, y = j + b; D[k] = Math.min(D[k], x >= 0 && y >= 0 && x < w && y < h ? D[y * w + x] + c : c); } } } };
  pass(true); pass(false); return D.map(v => v / 3);
}
function smoothNoise(G, w, h) { const o = F32(G.length); for (let k = 0; k < G.length; k++) { const i = k % w, j = k / w | 0; let s = 0, c = 0; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const x = i + a, y = j + b; if (x >= 0 && y >= 0 && x < w && y < h) { s += G[y * w + x]; c++; } } o[k] = s / c; } return o; }

// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// marble: paper marbling as exact, area-preserving maps of the bath's surface (after Lu, Jaffer and others,
// "Mathematical Marbling", IEEE CG&A 2012; Jaffer's write-ups of the drop and tine formulas). Written from the maps:
//   drop  of radius r at C pushes every point outward:  P' = C + (P - C) sqrt(1 + r^2 / |P - C|^2)
//         inverse (for |P' - C| > r):                 P  = C + (P' - C) sqrt(1 - r^2 / |P' - C|^2); inside: the new ink
//   tine  a comb tooth drawn along a line through B with direction M (unit), normal N, shift z, sharpness u in (0, 1):
//         P' = P + z u^d M, d = |(P - B) . N|;         inverse: P = P' - z u^d M (d is unchanged by a shift along M)
// Both maps keep area, so ink is neither made nor lost by moving it (tests/score measure det J). Motion: each
// operation runs over its own duration, applied in increments (r^2 and z add), so drops open and tines pull in time.
// State is the bath as per-tick colour plus ink cover, resampled backward each increment (bilinear: a little
// softening accumulates; recorded as a known limit).
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, sampleC, sample, hexLin, rngFrom } from '../core/layer.mjs';

export const marble = defineGen({
  id: 'marble',
  kind: 'conformational',
  law: { shape: 'cover', params: { opaque: 'paint takes over the ground by its cover' } },
  weights: { dropR: 'drop radius, cells', tineZ: 'tine shift, cells', sharp: 'tine sharpness u', dur: 'seconds per operation' },
  inputs: { source: 'optional: where drops fall (cells above 0.5 become drop sites)' },
  mechanism: 'drop: P = C + (P\'-C) sqrt(1 - r^2/|P\'-C|^2); tine: P = P\' - z u^d M; applied backward per increment',
  credits: ['Lu, Jaffer, Jin, Zhao and Mao 2012, Mathematical Marbling (IEEE CG&A)', 'ebru and suminagashi (the crafts)', 'Jaffer, drop and tine formulas'],
  create({ w = 160, h = 100, palette = ['#1f2d4a', '#c9a23f', '#a93b29', '#e9e2d0'], drops = 14, tines = 3, dropR = 9, tineZ = 14, sharp = 0.88, dur = 0.5, seed = 'marble', ops = null } = {}) {
    const r = rngFrom(seed), P = palette.map(hexLin), list = ops ? [...ops] : [];
    if (!ops) {
      for (let i = 0; i < drops; i++) list.push({ kind: 'drop', cx: (0.2 + 0.6 * r()) * w, cy: (0.2 + 0.6 * r()) * h, r: dropR * (0.6 + 0.8 * r()), col: P[i % P.length] });
      for (let i = 0; i < tines; i++) { const vert = i % 2 === 0; for (let t = 0; t < 5; t++) list.push({ kind: 'tine', bx: vert ? w * (0.1 + 0.2 * t) : 0, by: vert ? 0 : h * (0.1 + 0.2 * t), mx: vert ? 0 : 1, my: vert ? 1 : 0, z: tineZ * (t % 2 ? -1 : 1), u: sharp }); }
    }
    const L = makeLayer('marble', { w, h, law: { shape: 'cover', params: {} }, weights: { dropR, tineZ, sharp, dur }, fields: { rgb: F32(3 * w * h) }, state: { ops: list, i: 0, done: 0 } });
    return L;
  },
  step(L, dt, ctx) {
    const S = L.state; let budget = dt / L.weights.dur;
    if (ctx.source && S.ops.length - S.i < 2) { const a = ctx.source.fields.amount; for (let k = 0; k < L.n; k += 97) if (a[k] > 0.5) { S.ops.push({ kind: 'drop', cx: k % L.w, cy: k / L.w | 0, r: L.weights.dropR * 0.5, col: [0.12, 0.16, 0.3] }); break; } }
    while (budget > 1e-9 && S.i < S.ops.length) {
      const take = Math.min(budget, 1 - S.done); apply(L, S.ops[S.i], S.done, S.done + take); S.done += take; budget -= take;
      if (S.done >= 1 - 1e-9) { S.i++; S.done = 0; }
    }
  },
});

// one increment of an operation, from fraction f0 to f1 of its full strength
function apply(L, op, f0, f1) {
  const { w, h } = L, A = L.fields.amount, C = L.fields.rgb, A0 = Float32Array.from(A), C0 = Float32Array.from(C);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, x = i + 0.5, y = j + 0.5; let sx, sy, inside = false;
    if (op.kind === 'drop') {
      // increments compose because r^2 adds: the part of this drop already laid is pushed out like everything else
      const r2 = op.r * op.r * (f1 - f0), dx = x - op.cx, dy = y - op.cy, d2 = dx * dx + dy * dy;
      inside = d2 <= r2;
      if (inside) { A[k] = 1; for (let c = 0; c < 3; c++) C[3 * k + c] = op.col[c]; continue; }
      const s = Math.sqrt(1 - r2 / d2); sx = op.cx + dx * s; sy = op.cy + dy * s;
    } else {
      const nx = -op.my, ny = op.mx, d = Math.abs((x - op.bx) * nx + (y - op.by) * ny), z = op.z * (f1 - f0) * Math.pow(op.u, d);
      sx = x - z * op.mx; sy = y - z * op.my;
    }
    A[k] = sample(A0, w, h, sx - 0.5, sy - 0.5);
    for (let c = 0; c < 3; c++) C[3 * k + c] = sampleC(C0, 3, c, w, h, sx - 0.5, sy - 0.5);
  }
}

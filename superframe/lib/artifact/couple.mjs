// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// couple.mjs: the elements meet, the way inks meet on a marbling bath. Without this pass each law acts alone in its
// own region; with it, the laws push, carry and cut through one another.
//
// The maps are the marbling formulas the creation engine's marble law already uses (Lu, Jaffer and others,
// "Mathematical Marbling", IEEE CG&A 2012), lifted from one layer to the whole bath:
//   drop  each element, in recipe order, is dropped at its region's centre with radius r = weight * sqrt(ink / pi)
//         (ink: the sum of its ticks, so a heavier element opens a wider drop). It pushes every element laid before
//         it outward: P' = C + (P - C) sqrt(1 + r^2 / |P - C|^2). Inside the drop the earlier inks are gone, moved
//         out to the rim, never destroyed; the element's own ticks stay as laid.
//   tine  after all drops, `tines` comb teeth cross the bath on seeded lines and drag everything along them:
//         P' = P + z u^d M, d the distance from the tooth's line.
// Both maps preserve area, so each element keeps its total ink (the conservation measure in tests/artifact.test.mjs;
// a uniform scale fails it). Each layer is resampled once, backward, through the maps that act on it, so the
// softening of chained resampling never accumulates.
//
// weight 0 is the identity: the pass returns the layers untouched, and the output is byte-identical to an uncoupled
// recipe. Coupling is global by nature (a drop moves the whole bath), so the locality guarantee holds only at 0;
// the study records the coupling with the rest of the recipe.
import { xmur3, Mulberry32 } from '../../../substrate/lib/vendor/superstack.mjs';

const streamOf = s => { const m = new Mulberry32(xmur3(s)); return () => m.nextFloat(); };

export function opsFor(r, layers) {
  const c = r.couple, [w, h] = r.sim, ops = [];
  if (!c.weight) return ops;
  layers.forEach((o, i) => {
    let ink = 0; const A = o.layer.fields.amount; for (let k = 0; k < A.length; k++) ink += A[k];
    const rad = c.weight * Math.sqrt(ink / Math.PI) * c.spread;
    if (rad >= 0.5) ops.push({ kind: 'drop', by: i, cx: o.element.region.cx * w, cy: o.element.region.cy * h, r2: rad * rad });
  });
  const rnd = streamOf(`${r.seed}/couple/tines`);
  for (let t = 0; t < c.tines; t++) {
    const a = rnd() * Math.PI, mx = Math.cos(a), my = Math.sin(a);
    ops.push({ kind: 'tine', bx: (0.2 + 0.6 * rnd()) * w, by: (0.2 + 0.6 * rnd()) * h, mx, my, z: c.weight * 0.09 * w * (rnd() < 0.5 ? -1 : 1), u: Math.exp(-1 / (0.07 * Math.min(w, h))) });
  }
  return ops;
}

// the backward map for layer i: undo, last first, every op that acts on it (drops by later elements, then tines);
// returns null where the point lies inside a later drop (the layer's ink was pushed out of it)
function source(ops, i, x, y) {
  for (let q = ops.length - 1; q >= 0; q--) {
    const op = ops[q];
    if (op.kind === 'tine') { const d = Math.abs((x - op.bx) * -op.my + (y - op.by) * op.mx), s = op.z * Math.pow(op.u, d); x -= s * op.mx; y -= s * op.my; continue; }
    if (op.by <= i) continue;
    const dx = x - op.cx, dy = y - op.cy, d2 = dx * dx + dy * dy;
    if (d2 <= op.r2) return null;
    const s = Math.sqrt(1 - op.r2 / d2); x = op.cx + dx * s; y = op.cy + dy * s;
  }
  return [x, y];
}

const bil = (F, w, h, x, y, C = 1, c = 0) => {
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return 0;
  const i = Math.min(w - 2, x | 0), j = Math.min(h - 2, y | 0), fx = x - i, fy = y - j, a = (j * w + i) * C + c, b = a + C, d = a + w * C, e = d + C;
  return (F[a] * (1 - fx) + F[b] * fx) * (1 - fy) + (F[d] * (1 - fx) + F[e] * fx) * fy;
};

export function couple(r, layers) {
  const ops = opsFor(r, layers);
  if (!ops.length) return { layers, ops };
  const [w, h] = r.sim;
  for (let i = 0; i < layers.length; i++) {
    const o = layers[i], L = o.layer, A0 = L.fields.amount, M0 = o.mask, R0 = L.fields.rgb ?? null;
    const A = new Float32Array(w * h), M = new Float32Array(w * h), R = R0 ? new Float32Array(3 * w * h) : null;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = source(ops, i, x, y); if (!p) continue;
      const k = y * w + x, a = bil(A0, w, h, p[0], p[1]); if (!a) continue;
      A[k] = a; M[k] = bil(M0, w, h, p[0], p[1]);
      if (R) for (let c = 0; c < 3; c++) R[3 * k + c] = bil(R0, w, h, p[0], p[1], 3, c);
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x + 1 > x1) x1 = x + 1; if (y + 1 > y1) y1 = y + 1;
    }
    L.fields.amount = A; if (R) L.fields.rgb = R; o.mask = M;
    o.bbox = x1 > x0 ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 0, y1: 0 };
  }
  return { layers, ops };
}

// how much the elements now cut into one another: the share of inked neighbouring pixel pairs whose dominant
// element differs (an interface), over all inked pairs. Uncoupled regions touch along a few seams; marbled ones
// interleave, so the share rises.
export function interpenetration(r, layers, thr = 0.08) {
  const [w, h] = r.sim, dom = new Int16Array(w * h).fill(-1), best = new Float32Array(w * h);
  layers.forEach((o, i) => { const A = o.layer.fields.amount, B = o.bbox; for (let y = B.y0; y < B.y1; y++) for (let x = B.x0; x < B.x1; x++) { const k = y * w + x; if (A[k] > thr && A[k] > best[k]) { best[k] = A[k]; dom[k] = i; } } });
  let pairs = 0, cross = 0;
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const k = y * w + x; if (dom[k] < 0) continue;
    for (const n of [k + 1, k + w]) if (dom[n] >= 0) { pairs++; if (dom[n] !== dom[k]) cross++; }
  }
  return pairs ? +(cross / pairs).toFixed(5) : 0;
}

export const inkOf = o => { let s = 0; for (const v of o.layer.fields.amount) s += v; return s; };

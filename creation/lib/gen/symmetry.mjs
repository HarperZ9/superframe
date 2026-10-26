// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// symmetry: the symmetry tiler (the crystallography plate save, mathemetica 2026-10-25). The law is a wallpaper group:
// one of the 17 plane groups, each a set of operations on fractional lattice coordinates (International Tables
// settings, written from the group definitions; moderate confidence on every operator list, checked by the
// classifier round trip in tools/symmetry_check.mjs). Only rotations of order 1, 2, 3, 4 and 6 tile periodically
// (the crystallographic restriction); five-fold order needs an aperiodic pattern (Penrose; Shechtman 1984), given
// here as `quasi`: a sum of five plane waves at 72 degrees, a quasiperiodic stand-in for a Penrose patch.
//   motif      an asymmetric bump field on the unit cell; its parameters (blob count, size, seed) are the weights
//   tile       value(p) = max over the group's operations g of motif(frac(g(p))): the motif made symmetric
//   crystallise  a front (lib/core/ticks.mjs scheduleFront) moves each cell from disorder (a random field) to the
//              lattice, tick by tick from seeds: liquid to crystal
// Isomer operators act exactly here: mirror, rotation and glide are elements of the groups.
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, rngFrom, clamp } from '../core/layer.mjs';
import { scheduleFront, weightAt } from '../core/ticks.mjs';

const h = 0.5, S3 = Math.sqrt(3) / 2;
const P3 = [[1, 0, 0, 1], [0, -1, 1, -1], [-1, 1, -1, 0]];   // (x,y), (-y, x-y), (-x+y, -x): matrices [a b c d] acting as (a x + b y, c x + d y)
const op = (m, t = [0, 0]) => ({ m, t });
export const GROUPS = {
  p1: { lattice: 'oblique', ops: [op([1, 0, 0, 1])] },
  p2: { lattice: 'oblique', ops: [op([1, 0, 0, 1]), op([-1, 0, 0, -1])] },
  pm: { lattice: 'rect', ops: [op([1, 0, 0, 1]), op([-1, 0, 0, 1])] },
  pg: { lattice: 'rect', ops: [op([1, 0, 0, 1]), op([-1, 0, 0, 1], [0, h])] },
  cm: { lattice: 'rect', centred: true, ops: [op([1, 0, 0, 1]), op([-1, 0, 0, 1])] },
  pmm: { lattice: 'rect', ops: [op([1, 0, 0, 1]), op([-1, 0, 0, -1]), op([-1, 0, 0, 1]), op([1, 0, 0, -1])] },
  pmg: { lattice: 'rect', ops: [op([1, 0, 0, 1]), op([-1, 0, 0, -1]), op([-1, 0, 0, 1], [h, 0]), op([1, 0, 0, -1], [h, 0])] },
  pgg: { lattice: 'rect', ops: [op([1, 0, 0, 1]), op([-1, 0, 0, -1]), op([-1, 0, 0, 1], [h, h]), op([1, 0, 0, -1], [h, h])] },
  cmm: { lattice: 'rect', centred: true, ops: [op([1, 0, 0, 1]), op([-1, 0, 0, -1]), op([-1, 0, 0, 1]), op([1, 0, 0, -1])] },
  p4: { lattice: 'square', ops: [op([1, 0, 0, 1]), op([-1, 0, 0, -1]), op([0, -1, 1, 0]), op([0, 1, -1, 0])] },
  p4m: { lattice: 'square', ops: [op([1, 0, 0, 1]), op([-1, 0, 0, -1]), op([0, -1, 1, 0]), op([0, 1, -1, 0]), op([-1, 0, 0, 1]), op([1, 0, 0, -1]), op([0, 1, 1, 0]), op([0, -1, -1, 0])] },
  p4g: { lattice: 'square', ops: [op([1, 0, 0, 1]), op([-1, 0, 0, -1]), op([0, -1, 1, 0]), op([0, 1, -1, 0]), op([-1, 0, 0, 1], [h, h]), op([1, 0, 0, -1], [h, h]), op([0, 1, 1, 0], [h, h]), op([0, -1, -1, 0], [h, h])] },
  p3: { lattice: 'hex', ops: P3.map(m => op(m)) },
  p3m1: { lattice: 'hex', ops: [...P3.map(m => op(m)), op([0, -1, -1, 0]), op([-1, 1, 0, 1]), op([1, 0, 1, -1])] },
  p31m: { lattice: 'hex', ops: [...P3.map(m => op(m)), op([0, 1, 1, 0]), op([1, -1, 0, -1]), op([-1, 0, -1, 1])] },
  p6: { lattice: 'hex', ops: [...P3.map(m => op(m)), op([-1, 0, 0, -1]), op([0, 1, -1, 1]), op([1, -1, 1, 0])] },
  p6m: { lattice: 'hex', ops: [...P3.map(m => op(m)), op([-1, 0, 0, -1]), op([0, 1, -1, 1]), op([1, -1, 1, 0]), op([0, -1, -1, 0]), op([-1, 1, 0, 1]), op([1, 0, 1, -1]), op([0, 1, 1, 0]), op([1, -1, 0, -1]), op([-1, 0, -1, 1])] },
};
export const BASES = { oblique: [[1, 0], [0.3, 0.92]], rect: [[1, 0], [0, 0.72]], square: [[1, 0], [0, 1]], hex: [[1, 0], [-0.5, S3]] };

export function motifOf(seed = 1, blobs = 4, size = 0.09) {
  const r = rngFrom(`motif-${seed}`), B = Array.from({ length: blobs }, (_, i) => ({ x: 0.08 + 0.3 * r(), y: 0.05 + 0.25 * r(), s: size * (0.5 + r()), a: 0.6 + 0.4 * r(), e: 1 + 1.5 * r() * (i === 0 ? 1 : 0) }));
  return (u, v) => { let m = 0; for (const b of B) { let dx = u - b.x, dy = v - b.y; dx -= Math.round(dx); dy -= Math.round(dy); m = Math.max(m, b.a * Math.exp(-((dx * b.e) ** 2 + dy * dy) / (b.s * b.s))); } return m; };
}

// the symmetric value at cartesian point (x, y) in cells, for a group, scale (cells per lattice unit), rotation
export function tileValue(group, motif, x, y, scale = 24, rot = 0) {
  const G = GROUPS[group], [a, b] = BASES[G.lattice], c = Math.cos(rot), s = Math.sin(rot), X = (x * c + y * s) / scale, Y = (-x * s + y * c) / scale;
  const det = a[0] * b[1] - a[1] * b[0], u = (X * b[1] - Y * b[0]) / det, v = (Y * a[0] - X * a[1]) / det;
  let m = 0;
  for (const shift of G.centred ? [[0, 0], [h, h]] : [[0, 0]]) for (const o of G.ops) { const [p, q, r2, t] = o.m, uu = p * u + q * v + o.t[0] + shift[0], vv = r2 * u + t * v + o.t[1] + shift[1]; m = Math.max(m, motif(uu - Math.floor(uu), vv - Math.floor(vv))); }
  return m;
}
export function quasiValue(x, y, scale = 10) { let s = 0; for (let j = 0; j < 5; j++) { const a = j * 2 * Math.PI / 5; s += Math.cos(2 * Math.PI * (x * Math.cos(a) + y * Math.sin(a)) / scale); } return clamp((s + 1.2) / 5, 0, 1); }

export const symmetry = defineGen({
  id: 'symmetry',
  law: { shape: 'absorb', params: { strength: 2, law: 'wallpaper group (or quasi)' } },
  weights: { group: 'one of 17, or quasi', scale: 'cells per lattice unit', blobs: 'motif blob count', size: 'motif blob size', rot: 'lattice rotation, radians', speed: 'crystallisation rate' },
  inputs: { timing: 'optional: drives the crystallisation front' },
  mechanism: 'value = max over g in G of motif(frac(g(p))); a front lerps each cell from a random field to the tiled value',
  credits: ['Fedorov 1891 and Polya 1924 (the 17 plane groups)', 'International Tables for Crystallography, vol. A (operator settings)', 'Shechtman and others 1984 (quasicrystals); Penrose 1974', 'the crystallography plate (mathemetica save, 2026-10-25)'],
  create({ w = 160, h = 100, group = 'p4m', scale = 22, blobs = 4, size = 0.09, rot = 0.15, seed = 1, speed = 0.12, crystallise = true } = {}) {
    const motif = motifOf(seed, blobs, size), T = F32(w * h), Rn = F32(w * h), r = rngFrom(`liquid-${seed}`);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { T[j * w + i] = group === 'quasi' ? quasiValue(i - w / 2, j - h / 2, scale / 2.2) : tileValue(group, motif, i - w / 2, j - h / 2, scale, rot); Rn[j * w + i] = r(); }
    const L = makeLayer('symmetry', { w, h, law: { shape: 'absorb', params: { strength: 2 } }, weights: { group, scale, blobs, size, rot, speed }, ink: [0.12, 0.14, 0.24], state: { T, Rn, tau: crystallise ? scheduleFront(w, h, { seedAt: [Math.floor(w / 2), Math.floor(h / 2)], seed }).tau : null, p: crystallise ? 0 : 1 } });
    paint(L); return L;
  },
  step(L, dt, ctx) { const S = L.state; S.p = ctx.timing?.state ? ctx.timing.state.progress : Math.min(1.2, S.p + dt * L.weights.speed); paint(L); },
});
function paint(L) { const S = L.state, A = L.fields.amount; for (let k = 0; k < L.n; k++) { const t = S.tau ? weightAt(S.tau, k, S.p) : 1; A[k] = S.Rn[k] * 0.6 * (1 - t) + S.T[k] * t; } }

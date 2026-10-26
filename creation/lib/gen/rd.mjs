// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// rd: reaction-diffusion (Turing 1952; the Gray-Scott model, Pearson 1993's map of its regimes). An adapter on the
// superframe's lib/medium/reaction.mjs (seedReaction, stepReaction), imported and run on a shim tank with no surface,
// so the same reaction term the medium uses grows spots, stripes or coral here.
//   U + 2V -> 3V; dU = Du lap U - U V^2 + F (1 - U); dV = Dv lap V + U V^2 - (F + k) V
// The regime is the law's shape (F, k); `sub` sets how many reaction steps run per frame (its own timing).
// amount = V scaled to 0..1 (V rarely passes 0.45). Context: source seeds V where its amount passes 0.3 (each step,
// so a moving path keeps seeding a trail); flow carries both fields.
import { seedReaction, stepReaction } from '../../../superframe/lib/medium/reaction.mjs';
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, rngFrom, hexLin } from '../core/layer.mjs';

export const RD_PRESETS = { coral: { F: 0.0545, k: 0.062 }, spots: { F: 0.035, k: 0.065 }, stripes: { F: 0.026, k: 0.055 }, mitosis: { F: 0.0367, k: 0.0649 }, worms: { F: 0.046, k: 0.063 } };

export const rd = defineGen({
  id: 'rd',
  law: { shape: 'absorb', params: { beer: true } },
  weights: { F: 'feed rate', k: 'kill rate', Du: 'U diffusion', Dv: 'V diffusion', sub: 'reaction steps per frame', seedOn: 'source threshold' },
  inputs: { source: 'optional layer: seeds V', flow: 'optional layer with vel: carries U and V' },
  mechanism: 'Gray-Scott: dU = Du lap U - U V^2 + F (1 - U); dV = Dv lap V + U V^2 - (F + k) V; explicit, 5-point Laplacian',
  credits: ['Turing 1952, The Chemical Basis of Morphogenesis', 'Gray and Scott 1984', 'Pearson 1993, Complex Patterns in a Simple System', 'superframe lib/medium/reaction.mjs (adapted)'],
  create({ w = 160, h = 100, preset = 'coral', F, k, Du = 0.2, Dv = 0.1, sub = 8, seedOn = 0.3, seedSpots = 6, ink = '#3a2a4a', seed = 'rd' } = {}) {
    const P = { ...RD_PRESETS[preset], ...(F != null ? { F } : {}), ...(k != null ? { k } : {}) }, n = w * h;
    const m = { nx: w, ny: h, n, phase: new Uint8Array(n).fill(1), solid: new Uint8Array(n), u: F32(n), v: F32(n), rng: rngFrom(seed) };
    const L = makeLayer('rd', { w, h, law: { shape: 'absorb', params: { strength: 2.5 } }, weights: { F: P.F, k: P.k, Du, Dv, sub, seedOn }, ink: hexLin(ink), state: { m } });
    const cells = [];
    for (let s = 0; s < seedSpots; s++) { const cx = 0.15 + 0.7 * m.rng(), cy = 0.15 + 0.7 * m.rng(); for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const x = Math.round(cx * w) + i, y = Math.round(cy * h) + j; if (x >= 0 && y >= 0 && x < w && y < h) cells.push([y * w + x, 1]); } }
    seedReaction(m, cells, { F: P.F, k: P.k, Du, Dv, sub });
    out(L); return L;
  },
  step(L, dt, ctx) {
    const { m } = L.state, W = L.weights, R = m.reaction;
    R.F = W.F; R.k = W.k; R.Du = W.Du; R.Dv = W.Dv; R.sub = Math.max(1, Math.round(W.sub * Math.min(3, dt * 30)));
    if (ctx.source) { const src = ctx.source.fields.amount, cells = []; for (let k = 0; k < m.n; k++) if (src[k] > W.seedOn && R.V[k] < 0.25) cells.push([k, 0.6]); if (cells.length) seedReaction(m, cells, {}); }
    if (ctx.flow?.fields.vel) { const V = ctx.flow.fields.vel; for (let k = 0; k < m.n; k++) { m.u[k] = V[2 * k] * 0.5; m.v[k] = V[2 * k + 1] * 0.5; } }
    else { m.u.fill(0); m.v.fill(0); }
    stepReaction(m, dt);
    out(L);
  },
});

function out(L) { const V = L.state.m.reaction.V, A = L.fields.amount; for (let k = 0; k < A.length; k++) A[k] = Math.min(1, V[k] * 2.6); }

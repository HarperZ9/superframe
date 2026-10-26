// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// advect: diffusion and advection. Ink carried by a current and spreading against it (BLEED section 4: virality is
// advection, a correction is diffusion against the current). The numerics are the superframe's lib/medium/grid.mjs
// (Stam's stable fluids: semi-Lagrangian advection, implicit diffusion, Jacobi projection, vorticity confinement),
// imported, run here on one fluid with no surface, so the medium's own physics is the law and this file only feeds it.
//   velocity  u, v: forced by a context flow layer's vel (the path pushes the water), plus a seeded stir
//   dye       amount: poured from a context source layer at `pour` per second, carried by u, v, spread by kappa
// The total dye is renormalised after advection (semi-Lagrangian advection does not conserve; the medium does the
// same, medium.mjs carry()). Diffusion alone grows a stain's radius as sqrt(t) (Fick); tests/score check it.
import { advect as gAdvect, diffuse, project, confine } from '../../../superframe/lib/medium/grid.mjs';
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, rngFrom, hexLin as inkOf } from '../core/layer.mjs';

export const advect = defineGen({
  id: 'advect',
  law: { shape: 'absorb', params: { beer: 'transmission exp(-k * amount) per channel' } },
  weights: { kappa: 'dye diffusion, cells^2/s', nu: 'viscosity', pour: 'dye per second from the source', stir: 'seeded swirl strength', confine: 'vorticity confinement', carry: 'how much of a context flow is taken up' },
  inputs: { source: 'optional layer: where dye is poured', flow: 'optional layer with vel: momentum in' },
  mechanism: 'u <- project(diffuse(advect(u) + F)); q <- diffuse(advect(q, u), kappa) + pour * source; mass renormalised',
  credits: ['Stam 1999, Stable Fluids (via superframe lib/medium/grid.mjs)', 'Fick 1855 (diffusion)', 'Fedkiw, Stam and Jensen 2001 (vorticity confinement)', 'Frankenthaler soak stain (as a look reference only)'],
  create({ w = 160, h = 100, ink = '#1d2a3a', kappa = 0.15, nu = 0.02, pour = 0.6, stir = 0.0, confine: conf = 0.3, carry = 1, initial = null, seed = 'advect' } = {}) {
    const n = w * h, L = makeLayer('advect', { w, h, law: { shape: 'absorb', params: { strength: 3 } }, weights: { kappa, nu, pour, stir, confine: conf, carry }, fields: { vel: F32(2 * n) }, state: { u: F32(n), v: F32(n), p: F32(n), div: F32(n), tmp: F32(n), curl: F32(n), phase: new Uint8Array(n).fill(1), solid: new Uint8Array(n), rng: rngFrom(seed), ph: [0, 1, 2, 3].map(i => i * 1.7) } });
    L.ink = inkOf(ink);
    if (initial) L.fields.amount.set(initial);
    return L;
  },
  step(L, dt, ctx) {
    const { w, h } = L, S = L.state, W = L.weights, A = L.fields.amount, s = dt * 30;
    if (ctx.flow?.fields.vel) { const V = ctx.flow.fields.vel; for (let k = 0; k < L.n; k++) { S.u[k] += W.carry * V[2 * k] * 0.15; S.v[k] += W.carry * V[2 * k + 1] * 0.15; } }
    if (W.stir > 0) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i, x = i / w * 6.283, y = j / h * 6.283, t = L.t * 0.3; S.u[k] += dt * W.stir * Math.sin(y * 2 + t + S.ph[0]) * 0.5; S.v[k] += dt * W.stir * Math.sin(x * 2 - t + S.ph[1]) * 0.5; }
    confine(S.u, S.v, W.confine, w, h, dt, S.curl);
    const u0 = Float32Array.from(S.u), v0 = Float32Array.from(S.v);
    gAdvect(u0, u0, v0, w, h, s, S.u); gAdvect(v0, u0, v0, w, h, s, S.v);
    if (W.nu > 0) { diffuse(S.u, W.nu * dt, w, h, 4, S.tmp, null); diffuse(S.v, W.nu * dt, w, h, 4, S.tmp, null); }
    project(S.u, S.v, S.phase, S.solid, w, h, 30, S.p, S.div);
    for (let k = 0; k < L.n; k++) { S.u[k] *= 0.995; S.v[k] *= 0.995; }
    const before = sum(A);
    gAdvect(Float32Array.from(A), S.u, S.v, w, h, s, S.tmp); A.set(S.tmp);
    const after = sum(A); if (after > 1e-9 && before > 1e-9) { const f = before / after; for (let k = 0; k < L.n; k++) A[k] *= f; }
    if (W.kappa > 0) diffuse(A, W.kappa * dt, w, h, 6, S.tmp, null);
    if (ctx.source && W.pour > 0) { const src = ctx.source.fields.amount; for (let k = 0; k < L.n; k++) A[k] = Math.min(1.5, A[k] + W.pour * dt * src[k]); }
    const V = L.fields.vel; for (let k = 0; k < L.n; k++) { V[2 * k] = S.u[k]; V[2 * k + 1] = S.v[k]; }
  },
});

const sum = a => { let s = 0; for (let k = 0; k < a.length; k++) s += a[k]; return s; };

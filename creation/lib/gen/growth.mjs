// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// growth.mjs: the atelier growth family as step-driven generators (WORKSPACE-SOURCES S06: the portfolio site's
// atelier.js studies, the author's own work; rewritten here from the rules and the parameter ranges it exposes, so
// every study runs frame by frame instead of drawing a finished result).
//   dla        diffusion-limited aggregation (Witten and Sander 1981): walkers released on a ring random-walk until
//              they touch the aggregate, then stick with probability `stick`. Branching fronts: coral, frost, mineral.
//   physarum   agents after Jones 2010: each agent senses the trail ahead-left, ahead and ahead-right at `sense`
//              angle and distance, turns toward the strongest, moves, deposits; the trail diffuses and decays by
//              `decay` per step. Network-forming transport.
//   afterglow  phosphor persistence (WORKSPACE-SOURCES S10, the visualizer's render/phosphor.mjs): any source
//              layer's light kept as A = max(src, A exp(-dt / tau)). Gives every moving generator a trail.
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, rngFrom, hexLin, blur } from '../core/layer.mjs';

export const dla = defineGen({
  id: 'dla',
  law: { shape: 'absorb', params: { strength: 2.2 } },
  weights: { walkers: 'released per step', stick: 'sticking probability (0.1 feathery to 1 dense)', steps: 'walk steps per walker per frame' },
  inputs: { source: 'optional: cells above 0.5 join the aggregate as seeds' },
  mechanism: 'walker random walk on the grid; on touching an occupied cell it sticks with probability stick; released on a circle just outside the aggregate radius',
  credits: ['Witten and Sander 1981, Diffusion-limited aggregation', 'atelier.js DLA study (portfolio site, the author\'s own), parameter ranges'],
  create({ w = 160, h = 100, walkers = 60, stick = 0.7, steps = 1500, seed = 'dla', ink = '#2a2433', seeds = [[0.5, 0.5]] } = {}) {
    const L = makeLayer('dla', { w, h, law: { shape: 'absorb', params: { strength: 2.2 } }, weights: { walkers, stick, steps }, ink: hexLin(ink), state: { r: rngFrom(seed), radius: 2, cx: seeds[0][0] * w, cy: seeds[0][1] * h } });
    for (const [x, y] of seeds) L.fields.amount[Math.round(y * (h - 1)) * w + Math.round(x * (w - 1))] = 1;
    return L;
  },
  step(L, dt, ctx) {
    const S = L.state, { w, h } = L, A = L.fields.amount, r = S.r, W = L.weights;
    if (ctx.source) { const s = ctx.source.fields.amount; for (let k = 0; k < L.n; k++) if (s[k] > 0.5) A[k] = 1; }
    const n = Math.max(1, Math.round(W.walkers * dt * 30));
    for (let q = 0; q < n; q++) {
      const a = r() * 6.283, R = Math.min(Math.max(w, h), S.radius + 6); let x = Math.round(S.cx + R * Math.cos(a)), y = Math.round(S.cy + R * Math.sin(a));
      for (let s = 0; s < W.steps; s++) {
        const d = Math.floor(r() * 4); x += d === 0 ? 1 : d === 1 ? -1 : 0; y += d === 2 ? 1 : d === 3 ? -1 : 0;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1 || Math.hypot(x - S.cx, y - S.cy) > R + 12) break;
        const k = y * w + x; if (A[k - 1] + A[k + 1] + A[k - w] + A[k + w] > 0.5 && r() < W.stick) { A[k] = 1; S.radius = Math.max(S.radius, Math.hypot(x - S.cx, y - S.cy)); break; }
      }
    }
  },
});

export const physarum = defineGen({
  id: 'physarum',
  law: { shape: 'absorb', params: { strength: 1.6 } },
  weights: { agents: 'count', sense: 'sensor angle, radians (0.2 to 0.8)', reach: 'sensor distance, cells', turn: 'turn per step, radians', decay: 'trail kept per step (0.82 to 0.95)', deposit: 'trail laid per step' },
  inputs: { source: 'optional: attracts agents (added to the trail they sense)' },
  mechanism: 'sense trail at -sense, 0, +sense; turn toward the largest; move 1 cell; deposit; trail <- decay * blur(trail)',
  credits: ['Jones 2010, Characteristics of pattern formation and evolution in approximations of Physarum transport networks', 'atelier.js Physarum study (the author\'s own), parameter ranges'],
  create({ w = 160, h = 100, agents = 3000, sense = 0.45, reach = 4, turn = 0.4, decay = 0.9, deposit = 0.25, seed = 'physarum', ink = '#3a2a1a' } = {}) {
    const r = rngFrom(seed), P = F32(agents * 3); for (let i = 0; i < agents; i++) { const a = r() * 6.283, d = r() * Math.min(w, h) * 0.3; P[3 * i] = w / 2 + d * Math.cos(a); P[3 * i + 1] = h / 2 + d * Math.sin(a); P[3 * i + 2] = a + Math.PI; }
    return makeLayer('physarum', { w, h, law: { shape: 'absorb', params: { strength: 1.6 } }, weights: { agents, sense, reach, turn, decay, deposit }, ink: hexLin(ink), state: { P, T: F32(w * h), r } });
  },
  step(L, dt, ctx) {
    const S = L.state, W = L.weights, { w, h } = L, T = S.T, src = ctx.source?.fields.amount, at = (x, y) => { const i = clamp(Math.round(x), 0, w - 1), j = clamp(Math.round(y), 0, h - 1), k = j * w + i; return T[k] + (src ? src[k] : 0); };
    for (let i = 0; i < W.agents; i++) {
      let x = S.P[3 * i], y = S.P[3 * i + 1], a = S.P[3 * i + 2];
      const f = at(x + W.reach * Math.cos(a), y + W.reach * Math.sin(a)), l = at(x + W.reach * Math.cos(a - W.sense), y + W.reach * Math.sin(a - W.sense)), rr = at(x + W.reach * Math.cos(a + W.sense), y + W.reach * Math.sin(a + W.sense));
      if (f < l && f < rr) a += (S.r() < 0.5 ? -1 : 1) * W.turn; else if (l > rr) a -= W.turn; else if (rr > l) a += W.turn;
      x += Math.cos(a); y += Math.sin(a); if (x < 0 || y < 0 || x >= w || y >= h) { a += Math.PI; x = clamp(x, 0, w - 1); y = clamp(y, 0, h - 1); }
      S.P[3 * i] = x; S.P[3 * i + 1] = y; S.P[3 * i + 2] = a; T[Math.round(y) * w + Math.round(x)] += W.deposit;
    }
    const B = blur(T, w, h, 1); for (let k = 0; k < L.n; k++) T[k] = B[k] * W.decay;
    for (let k = 0; k < L.n; k++) L.fields.amount[k] = Math.min(1, T[k] * 1.2);
  },
});

export const afterglow = defineGen({
  id: 'afterglow',
  kind: 'conformational',
  law: { shape: 'emit', params: { exposure: 1 } },
  weights: { tau: 'persistence, seconds (0.12 shows a trail at 24 fps)', colour: 'phosphor colour' },
  inputs: { source: 'the layer whose light persists' },
  mechanism: 'A = max(src, A exp(-dt / tau)); emitted rgb = colour * A',
  credits: ['the visualizer\'s render/phosphor.mjs (WORKSPACE-SOURCES S10), as a stateful equivalent of its weighted past instants', 'phosphor persistence in CRTs'],
  create({ w = 160, h = 100, tau = 0.35, colour = '#9fe0b8' } = {}) { const L = makeLayer('afterglow', { w, h, law: { shape: 'emit', params: { exposure: 0.8 } }, weights: { tau, colour }, fields: { rgb: F32(3 * w * h) } }); L.ink = hexLin(colour); return L; },
  step(L, dt, ctx) { const A = L.fields.amount, C = L.fields.rgb, s = ctx.source?.fields.amount, keep = Math.exp(-dt / L.weights.tau); for (let k = 0; k < L.n; k++) { A[k] = Math.max(s ? s[k] : 0, A[k] * keep); for (let c = 0; c < 3; c++) C[3 * k + c] = L.ink[c] * A[k]; } },
});

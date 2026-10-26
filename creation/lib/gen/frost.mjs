// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// frost: a crystal growth front, after Reiter's hexagonal snowflake automaton (Reiter 2005, "A local cellular model
// for snow crystal growth", Chaos, Solitons and Fractals 23). Written from the paper's rule:
//   each cell holds water s; a cell is receptive if it is frozen (s >= 1) or touches a frozen cell
//   receptive cells keep their water and gain gamma (vapour addition); the rest diffuse it:
//   u = receptive ? 0 : s;  u' = u + (alpha / 2) (mean of the 6 neighbours of u - u);  s' = u' + (receptive ? s + gamma : 0)
//   background vapour beta fills the plate at the start
// The lattice is offset rows (odd-r hex); on the square output grid the half-cell row offset is dropped, so the six
// arms come out slightly sheared (a known distortion of this version, kept on record).
// Context: source (cells where it passes 0.5 freeze at once: frost seeded along a path or a letter), drive (adds
// vapour locally: weights beta by where it is cold). amount = 1 where frozen, 0.25 to 0.75 on the receptive
// boundary (the growing edge, by its water), 0 elsewhere.
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, hexLin } from '../core/layer.mjs';

const NB = [[[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]], [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]];

export const frost = defineGen({
  id: 'frost',
  law: { shape: 'screen', params: { light: 'ice scatters light: screen' } },
  weights: { alpha: 'vapour diffusion', beta: 'background vapour', gamma: 'vapour added at receptive cells', rate: 'automaton steps per second' },
  inputs: { source: 'optional: seeds ice', drive: 'optional: extra vapour where cold' },
  mechanism: 'Reiter 2005 hexagonal automaton: receptive cells accrete gamma, others diffuse at alpha; frozen when s >= 1',
  credits: ['Reiter 2005, A local cellular model for snow crystal growth', 'Nakaya 1954 (snow crystal morphology as a function of humidity and temperature)'],
  create({ w = 160, h = 100, alpha = 1.0, beta = 0.4, gamma = 0.001, rate = 40, seeds = [[0.5, 0.5]], ink = '#dfeefa' } = {}) {
    const n = w * h, s = F32(n).fill(beta), L = makeLayer('frost', { w, h, law: { shape: 'screen', params: {} }, weights: { alpha, beta, gamma, rate }, ink: hexLin(ink), state: { s, acc: 0, rec: new Uint8Array(n) } });
    for (const [x, y] of seeds) s[Math.round(y * (h - 1)) * w + Math.round(x * (w - 1))] = 1;
    out(L); return L;
  },
  step(L, dt, ctx) {
    const S = L.state; S.acc += dt * L.weights.rate;
    if (ctx.source) { const src = ctx.source.fields.amount; for (let k = 0; k < L.n; k++) if (src[k] > 0.5) S.s[k] = Math.max(S.s[k], 1); }
    while (S.acc >= 1) { S.acc -= 1; reiter(L, ctx.drive?.fields.amount); }
    out(L);
  },
});

function reiter(L, drive) {
  const { w, h } = L, S = L.state, s = S.s, rec = S.rec, { alpha, gamma } = L.weights, u = F32(L.n), next = F32(L.n);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i; let r = s[k] >= 1;
    if (!r) for (const [di, dj] of NB[j & 1]) { const x = i + di, y = j + dj; if (x >= 0 && y >= 0 && x < w && y < h && s[y * w + x] >= 1) { r = true; break; } }
    rec[k] = r ? 1 : 0; u[k] = r ? 0 : s[k];
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i; let m = 0;
    for (const [di, dj] of NB[j & 1]) { const x = i + di, y = j + dj; m += x >= 0 && y >= 0 && x < w && y < h ? u[y * w + x] : L.weights.beta; }
    const g = gamma + (drive ? 0.004 * drive[k] : 0);
    next[k] = u[k] + (alpha / 2) * (m / 6 - u[k]) + (rec[k] ? s[k] + g : 0);
  }
  s.set(next);
}
function out(L) { const s = L.state.s, rec = L.state.rec, A = L.fields.amount; for (let k = 0; k < A.length; k++) A[k] = s[k] >= 1 ? 1 : rec[k] ? 0.25 + 0.5 * Math.min(1, s[k]) : 0; }

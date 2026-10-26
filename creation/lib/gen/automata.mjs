// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// automata: ones and zeros across weights (BLEED section 15). Three generators, written from the rules:
//   life    Conway's Life (B3/S23) or any B/S rule, with an optional weighted neighbourhood: a cell is born or survives
//           when the weighted sum of its eight neighbours falls in the rule's set. Weights 1 everywhere is Conway.
//           A tick that flips at a threshold of its weighted neighbours is also a perceptron (section 15).
//   rule110 Wolfram's elementary rule (110 by default): each row is the next generation of the row above, so the
//           pattern grows downward as a moving front, forward in time as it is forward in space.
//   lenia   Chan's Lenia (2019): continuous states, a smooth ring kernel K of radius R, growth
//           G(u) = 2 exp(-(u - mu)^2 / (2 sigma^2)) - 1, A <- clip(A + dt G(K * A)). Lifelike moving forms.
// Each one's amount is its state. Context: source (cells where its amount passes 0.5 are set alive each step, so a
// path or a word can write into the automaton), drive (lenia: adds to the growth argument, a local nudge).
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, rngFrom, hexLin } from '../core/layer.mjs';

const parseRule = r => { const [b, s] = r.split('/'); return { B: new Set([...b.slice(1)].map(Number)), S: new Set([...s.slice(1)].map(Number)) }; };

export const life = defineGen({
  id: 'life',
  law: { shape: 'absorb', params: {} },
  weights: { rule: 'B/S notation', neighbourWeights: '8 weights, N to NW clockwise; all 1 is Conway', rate: 'generations per second', density: 'initial random fill' },
  inputs: { source: 'optional: writes live cells' },
  mechanism: 'n = sum_k w_k s_k over the 8 neighbours (toroidal); s <- round(n) in B (if dead) or S (if alive)',
  credits: ['Conway 1970 (Gardner, Scientific American)', 'McCulloch and Pitts 1943; Rosenblatt 1958 (the same weighted-sum-and-flip unit)'],
  create({ w = 160, h = 100, rule = 'B3/S23', neighbourWeights = [1, 1, 1, 1, 1, 1, 1, 1], rate = 12, density = 0.18, seed = 'life', pattern = null, ink = '#24302a' } = {}) {
    const L = makeLayer('life', { w, h, law: { shape: 'absorb', params: { strength: 2 } }, weights: { rule, neighbourWeights, rate, density }, ink: hexLin(ink), state: { R: parseRule(rule), acc: 0, gen: 0 } });
    const r = rngFrom(seed), A = L.fields.amount;
    if (pattern) for (const [x, y] of pattern) A[y * w + x] = 1; else for (let k = 0; k < A.length; k++) A[k] = r() < density ? 1 : 0;
    return L;
  },
  step(L, dt, ctx) {
    const S = L.state; S.acc += dt * L.weights.rate;
    while (S.acc >= 1) { S.acc -= 1; generation(L); S.gen++; }
    if (ctx.source) { const s = ctx.source.fields.amount, A = L.fields.amount; for (let k = 0; k < A.length; k++) if (s[k] > 0.5) A[k] = 1; }
  },
});

const OFF = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
export function generation(L) {
  const { w, h } = L, A = L.fields.amount, N = F32(A.length), Wt = L.weights.neighbourWeights, { B, S } = L.state.R;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let n = 0; for (let q = 0; q < 8; q++) n += Wt[q] * A[((j + OFF[q][1] + h) % h) * w + (i + OFF[q][0] + w) % w];
    const c = Math.round(n), alive = A[j * w + i] > 0.5; N[j * w + i] = (alive ? S.has(c) : B.has(c)) ? 1 : 0;
  }
  A.set(N);
}

export const rule110 = defineGen({
  id: 'rule110',
  law: { shape: 'absorb', params: {} },
  weights: { rule: 'elementary rule number 0..255', rate: 'rows per second' },
  mechanism: 'row[t+1][i] = bit(rule, 4 row[t][i-1] + 2 row[t][i] + row[t][i+1]); rows laid top to bottom',
  credits: ['Wolfram 1983, Statistical mechanics of cellular automata', 'Cook 2004, Universality in Elementary Cellular Automata (Rule 110 is universal)'],
  create({ w = 160, h = 100, rule = 110, rate = 20, seed = 'r110', single = true, ink = '#1c1c22' } = {}) {
    const L = makeLayer('rule110', { w, h, law: { shape: 'absorb', params: { strength: 2 } }, weights: { rule, rate }, ink: hexLin(ink), state: { row: 0, acc: 0 } });
    const r = rngFrom(seed), A = L.fields.amount; for (let i = 0; i < w; i++) A[i] = single ? (i === w - 2 ? 1 : 0) : r() < 0.5 ? 1 : 0;
    return L;
  },
  step(L, dt) {
    const S = L.state, { w, h } = L, A = L.fields.amount, rule = L.weights.rule; S.acc += dt * L.weights.rate;
    while (S.acc >= 1 && S.row < h - 1) {
      S.acc -= 1; const a = S.row * w, b = a + w;
      for (let i = 0; i < w; i++) { const l = A[a + (i - 1 + w) % w] > 0.5, c = A[a + i] > 0.5, r = A[a + (i + 1) % w] > 0.5; A[b + i] = (rule >> (4 * l + 2 * c + r)) & 1; }
      S.row++;
    }
  },
});

export const lenia = defineGen({
  id: 'lenia',
  law: { shape: 'absorb', params: {} },
  weights: { R: 'kernel radius, cells', mu: 'growth centre', sigma: 'growth width', T: 'time resolution (steps per unit)', peak: 'ring peak radius as a share of R' },
  inputs: { source: 'optional: adds mass', drive: 'optional: shifts the growth argument locally' },
  mechanism: 'U = K * A (ring kernel exp(4 - 1/(r(1-r))) at r = d/R); A <- clip(A + (1/T) G(U)), G(u) = 2 exp(-(u-mu)^2/(2 sigma^2)) - 1',
  credits: ['Chan 2019, Lenia: Biology of Artificial Life (Complex Systems 28)', 'Rafler 2011, SmoothLife'],
  create({ w = 160, h = 100, R = 8, mu = 0.17, sigma = 0.02, T = 10, seed = 'lenia', blobs = 8, ink = '#2b2440' } = {}) {
    const K = [], r = rngFrom(seed); let ks = 0;
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const d = Math.hypot(x, y) / R; if (d >= 1 || d === 0) continue; const v = Math.exp(4 - 1 / (d * (1 - d))); K.push([x, y, v]); ks += v; }
    for (const k of K) k[2] /= ks;
    const L = makeLayer('lenia', { w, h, law: { shape: 'absorb', params: { strength: 2.2 } }, weights: { R, mu, sigma, T }, ink: hexLin(ink), state: { K, acc: 0 } });
    const A = L.fields.amount;
    for (let b = 0; b < blobs; b++) { const cx = r() * w, cy = r() * h, s = R * (1.2 + r()); for (let j = Math.floor(cy - s); j < cy + s; j++) for (let i = Math.floor(cx - s); i < cx + s; i++) { const k = ((j + h) % h) * w + (i + w) % w; A[k] = Math.max(A[k], r() * clamp(1 - Math.hypot(i - cx, j - cy) / s, 0, 1) * 1.2); } }
    return L;
  },
  step(L, dt, ctx) {
    const S = L.state; S.acc += dt * 30;
    while (S.acc >= 1) { S.acc -= 1; leniaStep(L, ctx); }
    if (ctx.source) { const s = ctx.source.fields.amount, A = L.fields.amount; for (let k = 0; k < A.length; k++) A[k] = Math.max(A[k], 0.6 * s[k]); }
  },
});

function leniaStep(L, ctx) {
  const { w, h } = L, A = L.fields.amount, N = F32(A.length), { mu, sigma, T } = L.weights, K = L.state.K, drv = ctx.drive?.fields.amount;
  const KX = L.state.KX ??= Int32Array.from(K, k => k[0]), KY = L.state.KY ??= Int32Array.from(K, k => k[1]), KV = L.state.KV ??= Float32Array.from(K, k => k[2]), nk = KV.length, s2 = 2 * sigma * sigma;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let u = 0;
    if (i >= L.weights.R && j >= L.weights.R && i < w - L.weights.R && j < h - L.weights.R) { const base = j * w + i; for (let q = 0; q < nk; q++) u += KV[q] * A[base + KY[q] * w + KX[q]]; }
    else for (let q = 0; q < nk; q++) u += KV[q] * A[((j + KY[q] + h) % h) * w + (i + KX[q] + w) % w];
    const k = j * w + i; if (drv) u += 0.05 * drv[k];
    const g = 2 * Math.exp(-((u - mu) ** 2) / s2) - 1; N[k] = clamp(A[k] + g / T, 0, 1);
  }
  A.set(N);
}

// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// leaf: pigment reveal, the second case of red to orange to yellow (BLEED section 14). Same endpoints as heat,
// different path: a leaf's shift is a reveal of a layer underneath plus a new layer made.
//   chlorophyll  C: absorbs red and blue. Breaks down first order, dC/dt = -k(x) C, fastest at the margin and slowest
//                along the veins, and faster where a drive layer is high (cold, light): so the green retreats as a
//                front from the edge inward, veins last (the palimpsest move: lift the top layer)
//   carotenoid   X: absorbs blue (yellow and orange). Present all along at a constant amount: only revealed
//   anthocyanin  N: absorbs green (red). Made new where sugar builds up in light once chlorophyll is gone:
//                dN/dt = s * light * (1 - C) * (1 - N)
// Colour is Beer-Lambert: transmission per channel = exp(-sum_i c_i a_i), with three-band absorbances for each
// pigment (an approximation of their spectra, labelled inferred: chlorophyll a and b peak near 430 and 662 nm,
// carotenoids near 450 to 480 nm, anthocyanins near 520 to 540 nm). amount = 1 - C, the turning tick.
// Biology note: the mechanism above follows the standard account of senescence (chlorophyll degradation unmasking
// carotenoids; anthocyanin synthesis in some species). The rates here are set, not measured.
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, blur } from '../core/layer.mjs';

export const PIGMENT = { chl: [1.7, 0.32, 2.0], car: [0.04, 0.35, 1.5], anth: [0.12, 1.6, 0.55] };
// the same pigments as 16-band absorbance spectra (400 to 700 nm, 20 nm bands), for the spectral combine: sums of
// gaussian bands at the cited peaks (shapes inferred; transmission = exp(-3.9 a), the RGB engine's scale)
const LBD = Array.from({ length: 16 }, (_, i) => 400 + 20 * i), gb = (l, c, s) => Math.exp(-(((l - c) / s) ** 2));
export const PIGMENT_SPEC = {
  chl: LBD.map(l => 0.42 * gb(l, 432, 22) + 0.3 * gb(l, 462, 18) + 0.36 * gb(l, 664, 18) + 0.03),
  car: LBD.map(l => 0.38 * gb(l, 452, 24) + 0.32 * gb(l, 482, 18) + 0.01),
  anth: LBD.map(l => 0.42 * gb(l, 532, 32) + 0.02),
};

export const leaf = defineGen({
  id: 'leaf',
  law: { shape: 'absorb', params: { beer: 'per-tick absorbance in fields.absorb' } },
  weights: { kc: 'chlorophyll loss rate, 1/s', margin: 'how much faster at the margin', veins: 'vein protection 0..1', car: 'carotenoid amount', synth: 'anthocyanin synthesis rate', light: 'light level 0..1' },
  inputs: { drive: 'optional: speeds the loss locally (cold, light)', source: 'optional: the leaf shape' },
  mechanism: 'dC/dt = -kc (1 + margin d_edge^-1) (1 - veins v(x)) (1 + drive) C; X const; dN/dt = synth light (1 - C)(1 - N); T_c = exp(-(C a_chl + X a_car + N a_anth))',
  credits: ['senescence: chlorophyll breakdown unmasks carotenoids; anthocyanins are synthesised (standard plant physiology account)', 'Beer 1852; Lambert 1760', 'BLEED section 14 (the time metamer of heat and leaf)'],
  create({ w = 160, h = 100, shape = null, kc = 0.22, margin = 2.2, veins = 0.75, car = 0.55, synth = 0.12, light = 0.8, driveGain = 2 } = {}) {
    const n = w * h, mask = shape ? Float32Array.from(shape) : leafShape(w, h), V = veinField(w, h), edge = blur(mask, w, h, 4);
    const C = F32(n), X = F32(n), N = F32(n); for (let k = 0; k < n; k++) { C[k] = mask[k]; X[k] = car * mask[k]; }
    const L = makeLayer('leaf', { w, h, law: { shape: 'absorb', params: { strength: 1 } }, weights: { kc, margin, veins, car, synth, light, driveGain }, fields: { absorb: F32(3 * n) }, state: { mask, V, edge, C, X, N } });
    const buf = new Array(16);
    L.state.absorbSpectrum = k => { for (let b = 0; b < 16; b++) buf[b] = C[k] * PIGMENT_SPEC.chl[b] + X[k] * PIGMENT_SPEC.car[b] + N[k] * PIGMENT_SPEC.anth[b]; return buf; };
    out(L); return L;
  },
  step(L, dt, ctx) {
    const S = L.state, W = L.weights, d = ctx.drive?.fields.amount;
    for (let k = 0; k < L.n; k++) {
      if (S.mask[k] < 0.02) continue;
      const atEdge = clamp(1 - S.edge[k], 0, 1), rate = W.kc * (1 + W.margin * atEdge * 3) * (1 - W.veins * S.V[k]) * (1 + (d ? W.driveGain * d[k] : 0));
      S.C[k] *= Math.exp(-rate * dt);
      S.N[k] += dt * W.synth * W.light * (1 - S.C[k] / Math.max(1e-3, S.mask[k])) * (S.mask[k] - S.N[k]);
    }
    out(L);
  },
});

function out(L) {
  const S = L.state, Ab = L.fields.absorb, A = L.fields.amount;
  for (let k = 0; k < L.n; k++) {
    for (let c = 0; c < 3; c++) Ab[3 * k + c] = S.C[k] * PIGMENT.chl[c] + S.X[k] * PIGMENT.car[c] + S.N[k] * PIGMENT.anth[c];
    A[k] = S.mask[k] > 0.02 ? clamp(1 - S.C[k] / S.mask[k], 0, 1) : 0;
  }
}
// a leaf outline: a pointed ellipse with a toothed margin, and a midrib with pinnate veins
function leafShape(w, h) {
  const m = F32(w * h);
  for (let k = 0; k < m.length; k++) { const x = (k % w) / w - 0.5, y = (k / w | 0) / h - 0.5, u = x / 0.42, a = Math.atan2(y, x), r = 0.36 * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.35 * Math.abs(u)) * (1 + 0.04 * Math.sin(a * 26)); m[k] = Math.abs(y) < r && Math.abs(u) < 1 ? 1 : 0; }
  return blur(m, w, h, 1);
}
function veinField(w, h) {
  const v = F32(w * h);
  for (let k = 0; k < v.length; k++) {
    const x = (k % w) / w - 0.5, y = (k / w | 0) / h - 0.5, mid = Math.exp(-((y / 0.012) ** 2));
    // pinnate ribs: lines leaving the midrib forward at about 42 degrees, fading toward the margin
    let ph = (x * 9 - Math.abs(y) * 8.1) % 1; if (ph < 0) ph += 1;
    const rib = Math.exp(-(((ph - 0.5) / 0.06) ** 2)) * Math.exp(-Math.abs(y) * 3);
    v[k] = clamp(mid + 0.8 * rib, 0, 1);
  }
  return blur(v, w, h, 1);
}

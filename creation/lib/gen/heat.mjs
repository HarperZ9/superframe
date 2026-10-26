// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// heat: blackbody heat colour (BLEED section 14's first case of red to orange to yellow). One hidden tick per cell,
// temperature, drives the colour and the brightness together:
//   colour       Planck's law integrated against the CIE 1931 matching functions, through XYZ to linear sRGB. The
//                matching-function fit (Wyman, Sloan and Shirley 2013) and the chromaticity are Low Water's
//                lib/core/kelvin.mjs (cmf, kelvinRgb, vendored from Low Water), imported; the brightness is integrated here
//   brightness   photometric Y(T) = integral of B(lambda, T) ybar(lambda), relative to Y at `ref` kelvin, so a part at
//                900 K is a dull red ember and one at 1800 K is bright orange-yellow (Draper point near 798 K)
//   heat flow    dT/dt = kappa lap T - (T - ambient) / tau + q * source: conduction, Newton cooling, a heat input
// emit law: combine adds rgb * exposure as light. amount = (T - ambient) / (peak - ambient), the progress tick.
// A timing layer (the forge curve) can drive the input; the leaf generator shares the endpoints and differs in path.
import { cmf, kelvinRgb } from '../core/kelvin.mjs';
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, laplace } from '../core/layer.mjs';

const planck = (nm, K) => { const l = nm * 1e-9; return 1 / (l ** 5 * (Math.exp(1.4388e-2 / (l * K)) - 1)); };
export function luminance(K) { let Y = 0; for (let nm = 380; nm <= 780; nm += 5) Y += planck(nm, K) * cmf(nm)[1]; return Y; }

// a table every 10 K: rgb (brightest channel 1) times Y(T) / Y(ref)
const LUT = new Map();
export function glow(K, ref = 2400) {
  const k = Math.round(Math.max(300, Math.min(6500, K)) / 10) * 10, key = `${k}:${ref}`;
  let v = LUT.get(key); if (!v) { const c = k < 800 ? [1, 0.1, 0] : kelvinRgb(k), y = luminance(k) / luminance(ref); v = c.map(x => x * y); LUT.set(key, v); }
  return v;
}

export const heat = defineGen({
  id: 'heat',
  law: { shape: 'emit', params: { exposure: 1 } },
  weights: { ambient: 'K', peak: 'K at full input', kappa: 'conduction, cells^2/s', tau: 'Newton cooling time, s', q: 'input rate, K/s per unit source', ref: 'K whose brightness is 1' },
  inputs: { source: 'optional: where heat goes in', timing: 'optional: scales the input (forge)' },
  mechanism: 'dT/dt = kappa lap T - (T - ambient)/tau + q src(x) p(t); emit = rgb_bb(T) * Y(T)/Y(ref)',
  credits: ['Planck 1900', 'CIE 1931 observer; Wyman, Sloan and Shirley 2013 (fit), via lib/core/kelvin.mjs', 'Newton 1701 (cooling)', 'Fourier 1822 (conduction)', 'Draper 1847 (the onset of visible glow)'],
  create({ w = 160, h = 100, ambient = 300, peak = 2200, kappa = 1.2, tau = 3, q = 2600, ref = 2400, initial = null } = {}) {
    const T = F32(w * h).fill(ambient); if (initial) for (let k = 0; k < T.length; k++) T[k] = ambient + initial[k] * (peak - ambient);
    const L = makeLayer('heat', { w, h, law: { shape: 'emit', params: { exposure: 1 } }, weights: { ambient, peak, kappa, tau, q, ref }, fields: { rgb: F32(3 * w * h), temp: T }, state: { lap: F32(w * h) } });
    colour(L); return L;
  },
  step(L, dt, ctx) {
    const W = L.weights, T = L.fields.temp, lap = L.state.lap, p = ctx.timing?.state ? ctx.timing.state.progress : 1, src = ctx.source?.fields.amount, sub = 2, h = dt / sub;
    for (let s = 0; s < sub; s++) {
      laplace(T, L.w, L.h, lap);
      for (let k = 0; k < L.n; k++) T[k] += h * (Math.min(0.24 / h, W.kappa) * lap[k] - (T[k] - W.ambient) / W.tau + (src ? W.q * src[k] * p : 0));
    }
    colour(L);
  },
});

function colour(L) {
  const { ambient, peak, ref } = L.weights, T = L.fields.temp, C = L.fields.rgb, A = L.fields.amount;
  for (let k = 0; k < L.n; k++) { const g = glow(T[k], ref); C[3 * k] = g[0]; C[3 * k + 1] = g[1]; C[3 * k + 2] = g[2]; A[k] = Math.max(0, Math.min(1, (T[k] - ambient) / (peak - ambient))); }
}

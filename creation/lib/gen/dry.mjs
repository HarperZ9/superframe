// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// dry: drying, the coffee ring, and the tide line. Two modes from one idea: a liquid edge leaves what it carried where
// it stops.
// ring (Deegan et al. 1997): a drop with its contact line pinned keeps its footprint while it thins. Evaporation is
//   strongest at the edge, J(x) = e0 (1 + edge * (1 - b(x))), b the footprint's blurred interior (a stand-in for the
//   1 / sqrt(1 - r^2/R^2) singularity). The drop keeps its cap shape, h = h0(x) s(t), so mass balance fixes
//   ds/dt = -sum J / sum h0 and the liquid must flow outward to feed the edge: q = grad phi with
//   lap phi = -(h0 ds/dt + J) (Jacobi, no flux through the contact line). Solute rides that flow at q / h
//   (conservative upwind fluxes) and is left where it is when the film is thinner than h_min. The result is a dark
//   rim and a pale centre: the coffee ring.
// tide: a waterline rises and falls over a sloped ground z(x) on its own timing (a tidal sine, or a timing layer);
//   material is deposited where the line dwells, rate ~ exp(-((z - level)/width)^2) * (1 - |dlevel/dt| / vmax),
//   so strandlines form at the turning points of the tide.
// amount = deposit (0..1). Settles when the drop is dry or the tide has laid its lines.
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, blur, hexLin } from '../core/layer.mjs';

export const dry = defineGen({
  id: 'dry',
  law: { shape: 'absorb', params: { beer: true } },
  weights: { e0: 'base evaporation per second (share of volume)', edge: 'edge enhancement of evaporation', hmin: 'film thickness that freezes solute', iters: 'Jacobi iterations for the flow', tideRate: 'tide cycles per second', width: 'strandline width' },
  inputs: { source: 'optional: the drop footprint (ring) or the ground height (tide)', timing: 'optional: the tide level (tide mode)' },
  mechanism: 'ring: h = h0 s(t), ds/dt = -sum J/sum h0, lap phi = -(h0 ds/dt + J), q = grad phi, c_t + div(c q/h) = 0, frozen when h < hmin; tide: dep += exp(-((z-level)/width)^2)(1 - |level_t|/vmax) dt',
  credits: ['Deegan, Bakajin, Dupont, Huber, Nagel and Witten 1997, Capillary flow as the cause of ring stains (Nature 389)', 'Hu and Larson 2006 (Marangoni flow suppresses the ring; not modelled here)', 'strandlines and tide marks (field observation; the dwell-time model here is ours)'],
  create({ w = 160, h = 100, mode = 'ring', footprint = null, ground = null, e0 = 0.05, edge = 3, hmin = 0.04, iters = 40, tideRate = 0.09, width = 0.03, ink = '#5a3a22', drops = [[0.5, 0.5, 0.3]] } = {}) {
    const n = w * h, L = makeLayer('dry', { w, h, law: { shape: 'absorb', params: { strength: 2.6 } }, weights: { e0, edge, hmin, iters, tideRate, width }, ink: hexLin(ink), state: { mode, s: 1, phi: F32(n), dep: F32(n), level: 0 } });
    if (mode === 'ring') {
      const h0 = footprint ? Float32Array.from(footprint) : F32(n);
      if (!footprint) for (const [cx, cy, r] of drops) for (let k = 0; k < n; k++) { const x = (k % w - cx * w) / (r * h), y = ((k / w | 0) - cy * h) / (r * h), d = x * x + y * y; if (d < 1) h0[k] = Math.max(h0[k], 1 - d); }
      const b = blur(h0.map(v => (v > 0 ? 1 : 0)), w, h, 3), c = Float32Array.from(h0, v => (v > 0 ? 1 : 0));
      Object.assign(L.state, { h0, b, c, wet: Uint8Array.from(h0, v => (v > 0 ? 1 : 0)), q: F32(2 * n) });
    } else {
      const z = ground ? Float32Array.from(ground) : Float32Array.from({ length: n }, (_, k) => (k % w) / w * 0.8 + 0.1 + 0.05 * Math.sin((k / w | 0) / h * 9 + (k % w) / w * 3));
      L.state.z = z;
    }
    out(L); return L;
  },
  step(L, dt, ctx) { (L.state.mode === 'ring' ? ring : tide)(L, dt, ctx); out(L); },
});

function ring(L, dt) {
  const S = L.state, W = L.weights, { w, h } = L; if (S.s <= 0) return;
  let sJ = 0, sH = 0; const J = F32(L.n);
  for (let k = 0; k < L.n; k++) if (S.wet[k]) { J[k] = W.e0 * (1 + W.edge * clamp(1 - S.b[k], 0, 1) ** 2); sJ += J[k]; sH += S.h0[k]; }
  const ds = -sJ / Math.max(1e-6, sH); S.s = Math.max(0, S.s + ds * dt);
  // the outward flow that feeds the edge: lap phi = -(h0 ds + J), zero flux through the contact line
  const rhs = F32(L.n); for (let k = 0; k < L.n; k++) if (S.wet[k]) rhs[k] = -(S.h0[k] * ds + J[k]);
  const phi = S.phi;
  for (let it = 0; it < W.iters; it++) for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const k = j * w + i; if (!S.wet[k]) continue; let s = 0, c = 0;
    for (const m of [k - 1, k + 1, k - w, k + w]) if (S.wet[m]) { s += phi[m]; c++; }
    if (c) phi[k] = (s - rhs[k]) / c;
  }
  // conservative upwind transport of solute at q / h across each wet face
  const c = S.c, nc = Float32Array.from(c), hh = k => Math.max(W.hmin * 0.5, S.h0[k] * S.s), sub = 4, ddt = dt / sub;
  for (let s = 0; s < sub; s++) {
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
      const k = j * w + i; if (!S.wet[k]) continue;
      for (const m of [k + 1, k + w]) {
        if (!S.wet[m]) continue;
        const q = phi[m] - phi[k], from = q > 0 ? k : m;      // q > 0 means flow from k toward m
        if (S.h0[from] * S.s < W.hmin) continue;             // a film thinner than hmin has frozen its solute
        const f = clamp(Math.abs(q) / hh(from) * ddt, 0, 0.24) * c[from], to = from === k ? m : k;
        nc[from] -= f; nc[to] += f;
      }
    }
    c.set(nc);
  }
}

function tide(L, dt, ctx) {
  const S = L.state, W = L.weights, t = L.t + dt, lev = ctx.timing?.state ? 0.15 + 0.75 * ctx.timing.state.progress : 0.5 + 0.38 * Math.sin(2 * Math.PI * W.tideRate * t);
  const v = Math.abs(lev - S.level) / Math.max(1e-6, dt), vmax = 2 * Math.PI * W.tideRate * 0.38 + 1e-6; S.level = lev;
  const still = clamp(1 - v / vmax, 0, 1) ** 2;
  for (let k = 0; k < L.n; k++) S.dep[k] = Math.min(1.5, S.dep[k] + dt * 0.6 * still * Math.exp(-(((S.z[k] - lev) / W.width) ** 2)));
}

function out(L) {
  const S = L.state, A = L.fields.amount;
  if (S.mode === 'ring') for (let k = 0; k < L.n; k++) A[k] = clamp(S.c[k] * 0.55, 0, 1);
  else for (let k = 0; k < L.n; k++) A[k] = clamp(S.dep[k], 0, 1);
}

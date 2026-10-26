// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// kasane: kasane no irome, robes stacked so each layer shows only an edge (the Meditations in Color Piene set, image
// 4, as the reference instance; read from the coordinator's description and rebuilt as a law). Properties: each
// layer's colour; law: a layer shows a band at the opening whose width is its weight; structure: the stacking order
// (outermost first). Exposure shrinks the opening, so the inner bands narrow toward nothing: a clarity spectrum per
// layer as exposure falls. The same colours and weights in another order is an isomer.
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, hexLin, smooth } from '../core/layer.mjs';

export const KASANE_DEMO = { colours: ['#8a2a3a', '#c8607a', '#e8a7b5', '#f2d8de', '#6a8a5a'], weights: [0.3, 0.22, 0.18, 0.15, 0.15] };

export const kasane = defineGen({
  id: 'kasane',
  kind: 'conformational',
  law: { shape: 'cover', params: { rule: 'nested edges: band width = weight x exposure' } },
  weights: { colours: 'layer colours, outermost first', bands: 'edge-band weights', exposure: 'opening, 0..1', order: 'the stacking order (structure)' },
  inputs: { timing: 'optional: drives exposure (the robes open and close)' },
  mechanism: 'the opening is a V neckline; cell at depth d into it shows layer i where sum_{j<i} b_j e <= d < sum_{j<=i} b_j e; the innermost fills the rest',
  credits: ['kasane no irome (Heian layered-colour practice), via the Meditations in Color set (reference only)'],
  create({ w = 160, h = 100, colours = KASANE_DEMO.colours, bands = KASANE_DEMO.weights, order = null, exposure = 1, speed = 0.1 } = {}) {
    const ord = order ?? colours.map((_, i) => i), L = makeLayer('kasane', { w, h, law: { shape: 'cover', params: {} }, weights: { colours, bands, exposure, order: ord, speed }, fields: { rgb: F32(3 * w * h), which: F32(w * h) }, state: { p: 0 } });
    paint(L); return L;
  },
  step(L, dt, ctx) { if (ctx.timing?.state) L.weights.exposure = 0.15 + 0.85 * ctx.timing.state.progress; paint(L); },
});

function paint(L) {
  const { w, h } = L, W = L.weights, A = L.fields.amount, C = L.fields.rgb, cols = W.order.map(i => hexLin(W.colours[i])), bands = W.order.map(i => W.bands[i]);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, x = (i + 0.5) / w - 0.5, y = (j + 0.5) / h, edge = 0.06 + Math.abs(x) * 1.4 - y * 0.55;   // a V neckline; depth into the opening below its edge
    const d = -edge; A[k] = 1; let acc = 0, idx = cols.length - 1;
    if (d < 0) { idx = 0; } else { for (let q = 0; q < cols.length - 1; q++) { acc += bands[q] * 0.18 * W.exposure; if (d < acc) { idx = q; break; } } }
    L.fields.which[k] = idx; const c = cols[idx], soft = d < 0 ? 1 : 0.92 + 0.08 * smooth(0, 0.01, d - acc + 0.01);
    for (let q = 0; q < 3; q++) C[3 * k + q] = c[q] * soft;
  }
}

// per-layer visibility (share of the frame each layer shows) as exposure falls: the clarity spectrum per layer
export function exposureSpectrum(params = {}, steps = [1, 0.7, 0.45, 0.25, 0.1]) {
  return steps.map(e => { const L = kasane.create({ w: 160, h: 100, ...params, exposure: e }), n = L.n, share = new Array((params.colours ?? KASANE_DEMO.colours).length).fill(0); for (let k = 0; k < n; k++) share[L.fields.which[k]] += 1 / n; return { exposure: e, share: share.map(v => +v.toFixed(4)) }; });
}

// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// sheet: transparency. A sheet is a translucent layer with its own compositing law (BLEED sections 2, 9 and the
// spine item 3): density_add for printing ink (the Olivetti trap), weber for stacked transparent sheets (Albers
// XX-1), multiply for a filter, screen for light. The laws are the superframe's sheet engine (lib/medium/sheets.mjs),
// applied by combine.mjs; this generator only makes the ticks: the sheet's coverage at each cell.
//
// The claim sheet (BLEED section 2) is this generator with opacity = the claim's reach relative to what it covers:
// a 230K-view claim over a 627-view correction covers it at 1 - 627 / 230000 (0.997). Lifting it is motion: the sheet
// rises by `lift` cells and frosts (blurs) with the height it has risen, so what is under it comes through.
// Context it reads: cut (an unravel or front layer: its amount is the share already removed at each cell).
import { defineGen } from '../core/gen.mjs';
import { makeLayer, textMask, blur, clamp, hexLin, F32 } from '../core/layer.mjs';

export const sheet = defineGen({
  id: 'sheet',
  kind: 'conformational',
  law: { shape: 'sheet', params: { law: 'weber | density_add | multiply | screen' } },
  weights: { opacity: 'cover at full ink 0..1 (for a claim: 1 - reach_under / reach_over)', lift: 'cells risen at full progress', frost: 'blur per cell risen' },
  inputs: { cut: 'optional layer whose amount removes cover', timing: 'optional: drives the lift' },
  mechanism: 'cover(x) = opacity * shape(x - lift * p) * (1 - cut(x)); frosted by a gaussian of radius frost * lift * p',
  credits: ['Albers, Interaction of Color XX-1 (Weber-Fechner stack, measured)', 'Olivetti overprint (trap, measured)', 'Pink Noise translucent pages', 'superframe lib/medium/sheets.mjs'],
  create({ w = 160, h = 100, text = null, mask = null, rect = null, ink = '#2a3f8f', opacity = 0.85, sheetLaw = 'weber', lift = 0, frost = 0.25, box } = {}) {
    let base = mask ? Float32Array.from(mask) : text ? textMask(text, w, h, box) : F32(w * h);
    if (rect) { const [x0, y0, x1, y1] = rect; for (let j = Math.floor(y0 * h); j < y1 * h; j++) for (let i = Math.floor(x0 * w); i < x1 * w; i++) base[j * w + i] = 1; base = blur(base, w, h, 1); }
    const L = makeLayer('sheet', { w, h, law: { shape: 'sheet', params: { law: sheetLaw } }, weights: { opacity, lift, frost }, ink: hexLin(ink), state: { base } });
    L.fields.amount.set(base.map(v => v * opacity));
    return L;
  },
  step(L, dt, ctx) {
    const { w, h } = L, { opacity, lift, frost } = L.weights, p = ctx.timing?.state?.progress ?? 0, dy = lift * p, A = L.fields.amount, B = L.state.base, cut = ctx.cut?.fields.amount;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const sj = clamp(Math.round(j + dy), 0, h - 1), k = j * w + i;
      A[k] = opacity * B[sj * w + i] * (cut ? 1 - clamp(cut[k], 0, 1) : 1);
    }
    if (frost > 0 && dy > 0.5) A.set(blur(A, w, h, Math.min(8, frost * dy)));
  },
});

// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// glyph: words as a layer, set in the typeface agent's living cuts. Accession Burin has a LINE axis (how many burin
// lines build each stroke, 4 to 8) and Accession Divisumma a TURN axis (how far its tiles turn, 0 to 100). The cuts'
// own CSS animates those axes on timing curves; here a timing layer drives them, so a word's cut moves on the clock of
// whatever it is recombined with (a forge, a heartbeat, a tide).
// Masks come from data/glyph-atlas.json (tools/build_glyph_atlas.py renders the variable fonts at sampled axis
// values); between samples the mask is interpolated linearly (an approximation of the font's own interpolation,
// which acts on outlines; the LINE samples step in whole lines, so the interpolation reads as lines fading in).
// Without an atlas the 5x7 face in core/layer.mjs is used. The real-text equivalent is always kept (state.text).
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, textMask } from '../core/layer.mjs';

export function decodeMasks(atlas, font, word, w, h) {
  const F = atlas?.fonts?.[font], key = `${word}@${w}x${h}`; if (!F || !F.masks[key]) return null;
  const dec = typeof atob === 'function' ? s => Uint8Array.from(atob(s), c => c.charCodeAt(0)) : s => new Uint8Array(Buffer.from(s, 'base64'));
  return { values: F.values, axis: F.axis, masks: F.masks[key].map(s => Float32Array.from(dec(s), v => v / 255)) };
}

export const glyph = defineGen({
  id: 'glyph',
  law: { shape: 'sheet', params: { law: 'density_add' } },
  weights: { axisFrom: 'axis value at progress 0', axisTo: 'axis value at progress 1', ink: 'sheet ink', opacity: 'cover at full ink' },
  inputs: { timing: 'optional: drives the axis' },
  mechanism: 'mask(p) = lerp(mask[i], mask[i+1], f), axis = axisFrom + (axisTo - axisFrom) p, i and f from the sampled axis values',
  credits: ['the typeface agent: Accession Burin (LINE) and Accession Divisumma (TURN), typeface/dist/release', 'Bayer, Divisumma (the tiles that turn)'],
  create({ w = 160, h = 100, word = 'claim', font = 'burin', atlas = null, axisFrom = null, axisTo = null, opacity = 1, ink = [0.08, 0.08, 0.12], sheetLaw = 'density_add', box, masks = null } = {}) {
    const M = masks ?? decodeMasks(atlas, font, word, w, h);   // masks: { values, masks: [Float32Array(w*h)] } at full resolution (the 4K renders)
    const lo = axisFrom ?? (M ? M.values[0] : 0), hi = axisTo ?? (M ? M.values.at(-1) : 1);
    const L = makeLayer('glyph', { w, h, law: { shape: 'sheet', params: { law: sheetLaw } }, weights: { axisFrom: lo, axisTo: hi, opacity }, ink, state: { M, text: word, fallback: M ? null : textMask(word, w, h, box), axis: lo } });
    paint(L, 0); return L;
  },
  step(L, dt, ctx) { paint(L, ctx.timing?.state ? ctx.timing.state.progress : Math.min(1, L.t / 4)); },
});

function paint(L, p) {
  const S = L.state, A = L.fields.amount, o = L.weights.opacity;
  if (!S.M) { for (let k = 0; k < L.n; k++) A[k] = o * S.fallback[k]; return; }
  const v = L.weights.axisFrom + (L.weights.axisTo - L.weights.axisFrom) * p, V = S.M.values; S.axis = v;
  let i = 0; while (i < V.length - 2 && V[i + 1] < v) i++;
  const f = Math.max(0, Math.min(1, (v - V[i]) / (V[i + 1] - V[i] || 1))), a = S.M.masks[i], b = S.M.masks[i + 1];
  for (let k = 0; k < L.n; k++) A[k] = o * (a[k] + (b[k] - a[k]) * f);
}

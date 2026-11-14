// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// stencil.mjs: direction 6, the posted notice. CMMNS is cut in the Accession stencil (bowls split, strokes stopping
// short of the stroke they join, the bridges holding the stencil together) and printed in two inks, the register
// of public notices and community broadsides: a fluorescent pink plate carries a halftone field and the letters'
// offset shadow, a blue plate carries the letters, and the two plates sit slightly out of register. The print is the
// era quantizer's physics (lib/quantize/print.mjs): each ink is a transmittance on paper, two inks multiply where
// they overprint, and the halftone screen is area-true. In motion the type engine changes the stencil's weight and
// the press drifts a little in register; the reduced-motion still holds the regular weight.
import { screenCover, inksToImage, linOf } from '../quantize/print.mjs';
import { grain } from '../../../name-art/lib/img.mjs';
import { setWord } from './word.mjs';
import { boxFor } from './looks.mjs';
import { separate, press } from '../look/print.mjs';

// Bold: the printed notice goes through the newsprint press: separated to CMYK, screened coarse, misregistered,
// dot gain and ink trap on a yellowed sheet.
function newsprint(I, W) {
  const u = W / 3840, { w, h, px } = I, at = (x, y) => { const X = Math.min(w - 1, Math.max(0, x | 0)), Y = Math.min(h - 1, Math.max(0, y | 0)), i = 3 * (Y * w + X); return separate(px[i], px[i + 1], px[i + 2], 0.9); };
  return press(w, h, at, { pitch: 20 * u, gain: 0.2, trap: 0.3, register: 9 * u, turn: 0.003, seed: 6, paperOpts: { scale: u, age: 0.65 } });
}
import { linHex, oklch } from './palette.mjs';

export const meta = {
  id: 'stencil', n: 6, title: 'The posted notice (stencil and two-ink print)',
  technique: ['Accession stencil cut (typeface/forge/family/cuts.mjs) through the type engine at a moving weight', 'lib/quantize/print.mjs (two-ink overprint, area-true halftone screen)'],
  loop: { seconds: 4, fps: 24 }, still: 0, reduced: 0,
};
export const PRINT = { paper: linHex(oklch(0.955, 0.012, 95)), pink: linHex(oklch(0.68, 0.24, 355)), blue: linHex(oklch(0.48, 0.15, 245)) };

export const weightAt = t => Math.round(800 + 100 * Math.sin(2 * Math.PI * t));
export const registerAt = (t, cap) => [0.012 * cap + 0.004 * cap * Math.sin(2 * Math.PI * t), -0.008 * cap + 0.003 * cap * Math.cos(2 * Math.PI * t)];

const at = (M, w, h, x, y) => { const X = Math.round(x), Y = Math.round(y); return X < 0 || Y < 0 || X >= w || Y >= h ? 0 : M[Y * w + X]; };

// Coverage of the two plates. Pink: the letters' shadow (offset down-right) over a screened field that is
// strongest behind the word. Blue: the letters, offset by the register error.
export function plates(N, w, h, { shadow, register, cell, field = 0.42 }) {
  const pink = new Float32Array(w * h), blue = new Float32Array(w * h), s = N.spans, top = Math.min(...s.map(q => q.top)), base = Math.max(...s.map(q => q.base));
  const cy = (top + base) / 2, half = (base - top) * 0.95, x0 = s[0].x0, x1 = s[s.length - 1].x1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, vy = Math.max(0, 1 - ((y - cy) / half) ** 2), gx = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
    const tone = field * vy * (0.35 + 0.65 * gx), dots = cell >= 2 ? screenCover(x, y, tone, { cell, angle: 15, ss: 2 }) : tone;
    pink[i] = Math.max(dots, at(N.mask, w, h, x - shadow[0], y - shadow[1]));
    blue[i] = at(N.mask, w, h, x - register[0], y - register[1]);
  }
  return { pink, blue };
}

export function print(w, h, P) {
  const paper = linOf(PRINT.paper), inks = [PRINT.pink, PRINT.blue].map(hx => linOf(hx).map((v, c) => v / paper[c]));
  const out = inksToImage(w, h, paper, inks, [P.pink, P.blue]);
  return { w, h, px: out.lin };
}

export function render(W, H, { t = 0, seed = 'cmmns-wordmark/1', raw = false, look = 'corrected' } = {}) {
  const weight = weightAt(t), N = setWord(W, H, { box: boxFor(look, [0.08, 0.27, 0.92, 0.71]), weight, cut: 'stencil', tracking: 50, sdf: false }), cap = N.capPx;
  const P = plates(N, W, H, { shadow: [0.045 * cap, 0.06 * cap], register: registerAt(t, cap), cell: Math.max(4, Math.round(0.034 * cap)) });
  if (look === 'bold') return { image: newsprint(print(W, H, P), W), text: N.text, spoken: N.spoken, data: { weight, register: registerAt(t, cap).map(v => +v.toFixed(2)), look } };
  return { image: raw ? print(W, H, P) : grain(print(W, H, P), { amount: 1.6, seed: `${seed}/stencil/grain`, radius: Math.max(1, Math.round(W / 1600)) }), text: N.text, spoken: N.spoken, data: { weight, register: registerAt(t, cap).map(v => +v.toFixed(2)) } };
}

// Icon: the same two plates at icon size. At 16 px a shadow doubles every stroke, so the pink plate prints a flat
// light tint under the blue letters instead; from 32 px the shadow returns (one pixel per 32), from 48 px the screen.
export function icon(G) {
  const { w, h } = G, N = { mask: G.mask, spans: spansOf(G) };
  if (h <= 16) { const P = plates(N, w, h, { shadow: [w * 4, 0], register: [0, 0], cell: 0, field: 0 }); P.pink.fill(0.22); return print(w, h, P); }
  const k = Math.max(1, Math.round(h / 32));
  return print(w, h, plates(N, w, h, { shadow: [k, k], register: [0, 0], cell: h >= 48 ? 4 : 0, field: h >= 48 ? 0.3 : 0 }));
}
function spansOf(G) {
  let x0 = G.w, x1 = 0, y0 = G.h, y1 = 0;
  for (let i = 0; i < G.w * G.h; i++) if (G.mask[i] > 0.5) { const x = i % G.w, y = (i / G.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return [{ x0, x1, top: y0, base: y1 }];
}

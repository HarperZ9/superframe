// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// marbling.mjs: direction 5, many inks, one bath. Each contributor's ink is dropped on one bath (lib/marble/bath.mjs:
// area-preserving drops and tines, Lu, Jaffer and others 2012), then combed across and down, and the five letters
// take the bath. Because every op inverts exactly, each point of a letter knows which drop its colour came from: the
// mark is also the record of who gave it colour (data.inks: each contributor's share of the letters).
// Inside the letters the ink carries a field of tiny text (the name-art textfield, as nameart.textfield pours it):
// the contributor hashes themselves, legible only up close. In motion the comb rocks in and out; because the ops
// are exact inverses the bath returns to the same pattern each loop.
import { lay, provenance } from '../marble/bath.mjs';
import { textField } from '../../../name-art/lib/mosaic/textfield.mjs';
import { img, grain } from '../../../name-art/lib/img.mjs';
import { boxFor } from './looks.mjs';

import { setWord, contributors, hashUnit } from './word.mjs';
import { oklch, openHue } from './palette.mjs';

export const meta = {
  id: 'marbling', n: 5, title: 'Many inks, one bath (marbling)',
  technique: ['lib/marble/bath.mjs (drops, tines, exact provenance per point)', 'name-art/lib/mosaic/textfield.mjs (the nameart.textfield node) for the microtext'],
  loop: { seconds: 4, fps: 24 }, still: 0, reduced: 0,
};
export const PAPER = oklch(0.95, 0.014, 95);
export const INKS = 16, DROPS = 4;

export const inkOf = hx => oklch(0.42 + 0.2 * hashUnit(hx, 0), 0.12 + 0.05 * hashUnit(hx, 1), openHue(hashUnit(hx, 2)));

// The bath at w x h: contributor drops from lay(), then a comb across (tines along x every `pitch` px) and a comb
// down (tines along y), their strength scaled by `comb` (the loop rocks it).
export function bathOf(seed, w, h, cap, comb = 1) {
  const hashes = contributors(`${seed}/marbling`, INKS);
  // every contributor drops DROPS times (source index k belongs to contributor k % INKS), so the bath streaks finely
  const sources = Array.from({ length: INKS * DROPS }, (_, k) => ({ id: hashes[k % INKS], weight: 0.6 + hashUnit(hashes[k % INKS], 3 + (k / INKS | 0)) }));
  const bath = lay({ size: [w, h], sources, seed: `${seed}/marbling/bath`, tines: 4, fill: 2.6, comb: 0.05 });
  const across = Math.max(4, 0.11 * cap), down = Math.max(6, 0.3 * cap);
  for (let y = across / 2, j = 0; y < h; y += across, j++) bath.ops.push({ kind: 'tine', bx: 0, by: y, mx: 1, my: 0, z: (j % 2 ? -1 : 1) * 0.32 * cap * comb, u: Math.exp(-1 / (0.3 * across)) });
  for (let x = down / 2, j = 0; x < w; x += down, j++) bath.ops.push({ kind: 'tine', bx: x, by: 0, mx: 0, my: 1, z: (j % 2 ? -1 : 1) * 0.1 * cap * comb, u: Math.exp(-1 / (0.35 * down)) });
  const fine = Math.max(3, 0.045 * cap);
  for (let y = fine / 2, j = 0; y < h; y += fine, j++) bath.ops.push({ kind: 'tine', bx: 0, by: y, mx: 1, my: 0, z: (j % 2 ? -1 : 1) * 0.06 * cap * comb, u: Math.exp(-1 / (0.3 * fine)) });
  const inks = hashes.map(inkOf);
  return { bath, hashes, inks: sources.map((_, k) => inks[k % INKS]), owner: k => k % INKS };
}

// Colour of the bath at (x, y): the ink of the drop it came from, with the drop's rings (where later drops pushed it).
function inkAt(B, x, y) {
  const p = provenance(B.bath, x, y); if (p.src < 0) return { src: -1, c: PAPER };
  const r = Math.hypot(p.u, p.v), ring = 1 + 0.07 * Math.cos(r * 9.5);
  return { src: p.src, c: B.inks[p.src].map(v => v * ring) };
}

// The bath read at every pixel, 4 samples on the pixels where the source changes (so ink edges are antialiased).
export function bathImage(B, w, h) {
  const I = img(w, h), src = new Int16Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = inkAt(B, x + 0.5, y + 0.5), i = y * w + x; src[i] = s.src; I.px.set(s.c, i * 3); }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, s = src[i]; if (src[i - 1] === s && src[i + 1] === s && src[i - w] === s && src[i + w] === s) continue;
    const acc = [0, 0, 0]; for (const [a, b] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { const q = inkAt(B, x + a, y + b).c; for (let c = 0; c < 3; c++) acc[c] += q[c] / 4; }
    I.px.set(acc, i * 3);
  }
  return { I, src };
}

export function render(W, H, { t = 0, seed = 'cmmns-wordmark/1', raw = false, look = 'corrected' } = {}) {
  const N = setWord(W, H, { box: boxFor(look, [0.07, 0.25, 0.93, 0.75]), weight: 900, tracking: 40, sdf: false });
  const B = bathOf(seed, W, H, N.capPx, 0.8 + 0.2 * Math.cos(2 * Math.PI * t)), { I: bathI, src } = bathImage(B, W, H);
  const micro = textField(W, H, { text: B.hashes.join(' '), pitch: Math.max(5, 0.028 * N.capPx), weight: 600, mask: N.mask, glitch: 0 });
  const I = img(W, H), counts = new Float64Array(INKS);
  for (let i = 0; i < W * H; i++) {
    const m = N.mask[i], k = 0.38 * micro[i];
    if (m > 0.5 && src[i] >= 0) counts[B.owner(src[i])]++;
    for (let c = 0; c < 3; c++) { const ink = bathI.px[i * 3 + c] * (1 - k) + PAPER[c] * k, out = look === 'bold' ? bathI.px[i * 3 + c] * 0.42 : PAPER[c] * 0.96 + bathI.px[i * 3 + c] * 0.04; I.px[i * 3 + c] = out * (1 - m) + ink * m; }
  }
  const tot = counts.reduce((a, b) => a + b, 0) || 1;
  return { image: raw ? I : grain(I, { amount: 1.3, seed: `${seed}/marbling/grain`, radius: Math.max(1, Math.round(W / 1600)) }), text: N.text, spoken: N.spoken, data: { inks: B.hashes.map((hx, k) => ({ contributor: hx, share: +(counts[k] / tot).toFixed(4) })), ops: B.bath.ops.length } };
}

// Icon: the same bath, laid at the icon's own size (the comb scaled to its letters), under the letter mask.
export function icon(G, { seed = 'cmmns-wordmark/1' } = {}) {
  const { w, h, mask } = G, cap = h * (w === h ? 0.36 : 0.62), B = bathOf(seed, w, h, cap, 1), { I: bathI } = bathImage(B, w, h), I = img(w, h);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) I.px[i * 3 + c] = PAPER[c] * (1 - mask[i]) + bathI.px[i * 3 + c] * (h <= 32 ? 0.7 : 0.9) * mask[i];
  return I;
}

// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// icon.mjs: the CMMNS letter geometry at icon sizes. At 16 px an outline set by the type engine falls between
// pixels and its strokes go grey, so the 16 px forms are drawn on the pixel grid by hand (one-pixel strokes, six
// rows, the M's middle vertex one pixel deep). From 32 px up the Accession outlines carry it.
// Two layouts:
//   square  extension and store icons: CMMNS stacked as CMM over NS, centred, in a size x size frame
//   strip   one line at height h (toolbar, tab, favicon strip), width set by the word
// Output: { w, h, mask (coverage 0..1), letter (Int8, -1 outside, else the index 0..4 of C M M N S), text }.
import { setName } from '../../../name-art/lib/name.mjs';
import { TEXT, SPOKEN } from './word.mjs';

// Six-row pixel letters, '#' ink. C and S open and close the word on curves; M, M and N carry the straight strokes.
export const PIXEL = Object.freeze({
  C: ['.##', '#..', '#..', '#..', '#..', '.##'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#..#', '##.#', '##.#', '#.##', '#.##', '#..#'],
  S: ['.###', '#...', '.##.', '...#', '...#', '###.'],
});

function stamp(out, w, rows, x0, y0, k, scale) {
  rows.forEach((r, j) => [...r].forEach((c, i) => {
    if (c !== '#') return;
    for (let b = 0; b < scale; b++) for (let a = 0; a < scale; a++) { const p = (y0 + j * scale + b) * w + x0 + i * scale + a; out.mask[p] = 1; out.letter[p] = k; }
  }));
}
const lineWidth = (chars, scale) => chars.reduce((s, c) => s + PIXEL[c][0].length * scale, 0) + (chars.length - 1) * scale;

// Pixel-grid geometry: square 16 (two lines) or a strip `scale` px per cell (one line).
export function pixelWord(layout, size, scale = 1) {
  const lines = layout === 'square' ? [['C', 'M', 'M'], ['N', 'S']] : [['C', 'M', 'M', 'N', 'S']];
  const rowH = 6 * scale, gap = 2 * scale, blockH = lines.length * rowH + (lines.length - 1) * gap;
  const w = layout === 'square' ? size : lineWidth(lines[0], scale) + 4 * scale, h = layout === 'square' ? size : size;
  const out = { w, h, mask: new Float32Array(w * h), letter: new Int8Array(w * h).fill(-1), text: TEXT, spoken: SPOKEN };
  let k = 0, y = Math.round((h - blockH) / 2);
  for (const L of lines) {
    let x = Math.round((w - lineWidth(L, scale)) / 2);
    for (const c of L) { stamp(out, w, PIXEL[c], x, y, k++, scale); x += (PIXEL[c][0].length + 1) * scale; }
    y += rowH + gap;
  }
  return out;
}

// Outline geometry from the type engine, supersampled 4x and box-filtered so thin strokes keep their weight.
export function outlineWord(layout, size, { weight = 900, cut } = {}) {
  const sq = layout === 'square', h = size, w = sq ? size : Math.round(size * 3.7), S = 4;
  const text = sq ? 'CMM\nNS' : TEXT, box = sq ? [0.06, 0.1, 0.94, 0.9] : [0.04, 0.16, 0.96, 0.84];
  const N = setName(text, w * S, h * S, { box, weight, cut, tracking: 30, leading: 1.22, align: 'center' });
  const out = { w, h, mask: new Float32Array(w * h), letter: new Int8Array(w * h).fill(-1), text: TEXT, spoken: SPOKEN };
  const votes = new Float32Array(w * h * 5);
  for (let y = 0; y < h * S; y++) for (let x = 0; x < w * S; x++) {
    const v = N.mask[y * w * S + x]; if (v <= 0) continue;
    const p = ((y / S) | 0) * w + ((x / S) | 0); out.mask[p] += v / (S * S);
    const k = N.spans.findIndex(s => x >= s.x0 - 1 && x <= s.x1 + 1 && y >= s.top - 2 && y <= s.base + 2);
    if (k >= 0) votes[p * 5 + k] += v;
  }
  for (let p = 0; p < w * h; p++) {
    if (out.mask[p] < 0.02) continue;
    let best = -1, bv = 0; for (let k = 0; k < 5; k++) if (votes[p * 5 + k] > bv) { bv = votes[p * 5 + k]; best = k; }
    out.letter[p] = best; out.mask[p] = Math.min(1, out.mask[p]);
  }
  return out;
}

// The icon geometry for a size: pixel letters at 16, outlines above.
export function iconWord(layout, size, opts = {}) {
  if (size <= 16) return pixelWord(layout, size, layout === 'square' ? 1 : Math.max(1, Math.floor(size / 7)));
  return outlineWord(layout, size, opts);
}

export const ICON_SIZES = Object.freeze([16, 32, 48, 128]);

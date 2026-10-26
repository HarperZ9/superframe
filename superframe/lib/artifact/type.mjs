// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// type.mjs: the elements as living type. The recipe's text is set across the whole frame in Accession Mono, through
// the house forge (adapters/type.mjs setText: real outlines, nonzero fill, no system font). Each glyph is cached at
// three masters, 300, 550 and 800. At every pixel the type-weighted field picks the weight between them, so a law
// thickens the letters where it acts and leaves them hairline where it does not: the weight of the type is the
// weight of the law. The ink is the paint's own colour at that pixel, pulled toward the palette ink, so the type
// carries the painting's hue the way a letterpress sheet carries the press's ink. The field also sets the tone of
// each letter, so the type carries an element by two properties, weight and tone (with weight alone the study
// measured correlations of 0.01 to 0.13, 2026-10-26).
import { setText } from '../../adapters/type.mjs';
import { hexLin } from '../../../creation/lib/core/layer.mjs';
import { fillNonzero } from '../fill.mjs';
import { fieldFor, upsample } from './common.mjs';

const MASTERS = [300, 550, 800];

export function textOf(r) {
  if (r.text.trim()) return r.text.trim();
  return r.elements.map(e => `${e.id} ${e.law}`).join(' ') || 'artifact';
}

// lines of exactly `cols` characters, broken at word boundaries, the text repeated until `rows` lines are full
export function layoutLines(text, cols, rows) {
  const words = text.replace(/\s+/g, ' ').split(' ').filter(Boolean), lines = []; let line = '', i = 0;
  if (!words.length) return Array(rows).fill(' '.repeat(cols));
  while (lines.length < rows) {
    const wd = words[i++ % words.length].slice(0, cols);
    if (!line.length) line = wd; else if (line.length + 1 + wd.length <= cols) line += ' ' + wd; else { lines.push(line.padEnd(cols)); line = wd; }
  }
  return lines;
}

export function type(r, layers, paintRGB) {
  const [w, h] = r.sim, [W, H] = r.size, cols = Math.max(12, Math.round(96 * Math.sqrt(Math.min(1, W / 3840))));
  const cw = Math.floor(W / (cols + 1)), lh = Math.floor(cw * 1.5), rows = Math.floor((H - lh * 0.5) / lh), ox = Math.floor((W - cw * cols) / 2), oy = Math.floor((H - lh * rows) / 2);
  const cache = new Map(), glyph = (ch, wt) => {
    const key = `${ch}/${wt}`; if (cache.has(key)) return cache.get(key);
    const { polys } = setText(ch, cw, lh, { style: 'mono', weight: wt, fill: 0.92 }), cov = polys.length ? fillNonzero(polys, cw, lh) : null;
    cache.set(key, cov); return cov;
  };
  const F = upsample(fieldFor(r, layers, 'type'), w, h, W, H), cover = new Float32Array(W * H), lines = layoutLines(textOf(r), cols, rows);
  for (let row = 0; row < rows; row++) for (let c = 0; c < cols; c++) {
    const ch = lines[row][c]; if (ch === ' ') continue;
    const G = MASTERS.map(m => glyph(ch, m)); if (!G[0]) continue;
    const x0 = ox + c * cw, y0 = oy + row * lh;
    for (let j = 0; j < lh; j++) for (let i = 0; i < cw; i++) {
      const k = (y0 + j) * W + x0 + i, t = Math.min(1, F[k] * 1.6) * 2, q = j * cw + i;
      cover[k] = t <= 1 ? G[0][q] + (G[1][q] - G[0][q]) * t : G[1][q] + (G[2][q] - G[1][q]) * (t - 1);
    }
  }
  const paper = hexLin(r.palette.paper), ink = hexLin(r.palette.ink), out = new Float32Array(3 * W * H), wt = r.media.type;
  for (let k = 0; k < W * H; k++) {
    const a = cover[k] * (0.22 + 0.78 * Math.min(1, F[k] * 1.6)) * (0.35 + 0.65 * wt);   // the field sets tone as well as weight
    for (let q = 0; q < 3; q++) { const pi = 0.55 * paintRGB[3 * k + q] + 0.45 * ink[q]; out[3 * k + q] = paper[q] + (Math.min(pi, paper[q] * 0.8) - paper[q]) * a; }
  }
  return { W, H, rgb: out, cover, text: lines.join('\n'), grid: { cols, rows, cw, lh } };
}

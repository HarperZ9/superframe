// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// frontends.mjs: parse a medium into the IR (BLEED section 17).
//   paletteFromImage(img, { k })   image -> weighted pigment layers: colour (OKLCh and linear rgb), area weight
//                                  (measured: share of pixels), L order, ticks = pixel samples, structure = where
//                                  each colour sits (centroid, spatial spread, neighbours): after Meditations in
//                                  Color's palette studies of one painting, rebuilt as k-means in OKLab
//   partialsFromAudio(audio)       sound -> partials: frequency, amplitude, from a long FFT and peak picking
//   musicFromParts(parts)          a music parts.json study (reference library, st-music-*) -> stems as layers with
//                                  level weights, tempo and swing as timing layers, mode as a pitch-class law
import { makeFFT } from '../../../visualizer/lib/fft.mjs';
import { oklab, oklch, fromOklab, linToHex, irLayer, irDoc, weight } from './ir.mjs';
import { rngFrom } from '../core/layer.mjs';

export function paletteFromImage(img, { k = 12, iters = 25, seed = 'palette', sample = 24000, name = 'image' } = {}) {
  const { w, h, rgb } = img, n = w * h, r = rngFrom(seed), step = Math.max(1, Math.floor(n / sample)), idx = [];
  for (let i = 0; i < n; i += step) idx.push(i);
  const P = idx.map(i => oklab([rgb[3 * i], rgb[3 * i + 1], rgb[3 * i + 2]]));
  // k-means++ seeding, then Lloyd iterations in OKLab
  const C = [P[Math.floor(r() * P.length)].slice()]; const d2 = new Float64Array(P.length).fill(Infinity);
  while (C.length < k) { let s = 0; for (let i = 0; i < P.length; i++) { d2[i] = Math.min(d2[i], dist2(P[i], C.at(-1))); s += d2[i]; } let t = r() * s, i = 0; for (; i < P.length - 1 && t > d2[i]; i++) t -= d2[i]; C.push(P[i].slice()); }
  const lab = new Int32Array(P.length);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < P.length; i++) { let b = 0, bd = Infinity; for (let c = 0; c < k; c++) { const d = dist2(P[i], C[c]); if (d < bd) { bd = d; b = c; } } lab[i] = b; }
    const S = C.map(() => [0, 0, 0, 0]); for (let i = 0; i < P.length; i++) { const s = S[lab[i]]; s[0] += P[i][0]; s[1] += P[i][1]; s[2] += P[i][2]; s[3]++; }
    for (let c = 0; c < k; c++) if (S[c][3]) C[c] = [S[c][0] / S[c][3], S[c][1] / S[c][3], S[c][2] / S[c][3]];
  }
  const stats = C.map(() => ({ n: 0, x: 0, y: 0, x2: 0, y2: 0, ticks: [], nb: new Map() }));
  for (let q = 0; q < idx.length; q++) { const i = idx[q], c = lab[q], s = stats[c], x = (i % w) / w, y = Math.floor(i / w) / h; s.n++; s.x += x; s.y += y; s.x2 += x * x; s.y2 += y * y; if (s.ticks.length < 12 && r() < 0.05) s.ticks.push({ value: linToHex([rgb[3 * i], rgb[3 * i + 1], rgb[3 * i + 2]]), at: [+x.toFixed(3), +y.toFixed(3)] }); }
  // neighbours: which colours touch which (connectivity, BLEED section 19), counted on horizontal sample pairs
  const near = (a, b, s) => s.nb.set(b, (s.nb.get(b) ?? 0) + 1);
  for (let q = 1; q < idx.length; q++) if (idx[q] - idx[q - 1] === step && lab[q] !== lab[q - 1]) { near(lab[q - 1], lab[q], stats[lab[q - 1]]); near(lab[q], lab[q - 1], stats[lab[q]]); }
  const total = idx.length, order = C.map((c, i) => i).sort((a, b) => C[b][0] - C[a][0]);  // light to deep
  const layers = order.map((c, rank) => {
    const s = stats[c], lin = fromOklab(C[c]), lch = oklch(lin), mx = s.n ? s.x / s.n : 0, my = s.n ? s.y / s.n : 0;
    const spread = s.n ? Math.sqrt(Math.max(0, s.x2 / s.n - mx * mx + s.y2 / s.n - my * my)) : 0;
    const nb = [...s.nb.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([j]) => order.indexOf(j));
    return irLayer({ name: `colour-${rank + 1}`, order: rank + 1, role: 'pigment', law: 'pigment_area', w: weight(s.n / total, 'measured', 'share of sampled pixels in this OKLab k-means cluster'),
      params: { hex: linToHex(lin), oklch: lch.map(v => +v.toFixed(4)), lin: lin.map(v => +v.toFixed(5)) }, ticks: s.ticks,
      value: { L: +lch[0].toFixed(4), method: 'OKLab cluster centre' },
      structure: { centroid: [+mx.toFixed(3), +my.toFixed(3)], spread: +spread.toFixed(4), connectivity: nb },
      metamer: { readout: 'the colour under D65 (three numbers)', spectrum: 'pixel samples (ticks); no spectral data in a photograph', class: 'any spectrum with this XYZ: not recoverable from RGB', light_change: 'another illuminant; only a spectral source can split it' } });
  });
  return irDoc({ study: `palette-${name}`, kind: 'art', medium: 'visual', source: { front_end: 'paletteFromImage', k, sampled: total, image: [w, h] }, concepts: [{ name: 'palette', label: 'measured', by: 'code', layers }] });
}
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

export function partialsFromAudio({ rate, channels }, { n = 65536, maxPeaks = 16, floorDb = -60 } = {}) {
  const x = channels[0], F = makeFFT(n), pw = new Float64Array(n / 2 + 1), acc = new Float64Array(n / 2 + 1); let frames = 0;
  for (let at = 0; at + n <= x.length; at += n / 2) { F.power(x, pw, at); for (let i = 0; i < pw.length; i++) acc[i] += pw[i]; frames++; }
  if (!frames) { F.power(x, acc, 0); frames = 1; }
  const max = Math.max(...acc), peaks = [];
  for (let i = 2; i < acc.length - 2; i++) if (acc[i] > acc[i - 1] && acc[i] >= acc[i + 1] && 10 * Math.log10(acc[i] / max) > floorDb) {
    const a = Math.log(acc[i - 1]), b = Math.log(acc[i]), c = Math.log(acc[i + 1]), d = 0.5 * (a - c) / (a - 2 * b + c);   // parabolic interpolation
    peaks.push({ f: (i + d) * rate / n, power: (acc[i - 1] + acc[i] + acc[i + 1]) / frames });
  }
  return peaks.sort((p, q) => q.power - p.power).slice(0, maxPeaks).sort((p, q) => p.f - q.f);
}

// The score image back to music IR (backends.musicScore's layout is the notation it reads, the way a player reads a
// stave: a designed carrier, not an arbitrary picture). Bands -> level shares by darkness; stripe autocorrelation ->
// beat period -> tempo; the thin stripe's offset inside the beat -> swing; filled pitch-wheel cells -> mode set, the
// tallest cell -> root.
export function musicFromScore({ w, h, rgb }, { stems, window = 8 } = {}) {
  const lum = k => 0.2126 * rgb[3 * k] + 0.7152 * rgb[3 * k + 1] + 0.0722 * rgb[3 * k + 2], paper = lum(0) || 1, n = stems.length, bandH = Math.floor(h * 0.55 / n);
  const dark = stems.map((_, i) => { let s = 0, c = 0; for (let y = i * bandH + 2; y < (i + 1) * bandH - 2; y++) for (let x = 0; x < w; x++) { s += 1 - lum(y * w + x) / paper; c++; } return Math.max(0, s / c); });
  const tot = dark.reduce((a, b) => a + b, 0) || 1;
  const yMid = Math.floor(h * 0.67), prof = Float64Array.from({ length: w }, (_, x) => 1 - lum(yMid * w + x) / paper);
  const starts = []; for (let x = 1; x < w; x++) if (prof[x] > 0.5 && prof[x - 1] <= 0.5) starts.push(x);
  // the beat lines are 2 px wide, the swing lines 1 px: classify by run length
  const runs = starts.map(x => { let L = 0; while (x + L < w && prof[x + L] > 0.5) L++; return { x, L }; }), beats = runs.filter(r => r.L >= 2).map(r => r.x), offs = runs.filter(r => r.L === 1).map(r => r.x);
  const period = beats.length > 1 ? (beats.at(-1) - beats[0]) / (beats.length - 1) : NaN, bpm = 60 * (w / period) / window;
  const sw = offs.map(x => { const b = beats.filter(v => v <= x).at(-1); return b === undefined ? null : (x - b) / period * 100; }).filter(v => v !== null);
  const cw = w / 12, set = [], heights = [];
  for (let pc = 0; pc < 12; pc++) { const x = Math.floor((pc + 0.5) * cw); let top = h; for (let y = Math.floor(h * 0.78); y < h; y++) if (Math.abs(lum(y * w + x) - paper) > 0.05) { top = y; break; } if (top < h - 2) { set.push(pc); heights.push([pc, h - top]); } }
  const root = heights.sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const layers = stems.map((s, i) => irLayer({ name: s, order: i + 1, role: 'stem', law: 'stem_level', w: weight(dark[i] / tot, 'measured', 'band darkness share in the score image') }));
  return irDoc({ study: 'music-from-score', kind: 'music', medium: 'visual', source: { front_end: 'musicFromScore' }, concepts: [{ name: 'stems', label: 'measured', by: 'code', layers }, { name: 'harmony', label: 'measured', by: 'code', layers: [irLayer({ name: 'mode', order: 1, role: 'harmony', law: 'pitch_class_set', w: weight(1, 'measured', 'cells found'), params: { set, rootPc: root } })] }],
    timing_layers: [{ id: 'tempo', curve: { shape: 'beat_grid', params: { bpm } }, weight: weight(1, 'measured', 'stripe period') }, { id: 'swing', curve: { shape: 'swing', params: { sixteenth_pct: sw.length ? sw.reduce((a, b) => a + b, 0) / sw.length : NaN } }, weight: weight(1, 'measured', 'thin stripe offset') }] });
}

const MODES = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'];
export const MODE_SETS = { ...Object.fromEntries(MODES.map((m, i) => { const major = [0, 2, 4, 5, 7, 9, 11], rot = major.map(v => (v - major[i] + 12) % 12).sort((a, b) => a - b); return [m, rot]; })), 'harmonic minor': [0, 2, 3, 5, 7, 8, 11], 'melodic minor': [0, 2, 3, 5, 7, 9, 11] };
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

export function musicFromParts(parts) {
  const props = []; for (const c of parts.concepts ?? []) for (const L of c.layers ?? []) for (const p of L.parts ?? []) for (const q of p.properties ?? []) props.push({ layer: L.name, part: p.name, ...q });
  const tempo = +(props.find(q => q.property === 'tempo')?.value ?? NaN);
  const swing = props.filter(q => q.property === 'sixteenth swing').map(q => +q.value); const sw = swing.length ? swing.reduce((a, b) => a + b, 0) / swing.length : null;
  const stems = props.filter(q => q.layer === 'layers' && q.property === 'level').map(q => ({ name: q.part, db: +q.value }));
  const lin = stems.map(s => 10 ** (s.db / 20)), tot = lin.reduce((a, b) => a + b, 0) || 1;
  // mode: the best-fitting mode of the stem with the highest share of note time inside it
  let mode = null; for (const q of props.filter(q => q.layer === 'melody' && q.property === 'statement')) { const m = /best fit ([A-G][b#]?) ((?:harmonic |melodic )?\w+) \((\d+)%/.exec(q.value); if (m && MODE_SETS[m[2]] && (!mode || +m[3] > mode.share)) mode = { root: m[1], mode: m[2], share: +m[3], stem: q.part }; }
  const layers = stems.map((s, i) => irLayer({ name: s.name, order: i + 1, role: 'stem', law: 'stem_level', w: weight(lin[i] / tot, 'measured', `10^(dB/20) share; ${s.db} dB in the study`), params: { db: s.db } }));
  const harmony = mode ? [irLayer({ name: 'mode', order: 1, role: 'harmony', law: 'pitch_class_set', w: weight(mode.share / 100, 'measured', `share of note time inside the mode (${mode.stem})`), params: { root: mode.root, rootPc: PC[mode.root], mode: mode.mode, set: MODE_SETS[mode.mode].map(v => (v + PC[mode.root]) % 12) } })] : [];
  return irDoc({ study: `music-${parts.study}`, kind: 'music', medium: 'sound', source: { front_end: 'musicFromParts', study: parts.study }, concepts: [{ name: 'stems', label: 'measured', by: 'converter', layers }, { name: 'harmony', label: 'measured', by: 'converter', layers: harmony }],
    timing_layers: [{ id: 'tempo', curve: { shape: 'beat_grid', params: { bpm: tempo } }, weight: weight(1, 'set', 'the study tempo') }, ...(sw !== null ? [{ id: 'swing', curve: { shape: 'swing', params: { sixteenth_pct: +sw.toFixed(2) } }, weight: weight(1, 'set', 'mean sixteenth swing across drum parts') }] : [])] });
}

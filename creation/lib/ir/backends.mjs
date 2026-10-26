// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// backends.mjs: emit the IR into a medium (BLEED section 17). Every back end returns its output plus the structure it
// imposed, so the isomer and transparency records can see what changed.
// Palette IR (pigment layers with area weights) as:
//   discs        one disc per colour, area proportional to weight, light to deep (after Benson's disc groups)
//   pie          sectors proportional to weight (a proportion pie)
//   checker      a checkerboard whose cell counts follow the weights (largest remainder)
//   translucent  discs on a dark field that overlap and glaze each other (the painting's own law: overlaps make new
//                colours, so the weights do not survive; the loss is the point of including it)
//   chord        sound: each colour one partial. hue -> pitch inside an octave, f = f0 2^(oct + h/360), lightness ->
//                octave (oct = floor(4 L), coarse), weight -> power (amplitude sqrt(w)); chroma has no carrier
//   timing       a timing layer: one segment per colour, duration proportional to weight (a playable palette)
// Music IR as:
//   score image  stems as bands (darkness = level share), beats as vertical stripes over an 8 s window (tempo), a
//                second stripe at the swing fraction of each beat, the mode as filled cells on a 12-step pitch
//                wheel with the root drawn full height
import { F32 } from '../core/layer.mjs';
import { specOf } from '../core/spectral.mjs';
import { glaze } from '../../../superframe/lib/medium/spectral.mjs';
import { spectrumRGB } from '../../../superframe/lib/medium/spectral.mjs';
import { hexToLin } from './ir.mjs';

const PAPER = hexToLin('#f3efe6');
export const paletteParts = ir => ir.concepts.find(c => c.name === 'palette').layers.map(L => ({ lin: L.function.params.lin, w: L.function.weight.value, L: L.function.params.oklch[0], hue: L.function.params.oklch[2], c: L.function.params.oklch[1] }));
const canvas = (w, h, c = PAPER) => { const R = F32(3 * w * h); for (let k = 0; k < w * h; k++) R.set(c, 3 * k); return R; };
const put = (R, w, k, c) => { R[3 * k] = c[0]; R[3 * k + 1] = c[1]; R[3 * k + 2] = c[2]; };

export function paletteDiscs(ir, w = 320, h = 200, { fill = 0.55 } = {}) {
  const P = paletteParts(ir).sort((a, b) => b.L - a.L), R = canvas(w, h), area = w * h * fill, tw = P.reduce((s, p) => s + p.w, 0);
  const radii = P.map(p => Math.sqrt(area * p.w / tw / Math.PI)), cols = Math.ceil(Math.sqrt(P.length * w / h)), rows = Math.ceil(P.length / cols), cw = w / cols, ch = h / rows;
  P.forEach((p, i) => { const cx = (i % cols + 0.5) * cw, cy = (Math.floor(i / cols) + 0.5) * ch, r = Math.min(radii[i], Math.min(cw, ch) * 0.5 - 0.5);
    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(h, cy + r + 1); y++) for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(w, cx + r + 1); x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) put(R, w, y * w + x, p.lin); });
  return { w, h, rgb: R, structure: { kind: 'discs', order: 'light to deep', capped: radii.some((r, i) => r > Math.min(cw, ch) * 0.5 - 0.5) } };
}

export function palettePie(ir, w = 240, h = 240) {
  const P = paletteParts(ir).sort((a, b) => b.L - a.L), R = canvas(w, h), tw = P.reduce((s, p) => s + p.w, 0), cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.46;
  const edges = []; let acc = 0; for (const p of P) { acc += p.w / tw; edges.push(acc); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy > r * r) continue; const a = ((Math.atan2(dy, dx) / (2 * Math.PI)) + 1) % 1; let i = 0; while (i < P.length - 1 && a > edges[i]) i++; put(R, w, y * w + x, P[i].lin); }
  return { w, h, rgb: R, structure: { kind: 'pie', order: 'light to deep, clockwise from east' } };
}

export function paletteChecker(ir, w = 240, h = 240, { cells = 12, shuffle = null } = {}) {
  const P = paletteParts(ir), R = canvas(w, h), N = cells * cells, tw = P.reduce((s, p) => s + p.w, 0), raw = P.map(p => p.w / tw * N), cnt = raw.map(Math.floor);
  let left = N - cnt.reduce((a, b) => a + b, 0); raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => cnt[i]++);
  let seq = []; P.forEach((p, i) => { for (let q = 0; q < cnt[i]; q++) seq.push(i); });
  if (shuffle) { let s = shuffle; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); for (let i = seq.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]]; } }
  const cs = Math.floor(Math.min(w, h) / cells);
  for (let q = 0; q < N; q++) { const gx = q % cells, gy = Math.floor(q / cells); for (let y = gy * cs; y < (gy + 1) * cs; y++) for (let x = gx * cs; x < (gx + 1) * cs; x++) put(R, w, y * w + x, P[seq[q]].lin); }
  return { w, h, rgb: R, structure: { kind: 'checker', order: shuffle ? `shuffled (seed ${shuffle})` : 'grouped in list order', counts: cnt } };
}

export function paletteTranslucent(ir, w = 240, h = 300, { seed = 7, ground = '#1d2420' } = {}) {
  const P = paletteParts(ir), G = specOf(hexToLin(ground)), S = new Array(w * h).fill(null), tw = P.reduce((s, p) => s + p.w, 0);
  let s = seed; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const discs = P.map(p => ({ T: specOf(p.lin), cx: (0.2 + 0.6 * r()) * w, cy: (0.15 + 0.7 * r()) * h, rad: Math.sqrt(w * h * 0.5 * p.w / tw / Math.PI) }));
  const R = F32(3 * w * h);
  for (let k = 0; k < w * h; k++) { const x = k % w + 0.5, y = Math.floor(k / w) + 0.5, over = discs.filter(d => (x - d.cx) ** 2 + (y - d.cy) ** 2 <= d.rad * d.rad); const lit = over.length ? glaze(specOf([0.9, 0.88, 0.82]), ...over.map(d => d.T.map(v => Math.sqrt(v)))) : G; const c = spectrumRGB(lit); R.set(c, 3 * k); }
  return { w, h, rgb: R, structure: { kind: 'translucent discs', law: 'glaze (transmittances multiply band by band)', overlaps: true } };
}

export const CHORD = { f0: 220, rate: 48000, seconds: 3 };
export function paletteChord(ir, { f0 = CHORD.f0, rate = CHORD.rate, seconds = CHORD.seconds } = {}) {
  const P = paletteParts(ir), n = Math.round(rate * seconds), x = F32(n), tw = P.reduce((s, p) => s + p.w, 0);
  const partials = P.map(p => { const oct = Math.min(3, Math.floor(4 * p.L)), f = f0 * 2 ** (oct + p.hue / 360); return { f, a: Math.sqrt(p.w / tw), oct }; });
  for (const q of partials) for (let i = 0; i < n; i++) x[i] += q.a * Math.sin(2 * Math.PI * q.f * i / rate);
  let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); for (let i = 0; i < n; i++) x[i] *= 0.8 / m;
  return { rate, channels: [x], partials, structure: { kind: 'chord', carriers: { hue: 'pitch within the octave', lightness: 'octave (4 steps)', weight: 'power', chroma: 'none' } } };
}
export function paletteTiming(ir, span = 8) { const P = paletteParts(ir), tw = P.reduce((s, p) => s + p.w, 0); let t = 0; return P.map(p => { const seg = { from: +t.toFixed(4), to: +(t += span * p.w / tw).toFixed(4), hue: p.hue }; return seg; }); }

export function musicScore(ir, w = 640, h = 320, { window = 8 } = {}) {
  const stems = ir.concepts.find(c => c.name === 'stems').layers, mode = ir.concepts.find(c => c.name === 'harmony')?.layers[0], bpm = ir.timing_layers.find(t => t.id === 'tempo').curve.params.bpm, swing = ir.timing_layers.find(t => t.id === 'swing')?.curve.params.sixteenth_pct ?? 50;
  const R = canvas(w, h), ink = [0.04, 0.04, 0.06], maxW = Math.max(...stems.map(s => s.function.weight.value)), bandH = Math.floor(h * 0.55 / stems.length);
  stems.forEach((s, i) => { const a = 0.9 * s.function.weight.value / maxW; for (let y = i * bandH + 1; y < (i + 1) * bandH - 1; y++) for (let x = 0; x < w; x++) put(R, w, y * w + x, PAPER.map((p, c) => p + (ink[c] - p) * a)); });
  const y0 = Math.floor(h * 0.6), y1 = Math.floor(h * 0.75), beatPx = w / (bpm / 60 * window), line = (xc, wd) => { for (let x = Math.round(xc); x < Math.min(w, Math.round(xc) + wd); x++) for (let y = y0; y < y1; y++) put(R, w, y * w + x, ink); };
  for (let b = 0; b * beatPx < w; b++) { line(b * beatPx, 2); line(b * beatPx + beatPx * swing / 100, 1); }
  if (mode) { const set = mode.function.params.set, root = mode.function.params.rootPc, cw = w / 12; for (let pc = 0; pc < 12; pc++) { if (!set.includes(pc)) continue; const top = pc === root ? Math.floor(h * 0.8) : Math.floor(h * 0.9), hue = pc * 30 * Math.PI / 180, col = [0.5 + 0.4 * Math.cos(hue), 0.5 + 0.4 * Math.cos(hue - 2.094), 0.5 + 0.4 * Math.cos(hue + 2.094)].map(v => v ** 2.2); for (let y = top; y < h; y++) for (let x = Math.floor(pc * cw + 2); x < (pc + 1) * cw - 2; x++) put(R, w, y * w + x, col); } }
  return { w, h, rgb: R, window, structure: { kind: 'score image', stems: stems.map(s => s.name) } };
}

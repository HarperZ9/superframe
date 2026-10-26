// lib/mosaic/glyphs.mjs: glyphs as marks. A glyph is a mark with a measured ink coverage; a field of glyphs reads as
// tone at a distance and as text up close (CORE.md, "Marks", "Glyphs as marks").
//   atlas(chars, cw, ch, { face })   coverage masks of each glyph in the face actually drawn (Accession mono by default,
//                                    the typeengine's own setter), cached per cell size
//   rampOf(atlas)                    each glyph's ink coverage measured from those masks, sorted: never a stock string
//   loadRamp(state)                  a living-type state's ramp, measured by living type itself (typeengine
//                                    lib/living/marks.mjs inkRamp, written to typeengine/out/ramps/<state>.json)
//   asciiField(ink, W, H, { cw, ch, ramp, diffuse })   one glyph per cell, chosen by coverage, with the cell error
//                                    carried Floyd-Steinberg style so runs of one tone do not band
//   drawField(field, W, H, atlas)    the glyph masks laid into a coverage raster (the far readout is its blur)
import { glyphContext } from '../../../typeengine/lib/setline.mjs';
import { face as faceOf } from '../../../typeengine/lib/faces.mjs';

export const MONO = Object.freeze({ source: 'accession', style: 'mono', weight: 500 });
export const ASCII = ' .,:;-=+*#%@abcdefghijklmnopqrstuvwxyz()[]{}<>/\\|_0123456789';
const NODE = typeof process !== 'undefined' && !!process.versions?.node;
const fs = NODE ? await import('node:fs') : null;

const ATLAS = new Map();
export function atlas(chars = ASCII, cw = 10, ch = 16, { face = MONO } = {}) {
  const key = `${JSON.stringify(face)}/${cw}x${ch}`; let A = ATLAS.get(key);
  if (!A) ATLAS.set(key, (A = { cw, ch, face, masks: new Map() }));
  const fc = faceOf(face);
  for (const c of new Set(chars)) {
    if (A.masks.has(c)) continue;
    A.masks.set(c, c === ' ' ? new Float32Array(cw * ch) : Float32Array.from(glyphContext(fc, c, cw, ch, { size: ch * 0.82 }).coverage.data));
  }
  return A;
}
export function rampOf(A, chars = [...A.masks.keys()]) {
  return chars.map(c => { const m = A.masks.get(c); let s = 0; for (const v of m) s += v; return { ch: c, coverage: s / m.length }; }).sort((a, b) => a.coverage - b.coverage);
}

const RAMPS = new URL('../../../typeengine/out/ramps/', import.meta.url);
export async function loadRamp(state = 'code') {
  const u = new URL(`${state}.json`, RAMPS);
  const j = fs ? JSON.parse(fs.readFileSync(u, 'utf8')) : await (await fetch(u)).json();
  if (!Array.isArray(j.ramp)) throw new Error(`loadRamp: ${u} has no ramp array`);
  return j.ramp.map(r => ({ ch: r.ch, coverage: r.coverage, state: j.state, face: j.face }));
}

// the glyph whose coverage is nearest a target, by binary search in the sorted ramp
export function nearest(ramp, t) {
  let lo = 0, hi = ramp.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ramp[m].coverage < t) lo = m; else hi = m; }
  return Math.abs(ramp[lo].coverage - t) <= Math.abs(ramp[hi].coverage - t) ? ramp[lo] : ramp[hi];
}

// one glyph per cell: cell means of the ink, matched to the ramp; diffuse carries each cell's error to its
// neighbours with the Floyd-Steinberg weights. The ramp's top is the densest glyph, so the ink is rescaled to it.
export function asciiField(ink, W, H, { cw = 10, ch = 16, ramp, diffuse = true, scale = true } = {}) {
  if (!ramp?.length) throw new Error('asciiField: needs a measured ramp (rampOf(atlas(...)) or loadRamp(state))');
  const cols = Math.floor(W / cw), rows = Math.floor(H / ch), top = scale ? ramp.at(-1).coverage : 1, e = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let s = 0; for (let y = r * ch; y < (r + 1) * ch; y++) for (let x = c * cw; x < (c + 1) * cw; x++) s += ink[y * W + x];
    e[r * cols + c] = (s / (cw * ch)) * top;
  }
  const chars = new Array(cols * rows), cov = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, g = nearest(ramp, e[i]), err = e[i] - g.coverage;
    chars[i] = g.ch; cov[i] = g.coverage;
    if (!diffuse) continue;
    if (c + 1 < cols) e[i + 1] += err * 7 / 16;
    if (r + 1 < rows) { if (c > 0) e[i + cols - 1] += err * 3 / 16; e[i + cols] += err * 5 / 16; if (c + 1 < cols) e[i + cols + 1] += err / 16; }
  }
  return { cols, rows, cw, ch, chars, coverage: cov, lines: Array.from({ length: rows }, (_, r) => chars.slice(r * cols, (r + 1) * cols).join('')), scale: top };
}

// lay the chosen glyphs into a coverage raster; weights (optional, per cell) pick a heavier atlas per cell. am > 1
// draws each glyph that much larger about its cell centre (neighbours touch and overlap, the union kept): amplitude
// modulation on top of the density, because the heaviest mono glyph covers under half its cell, which caps the tone
// contrast near 1.7 to 1 (living type's OCR finding, 2026-10-26: 100% error far away at am 1, 0% at 1.35 from 4x).
export function drawField(field, W, H, A, { atlases = null, weightOf = null, am = 1 } = {}) {
  const out = new Float32Array(W * H), { cols, rows, cw, ch, chars } = field, R = Math.max(1, am);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, src = atlases && weightOf ? atlases[weightOf[i]] : A, m = src.masks.get(chars[i]);
    if (!m) continue;
    if (R === 1) { for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) out[(r * ch + y) * W + c * cw + x] = m[y * cw + x]; continue; }
    const cx = (c + 0.5) * cw, cy = (r + 0.5) * ch, hx = cw * R / 2, hy = ch * R / 2;
    for (let y = Math.max(0, Math.floor(cy - hy)); y < Math.min(H, Math.ceil(cy + hy)); y++) for (let x = Math.max(0, Math.floor(cx - hx)); x < Math.min(W, Math.ceil(cx + hx)); x++) {
      const gx = Math.floor((x + 0.5 - cx) / R + cw / 2), gy = Math.floor((y + 0.5 - cy) / R + ch / 2);
      if (gx < 0 || gy < 0 || gx >= cw || gy >= ch) continue;
      const v = m[gy * cw + gx], k = y * W + x; if (v > out[k]) out[k] = v;
    }
  }
  return out;
}

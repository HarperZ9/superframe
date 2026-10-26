// Medium translation (painting to pixel art) and the spot-ink treatment: the rules each module claims, plus goldens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paint } from '../painting.mjs';
import { pixelate, kmeans, orphans } from '../pixelart.mjs';
import { illustrate } from '../spotink.mjs';
import { encode } from '../lib/field.mjs';
import { golden } from '../lib/io.mjs';

const GOLD = new URL('./golden/translate.json', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const P = paint({ w: 240, h: 180, seed: 'valley' });
const X = pixelate(P, { cell: 4, colors: 12, dither: 0.4, cleanup: 2, outline: 1, seed: 'valley' });

test('pixel art: the grid is the source shrunk by the cell, every pixel is a palette colour, at most k colours', () => {
  assert.equal(X.gw, 60); assert.equal(X.gh, 45); assert.ok(X.palette.length <= 12);
  const used = new Set(X.idx); assert.ok(used.size <= 12);
  for (let i = 0; i < X.R.w * X.R.h; i++) { const c = [X.R.px[3 * i], X.R.px[3 * i + 1], X.R.px[3 * i + 2]]; assert.ok(X.palette.some(p => p.every((v, k) => Math.abs(v - c[k]) < 1e-6))); }
});

test('pixel art: every colour change in the upscaled output falls on a cell boundary', () => {
  const { w, h, px } = X.R;
  for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) { const a = 3 * (y * w + x), b = a - 3; if (px[a] !== px[b] || px[a + 1] !== px[b + 1]) assert.equal(x % 4, 0, `step at x ${x}`); }
});

test('pixel art: cleanup leaves no orphan cells, and without it the raw quantise has some', () => {
  assert.equal(orphans(X.idx, X.gw, X.gh), 0);
  const raw = pixelate(P, { cell: 4, colors: 12, dither: 0.4, cleanup: 0, seed: 'valley' });
  assert.ok(orphans(raw.idx, raw.gw, raw.gh) > 0, 'the control: cleanup has work to do');
});

test('pixel art: k-means error never rises across iterations (Lloyd is monotone)', () => {
  for (let i = 1; i < X.trace.length; i++) assert.ok(X.trace[i] <= X.trace[i - 1] + 1e-9, `iteration ${i}`);
  const pts = Array.from({ length: 200 }, (_, i) => [i % 2 ? 0.2 : 0.8, 0, 0]), { centres } = kmeans(pts, 2, 's');
  assert.ok(Math.abs(centres[0][0] - 0.2) < 1e-9 && Math.abs(centres[1][0] - 0.8) < 1e-9, 'two clean clusters found exactly');
});

test('pixel art: the translation keeps the scene: mean colour within 0.03 of the painting per channel', () => {
  const mean = R => [0, 1, 2].map(c => { let s = 0; for (let i = 0; i < R.w * R.h; i++) s += R.px[3 * i + c]; return s / (R.w * R.h); });
  const a = mean(P), b = mean(X.R); a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 0.03, `channel ${i}: ${v} vs ${b[i]}`));
});

test('pixel art: accent keeps thin dark strokes; a plain average loses more of them', () => {
  const dark = R => { let n = 0; for (let i = 0; i < R.w * R.h; i++) if (R.px[3 * i] + R.px[3 * i + 1] + R.px[3 * i + 2] < 0.1) n++; return n; };
  const plain = pixelate(P, { cell: 4, colors: 12, accent: 0, seed: 'valley' });
  assert.ok(dark(X.R) > dark(plain.R), `accent ${dark(X.R)} plain ${dark(plain.R)}`);
});

const T = illustrate({ w: 256, h: 192, mode: 'twotone', spot: '#f2b230', paper: '#e9e2d0', ink: '#1b1d33', ss: 3 });
const M = illustrate({ w: 256, h: 192, mode: 'marker', ss: 3 });

test('two-tone: every pixel is paper, ink, spot, or an anti-aliased blend of two of them', () => {
  const { paper, ink, spot } = T.palette, pairs = [[paper, ink], [paper, spot], [ink, spot]];
  for (let i = 0; i < T.w * T.h; i++) {
    const c = [T.px[3 * i], T.px[3 * i + 1], T.px[3 * i + 2]];
    const ok = pairs.some(([a, b]) => { const d = b.map((v, k) => v - a[k]), L = d.reduce((s, v) => s + v * v, 0), t = Math.max(0, Math.min(1, d.reduce((s, v, k) => s + v * (c[k] - a[k]), 0) / L)); return a.every((v, k) => Math.abs(v + t * d[k] - c[k]) < 0.004); });
    assert.ok(ok, `pixel ${i} off-palette: ${c}`);
  }
});

test('spot colour appears only on lit things, and there is some', () => {
  let spot = 0; for (const v of T.spotCov) spot += v; assert.ok(spot > 20);
  for (let i = 0; i < T.w * T.h; i++) if (T.spotCov[i] === 0 && T.lineCov[i] === 0) { const c = [T.px[3 * i], T.px[3 * i + 1], T.px[3 * i + 2]], s = T.palette.spot; assert.ok(Math.hypot(...c.map((v, k) => v - s[k])) > 0.05); }
});

test('line weight: the heaviest ink class covers more than the window class at the same scene', () => {
  const thin = illustrate({ w: 256, h: 192, mode: 'marker', weights: [0.6, 0.6, 0.6] }), heavy = illustrate({ w: 256, h: 192, mode: 'marker', weights: [2.2, 0.6, 0.6] });
  let a = 0, b = 0; for (let i = 0; i < 256 * 192; i++) { a += thin.lineCov[i]; b += heavy.lineCov[i]; } assert.ok(b > a * 1.3, `heavy ${b} thin ${a}`);
});

test('determinism and goldens (S3, S5)', () => {
  const again = illustrate({ w: 256, h: 192, mode: 'marker', ss: 3 }); assert.deepEqual(Buffer.from(again.px.buffer), Buffer.from(M.px.buffer));
  for (const [name, R] of [['painting', P], ['pixel', X.R], ['marker', M], ['twotone', T]]) { const g = golden(GOLD, name, encode(R, { seed: name }), R.w, R.h); assert.ok(g.mean >= 0.995 && g.chroma <= 0.02, `${name} ${g.mean} ${g.chroma}`); }
});

// The capsule lettering technique, on the lettering library's own synthetic glyphs.
import { buildGlyph } from '../../../lettering/lib/glyph.mjs';
import { O, T as Tee, I } from '../../../lettering/tests/shapes.mjs';
import { pills, render as capsule } from '../letters/capsule.mjs';

test('capsule letters: pills sit on the letter and cover most of it; the word walks the ramp; reveal starts empty', () => {
  for (const shape of [O(), Tee(), I()]) {
    const g = buildGlyph(shape), R = capsule(g, { seed: 2, grainSd: 0 }), n = g.w * g.h;
    let onLetter = 0, art = 0, letterCovered = 0, letter = 0;
    for (let i = 0; i < n; i++) { if (R.alpha[i] > 0.5) { art++; if (shape.mask[i] > 0.2) onLetter++; } if (shape.mask[i] > 0.5) { letter++; if (R.alpha[i] > 0.5) letterCovered++; } }
    assert.ok(onLetter / art > 0.85, `on letter ${onLetter / art}`); assert.ok(letterCovered / letter > 0.6, `covered ${letterCovered / letter}`);
    const empty = capsule(g, { t: 0, seed: 2, grainSd: 0 }); assert.ok(empty.alpha.every(a => a === 0), 'nothing drawn at t = 0');
  }
  const P = pills(buildGlyph(Tee())); assert.ok(P.length >= 4 && Math.min(...P.map(p => p.u)) < 0.1 && Math.max(...P.map(p => p.u)) > 0.5);
});

test('capsule letters: deterministic, and the golden matches (S3, S5)', () => {
  const g = buildGlyph(O()), a = capsule(g, { seed: 5 }), b = capsule(g, { seed: 5 });
  assert.deepEqual(Buffer.from(a.rgba.buffer), Buffer.from(b.rgba.buffer));
  const flat = new Uint8ClampedArray(a.rgba.length); for (let i = 0; i < a.w * a.h; i++) { const al = a.rgba[4 * i + 3] / 255; for (let c = 0; c < 3; c++) flat[4 * i + c] = Math.round(a.rgba[4 * i + c] * al + 241 * (1 - al)); flat[4 * i + 3] = 255; }
  const gd = golden(GOLD, 'capsule-O', flat, a.w, a.h); assert.ok(gd.mean >= 0.995 && gd.chroma <= 0.02);
});

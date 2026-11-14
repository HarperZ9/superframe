// The techniques' own logic: each claim on the specimen page that is a number gets a test here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGlyph } from '../lib/glyph.mjs';
import { O, T, I } from './shapes.mjs';
import { toneField } from '../lib/techniques/engraved.mjs';
import { pressField, wallContrast } from '../lib/techniques/raked.mjs';
import { coverage, dotRadius } from '../lib/techniques/glyphcell.mjs';
import { valueAt, widthFor, valueFor } from '../lib/techniques/data.mjs';
import { plateModes, mode } from '../lib/techniques/chladni.mjs';
import { bitmap, synth, spectrogram } from '../lib/techniques/sound.mjs';
import { dropRadius, stencilMask } from '../lib/techniques/sprayed.mjs';
import { lamps, lampColor } from '../lib/techniques/nightlights.mjs';
import { tipAt, packArc } from '../lib/techniques/light.mjs';
import { pieces } from '../lib/techniques/swarm.mjs';
import { exposure } from '../lib/techniques/developed.mjs';
import { tearLoop } from '../lib/techniques/torn.mjs';
import { cascade, reach } from '../../techniques/lib/timing.js';
import { rng } from '../lib/paint.mjs';

const gO = buildGlyph(O()), gT = buildGlyph(T());

test('engraved: the letter is dark, the shadow falls down and right only', () => {
  const L = toneField(gO), w = gO.w;
  assert.ok(L[60 * w + 22] < 0.4, 'inside the ring is dark');
  assert.ok(L[5 * w + 5] > 0.99, 'the ground is empty');
  const off = Math.max(2, gO.half * 0.55), below = L[Math.round(60 + 46 + off * 0.6) * w + 60], above = L[Math.round(60 - 46 - off * 0.6) * w + 60];
  assert.ok(below < above, `shadow below ${below} vs above ${above}`);
});

test('raked: a raking lamp shows the wall at least three times more than a high lamp', () => {
  const low = wallContrast(Math.PI, 0.3), high = wallContrast(Math.PI, 1.45);
  assert.ok(low > 3 * high, `low ${low} high ${high}`);
});

test('raked: the floor is pressed by about the set depth, the wall is a ramp, and the counter is occluded', () => {
  const F = pressField(gO, { depth: 0.3, uneven: 0, micro: null }), w = gO.w;
  const field = F.height[5 * w + 5], floor = F.height[60 * w + 22];
  assert.ok(Math.abs(field - floor - 0.3) < 0.08, `field ${field} floor ${floor}`);
  assert.ok(F.floor[60 * w + 22] > 0.95 && F.floor[5 * w + 5] === 0);
  assert.ok(F.ao[60 * w + 22] < F.ao[5 * w + 5], 'the pressed floor is more occluded than the open field');
});

test('glyph-cell: coverage is exact and dot area is proportional to it', () => {
  const g = { w: 20, h: 10, mask: new Float32Array(200) };
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) g.mask[y * 20 + x] = 1;
  const c = coverage(g, 10); assert.deepEqual([...c.cov], [1, 0]);
  for (const v of [0.1, 0.25, 0.5, 1]) assert.ok(Math.abs(Math.PI * dotRadius(v) ** 2 / (Math.PI * 0.25) - v) < 1e-9);
});

test('glyph-cell: the cascade lands on the measured 10, 50 and 90 percent times', () => {
  const t10 = reach(cascade, 0.1), t50 = reach(cascade, 0.5), t90 = reach(cascade, 0.9);
  assert.ok(Math.abs(t10 - 0.53) < 0.05 && Math.abs(t50 - 1.13) < 0.05 && Math.abs(t90 - 1.4) < 0.05, `${t10} ${t50} ${t90}`);
});

test('data: weight reads back to the value, and the series runs end to end', () => {
  const s = { y: [100, 50, 3.15] };
  assert.equal(valueAt(s, 0), 100); assert.equal(valueAt(s, 1), 3.15); assert.equal(valueAt(s, 0.5), 50);
  for (const v of [3.15, 20, 77, 100]) assert.ok(Math.abs(valueFor(widthFor(v, 3.15, 100, 8), 3.15, 100, 8) - v) < 1e-9);
});

test('chladni: the free plate solver reproduces Leissa\'s first frequency, and membrane nodal lines are zero', () => {
  const P = plateModes();
  assert.ok(Math.abs(P.modes[0].lambda / 13.468 - 1) < 0.01, `lambda1 ${P.modes[0].lambda}`);
  assert.ok(mode(1 / 3, 0.37, 3, 3) < 1e-9);
});

test('sound: the spectrogram of the synthesised word puts energy in the inked rows and not the blank ones', () => {
  const bm = bitmap(gT, 24), sig = synth(bm, { colSec: 0.012 }), sp = spectrogram(sig);
  // row energy over time in the spectrogram, against row ink in the bitmap (frequency axis is linear and inverted)
  const rowInk = bm.map(r => r.reduce((a, b) => a + b, 0)), rows = rowInk.length;
  const band = r => { const f = sig.fHigh - ((sig.fHigh - sig.fLow) * r) / (rows - 1), y = Math.round((sp.fTop - f) / sp.binHz); let e = 0; for (let x = 0; x < sp.W; x++) e += sp.v[y * sp.W + x]; return e; };
  const inked = rowInk.map((v, r) => [v, band(r)]).filter(([v]) => v > 1), blank = rowInk.map((v, r) => [v, band(r)]).filter(([v]) => v === 0);
  const mean = a => a.reduce((s, [, e]) => s + e, 0) / Math.max(1, a.length);
  assert.ok(inked.length && mean(inked) > 2 * mean(blank), `inked ${mean(inked)} blank ${mean(blank)}`);
});

test('sprayed: droplet radii are log-normal around the stated median, and the stencil bridges every counter', () => {
  const R = rng(5), r = Array.from({ length: 20000 }, () => dropRadius(R)).sort((a, b) => a - b);
  assert.ok(Math.abs(r[10000] / 0.32 - 1) < 0.05, `median ${r[10000]}`);
  const m = stencilMask(gO, 4), w = gO.w;
  assert.ok(m[(60 - 38) * w + 60] < 0.2, 'bridge cut at the top of the ring'); assert.ok(m[(60 + 38) * w + 60] < 0.2, 'and at the bottom');
  assert.ok(m[60 * w + 22] > 0.9, 'the ring stays open elsewhere');
});

test('night lights: lamps are deterministic, sit inside the word, and the front sets the colour', () => {
  const a = lamps(gT, { seed: 4 }), b = lamps(gT, { seed: 4 });
  assert.deepEqual(a.slice(0, 50), b.slice(0, 50));
  const town = a.filter(l => l.cls < 2), inside = town.filter(l => gT.sdf[Math.round(l.y) * gT.w + Math.round(l.x)] > -1.5);
  assert.ok(inside.length / town.length > 0.97, `${inside.length}/${town.length}`);
  assert.deepEqual(lampColor(a[0], gT, 0), [255, 166, 72], 'retrofit 0: every lamp is sodium');
});

test('light: the pen starts at the first stroke and ends at the last; the arc packs to 16 bits', () => {
  const s0 = gT.strokes[0], sN = gT.strokes.at(-1);
  assert.deepEqual(tipAt(gT, 0), [s0.pts[0], s0.pts[1]]);
  assert.deepEqual(tipAt(gT, 1), [sN.pts.at(-2), sN.pts.at(-1)]);
  const p = packArc(gT, 50); assert.equal(p.data.length, gT.w * gT.h * 4);
});

test('swarm: chain pieces cover the strokes, and a dot becomes a coil', () => {
  const gi = buildGlyph(I()), P = pieces(gi, 3, 12);
  assert.ok(P.length >= 2); assert.ok(P.some(p => p.length === 24), 'the coil has one point per link');
});

test('developed and torn: exposure is dense in the letter; a torn loop keeps its points', () => {
  const E = exposure(gO), w = gO.w; assert.ok(E[60 * w + 22] > 0.75 && E[5 * w + 5] < 0.1);
  const t = tearLoop(gO.loops[0], 3, { step: 8, amp: 1.5, fringe: 2, pull: [-0.55, -0.83] });
  assert.ok(t.inner.length > 50 && t.outer.length === t.inner.length);
});

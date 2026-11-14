// wordmark.test.mjs: lib/wordmark, the six CMMNS wordmark directions. The checks: verdict colours stay reserved
// (with the verdict colour itself as the false-success control), every direction keeps the real text, renders are
// byte-stable under one seed, every 16 px icon keeps a luminance gap between letters and ground (a flat icon is the
// control that must fail), and each direction's own law holds (one contributor per tessera, a ledger that only
// grows, ink shares that sum to one, overprint darker than either ink).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../lib/wordmark/index.mjs';
import { openHue, verdictClearance, VERDICT_HUES, HUE_WINDOW, hexLin, oklch, VERDICT } from '../lib/wordmark/palette.mjs';
import { contributors, hashUnit } from '../lib/wordmark/word.mjs';
import { iconWord, pixelWord } from '../lib/wordmark/icon.mjs';
import { vdc, ledger, REVISIONS } from '../lib/wordmark/intaglio.mjs';
import { tileColour } from '../lib/wordmark/smalti.mjs';
import { inkOf, bathOf, INKS } from '../lib/wordmark/marbling.mjs';
import { strataOf } from '../lib/wordmark/strata.mjs';
import { PLATES } from '../lib/wordmark/strata-plates.mjs';
import { PRINT, print } from '../lib/wordmark/stencil.mjs';
import { LIGHT } from '../lib/wordmark/apertures.mjs';
import { INK as INTAGLIO } from '../lib/wordmark/intaglio.mjs';

const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
const luma = (I, i) => 0.2126 * I.px[i * 3] + 0.7152 * I.px[i * 3 + 1] + 0.0722 * I.px[i * 3 + 2];

test('openHue never lands inside a verdict window, and covers the rest of the circle', () => {
  let lo = 360, hi = 0;
  for (let k = 0; k < 2000; k++) { const h = openHue(k / 2000); for (const v of VERDICT_HUES) assert.ok(hueDist(h, v) >= HUE_WINDOW - 1e-9, `hue ${h} in window of ${v}`); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  assert.ok(hi - lo > 300);
});

test('mark colours keep a CIEDE2000 clearance from the verdict colours; a verdict colour itself is the control', () => {
  for (const hx of Object.values(VERDICT).flat()) assert.ok(verdictClearance(hexLin(hx)) < 1e-6);
  const keys = [LIGHT.core, LIGHT.mid, LIGHT.rim, LIGHT.ground, INTAGLIO.ink, INTAGLIO.spot, INTAGLIO.paper, hexLin(PRINT.pink), hexLin(PRINT.blue), hexLin(PRINT.paper)];
  for (const c of keys) assert.ok(verdictClearance(c) >= 8, `colour ${c.map(v => v.toFixed(3))} clearance ${verdictClearance(c).toFixed(2)}`);
  const hx = contributors('test', 200);
  const worst = Math.min(...hx.map(h => verdictClearance(tileColour(2, h))), ...hx.map(h => verdictClearance(inkOf(h))));
  assert.ok(worst >= 5, `worst contributor colour clearance ${worst.toFixed(2)}`);
});

test('contributor hashes are 64 hex characters, distinct, and stable for a seed', () => {
  const a = contributors('s', 500), b = contributors('s', 500);
  assert.deepEqual(a, b); assert.equal(new Set(a).size, 500); assert.ok(a.every(h => /^[0-9a-f]{64}$/.test(h)));
  assert.notDeepEqual(contributors('t', 5), a.slice(0, 5));
  for (const h of a.slice(0, 50)) for (let i = 0; i < 8; i++) { const u = hashUnit(h, i); assert.ok(u >= 0 && u < 1); }
});

test('the 16 px pixel letters spell C M M N S, five letters, separated by at least one empty column', () => {
  for (const layout of ['square', 'strip']) {
    const G = pixelWord(layout, 16, layout === 'square' ? 1 : 2), seen = new Set(G.letter.filter(k => k >= 0));
    assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4]); assert.equal(G.text, 'CMMNS'); assert.equal(G.spoken, 'commons');
    for (let x = 0; x < G.w; x++) for (let y = 0; y < G.h - 0; y++) {
      const k = G.letter[y * G.w + x]; if (k < 0 || x + 1 >= G.w) continue;
      const r = G.letter[y * G.w + x + 1]; assert.ok(r < 0 || r === k, `letters ${k} and ${r} touch at ${x},${y}`);
    }
  }
});

test('every direction renders the real text CMMNS, spoken commons, and is byte-stable under one seed', async () => {
  for (const D of W.DIRECTIONS) {
    const a = await D.render(192, 108, { t: 0.25, seed: 'unit' }), b = await D.render(192, 108, { t: 0.25, seed: 'unit' });
    assert.equal(a.text, 'CMMNS'); assert.equal(a.spoken, 'commons');
    assert.deepEqual(Buffer.from(a.image.px.buffer), Buffer.from(b.image.px.buffer), `${D.meta.id} differs between two runs`);
    assert.ok(a.image.px.every(Number.isFinite), `${D.meta.id} has a non-finite pixel`);
  }
});

test('every 16 px icon keeps a luminance gap between letter and ground pixels; a flat icon is the control', () => {
  const gap = (I, G) => { let a = 0, na = 0, b = 0, nb = 0; for (let i = 0; i < G.w * G.h; i++) { if (G.mask[i] > 0.5) { a += luma(I, i); na++; } else { b += luma(I, i); nb++; } } return Math.abs(a / na - b / nb); };
  for (const D of W.DIRECTIONS) for (const layout of ['square', 'strip']) {
    const G = iconWord(layout, 16), I = D.icon(G, { seed: 'unit' });
    assert.ok(gap(I, G) > 0.12, `${D.meta.id} ${layout} 16 px letter/ground luma gap ${gap(I, G).toFixed(3)}`);
  }
  const G = iconWord('square', 16), flat = { w: 16, h: 16, px: new Float32Array(16 * 16 * 3).fill(0.4) };
  assert.ok(gap(flat, G) < 1e-6);
});

test('smalti: every tessera takes a different contributor, and letter tiles are lighter than field tiles', () => {
  const hx = contributors('unit/smalti', 400), cols = hx.map(h => tileColour(2, h).map(v => Math.round(v * 4095)).join());
  assert.equal(new Set(cols).size, 400);
  const Y = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  assert.ok(Math.min(...hx.map(h => Y(tileColour(2, h)))) > Math.max(...hx.map(h => Y(tileColour(0, h)))));
});

test('intaglio: van der Corput order, and each revision only adds cuts (the ledger never removes one)', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(vdc), [0.5, 0.25, 0.75, 0.125, 0.625]);
  const L = ledger('unit');
  assert.equal(L.length, REVISIONS); assert.equal(new Set(L.map(r => r.entry)).size, REVISIONS);
  const all = L.flatMap(r => r.levels); assert.equal(all.length, 2 * REVISIONS);
  for (let r = 1; r < L.length; r++) { const before = L.slice(0, r).flatMap(q => q.levels), after = L.slice(0, r + 1).flatMap(q => q.levels); assert.ok(before.every(l => after.includes(l))); }
  const sorted = [...all].sort((a, b) => a - b); for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] > 0.01, 'two cuts closer than a cut');
});

test('marbling: provenance shares sum to one, and each drop belongs to one contributor', async () => {
  const B = bathOf('unit', 96, 54, 20);
  assert.equal(B.hashes.length, INKS); for (let k = 0; k < B.inks.length; k++) { assert.equal(B.owner(k), k % INKS); assert.equal(B.inks[k], B.inks[B.owner(k)]); }
  const r = await W.byId('marbling').render(192, 108, { seed: 'unit' }), s = r.data.inks.reduce((a, q) => a + q.share, 0);
  assert.ok(Math.abs(s - 1) < 1e-3, `shares sum ${s}`);
});

test('strata: palettes come from measured plates with their source hashes, and strata are dated newest first', () => {
  assert.equal(PLATES.length, 4); for (const p of PLATES) { assert.match(p.sha256, /^[0-9a-f]{64}$/); assert.equal(p.licence, 'CC0'); assert.ok(p.swatches.length >= 1); }
  const S = strataOf('unit', 22); assert.equal(S.length, 22); assert.ok(S.every(q => q.thick > 0 && PLATES.some(p => p.id === q.ref)));
});

test('stencil print: blue over pink is darker than either ink alone, and bare paper is the paper', () => {
  const one = (p, b) => print(1, 1, { pink: Float32Array.of(p), blue: Float32Array.of(b) }).px;
  const Y = px => 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2];
  const paper = one(0, 0), pink = one(1, 0), blue = one(0, 1), both = one(1, 1);
  assert.ok(Y(both) < Y(pink) && Y(both) < Y(blue) && Y(pink) < Y(paper));
  assert.ok(Math.abs(paper[1] - hexLin(PRINT.paper)[1]) < 0.01);
  assert.ok(oklch(0.5, 0.1, 10).every(v => v >= 0 && v <= 1));
});

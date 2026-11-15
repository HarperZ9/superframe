// Origin: the alive workspace tests/framemosaic.test.js, written 2026-10-23 and left out of the site import; carried on 2026-11-14 with imports repointed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partition, shared, layoutAt, layoutOn, tokens, codeImage, codeSource, seriesSource, framesSource, renderMosaic, intoSheet, tilePx } from '../src/framemosaic.js';
import { sheet } from '../../../feed-25/build/compose.mjs';
import { golden, fnv, fixture, scene } from './helpers.js';

// A frozen copy of our own alive.js, so the golden does not move when the code does.
const OWN = readFileSync(new URL('./fixtures/alive-snapshot.js.txt', import.meta.url), 'utf8');

test('a partition tiles the frame exactly: areas sum to one and every point is covered once', () => {
  for (const seed of [1, 7, 42, 1234]) {
    const p = partition(seed, { depth: 5, minSide: 0.06 });
    assert.ok(Math.abs(p.reduce((a, r) => a + r[2] * r[3], 0) - 1) < 1e-6, `seed ${seed}`);
    for (let k = 0; k < 400; k++) {
      const x = ((k * 37) % 400) / 400 + 0.00123, y = ((k * 91) % 400) / 400 + 0.00071;
      assert.equal(p.filter(([a, b, w, h]) => x >= a && x < a + w && y >= b && y < b + h).length, 1, `point ${x},${y} seed ${seed}`);
    }
  }
});

test('the recut: consecutive layouts share at most 30% of rectangles, one hot tile each', () => {
  for (let k = 1; k < 40; k++) {
    const a = layoutAt(9, k - 1), b = layoutAt(9, k);
    assert.ok(shared(a.rects, b.rects) <= 0.3, `layout ${k}`);
    assert.ok(Number.isInteger(b.hot) && b.hot >= 0 && b.hot < b.rects.length);
  }
  const l = layoutOn(9, 12.5, { fps: 1, holds: [5] }); assert.equal(l.k, 2);
});

test('code tokenises into classes, and the code image is one cell per character', () => {
  const t = tokens("const a = 'x'; // note\nreturn 12;");
  assert.deepEqual(t.filter((x) => x.cls !== 'space').map((x) => x.cls), ['keyword', 'name', 'punct', 'string', 'punct', 'comment', 'keyword', 'number', 'punct']);
  const im = codeImage('ab\n  cd', { cw: 2, ch: 4, cols: 10 }); assert.equal(im.w, 20); assert.equal(im.h, 8);
  assert.equal(im.data[((4 + 1) * 20 + 0) * 4 + 3], 255);
  assert.ok(im.data[((4 + 1) * 20 + 0) * 4] < 40, 'the indentation stays ground'); assert.ok(im.data[((4 + 1) * 20 + 4) * 4] > 150, 'c is inked');
});

test('golden: our own source as a mosaic (alive.js, recut layout 3)', () => {
  const f = renderMosaic(320, 200, layoutAt(5, 3), codeSource(OWN), 4);
  assert.equal(f.labels.filter((l) => l.hot).length, 1);
  const r = golden('mosaic-code', f.image); assert.ok(r.ok, JSON.stringify(r));
});

test('golden: a data series as tiles, the largest value carrying no special mark unless hot', () => {
  const cpi = [9.9, 10.0, 10.2, 12.9, 13.9, 14.1, 17.3, 24.0, 29.6, 38.8, 56.9, 82.4, 130.7, 172.2, 218.1, 258.8, 313.7];
  const f = renderMosaic(320, 200, layoutAt(2, 0, { depth: 5 }), seriesSource(cpi, { unit: '' }), 0);
  assert.ok(f.labels.every((l, i) => l.text === String(cpi[i % cpi.length])));
  const r = golden('mosaic-series', f.image); assert.ok(r.ok, JSON.stringify(r));
});

test('golden: frames as windows at a delay (a drifting plate sampled at 0.18 s per tile)', () => {
  const base = fixture('hmso-store-1950'), get = (t) => scene(base.w, base.h, { shift: t * 30 });
  const f = renderMosaic(240, 180, layoutAt(4, 1), framesSource(get, { delay: 0.18 }), 3);
  const r = golden('mosaic-frames', f.image); assert.ok(r.ok, JSON.stringify(r));
});

test('tiles drop into a feed-25 compose sheet and are recorded like its own mosaic', () => {
  const S = sheet(400, 300, { seed: 3 }), L = layoutAt(3, 0);
  intoSheet(S, L, ({ hot }) => (hot ? '#e0177e' : '#2a2a27'));
  assert.equal(S.meta.tiles.length, L.rects.length);
  assert.equal(S.meta.tiles.filter((t) => t.hot).length, 1);
  const px = tilePx(L.rects[0], 100, 100, 0); assert.equal(px.length, 4);
});

test('determinism: same seed, same pixels', () => {
  const a = renderMosaic(160, 100, layoutAt(8, 2), codeSource(OWN), 1.5), b = renderMosaic(160, 100, layoutAt(8, 2), codeSource(OWN), 1.5);
  assert.equal(fnv(a.image.data), fnv(b.image.data));
});

test('whole-frame tiles keep the frame aspect: a centre crop, never a stretch', async () => {
  const { sheetSource, renderMosaic: R } = await import('../src/framemosaic.js');
  const { image } = await import('../src/lib/img.js');
  const cell = image(40, 80); for (let y = 0; y < 80; y++) for (let x = 0; x < 40; x++) { const on = Math.hypot(x - 20, y - 40) < 15; cell.data.set(on ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * 40 + x) * 4); }
  const f = R(200, 50, { rects: [[0, 0, 1, 1]], hot: -1 }, sheetSource([cell], { delay: 0 }), 0, { gap: 0 });
  let n = 0, xs = 0, ys = 0; for (let y = 0; y < 50; y++) for (let x = 0; x < 200; x++) if (f.image.data[(y * 200 + x) * 4] > 128) { n++; xs += x; ys += y; }
  let w = 0; for (let x = 0; x < 200; x++) if (f.image.data[(25 * 200 + x) * 4] > 128) w++;
  assert.ok(Math.abs(w - 150) < 6, `the disc keeps its width ratio when cropped: ${w} px across, expected about 150`);
});

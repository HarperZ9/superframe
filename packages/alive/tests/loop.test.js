// Origin: the alive workspace tests/loop.test.js, written 2026-10-23 and left out of the site import; carried on 2026-11-14 with imports repointed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestLoop, closeLoop, seamRatio, proxyOf, periodOf, pingpong, frameAt, snapToBar, sliceGrid, crop, flow, advect } from '../src/loop.js';
import { image, luma, gradient, resize, vnoise } from '../src/lib/img.js';
import { golden, fixture, strip, scene } from './helpers.js';

// A clip whose content repeats every `period` frames: a wall pans by one stripe cycle, plus faint noise.
function periodic(n, period, w = 64, h = 48) {
  return [...Array(n)].map((_, i) => { const im = scene(w, h, { shift: (14 * (i % period)) / period }); for (let k = 0; k < im.data.length; k += 4) im.data[k] += ((k * 2654435761 + i * 97) >>> 28) - 8; return im; });
}
// A clip that drifts and never returns (a slow pan).
const drifting = (n, w = 64, h = 48) => [...Array(n)].map((_, i) => { const o = image(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = 40 + 180 * vnoise((x - i * 0.7) / 5, y / 5, 3); o.data.set([v, v, v, 255], (y * w + x) * 4); } return o; });
const sharp = (ims) => ims.reduce((a, im) => { const g = gradient(luma(im)); return a + g.data.reduce((x, y) => x + y, 0) / g.data.length; }, 0) / ims.length;

test('loop length is measured: a clip repeating every 20 frames loops at 20', () => {
  const fr = periodic(70, 20), r = bestLoop(fr.map((f) => proxyOf(f, 48)), { minLen: 8 });
  assert.equal(r.length, 20, JSON.stringify({ start: r.start, end: r.end, len: r.length }));
  assert.ok(r.seamRatio < 0.5, `seam ${r.seamRatio.toFixed(2)} of a step`);
});

test('closing the seam: crossfade and flow beat a hard cut on a clip that never repeats', () => {
  const fr = drifting(40), r = bestLoop(fr.map((f) => proxyOf(f, 48)), { minLen: 24 });
  const cut = seamRatio(closeLoop(fr, r.start, r.end, { method: 'cut' })), fade = seamRatio(closeLoop(fr, r.start, r.end, { method: 'crossfade', blend: 8 })), fl = seamRatio(closeLoop(fr, r.start, r.end, { method: 'flow', blend: 8 }));
  assert.ok(cut > 2, `the cut jumps ${cut.toFixed(2)} steps`);
  assert.ok(fade < 0.6 * cut && fl < 0.6 * cut, `cut ${cut.toFixed(2)}, crossfade ${fade.toFixed(2)}, flow ${fl.toFixed(2)} steps`);
});

test('flow closing keeps edges sharper than a plain dissolve', () => {
  const fr = drifting(40), r = bestLoop(fr.map((f) => proxyOf(f, 48)), { minLen: 24 });
  const tail = (m) => closeLoop(fr, r.start, r.end, { method: m, blend: 8 }).slice(-8);
  const sf = sharp(tail('flow')), sc = sharp(tail('crossfade'));
  assert.ok(sf > sc * 1.03, `flow ${sf.toFixed(4)} against crossfade ${sc.toFixed(4)}`);
});

test('flow recovers a known translation', () => {
  const a = scene(96, 72), b = scene(96, 72, { shift: 4 }), f = flow(a, b, { w: 96 });
  const mid = f.U.data[Math.floor(f.U.h / 2) * f.U.w + Math.floor(f.U.w / 2)];
  assert.ok(Math.abs(mid - 4) <= 1, `u at centre ${mid}`);
  assert.equal(advect(a, f, 0).data.length, a.data.length);
});

test('periods, ping-pong, cadence and the bar', () => {
  assert.equal(periodOf([...Array(66)].map((_, i) => Math.sin((2 * Math.PI * i) / 11))), 11);
  assert.deepEqual(pingpong(4), [0, 1, 2, 3, 2, 1]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => frameAt(k / 24 + 1e-6, 8, 'twos-24')), [0, 0, 1, 1, 2, 2]);
  assert.equal(snapToBar(0.83), 0.8); assert.equal(snapToBar(1.0), 1.0); assert.equal(snapToBar(3.1), 3.2);
});

test('a Muybridge plate cuts into its 24 cells and its first row loops as a wing beat', () => {
  const im = fixture('muybridge-758'), cells = sliceGrid(im, 8, 3);
  assert.equal(cells.length, 24);
  const ws = new Set(cells.map((c) => c.w)), hs = new Set(cells.map((c) => c.h));
  assert.equal(ws.size, 1); assert.equal(hs.size, 1);
  const row = cells.slice(0, 8).map((c) => resize(crop(im, c), 87, 130)), r = bestLoop(row.map((f) => proxyOf(f, 40)), { minLen: 4 });
  assert.ok(r.length >= 4 && r.length <= 6, `loop ${r.length} frames from ${r.start}`);
  const g = golden('loop-muybridge-row', strip(row)); assert.ok(g.ok, JSON.stringify(g));
});

test('golden: a crossfaded seam on a drifting clip, last four frames then the first', () => {
  const fr = drifting(40), r = bestLoop(fr.map((f) => proxyOf(f, 48)), { minLen: 24 }), out = closeLoop(fr, r.start, r.end, { method: 'flow', blend: 8 });
  const g = golden('loop-seam-flow', strip([...out.slice(-4), out[0]])); assert.ok(g.ok, JSON.stringify(g));
  assert.equal(image(1, 1).data.length, 4);
});

test('sheetFrames keeps a whole row when its own join closes, as on Plate 758', async () => {
  const { sheetFrames } = await import('../src/loop.js');
  const fr = sheetFrames(fixture('muybridge-758'), 8, 3, { row: 0 });
  assert.equal(fr.length, 8); assert.equal(new Set(fr.map((f) => `${f.w}x${f.h}`)).size, 1);
});

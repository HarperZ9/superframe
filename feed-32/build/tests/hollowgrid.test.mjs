import test from 'node:test';
import assert from 'node:assert/strict';
import { cellOf, cells, draw, describe, easeOutQuad } from '../hollowgrid.mjs';
import { hexLin } from '../../../feed-29/build/lib/color.mjs';

const ev = (t, note, vel = 1, dur = 0) => ({ t, voice: 'v', args: { note, vel, dur } });
const score = (...events) => ({ duration: 10, events });

test('pitch map: pitch class picks the column, octave the row; order map visits every cell once', () => {
  assert.equal(cellOf(60, 5, 5) % 5, 0); assert.equal(cellOf(61, 5, 5) % 5, 1);
  assert.notEqual(Math.floor(cellOf(48, 5, 5) / 5), Math.floor(cellOf(60, 5, 5) / 5));
  const seen = new Set(); for (let n = 0; n < 25; n++) seen.add(cellOf(n, 5, 5, 'order')); assert.equal(seen.size, 25);
});

test('one state per cell: a retrigger restarts it, and the cell is gone after its fade', () => {
  const s = score(ev(0, 60), ev(1, 60));
  const c = cells(s, 1.5); assert.equal(c.length, 1); assert.ok(Math.abs(c[0].age - 0.5) < 1e-12);
  assert.equal(cells(s, 1 + 2.5 + 1e-9).length, 0);
  const long = cells(score(ev(0, 60, 1, 2)), 3); assert.equal(long.length, 1, 'a two-second note fades 1.6x slower');
});

test('the hollowing: centre goes from ink to ground while the frame stays', () => {
  const s = score(ev(0, 60)), W = 200, H = 200, I = hexLin('#1d2a44'), G = hexLin('#e9edf2');
  const at = (t, x, y) => draw({ w: W, h: H, score: s, t, cols: 1, rows: 1 }).px[3 * (y * W + x)];
  assert.ok(Math.abs(at(0, 100, 100) - I[0]) < 1e-3, 'struck: centre is ink');
  assert.ok(Math.abs(at(1.0, 100, 100) - G[0]) < 1e-3, 'mid-fade: centre is already a hole');
  assert.ok(at(1.0, 100, 100) - at(1.0, 100, 32) > 0.1, 'mid-fade: ink remains near the edge (a ring)');
  assert.ok(Math.abs(at(3, 100, 100) - G[0]) < 1e-3, 'empty after the fade');
  const edge = Math.floor(100 - 0.82 * 200 * 0.89 / 2); // the 1 px frame sits just inside the cell edge
  assert.ok(Math.abs(at(3, 100, edge) - I[0]) < 0.05, 'frame always on');
  assert.ok(Math.abs(easeOutQuad(0.5) - 0.75) < 1e-12);
});

test('draw is a pure function of time; describe gives the text equivalent', () => {
  const s = score(ev(0, 60), ev(0.3, 64, 0.5), ev(0.6, 67));
  assert.deepEqual(draw({ w: 160, h: 120, score: s, t: 0.7 }).px, draw({ w: 160, h: 120, score: s, t: 0.7 }).px);
  assert.match(describe(s, 0.7), /^3 of 3 notes played; 3 of 25 cells lit: /);
});

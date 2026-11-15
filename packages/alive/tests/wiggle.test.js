// Origin: the alive workspace tests/wiggle.test.js, written 2026-10-23 and left out of the site import; carried on 2026-11-14 with imports repointed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sequence, viewAt, cams, synthViews, shiftAt, alignViews, measureWiggle } from '../src/wiggle.js';
import { estimateDepth } from '../src/livestill.js';
import { image, sample, field, luma } from '../src/lib/img.js';
import { golden, fixture, strip, scene } from './helpers.js';

const shifted = (im, dx, dy) => { const o = image(im.w, im.h), p = [0, 0, 0, 0]; for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { sample(im, x - dx, y - dy, p); o.data.set(p, (y * im.w + x) * 4); } return o; };
const small = (im) => { const L = luma(im), f = field(24, 18); for (let y = 0; y < 18; y++) for (let x = 0; x < 24; x++) f.data[y * 24 + x] = L.data[Math.floor((y * im.h) / 18) * im.w + Math.floor((x * im.w) / 24)]; return f; };

test('sequences: pingpong turns at the ends without repeating them; cycle wraps', () => {
  assert.deepEqual(sequence(3), [0, 1, 2, 1]);
  assert.deepEqual(sequence(4), [0, 1, 2, 3, 2, 1]);
  assert.deepEqual(sequence(2), [0, 1]);
  assert.deepEqual(sequence(3, 'cycle'), [0, 1, 2]);
  const seq = sequence(3), at = [0, 0.09, 0.1, 0.25, 0.31, 0.4].map((t) => viewAt(t, seq, 0.1));
  assert.deepEqual(at, [0, 0, 1, 2, 1, 0]);
  assert.deepEqual(cams(3, 0.02).map((c) => +c.toFixed(3)), [-0.01, 0, 0.01]);
});

test('synthesized views: the pivot holds still while the rest swings', () => {
  const im = scene(120, 90), dep = estimateDepth(im, { masks: [{ poly: [[0.36, 0.5], [0.64, 0.5], [0.64, 0.76], [0.36, 0.76]], depth: 1, feather: 2 }] });
  const v = synthViews(im, { views: 3, amp: 0.05, pivot: [0.5, 0.62], depth: dep });
  const atPivot = shiftAt(v[0], v[2], [0.5, 0.62], { win: 0.12, radius: 8 }), atWall = shiftAt(v[0], v[2], [0.5, 0.2], { win: 0.2, radius: 8 });
  assert.ok(Math.abs(atPivot[0]) < 0.5, `pivot moved ${atPivot[0].toFixed(2)} px`);
  assert.ok(Math.abs(atWall[0]) > 2, `the far wall swings ${atWall[0].toFixed(2)} px`);
});

test('real views: alignment recovers known shifts to a quarter pixel', () => {
  const base = fixture('goya-nobody'), a = shifted(base, 3, -2), b = shifted(base, 6.5, 0.5);
  const { shifts } = alignViews([base, a, b], [0.5, 0.35], { radius: 10 });
  assert.ok(Math.abs(shifts[1][0] - 3) < 0.25 && Math.abs(shifts[1][1] + 2) < 0.25, JSON.stringify(shifts[1]));
  assert.ok(Math.abs(shifts[2][0] - 6.5) < 0.25 && Math.abs(shifts[2][1] - 0.5) < 0.25, JSON.stringify(shifts[2]));
});

test('measureWiggle reads views, order, hold and period from a reference clip', () => {
  const v = [0, 4, 8].map((s) => small(scene(96, 72, { shift: s })));
  const seq = sequence(3), frames = []; for (let k = 0; k < 18; k++) for (let h = 0; h < 4; h++) frames.push(v[seq[k % seq.length]]);
  const m = measureWiggle(frames, 30);
  assert.equal(m.views, 3); assert.equal(m.order, 'pingpong'); assert.equal(m.holdFrames, 4);
  assert.ok(Math.abs(m.step - 4 / 30) < 1e-9 && Math.abs(m.period - 16 / 30) < 1e-9, JSON.stringify({ step: m.step, period: m.period }));
  const c = []; for (let k = 0; k < 12; k++) for (let h = 0; h < 3; h++) c.push(v[k % 3]);
  const mc = measureWiggle(c, 24); assert.equal(mc.order, 'cycle'); assert.equal(mc.holdFrames, 3);
});

test('golden: a living frame for a portrait (Goya, three synthesized views, pivot on the face)', () => {
  const im = fixture('goya-nobody'), v = synthViews(im, { views: 3, amp: 0.03, pivot: [0.5, 0.3] });
  const r = golden('wiggle-goya', strip(v)); assert.ok(r.ok, JSON.stringify(r));
});

// Origin: the alive workspace tests/livestill.test.js, written 2026-10-23 and left out of the site import; carried on 2026-11-14 with imports repointed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateDepth, renderFrame, region, pose, percentile, DEFAULTS } from '../src/livestill.js';
import { image, mad, sdf, polyMask, field } from '../src/lib/img.js';
import { golden, fixture, fnv, strip, scene, centroid } from './helpers.js';

const STILL = { parallax: 0, breathe: 0, wind: 0, water: 0, light: 0 };

test('depth: lower and busier reads nearer than a bright, flat top', () => {
  const im = scene(96, 72), d = estimateDepth(im);
  let top = 0, bot = 0; for (let x = 0; x < 96; x++) { top += d.data[5 * 96 + x]; bot += d.data[66 * 96 + x]; }
  assert.ok(bot / 96 > top / 96 + 0.3, `bottom ${(bot / 96).toFixed(2)} should exceed top ${(top / 96).toFixed(2)} by 0.3`);
  assert.ok(Math.min(...d.data) >= 0 && Math.max(...d.data) <= 1);
});

test('depth: a hand mask sets its depth inside and feathers across its edge', () => {
  const im = scene(96, 72), poly = [[0.1, 0.05], [0.4, 0.05], [0.4, 0.35], [0.1, 0.35]];
  const d = estimateDepth(im, { masks: [{ poly, depth: 1, feather: 4 }] });
  assert.ok(d.data[12 * 96 + 24] > 0.97, 'inside the mask is near');
  const row = 12, xs = [30, 36, 39, 42, 46].map((x) => d.data[row * 96 + x]);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] <= xs[i - 1] + 1e-6, `feather falls off monotonically: ${xs.map((v) => v.toFixed(2))}`);
});

test('sdf: signed distance is positive inside, negative outside, zero-crossing at the edge', () => {
  const m = polyMask(40, 40, [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]]), s = sdf(m);
  assert.ok(s.data[20 * 40 + 20] >= 9 && s.data[20 * 40 + 20] <= 11, `centre ${s.data[20 * 40 + 20]}`);
  assert.ok(s.data[2 * 40 + 2] < -6);
});

test('zero amplitude gives back the source', () => {
  const im = fixture('goya-nobody'), d = estimateDepth(im), f = renderFrame(im, d, 3.3, STILL);
  assert.ok(mad(im, f) < 0.6, `mad ${mad(im, f)}`);
});

test('parallax: near content moves further than far content, and the pivot depth holds still', () => {
  const im = scene(120, 90), d = estimateDepth(im, { masks: [{ poly: [[0.36, 0.5], [0.64, 0.5], [0.64, 0.76], [0.36, 0.76]], depth: 1, feather: 2 }] });
  const ps = { cam: [0.04, 0], scale: 1, lightPhase: -9 }, f = renderFrame(im, d, 0, { ...STILL, pivot: 0 }, { ps });
  const box = [20, 40, 100, 80], [cx0] = centroid(im, 215, box), [cx1] = centroid(f, 215, box);
  assert.ok(Math.abs(cx1 - cx0) > 3, `disc moved ${(cx1 - cx0).toFixed(2)} px`);
  const g = renderFrame(im, d, 0, { ...STILL, pivot: 1 }, { ps }), [cx2] = centroid(g, 215, box);
  assert.ok(Math.abs(cx2 - cx0) < 0.6, `with the pivot on the disc it holds: ${(cx2 - cx0).toFixed(2)} px`);
});

test('water moves only inside its mask', () => {
  const im = fixture('hmso-store-1950'), d = estimateDepth(im), water = region(im.w, im.h, { rects: [[0, 0.7, 1, 1]], soft: 2 });
  const f = renderFrame(im, d, 2.1, { ...STILL, water: 0.01 }, { water });
  const top = { w: im.w, h: 100, data: im.data.subarray(0, im.w * 100 * 4) }, ftop = { w: im.w, h: 100, data: f.data.subarray(0, im.w * 100 * 4) };
  assert.ok(mad(top, ftop) < 0.6, 'above the water line nothing moves');
  assert.ok(mad(im, f) > 0.3, 'below it the plate ripples');
});

test('breath and drift are periodic on the bar', () => {
  const a = pose(1.1, DEFAULTS), b = pose(1.1 + 4 * DEFAULTS.breathPeriod, DEFAULTS);
  assert.ok(Math.abs(a.scale - b.scale) < 1e-9 && Math.abs(a.cam[0] - b.cam[0]) < 1e-9 && Math.abs(a.cam[1] - b.cam[1]) < 1e-9);
});

test('determinism: same inputs, same bytes', () => {
  const im = fixture('goya-nobody'), d = estimateDepth(im), w = region(im.w, im.h, { rects: [[0, 0, 1, 0.3]] });
  const a = renderFrame(im, d, 1.7, {}, { wind: w }), b = renderFrame(im, d, 1.7, {}, { wind: w });
  assert.equal(fnv(a.data), fnv(b.data));
});

test('golden: a cleared plate breathing, with wind in the sky band and the light passing', () => {
  const im = fixture('munchausen-dore'), d = estimateDepth(im), wind = region(im.w, im.h, { rects: [[0, 0, 1, 0.35]] });
  const p = { parallax: 0.02, breathe: 0.01, wind: 0.01, light: 0.3, lightPeriod: 8 };
  const frames = [0, 1.6, 3.2, 4.8].map((t) => renderFrame(im, d, t, p, { wind }));
  const dv = image(d.w, d.h); for (let i = 0; i < d.w * d.h; i++) { const v = d.data[i] * 255; dv.data.set([v, v, v, 255], i * 4); }
  const r = golden('livestill-dore', strip([dv, ...frames]));
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(percentile(d.data, 0.5) > 0.1 && percentile(d.data, 0.5) < 0.9);
});

test('region fields are feathered 0..1', () => {
  const r = region(50, 50, { rects: [[0, 0, 0.5, 1]], soft: 4 });
  assert.ok(r.data[25 * 50 + 5] > 0.95 && r.data[25 * 50 + 45] < 0.05 && r.data[25 * 50 + 25] > 0.2 && r.data[25 * 50 + 25] < 0.8);
  assert.ok(field(2, 2).data.length === 4);
});

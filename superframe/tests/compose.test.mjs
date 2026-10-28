// compose.test.mjs: the composition-axis scorer and wide-angle checker against planted answers and controls, at
// reduced size so the slice stays fast. The full registered run is tools/compose-eval.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lgamma, log10BinomTail, rng } from '../lib/compose/stats.mjs';
import { stripeCov, corridorScene, railScene } from '../lib/compose/scene.mjs';
import { makeCamera } from '../lib/compose/camera.mjs';
import { detectLines } from '../lib/compose/lines.mjs';
import { mainVP, findVP, shuffleDirections } from '../lib/compose/vp.mjs';
import { wideAngle, edgeDistance } from '../lib/compose/wide.mjs';
import { lensSet } from '../lib/compose/plant.mjs';

const W = 640, H = 360;
const err = (a, b, w) => Math.hypot(a[0] - b[0], a[1] - b[1]) / w;
const noise = (w, h, seed) => { const r = rng(seed), a = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { const v = r() * 255; a[4 * i] = a[4 * i + 1] = a[4 * i + 2] = v; a[4 * i + 3] = 255; } return a; };

test('stats: log-gamma and binomial tail against exact values', () => {
  assert.ok(Math.abs(lgamma(10) - Math.log(362880)) < 1e-9);
  assert.ok(Math.abs(lgamma(0.5) - Math.log(Math.sqrt(Math.PI))) < 1e-9);
  // P[X >= 3], X ~ B(4, 0.25) = 4 * 0.25^3 * 0.75 + 0.25^4 = 0.05078125
  assert.ok(Math.abs(10 ** log10BinomTail(4, 3, 0.25) - 0.05078125) < 1e-12);
  assert.equal(log10BinomTail(10, 0, 0.3), 0);
});

test('box-filtered stripes: exact inside a line, mean tone over a wide footprint', () => {
  assert.equal(stripeCov(0, 0, 1, 0.1), 1);
  assert.equal(stripeCov(0.5, 0, 1, 0.1), 0);
  assert.ok(Math.abs(stripeCov(0.37, 100, 1, 0.1) - 0.1) < 1e-3);
});

test('camera: the optical axis vanishes at the frame centre, and a yawed camera moves it by f tan(yaw)', () => {
  const c = makeCamera({ w: 1000, h: 500, focalMm: 36 }), v = c.vanish([0, 0, 1]);
  assert.deepEqual(v.map(x => Math.round(x * 1e6) / 1e6), [500, 250]);
  const y = makeCamera({ w: 1000, h: 500, focalMm: 36, yaw: 10 }).vanish([0, 0, 1]);
  assert.ok(Math.abs(y[0] - (500 - 1000 * Math.tan(10 * Math.PI / 180))) < 1e-6, `yaw vp ${y[0]}`);
});

test('noise floor: white noise and a uniform field give no segments and no vanishing point', () => {
  const n = detectLines(noise(W, H, 'tn'), W, H), u = detectLines(new Uint8ClampedArray(W * H * 4).fill(128), W, H);
  assert.equal(n.length, 0); assert.equal(u.length, 0);
  assert.equal(mainVP(n, W, H).main, null);
});

test('P1 slice: vanishing point within 1% of W on a yawed corridor and a rail track; shuffled directions are not significant', () => {
  for (const sc of [corridorScene({ w: W, h: H, focalMm: 24, pos: [0, 1.6, 0], yaw: 7, pitch: -4 }), railScene({ w: W, h: H, focalMm: 35, yaw: -6, pitch: -5 })]) {
    const segs = detectLines(sc.rgba, sc.w, sc.h), { main } = mainVP(segs, sc.w, sc.h);
    assert.ok(main && main.significant, 'no significant vanishing point');
    assert.ok(err(main.vp, sc.truth.vp, sc.w) <= 0.01, `vp error ${err(main.vp, sc.truth.vp, sc.w)}`);
    assert.equal(findVP(shuffleDirections(segs, 'test')).significant, false);
  }
});

// At 640 px the far ends crowd into a few pixels round the vanishing point and the depth ratio under-reads (spec
// sheet), so this slice runs at the registered 1280 x 720.
// All three registered lens scenes. The P2 control (200 mm framed from the mouth, edge score under 0.5 with the point
// found) was not asserted before 2026-10-28 verification: a constant edge score of 1 passed every test. It is asserted
// here at the registered threshold; it is fragile (0.4545 at the registered 23.8 m, 0.50 to 0.64 at 21 to 27 m, spec
// sheet), so a failure here after an unrelated change reads as that fragility before it reads as a regression.
test('P2 and P3 slice: 16 mm reaches every edge, 200 mm framed does not, the zoom does; depth ratio within 15% for all three', () => {
  const [a, b, z] = lensSet({ w: 1280, h: 720 }).map(({ make }) => { const sc = make(); return { sc, r: wideAngle(detectLines(sc.rgba, sc.w, sc.h), sc.w, sc.h) }; });
  assert.equal(a.r.edgeScore, 1);
  assert.ok(b.r.vp && err(b.r.vp, b.sc.truth.vp, b.sc.w) <= 0.01, 'framed 200 mm: vanishing point not found within 1% of W');
  assert.ok(b.r.edgeScore < 0.5, `framed 200 mm edge score ${b.r.edgeScore}`);
  assert.ok(z.r.edgeScore >= 0.9, `200 mm zoom edge score ${z.r.edgeScore}`);
  for (const { sc, r } of [a, b, z]) assert.ok(Math.abs(r.depthRatio / sc.truth.depthRatio - 1) <= 0.15, `depth ${r.depthRatio} vs ${sc.truth.depthRatio}`);
  assert.ok(z.r.depthRatio <= 2.5 && a.r.depthRatio >= 10, `16 mm ${a.r.depthRatio}, 200 mm ${z.r.depthRatio}`);
});

test('edge distance: from the centre of a 200 x 100 frame, 100 to the side and 50 up', () => {
  assert.equal(edgeDistance([100, 50], 1, 0, 200, 100), 100);
  assert.equal(edgeDistance([100, 50], 0, -1, 200, 100), 50);
});

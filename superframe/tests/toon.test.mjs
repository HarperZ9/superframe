// toon.test.mjs: the cartoon pipeline. Each test names a property a passing render could still get wrong, and most
// carry a control that must fail the same check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { canvas, coverage, covArea, clip, cut } from '../lib/toon/raster.mjs';
import { ellipse, roundRect, resample } from '../lib/toon/geom.mjs';
import { inkClosed, pressure, heldFrame, boilStep, boil } from '../lib/toon/ink.mjs';
import { morphOutline, drawPuppet, stage, place } from '../lib/toon/puppet.mjs';
import { standing, jaw, ik2 } from '../lib/toon/rig.mjs';
import { jitterParts, flicker, insideDistance, clay } from '../lib/toon/stopmo.mjs';
import { mumble, syllables, mouthAt } from '../lib/toon/voice.mjs';
import { puppetLayer } from '../lib/toon/layer.mjs';
import { CAST } from '../lib/toon/cast/index.mjs';
import { buildGulp } from '../lib/toon/cast/gulp.mjs';

const sq = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const quadrant = (A, cx, cy, sx, sy) => { let s = 0; for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) if (Math.sign(x + A.x0 - cx) === sx && Math.sign(y + A.y0 - cy) === sy) s += A.a[y * A.w + x]; return s; };

test('coverage is area-true for a fractional square and a circle', () => {
  assert.ok(Math.abs(covArea(coverage([sq(10.3, 20.7, 100, 50)], 300, 300)) - 5000) < 25);
  const c = covArea(coverage([ellipse(150, 150, 40, 40, 256)], 300, 300));
  assert.ok(Math.abs(c - Math.PI * 1600) / (Math.PI * 1600) < 0.01, `circle ${c}`);
});

test('nonzero winding unions same-direction shapes; cut of a shape by itself is empty', () => {
  const A = coverage([sq(0, 0, 100, 100), sq(50, 0, 100, 100)], 300, 300);
  assert.ok(Math.abs(covArea(A) - 15000) < 10);
  const B = coverage([sq(10, 10, 80, 80)], 300, 300);
  assert.ok(covArea(cut(B, B)) < 1);
  assert.ok(Math.abs(covArea(clip(B, B)) - covArea(B)) < 1);
});

test('silhouette ink is heavier on the side away from the light; spread 0 (control) is even', () => {
  const C = ellipse(200, 200, 120, 120, 128), ratio = spread => { const A = coverage(inkClosed(C, { w: 10, spread }), 400, 400); return quadrant(A, 200, 200, 1, 1) / quadrant(A, 200, 200, -1, -1); };
  assert.ok(ratio(0.75) > 2, `weighted ${ratio(0.75)}`);
  assert.ok(Math.abs(ratio(0) - 1) < 0.05, `control ${ratio(0)}`);
});

test('brush pressure tapers both ends and peaks in the middle', () => {
  assert.equal(pressure(0.5), 1);
  assert.ok(pressure(0) < 0.2 && pressure(1) < 0.2);
});

test('on twos: 12 held drawings per 24 frames, boil redraws on the same beat through a cycle of 3; ones is the control', () => {
  const uniq = h => new Set(Array.from({ length: 24 }, (_, f) => heldFrame(f, h))).size;
  assert.equal(uniq(2), 12); assert.equal(uniq(1), 24);
  const steps = Array.from({ length: 12 }, (_, f) => boilStep(f));
  assert.deepEqual(steps, [0, 0, 1, 1, 2, 2, 0, 0, 1, 1, 2, 2]);
});

test('boil: amp 0 is the identity; displacement is bounded and coherent between neighbours', () => {
  const C = Array.from({ length: 200 }, (_, i) => [i, 100]);
  assert.strictEqual(boil([C], { amp: 0 })[0], C);
  const [D] = boil([C], { amp: 4, cell: 60, seed: 't', step: 1 });
  let worst = 0, jump = 0;
  D.forEach(([x, y], i) => { worst = Math.max(worst, Math.hypot(x - C[i][0], y - C[i][1])); if (i) jump = Math.max(jump, Math.abs((y - 100) - (D[i - 1][1] - 100))); });
  assert.ok(worst <= 4 * Math.SQRT2 + 1e-9 && worst > 0.5, `worst ${worst}`);
  assert.ok(jump < 0.4, `neighbour jump ${jump}`);
  const [E] = boil([C], { amp: 4, cell: 60, seed: 't', step: 2 });
  assert.notDeepEqual(D, E, 'a new boil step is a new drawing');
});

test('morph parts: the front view is the front drawing, the side view is the side drawing, the back mirrors', () => {
  const front = ellipse(0, 0, 100, 60, 64), side = ellipse(0, 0, 30, 60, 64), p = { at: [0, 0, 0], front, side };
  const w = C => Math.max(...C.map(q => q[0])) - Math.min(...C.map(q => q[0]));
  assert.ok(Math.abs(w(morphOutline(p, 0)) - 200) < 1);
  assert.ok(Math.abs(w(morphOutline(p, Math.PI / 2)) - 60) < 1);
  assert.ok(Math.abs(w(morphOutline(p, Math.PI)) - 200) < 1);
  assert.equal(resample(front, 32).length, 32);
});

test('a face feature draws in front of its head and is culled from behind', () => {
  const head = { id: 'head', kind: 'morph', at: [0, -100, 0], front: ellipse(0, 0, 80, 100), side: ellipse(0, 0, 80, 100), fill: '#eeccaa' };
  const eye = { id: 'eye', kind: 'morph', at: [0, -110, 80], front: ellipse(0, 0, 20, 20), side: ellipse(0, 0, 5, 20), fill: '#ffffff', clip: 'head' };
  const run = th => drawPuppet(canvas(300, 300, '#000000'), [head, eye], th, stage(150, 260, 1));
  assert.ok(run(0).has('eye')); assert.ok(!run(Math.PI).has('eye'));
});

test('stuck decals stay drawn in a turned view (the lure face at -14 degrees)', () => {
  const ids = place(buildGulp({ expr: { lure: true } }), -14 * Math.PI / 180, stage(500, 1300, 1)).map(s => s.p.id);
  assert.ok(ids.indexOf('lureEye-1') > ids.indexOf('lure') && ids.indexOf('lureEye1') > ids.indexOf('lure'));
  const covs = drawPuppet(canvas(600, 1000, '#000'), buildGulp({ expr: { lure: true } }), -14 * Math.PI / 180, stage(300, 950, 0.6));
  assert.ok(covs.has('lureEye-1') && covs.has('lureEye1'));
});

test('rig: the standing pose keeps its centre of mass over the standing ankle; the jaw glides only past phase 1', () => {
  const r = standing({ u: 6, side: 'R' });
  assert.ok(Math.abs(r.com[0] - r.ankleR[0]) < 1e-6 * 6 + 1e-3, `com ${r.com[0]} ankle ${r.ankleR[0]}`);
  const small = jaw(0.2), big = jaw(0.9);
  assert.equal(small.phase, 1); assert.equal(small.fwd, 0);
  assert.equal(big.phase, 2); assert.ok(big.fwd > 0 && big.drop > small.drop);
  const { elbow, wrist } = ik2([0, 0, 0], [100, 50, 0], 80, 80, [0, 100, -50]);
  assert.ok(Math.abs(Math.hypot(...elbow) - 80) < 1e-6 && Math.abs(Math.hypot(...wrist.map((v, i) => v - [100, 50, 0][i]))) < 1e-6);
});

test('every cast member builds finite geometry at every turnaround view, with six expressions', () => {
  for (const c of CAST) {
    assert.equal(c.expressions.length, 6, c.id);
    for (const [, pose] of c.expressions) for (const d of [0, 45, 90, 135, 180]) for (const s of place(c.build(pose), d * Math.PI / 180, stage(0, 0, 1)))
      assert.ok(s.C.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), `${c.id} ${s.p.id} at ${d}`);
  }
});

test('replacement jitter: same frame repeats, frames differ, knocks stay bounded, a child rides its parent', () => {
  const parts = [{ id: 'a', kind: 'morph', at: [0, 0, 0] }, { id: 'b', kind: 'morph', at: [0, 0, 0], clip: 'a' }];
  const j1 = jitterParts(parts, 5, { amp: 3 }), j1b = jitterParts(parts, 5, { amp: 3 }), j2 = jitterParts(parts, 6, { amp: 3 });
  assert.deepEqual(j1, j1b); assert.notDeepEqual(j1[0].at, j2[0].at);
  assert.ok(Math.abs(j1[0].at[0]) <= 3 && Math.abs(j1[0].at[1]) <= 3);
  assert.ok(Math.abs(j1[1].at[0] - j1[0].at[0]) <= 3 * 0.35 + 1e-9);
  const g = Array.from({ length: 480 }, (_, f) => flicker(f).gain), mean = g.reduce((s, v) => s + v, 0) / g.length, sd = Math.sqrt(g.reduce((s, v) => s + (v - mean) ** 2, 0) / g.length);
  assert.ok(Math.abs(mean - 1) < 0.01 && sd > 0.005 && sd < 0.04, `mean ${mean} sd ${sd}`);
});

test('clay: inside distance peaks at the centre; the key light brightens the upper left more than the lower right', () => {
  const A = coverage([sq(0, 0, 41, 41)], 41, 41), D = insideDistance(A);
  assert.ok(Math.abs(D[20 * 41 + 20] - 21) < 1.5, `centre ${D[20 * 41 + 20]}`);
  const K = canvas(300, 300, '#808080'), B = coverage([ellipse(150, 150, 100, 100, 128)], 300, 300);
  clay({ seed: 't', ridge: 0 })(K, B, null, { id: 'x', kind: 'morph' }, 1);
  const lum = (x, y) => K.px[3 * (y * 300 + x)];
  assert.ok(lum(100, 100) > lum(200, 200) * 1.3, `${lum(100, 100)} vs ${lum(200, 200)}`);
});

test('mumble: one syllable per vowel group, deterministic, level-capped, and the mouth closes between syllables', () => {
  assert.equal(syllables('which one').filter(s => !s.pause).length, 3);
  const a = mumble('which one', { seed: 's' }), b = mumble('which one', { seed: 's' });
  assert.deepEqual(a.pcm, b.pcm);
  assert.ok(Math.max(...a.pcm.map(Math.abs)) <= 0.5 + 1e-6);
  assert.equal(mouthAt(a.syl, 0), 0);
  const s = a.syl[0]; assert.ok(mouthAt(a.syl, (s.t0 + s.t1) / 2) > 0.4);
});

test('a puppet layer is premultiplied: zero alpha and zero light outside the silhouette', () => {
  const L = puppetLayer([{ id: 'b', kind: 'morph', at: [0, -50, 0], front: ellipse(0, 0, 30, 30), side: ellipse(0, 0, 30, 30), fill: '#ff0000' }], 0, stage(100, 150, 1), 200, 200);
  assert.equal(L.a[0], 0); assert.equal(L.px[0], 0);
  assert.ok(L.a[100 * 200 + 100] > 0.99 && L.px[3 * (100 * 200 + 100)] > 0.5);
});

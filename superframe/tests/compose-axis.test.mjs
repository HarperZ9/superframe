// compose-axis.test.mjs: the composition axis and the café wall control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLines } from '../lib/compose/lines.mjs';
import { shuffleDirections } from '../lib/compose/vp.mjs';
import { compositionAxis, contrastMap, grid } from '../lib/compose/axis.mjs';
import { axisScene } from '../lib/compose/plant.mjs';
import { cafeWall, lineAngles } from '../lib/compose/cafewall.mjs';

const d = (a, b, w) => Math.hypot(a[0] - b[0], a[1] - b[1]) / w;

test('P4 slice: anchor within 10% of W of the planted subject on three scenes; shuffled directions lose it', () => {
  let shuffledHits = 0;
  for (const k of [0, 1, 2]) {
    const sc = axisScene(k, { w: 640, h: 360 }); assert.ok(sc, `placement failed for scene ${k}`);
    const segs = detectLines(sc.rgba, sc.w, sc.h), C = contrastMap(sc.rgba, sc.w, sc.h, grid(sc.w, sc.h));
    const a = compositionAxis(sc.rgba, sc.w, sc.h, segs, { contrast: C });
    assert.ok(d(a.anchor, sc.truth.subject, sc.w) <= 0.1, `scene ${k}: anchor ${d(a.anchor, sc.truth.subject, sc.w)}`);
    const s = compositionAxis(sc.rgba, sc.w, sc.h, shuffleDirections(segs, `t${k}`), { contrast: C });
    if (d(s.anchor, sc.truth.subject, sc.w) <= 0.1) shuffledHits++;
  }
  assert.ok(shuffledHits <= 1, `shuffled hits ${shuffledHits} of 3`);
});

test('P4 design check: the planted lamps out-contrast the subject, so contrast alone does not find it', () => {
  const sc = axisScene(0, { w: 640, h: 360 }), a = compositionAxis(sc.rgba, sc.w, sc.h, detectLines(sc.rgba, sc.w, sc.h));
  assert.ok(d(a.contrastOnly, sc.truth.subject, sc.w) > 0.1);
});

test('P5: café wall mortar lines read 0.00 degrees; the strip rotated 1 degree reads 1.00', () => {
  for (const a of [0, 1]) {
    const s = cafeWall(1000, 300, { angleDeg: a }), L = lineAngles(detectLines(s.rgba, s.w, s.h));
    assert.ok(Math.abs(L.angle - a) <= 0.05, `pooled ${L.angle} for ${a}`);
    assert.ok(L.lines.length >= 2 * s.truth.mortarLines, `lines ${L.lines.length}`);
    for (const l of L.lines) assert.ok(Math.abs(l.angle - a) <= 0.05, `line at ${l.offset}: ${l.angle}`);
  }
});

test('P5 resolution: 0.05 degrees apart is read apart', () => {
  const read = a => { const s = cafeWall(1000, 300, { angleDeg: a }); return lineAngles(detectLines(s.rgba, s.w, s.h)).angle; };
  const a = read(0), b = read(0.05);
  assert.ok(Math.abs(b - a - 0.05) < 0.02, `difference ${b - a}`);
});

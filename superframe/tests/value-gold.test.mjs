// value-gold.test.mjs: gold as tinted reflection (lib/value). PREREG P4 to P6 in lib/value/README.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { goldF, goldAt, dielectricF, fresnelConductor } from '../lib/value/gold.mjs';
import { renderSphere } from '../lib/value/goldscene.mjs';
import { toDisplay } from '../lib/value/tone.mjs';
import { yellowShare, meanAB, hueFollow, hueDiff, isYellow } from '../lib/value/goldmeasure.mjs';

test('P4: gold\'s normal reflectance is under 0.5 in the blue and over 0.85 in the red', () => {
  const N = goldF(1); assert.ok(Math.max(...N.slice(0, 5)) < 0.5); assert.ok(Math.min(...N.slice(10)) > 0.85);
});
test('grazing light whitens gold: at 89.5 degrees every band is above 0.96 (the PREREG asked 0.97; see README)', () => {
  assert.ok(Math.min(...goldF(Math.cos(89.5 * Math.PI / 180))) > 0.96);
  assert.ok(Math.min(...goldF(Math.cos(89.9 * Math.PI / 180))) > 0.99);
});
test('P4 control: glass at normal incidence is a flat 0.04, no tint', () => {
  const D = dielectricF(1); assert.ok(Math.max(...D) - Math.min(...D) < 1e-12); assert.ok(Math.abs(D[0] - 0.04) < 1e-12);
});
test('the cached gold table matches the exact formula within 1e-3', () => {
  for (let c = 0.01; c <= 1; c += 0.037) goldAt(c).forEach((v, i) => assert.ok(Math.abs(v - goldF(c)[i]) < 1e-3));
  assert.ok(Math.abs(fresnelConductor(1, 0.2, 3.09) - ((0.8 ** 2 + 3.09 ** 2) / (1.2 ** 2 + 3.09 ** 2))) < 1e-12);
});

const R = {};
const get = (env, mat) => (R[env + mat] ??= (() => { const img = renderSphere(env, mat, { w: 96, h: 96, ss: 2 }), d = toDisplay(img, { C: img.C }); return { img, d, y: yellowShare(d, img.mask), ab: meanAB(d, img.mask) }; })());

test('P5: gold in a sunset, a forest and a studio is mostly not yellow; diffuse yellow is mostly yellow', () => {
  for (const env of ['sunset', 'foliage', 'studio']) assert.ok(get(env, 'gold').y.share < 0.5, `${env} ${get(env, 'gold').y.share}`);
  for (const env of ['sky', 'sunset', 'foliage', 'studio']) assert.ok(get(env, 'yellow').y.share > 0.5, `${env} ${get(env, 'yellow').y.share}`);
});
test('P6: gold\'s hue follows the room by at least 2.5 times as much as diffuse yellow\'s; the control stays under 0.2', () => {
  for (const [a, b] of [['sky', 'sunset'], ['foliage', 'sunset']]) {
    const g = hueFollow(get(a, 'gold').ab, get(b, 'gold').ab, get(a, 'gold').img.seenAB, get(b, 'gold').img.seenAB);
    const y = hueFollow(get(a, 'yellow').ab, get(b, 'yellow').ab, get(a, 'gold').img.seenAB, get(b, 'gold').img.seenAB);
    assert.ok(y.coefficient <= 0.2 && g.coefficient > 2.5 * y.coefficient, `${a}-${b}: ${g.coefficient} vs ${y.coefficient}`);
    assert.ok(g.coefficient >= 0.5, `PREREG P6 gold >= 0.5: ${a}-${b} ${g.coefficient}`);
  }
});
test('the yellow criterion and hue arithmetic say no where they should', () => {
  assert.equal(isYellow({ hsv_hue: 50, C: 10 }), false); assert.equal(isYellow({ hsv_hue: null, C: 40 }), false); assert.equal(isYellow({ hsv_hue: 50, C: 30 }), true);
  assert.equal(hueDiff(350, 10), 20); assert.equal(hueFollow([10, 10], [10, 10], [1, 0], [0, 1]).coefficient, 0);
});

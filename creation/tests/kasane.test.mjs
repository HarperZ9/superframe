// kasane.test.mjs: the same colours and weights in another stacking order is an isomer (the combined picture
// differs while the formula, the colour list and the band weights, is unchanged); exposure shrinks the inner layers
// toward nothing (the per-layer clarity spectrum).
import test from 'node:test';
import assert from 'node:assert/strict';
import { kasane, exposureSpectrum, KASANE_DEMO } from '../lib/gen/kasane.mjs';
import { combine } from '../lib/core/combine.mjs';

test('kasane isomer: reordering the robes changes the picture with the formula unchanged', () => {
  const eq = { bands: [0.2, 0.2, 0.2, 0.2, 0.2] }, A = kasane.create({ ...eq }), B = kasane.create({ ...eq, order: [2, 0, 4, 1, 3] });
  const a = combine([A]).rgb, b = combine([B]).rgb; let d = 0; for (let k = 0; k < a.length; k++) d += Math.abs(a[k] - b[k]);
  assert.ok(d / a.length > 0.01, 'the arrangement shows');
  assert.deepEqual([...A.weights.colours].sort(), [...B.weights.colours].sort());
});
test('exposure spectrum: inner layers narrow as the opening closes', () => {
  const s = exposureSpectrum(), inner = s.map(r => r.share[1]);
  assert.ok(inner[0] > inner.at(-1), JSON.stringify(s));
  assert.equal(s[0].share.length, KASANE_DEMO.colours.length);
});

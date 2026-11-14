// tests/fields.test.mjs: the two forms of every pattern field agree. polys() goes into the font; at() draws live.
// Both are rasterised over one glyph box at 0.25 px per font unit and compared by intersection over union.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, FIELD_NAMES } from '../lib/fields.mjs';
import { fillNonzero } from '../../superframe/lib/fill.mjs';
import { MATERIALS } from '../lib/materials.mjs';

const k = 0.25, box = { x0: 0, x1: 640 }, W = Math.round(640 * k), H = Math.round(1300 * k);
const defaults = (id) => Object.fromEntries(Object.entries(MATERIALS.get(id).params).map(([n, p]) => [n, p.default]));
const P = {
  halftone: defaults('halftone'), engraved: defaults('engraved'), scanline: defaults('scanline'), sand: defaults('sand'),
  ledger: { ...defaults('ledger'), series: [0.1, 0.9, 0.4, 0.7, 0.2] }, ridgeline: { ...defaults('ridgeline'), series: [0.2, 0.8, 0.5, 1, 0] },
};

for (const name of FIELD_NAMES) {
  test(`${name}: font polygons and live coverage agree (IoU)`, () => {
    const F = FIELDS[name], p = P[name], polys = F.polys(p, box).map((poly) => poly.map(([x, y]) => [x * k, (1000 - y) * k]));
    const A = fillNonzero(polys, W, H), B = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) B[y * W + x] = F.at((x + 0.5) / k, 1000 - (y + 0.5) / k, p, 1 / k, box);
    let i = 0, u = 0; for (let j = 0; j < W * H; j++) { const a = A[j] > 0.5, b = B[j] > 0.5; if (a && b) i++; if (a || b) u++; }
    assert.ok(u > 50, 'the field draws something');
    assert.ok(i / u > 0.85, `IoU ${(i / u).toFixed(3)} should exceed 0.85`);
  });
}

test('control: the check fails when the two forms disagree (halftone polygons against engraved coverage)', () => {
  const pH = P.halftone, pE = P.engraved, polys = FIELDS.halftone.polys(pH, box).map((poly) => poly.map(([x, y]) => [x * k, (1000 - y) * k]));
  const A = fillNonzero(polys, W, H); let i = 0, u = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = A[y * W + x] > 0.5, b = FIELDS.engraved.at((x + 0.5) / k, 1000 - (y + 0.5) / k, pE, 1 / k, box) > 0.5; if (a && b) i++; if (a || b) u++; }
  assert.ok(i / u < 0.6, `mismatched IoU ${(i / u).toFixed(3)} stays low`);
});

// rings.test.mjs: Newton's rings from exact Airy theory (lib/medium/rings.mjs), the claims of
// docs/prereg/RINGS-PREREG.md that need no external data.
// Accept: dark centre; dark rings at whole half-wavelengths, bright rings at odd quarter-wavelengths; the obliquity law
// is the secant of the angle in the air. Control: forcing both reflections to one sign brightens the centre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gapReflectance, cosAir } from '../lib/medium/rings.mjs';

const nG = 1.5175, L = 571;
const R = (d, cg = 1, o = {}) => gapReflectance(d, L, { nGlass: nG, cosGlass: cg, ...o }).u;

test('the centre is dark, dark rings sit at m lambda / 2 and bright rings at (2m - 1) lambda / 4', () => {
  assert.ok(R(0) < 1e-12);
  for (const m of [1, 2, 3]) assert.ok(R(m * L / 2) < 1e-12, `dark ${m}`);
  for (const m of [1, 2, 3]) { const b = (2 * m - 1) * L / 4; assert.ok(R(b) > R(b - 15) && R(b) > R(b + 15), `bright ${m}`); }
});

test('the thickness of a given ring grows as the secant of the angle in the air, below the critical angle', () => {
  for (const a of [20, 45, 70, 85]) {
    const sa = Math.sin(a * Math.PI / 180), cg = Math.sqrt(1 - (sa / nG) ** 2), ca = cosAir(nG, cg);
    assert.ok(Math.abs(ca - Math.cos(a * Math.PI / 180)) < 1e-12);
    assert.ok(R(L / (2 * ca), cg) < 1e-12, `first dark at ${a} deg`);
  }
});

test('control: without the half-wave sign flip the centre is bright, not dark', () => {
  assert.ok(R(0, 1, { sameSign: true }) > 0.1);
  assert.ok(R(L / 4, 1, { sameSign: true }) < 1e-12);
});

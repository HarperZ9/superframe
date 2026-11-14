// Optics: the catalogue pair is honoured exactly, Snell and Fresnel behave at their known points.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cauchy, iorAt, channelIor, fresnel, fresnelP, schlick, refract, slabOffset, GLASSES, LINES } from '../lib/optics.js';

test('Cauchy fit reproduces n_d and V_d for every catalogue glass', () => {
  for (const [name, g] of Object.entries(GLASSES)) {
    const nd = iorAt(LINES.d, g.nd, g.vd), nF = iorAt(LINES.F, g.nd, g.vd), nC = iorAt(LINES.C, g.nd, g.vd);
    assert.ok(Math.abs(nd - g.nd) < 1e-12, `${name} n_d`);
    assert.ok(Math.abs((nd - 1) / (nF - nC) - g.vd) < 1e-9, `${name} V_d`);
  }
  assert.throws(() => cauchy(0.9, 50), RangeError);
});

test('per-channel index: blue bends more than red; spread 0 removes dispersion; dense flint fringes more than crown', () => {
  const [r, g, b] = channelIor('crown');
  assert.ok(b > g && g > r);
  const z = channelIor('crown', 0); assert.equal(z[0], z[1]); assert.equal(z[2], z[1]);
  const c = channelIor('crown'), f = channelIor('dense'); assert.ok(f[2] - f[0] > 2.5 * (c[2] - c[0]));
});

test('Fresnel: normal incidence, Brewster angle, total internal reflection, Schlick equal at normal', () => {
  const n = 1.5168, r0 = ((n - 1) / (n + 1)) ** 2;
  assert.ok(Math.abs(fresnel(1, 1, n) - r0) < 1e-12);
  assert.ok(fresnelP(Math.cos(Math.atan(n)), 1, n) < 1e-12);
  assert.equal(fresnel(Math.cos(Math.asin(1 / n) + 0.01), n, 1), 1);
  assert.ok(Math.abs(schlick(1, 1, n) - r0) < 1e-12);
  assert.ok(fresnel(0.05, 1, n) > 0.7, 'grazing light mostly reflects');
});

test('refract obeys Snell; a flat slab shifts nothing; a tilted face bends the view toward the thick side; more gap, more shift', () => {
  const th = 0.4, I = [Math.sin(th), 0, -Math.cos(th)], T = refract(I, [0, 0, 1], 1 / 1.5);
  assert.ok(Math.abs(Math.hypot(T[0], T[1]) - Math.sin(th) / 1.5) < 1e-12);
  assert.equal(refract([Math.sin(1.2), 0, -Math.cos(1.2)], [0, 0, 1], 1.5), null, 'TIR from glass to air');
  const flat = slabOffset([0, 0, 1], 1.5, 40, 100); assert.ok(Math.abs(flat.dx) < 1e-12 && Math.abs(flat.dy) < 1e-12);
  const N = [Math.sin(0.2), 0, Math.cos(0.2)], s = slabOffset(N, 1.5, 40, 100);
  assert.ok(s.dx < 0, 'a face whose normal tilts to +x is thicker toward -x, and the ray bends toward the thick side');
  assert.ok(slabOffset(N, 1.5, 40, 200).dx < s.dx);
});

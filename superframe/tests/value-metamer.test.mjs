// value-metamer.test.mjs: the illuminant-swap view (lib/value/metamer.mjs). PREREG P7 in lib/value/README.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { metamerPair, rgbRelight, dEUnder, blackbody, blackbodySweep } from '../lib/value/metamer.mjs';
import { metamerImage } from '../lib/value/plates2.mjs';
import { ILLUMINANTS } from '../lib/medium/spectral.mjs';

const P = ['#7a8a5a', '#b08a6e'].map(h => metamerPair(h, { n: 32 }));
test('P7: each pair matches under D65 within dE 0.5 and splits under A by more than 4', () => {
  for (const p of P) { assert.ok(p.d65 < 0.5, `${p.hex} ${p.d65}`); assert.ok(p.A > 4, `${p.hex} ${p.A}`); }
});
test('P7 controls: one spectrum twice never splits; an RGB engine cannot split the pair', () => {
  for (const p of P) { assert.equal(dEUnder(p.a, p.a.slice(), 'A'), 0); assert.ok(rgbRelight(p, 'A') < 0.5); assert.ok(rgbRelight(p, 'candle') < 0.5); }
});
test('the painted figure is invisible on screen under D65 and visible under A', () => {
  for (const p of P) { assert.ok(metamerImage(p, 'D65', 32, 20).dE8 < 0.5); assert.ok(metamerImage(p, 'A', 32, 20).dE8 > 4); }
});
test('blackbody at 2856 K is illuminant A, and the split grows away from daylight', () => {
  blackbody(2856).forEach((v, i) => assert.ok(Math.abs(v - ILLUMINANTS.A[i]) / ILLUMINANTS.A[i] < 1e-9));
  const s = blackbodySweep(P[0], { steps: 9 }); assert.ok(s[0].dE > s[4].dE && s[8].dE > s[4].dE);
});
test('the smoothest splitting pair is smoother than the extreme pair', () => {
  const r = R => R.reduce((s, v, i) => (i ? s + (v - R[i - 1]) ** 2 : 0), 0);
  for (const p of P) { assert.ok(p.gentle && p.gentle.A > 4); assert.ok(p.gentle.rough <= Math.max(r(p.a), r(p.b))); }
});

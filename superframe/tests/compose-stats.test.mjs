// Prior update PU30-04 (F91 C5): exact interval and bound rule in lib/compose/stats.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { exactInterval, boundViolations, twoSigma, rng } from '../lib/compose/stats.mjs';

test('exact interval: known Clopper-Pearson values and edge cases', () => {
  const [lo, hi] = exactInterval(8, 40);
  assert.ok(Math.abs(lo - 0.0905) < 1e-3 && Math.abs(hi - 0.3565) < 1e-3, `${lo} ${hi}`);
  assert.deepEqual(exactInterval(0, 10).map(v => +v.toFixed(4)), [0, 0.3085]);
  assert.equal(exactInterval(10, 10)[1], 1);
});

test('exact interval covers at least nominally where the Wald half-width does not (p 0.05, n 20)', () => {
  const p = 0.05, n = 20, r = rng('pu30-04'); let cover = 0, wald = 0; const R = 2000;
  for (let i = 0; i < R; i++) {
    let k = 0; for (let j = 0; j < n; j++) k += r() < p;
    const [lo, hi] = exactInterval(k, n); if (lo <= p && p <= hi) cover++;
    const ph = k / n, h = twoSigma(ph, n); if (ph - h <= p && p <= ph + h) wald++;
  }
  assert.ok(cover / R >= 0.94, `exact ${cover / R}`);
  assert.ok(wald / R < 0.9, `wald ${wald / R}`);
});

test('bound rule: all-null family stays near alpha, a clear exceedance is flagged', () => {
  const r = rng('pu30-04-holm'); let any = 0; const F = 200;
  for (let f = 0; f < F; f++) {
    const tests = Array.from({ length: 30 }, () => { let k = 0; for (let j = 0; j < 300; j++) k += r() < 0.3; return [k, 300, 0.3]; });
    if (boundViolations(tests).flags.some(Boolean)) any++;
  }
  assert.ok(any / F <= 0.09, `family rate ${any / F}`);
  assert.deepEqual(boundViolations([[80, 100, 0.5], [50, 100, 0.5], [3, 3, 1]]).flags, [true, false, false]);
});

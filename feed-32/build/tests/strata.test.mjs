import test from 'node:test';
import assert from 'node:assert/strict';
import { sequence, primesBelow, spfSieve } from '../sequences.mjs';
import { decompose, smallestDivisorAbove, coords, render, tally, camera } from '../strata.mjs';

test('sequences are strictly increasing integers', () => {
  for (const name of ['primes', 'naturals', 'squares', 'cubes', 'triangular', 'evil', 'odious', 'palindromes', 'semiprimes', 'primeSquares']) {
    const s = sequence(name, 500);
    assert.equal(s.length, 500, name);
    for (let i = 1; i < s.length; i++) { assert.ok(s[i] > s[i - 1], `${name} at ${i}`); assert.ok(Number.isInteger(s[i]), name); }
  }
  assert.deepEqual([...sequence('primes', 10)], [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  assert.deepEqual([...sequence('semiprimes', 8)], [4, 6, 9, 10, 14, 15, 21, 22]);
  assert.deepEqual([...sequence('evil', 6)], [0, 3, 5, 6, 9, 10]);
});

test('primes below 1e6: 78,498 (known count)', () => assert.equal(primesBelow(1e6).length, 78498));

test('smallest divisor above d, both paths agree', () => {
  const spf = spfSieve(5000);
  for (let m = 1; m < 5000; m += 7) for (const d of [1, 2, 4, 6, 10, 30]) {
    let want = 0; for (let k = d + 1; k <= m; k++) if (m % k === 0) { want = k; break; }
    assert.equal(smallestDivisorAbove(m, d, spf), want, `m ${m} d ${d}`);
    assert.equal(smallestDivisorAbove(m, d, null), want, `trial m ${m} d ${d}`);
  }
});

test('every decomposed term satisfies a = k L + d with k > d and k the smallest such divisor', () => {
  const s = sequence('primes', 20000), D = decompose(s);
  for (let i = 0; i < D.n; i++) {
    if (!D.ok[i]) continue;
    assert.equal(D.k[i] * D.L[i] + D.d[i], s[i]);
    assert.ok(D.k[i] > D.d[i]);
  }
  // known small cases worked by hand: 5 = 3*1 + 2, 11 = 3*3 + 2, 7 -> m = 3 <= d = 4, undecomposable
  assert.deepEqual([D.k[2], D.L[2], D.d[2]], [3, 1, 2]);
  assert.deepEqual([D.k[4], D.L[4], D.d[4]], [3, 3, 2]);
  assert.equal(D.ok[3], 0);
  assert.equal(D.ok[D.n - 1], 0, 'the last term has no jump');
});

test('weight 3 among primes is exactly the lower twin primes above 3 (the caption property)', () => {
  const s = primesBelow(1e6), D = decompose(s), T = tally(D, 'weight3');
  let twins = 0; for (let i = 0; i + 1 < s.length; i++) if (s[i + 1] - s[i] === 2 && s[i] > 3) twins++;
  for (let i = 0; i + 1 < s.length; i++) assert.equal(Boolean(D.ok[i] && D.k[i] === 3), s[i + 1] - s[i] === 2 && s[i] > 3, `p ${s[i]}`);
  assert.equal(T.hot, twins);
  assert.equal(twins + 1, 8169, 'twin pairs below 1e6, (3,5) included, is 8169');
  assert.equal(T.status, 'conjecture');
});

test('level 1 on the counting numbers is n - 1 prime', () => {
  const s = sequence('naturals', 3000), D = decompose(s), spf = spfSieve(3001);
  for (let i = 0; i + 1 < s.length; i++) if (D.ok[i]) assert.equal(D.L[i] === 1, spf[s[i] - 1] === s[i] - 1, `n ${s[i]}`);
});

test('coordinates stay in the unit cube', () => {
  const s = sequence('squares', 5000), D = decompose(s), P = coords(D, s[s.length - 1]);
  for (let i = 0; i < D.n; i++) if (D.ok[i]) for (let c = 0; c < 3; c++) { const v = P[3 * i + c]; assert.ok(v >= 0 && v <= 1.0001, `${i}:${c} ${v}`); }
});

test('camera maps the cube centre to the frame centre', () => {
  const [x, y] = camera(800, 600, { yaw: 0.7, pitch: 0.3, persp: 0.2 })(0.5, 0.5, 0.5);
  assert.ok(Math.abs(x - 400) < 1e-9 && Math.abs(y - 300) < 1e-9);
});

test('render is deterministic and the hot line is drawn in the hot ink', () => {
  const s = sequence('primes', 30000), D = decompose(s), args = { w: 320, h: 320, D, A: s[s.length - 1], hot: 'weight3', yaw: -0.6, pitch: 0.35, persp: 0.18 };
  const a = render(args), b = render(args);
  assert.deepEqual(a.px, b.px);
  let hotPx = 0; for (let i = 0; i < 320 * 320; i++) { const r = a.px[3 * i], g = a.px[3 * i + 1], bb = a.px[3 * i + 2]; if (r > 0.3 && r > 2.5 * g && r > 4 * bb) hotPx++; }
  assert.ok(hotPx > 40, `hot pixels ${hotPx}`);
  const c = render({ ...args, hot: null }); let hot2 = 0;
  for (let i = 0; i < 320 * 320; i++) { const r = c.px[3 * i], g = c.px[3 * i + 1], bb = c.px[3 * i + 2]; if (r > 0.3 && r > 2.5 * g && r > 4 * bb) hot2++; }
  assert.equal(hot2, 0, 'no hot ink without a hot line');
});

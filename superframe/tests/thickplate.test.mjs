// thickplate.test.mjs: Newton's thick-plate rings (lib/medium/thickplate.mjs) against his Opticks II.4 measurements,
// with his own control. Claims of docs/prereg/THICKPLATE-PREREG.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ringDiameter, intensity } from '../lib/medium/thickplate.mjs';

const LAMBDA = 2 * 25.4e6 / 89000, N = 17 / 11, L = 72, rel = (a, b) => Math.abs(a - b) / b;

test('the quarter-inch plate: bright and dark ring diameters at six feet match Newton within 1.5% and 2%', () => {
  [1.6875, 2.375, 2 + 11 / 12, 3.375].forEach((m, i) => assert.ok(rel(ringDiameter(i + 1, 0.25, N, LAMBDA, L), m) < 0.015));
  [1 + 3 / 16, 2 + 1 / 16, 2 + 2 / 3, 3.15].forEach((m, i) => assert.ok(rel(ringDiameter(i + 0.5, 0.25, N, LAMBDA, L), m) < 0.02));
});

test('the 5/62-inch plate: rings grow as one over the square root of thickness, as measured', () => {
  [3, 4 + 1 / 6, 5.125].forEach((m, i) => assert.ok(rel(ringDiameter(i + 1, 5 / 62, N, LAMBDA, L), m) < 0.02));
});

test('the centre is the white spot Newton saw', () => assert.ok(intensity(0, 0.25, N, LAMBDA) > 3.999));

test('control: a metal speculum (one surface) makes no rings, Newton\'s own control', () => {
  const I = []; for (let a = 0; a < 0.05; a += 1e-4) I.push(intensity(a, 0.25, N, LAMBDA, { a1: 0 }));
  assert.equal(Math.max(...I) - Math.min(...I), 0);
});

test('control: without the glass index the rings miss by about 19%', () => {
  const d = 2 * L * Math.tan(Math.sqrt(LAMBDA / (0.25 * 25.4e6)));
  assert.ok(rel(d, 1.6875) > 0.15);
});

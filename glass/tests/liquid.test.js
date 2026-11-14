// Water: the stability bound, wave speed equal to the Courant number, stiffness makes short waves lead, obstacles hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Water } from '../liquid.js';

const lead = (W, thr) => { for (let x = W.nx - 1; x > W.nx / 2; x--) if (Math.abs(W.u[(W.ny / 2) * W.nx + x]) > thr) return x - W.nx / 2; return 0; };
const peak = W => { let r = 0, best = 0; for (let x = W.nx / 2; x < W.nx; x++) { const v = Math.abs(W.u[(W.ny / 2) * W.nx + x]); if (v > best) { best = v; r = x - W.nx / 2; } } return r; };

test('the stability bound is enforced', () => {
  assert.throws(() => new Water({ courant: 0.8 }), RangeError);
  assert.ok(new Water({ courant: 0.7 }));
});

test('a ring travels at the Courant number in cells per step (within 8%)', () => {
  const W = new Water({ nx: 256, ny: 256, courant: 0.5, damping: 0, edge: 'absorb' });
  W.drop(128, 128, 3, -1).step(160);
  const r = peak(W); assert.ok(Math.abs(r - 80) / 80 < 0.08, `front at ${r} cells, expected 80`);
});

// One standing mode cos(k x) on a periodic strip: count its period and compare with the discrete dispersion relation
// cos(w) = 1 - (C^2 L + K L^2) / 2, L = 4 sin^2(k / 2). Returns the measured phase speed w / k.
function phaseSpeed(K, waves, n = 256) {
  const W = new Water({ nx: n, ny: 4, courant: 0.45, damping: 0, stiffness: K }), k = 2 * Math.PI * waves / n;
  for (let y = 0; y < 4; y++) for (let x = 0; x < n; x++) { W.u[y * n + x] = Math.cos(k * x); W.p[y * n + x] = Math.cos(k * x); }
  const L = 4 * Math.sin(k / 2) ** 2, w = Math.acos(1 - (0.45 ** 2 * L + K * L * L) / 2);
  // first-step correction so the mode starts at rest: u_prev = u * cos(w)
  for (let i = 0; i < W.p.length; i++) W.p[i] = W.u[i] * Math.cos(w);
  let cross = [], last = W.u[0];
  for (let s = 1; s < 4000 && cross.length < 12; s++) { W.step(1); const v = W.u[0]; if ((last > 0) !== (v > 0)) cross.push(s - 1 + last / (last - v)); last = v; }
  const period = 2 * (cross[cross.length - 1] - cross[0]) / (cross.length - 1);
  return { measured: (2 * Math.PI / period) / k, theory: w / k };
}

test('dispersion: the grid follows its relation; stiffness makes short ripples faster than long ones', () => {
  for (const K of [0, 0.02]) for (const waves of [4, 64]) {
    const { measured, theory } = phaseSpeed(K, waves);
    assert.ok(Math.abs(measured - theory) / theory < 0.01, `K ${K}, ${waves} waves: ${measured} against ${theory}`);
  }
  assert.ok(phaseSpeed(0.02, 64).measured > phaseSpeed(0.02, 4).measured, 'capillary-like: short waves lead');
  assert.ok(phaseSpeed(0, 64).measured <= phaseSpeed(0, 4).measured, 'the plain grid has slight numerical lag on short waves');
});

test('damping drains energy; solid cells stay still; a seed repeats exactly', () => {
  const W = new Water({ nx: 64, ny: 64, damping: 0.02, seed: 4 }); W.rain(10).step(5);
  const e0 = W.energy(); W.step(200); assert.ok(W.energy() < 0.2 * e0);
  const S = new Water({ nx: 64, ny: 64, seed: 4 }).block(x => x === 32); S.rain(10).step(50);
  for (let y = 0; y < 64; y++) assert.equal(S.u[y * 64 + 32], 0);
  const a = new Water({ nx: 32, ny: 32, seed: 9 }).rain(5).step(20), b = new Water({ nx: 32, ny: 32, seed: 9 }).rain(5).step(20);
  assert.deepEqual(Array.from(a.u), Array.from(b.u));
});

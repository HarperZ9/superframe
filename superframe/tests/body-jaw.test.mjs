// body-jaw.test.mjs: lib/body/jaw.mjs and lib/body/fit.mjs against the PREREG (J1 to J4, control C2, noise floor).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JAW, K_TWO_PHASE, jawPose, opening, incisorPath, alphaFor, couplingFor, neckClearance } from '../lib/body/jaw.mjs';
import { fitCircle, findBreak } from '../lib/body/fit.mjs';
import { rngFrom } from '../lib/seed.mjs';
import { jittered } from '../lib/body/measure.mjs';

const k = K_TWO_PHASE;

test('the coupling lands full condyle travel at 50 mm of opening', () => {
  const a = alphaFor(50, k), p = jawPose(a, k);
  assert.ok(Math.abs(p.s - JAW.travel) < 1e-6, `travel ${p.s}`);
  assert.ok(Math.abs(opening(p) - 50) < 1e-6);
});

test('J1: phase 1 lies on one circle about the condyle', () => {
  const f = fitCircle(incisorPath(k, { to: opening(jawPose(JAW.alpha1, k)) }));
  assert.ok(f.rms < 0.01, `rms ${f.rms}`);
  assert.ok(Math.hypot(f.cx, f.cy) < 0.1, `centre ${f.cx}, ${f.cy}`);
});

test('J2 (failed as preregistered): a free-centre circle absorbs most of phase 2; RMS is 0.1 to 1 mm, not over 1', () => {
  const f = fitCircle(incisorPath(k));
  assert.ok(f.rms > 0.1 && f.rms < 1, `rms ${f.rms}`);
});

for (const a1 of [12, 8]) test(`J3 planted answer: the detector recovers a phase break planted at ${a1} degrees within 0.5 mm`, () => {
  const J = { ...JAW, alpha1: a1 }, kk = couplingFor(J), truth = opening(jawPose(a1, kk, J), J), b = findBreak(incisorPath(kk, { J }));
  assert.ok(b, 'a break was found');
  assert.ok(Math.abs(b.opening - truth) <= 0.5, `found ${b.opening}, planted ${truth}`);
});

test('J4: the two-phase jaw opens 50 mm with the chin in front of the neck line', () => {
  const c = neckClearance(jawPose(alphaFor(50, k), k));
  assert.ok(c > 0, `clearance ${c}`);
});

test('control C2 (must fail): a pure hinge stays on one circle and swings the chin into the neck', () => {
  const path = incisorPath(0);
  assert.ok(fitCircle(path).max < 0.01);
  assert.equal(findBreak(path), null);
  const c = neckClearance(jawPose(alphaFor(50, 0), 0));
  assert.ok(c < 0, `clearance ${c}`);
});


test('noise floor: 0.1 mm jitter on a hinge path gives no break at a 5 sigma tolerance', () => {
  assert.equal(findBreak(jittered(incisorPath(0), 0.1), { tol: 0.5 }), null);
});

test('structureless control: scattered points give a break at the first prefix', () => {
  const rng = rngFrom('body/jaw-scatter'), pts = Array.from({ length: 60 }, () => [100 * rng(), 100 * rng()]);
  const b = findBreak(pts, { tol: 0.5 });
  assert.ok(b && b.index <= 6);
});

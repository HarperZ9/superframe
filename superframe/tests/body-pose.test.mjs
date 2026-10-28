// body-pose.test.mjs: lib/body/pose.mjs against the PREREG (P1, controls C3, C4, C5 and the level stance).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPose, checkStance, poseSet, centreOfMass, SEGMENTS, FOOT_HALF_CM } from '../lib/body/pose.mjs';
import { shuffledAgreement } from '../lib/body/measure.mjs';
import { rngFrom } from '../lib/seed.mjs';

const share = (set, pred) => set.filter(x => pred(checkStance(x.pose))).length / set.length;

test('segment fractions sum to one; the solved pose puts the centre of mass on the support ankle', () => {
  assert.ok(Math.abs(SEGMENTS.reduce((a, s) => a + s[0], 0) - 1) < 1e-9);
  for (const side of ['L', 'R']) assert.ok(Math.abs(centreOfMass(buildPose({ side }))[0]) < 1e-8);
});

test('emergent plumb line: with the centre of mass solved, the neck sits within 3 cm over the support ankle', () => {
  for (const side of ['L', 'R']) assert.ok(Math.abs(buildPose({ side }).neck[0]) < 3);
});

test('P1: at least 90 percent of generated contrapposto poses classify as contrapposto over the support foot', () => {
  const s = share(poseSet('contrapposto'), r => r.cls === 'contrapposto' && r.offset <= FOOT_HALF_CM);
  assert.ok(s >= 0.9, `share ${s}`);
});

test('control C3 (failed as preregistered at 99 percent): same-direction poses are flagged 98.5 percent of the time', () => {
  const s = share(poseSet('same'), r => r.cls === 'same-direction');
  assert.ok(s >= 0.98 && s < 0.99, `share ${s}`);
  assert.equal(share(poseSet('same'), r => r.cls === 'contrapposto'), 0, 'never accepted as contrapposto');
});

test('control C4 (must fail): centre of mass 8 to 14 cm outside the support ankle is flagged off-support', () => {
  assert.ok(share(poseSet('off'), r => r.cls === 'off-support') >= 0.99);
});


test('shuffled control C5: agreement with shuffled labels sits between 40 and 60 percent', () => {
  const a = shuffledAgreement();
  assert.ok(a >= 0.4 && a <= 0.6, `agreement ${a}`);
});

test('structureless control: a level symmetric stance is level, never contrapposto', () => {
  const r = checkStance(buildPose({ side: 'L', pelvisDeg: 0, shoulderDeg: 0 }));
  assert.equal(r.cls, 'level');
});

test('the support hip is the high hip in every generated contrapposto pose without jitter', () => {
  for (const side of ['L', 'R']) assert.ok(checkStance(buildPose({ side, pelvisDeg: 5, shoulderDeg: side === 'L' ? -4 : 4 })).hipHighOnSupport);
});

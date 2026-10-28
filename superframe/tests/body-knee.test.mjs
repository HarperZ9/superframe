// body-knee.test.mjs: lib/body/knee.mjs against the PREREG in lib/body/README.md (K1 to K5, control C1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { axialRange, footVsKneecap, aimFoot, aimFootHinge, checkLeg, cordStretch, screwHome, makeCords, LOCK_GATE_DEG } from '../lib/body/knee.mjs';
import { worstLockDeviation, plantedLegSet } from '../lib/body/measure.mjs';


test('K1: the cords lock axial turn at full extension and hold the foot within 2 degrees under 5 degrees of flexion', () => {
  const r0 = axialRange(0);
  assert.ok(r0.outward <= 1e-6 && r0.inward <= 1e-6, `range at 0: ${r0.outward} / ${r0.inward}`);
  const w = worstLockDeviation();
  assert.ok(w <= LOCK_GATE_DEG, `worst ${w}`);
  assert.ok(w > 0.5, 'the coupled unwind is part of the deviation, so the worst case is not trivially zero');
});

test('the cords are at rest length at extension and slacken with flexion (collinear rule)', () => {
  for (const s of cordStretch(0, 0)) assert.ok(Math.abs(s.stretch) < 1e-9, s.id);
  for (const f of [10, 45, 90]) for (const s of cordStretch(f, 0)) assert.ok(s.stretch < 0, `${s.id} at ${f}`);
});

test('K2: the range grows monotonically to 90 degrees; total at 90 is the calibration target 30 to 60', () => {
  let prev = -1;
  for (let f = 0; f <= 90; f += 5) { const t = axialRange(f).total; assert.ok(t >= prev - 1e-9, `at ${f}`); prev = t; }
  assert.ok(prev >= 30 && prev <= 60, `total at 90: ${prev}`);
});

test('K3: collaterals bind outward turn, cruciates bind inward turn', () => {
  const fam = id => (id === 'mcl' || id === 'lcl' ? 'collateral' : 'cruciate');
  for (const f of [30, 60, 90]) {
    const r = axialRange(f);
    assert.equal(fam(r.outwardCord), 'collateral', `outward at ${f}: ${r.outwardCord}`);
    assert.equal(fam(r.inwardCord), 'cruciate', `inward at ${f}: ${r.inwardCord}`);
  }
});

test('K4: a straight-leg foot turn goes to the hip; a bent knee carries part of it', () => {
  for (const t of [30, -30]) { const a = aimFoot(t, 0); assert.ok(Math.abs(a.hip - t) <= 2, `hip ${a.hip}`); assert.ok(a.reachable); }
  const b = aimFoot(30, 90);
  assert.ok(b.knee >= 10, `knee carries ${b.knee}`);
  assert.ok(Math.abs(b.reached - 30) < 1e-9);
});


test('K5 planted answer: the checker flags exactly the six planted straight-leg twists', () => {
  const set = plantedLegSet(), flagged = set.map(p => !checkLeg(p).ok);
  assert.deepEqual(flagged, set.map(p => p.planted));
  for (const p of set.filter(q => q.planted)) assert.ok(checkLeg(p).flags.includes('lock'));
});

test('control C1 (must fail): a plain hinge with a free twist channel puts a 30 degree turn through the straight shin', () => {
  const a = aimFootHinge(30), c = checkLeg({ flex: 0, hip: a.hip, foot: a.reached });
  assert.ok(!c.ok && c.flags.includes('lock'));
  assert.ok(Math.abs(c.dev - 30) < 1e-9);
});

test('screw-home path: 10 degrees outward at extension, gone by 30 degrees, monotone', () => {
  assert.equal(screwHome(0), 10); assert.equal(screwHome(30), 0); assert.equal(screwHome(60), 0);
  for (let f = 0; f < 30; f += 1) assert.ok(screwHome(f + 1) <= screwHome(f));
});

test('false-accept control: cords 0.5 mm lax (a loose ligament) unlock the straight knee and fail the gate', () => {
  const lax = makeCords(undefined, { laxMm: 0.5 }), r = axialRange(0, lax);
  assert.ok(r.outward > LOCK_GATE_DEG && r.inward > LOCK_GATE_DEG, `lax range ${r.outward} / ${r.inward}`);
  const pose = { flex: 0, hip: 0, foot: r.outward };
  assert.ok(checkLeg(pose, { cords: lax }).flags.includes('lock'), 'the lock gate still catches the pose the lax cords allow');
  assert.ok(!checkLeg(pose, { cords: lax }).flags.includes('cord'), 'the lax cords themselves accept it');
});

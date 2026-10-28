// body-spec.mjs: measure every lib/body PREREG quantity and write the spec sheet numbers to JSON.
//   node tools/body-spec.mjs [out.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { axialRange, aimFoot, aimFootHinge, checkLeg, makeCords } from '../lib/body/knee.mjs';
import { JAW, K_TWO_PHASE as k, jawPose, opening, incisorPath, alphaFor, couplingFor, neckClearance } from '../lib/body/jaw.mjs';
import { fitCircle, findBreak } from '../lib/body/fit.mjs';
import { checkStance, poseSet, buildPose } from '../lib/body/pose.mjs';
import { worstLockDeviation, plantedLegSet, jittered, shuffledAgreement } from '../lib/body/measure.mjs';

const OUT = process.argv[2] ?? 'out/body/spec.json', r6 = v => Math.round(v * 1e6) / 1e6;
const share = (kind, pred) => { const s = poseSet(kind); return s.filter(x => pred(checkStance(x.pose))).length / s.length; };
const planted = a1 => { const J = { ...JAW, alpha1: a1 }, kk = couplingFor(J); return { planted: opening(jawPose(a1, kk, J), J), found: findBreak(incisorPath(kk, { J })).opening }; };
const laxRange = l => axialRange(0, makeCords(undefined, { laxMm: l }));
const knee = {
  K1_range_at_0: axialRange(0), K1_worst_dev_under_5: worstLockDeviation(),
  K2_range_by_flex: Object.fromEntries([5, 10, 30, 60, 90, 120].map(f => [f, axialRange(f)])),
  K4: { straight_plus30: aimFoot(30, 0), straight_minus30: aimFoot(-30, 0), bent90_plus30: aimFoot(30, 90) },
  K5_flags: plantedLegSet().map(p => ({ planted: p.planted, flags: checkLeg(p).flags })),
  C1_hinge: checkLeg({ flex: 0, ...(({ hip, reached }) => ({ hip, foot: reached }))(aimFootHinge(30)) }),
  lax_control: Object.fromEntries([0.25, 0.5, 1].map(l => [l, laxRange(l)])),
};
const jaw = {
  coupling_mm_per_deg: k, alpha_at_50_two_phase: alphaFor(50, k), alpha_at_50_hinge: alphaFor(50, 0),
  J1: fitCircle(incisorPath(k, { to: opening(jawPose(JAW.alpha1, k)) })), J2: fitCircle(incisorPath(k)),
  J3: { a12: planted(12), a8: planted(8), a10_1_post_hoc: planted(10.1) },
  J4_clearance: neckClearance(jawPose(alphaFor(50, k), k)),
  C2: { max_residual: fitCircle(incisorPath(0)).max, break: findBreak(incisorPath(0)), clearance: neckClearance(jawPose(alphaFor(50, 0), 0)) },
  noise: Object.fromEntries([0.05, 0.1, 0.2].map(s => [s, findBreak(jittered(incisorPath(0), s), { tol: 5 * s })])),
};
const pose = {
  P1: share('contrapposto', r => r.cls === 'contrapposto' && r.offset <= 4.5), C3: share('same', r => r.cls === 'same-direction'),
  C3_accepted_as_contrapposto: share('same', r => r.cls === 'contrapposto'), C4: share('off', r => r.cls === 'off-support'),
  C5_shuffled_agreement: shuffledAgreement(), level: checkStance(buildPose({ side: 'L', pelvisDeg: 0, shoulderDeg: 0 })).cls,
};
const round = o => JSON.parse(JSON.stringify(o, (key, v) => (typeof v === 'number' ? r6(v) : v)));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(round({ schema: 'superframe.body-spec/1', date: '2026-10-28', knee, jaw, pose }), null, 1));
console.log(OUT);

// pose.mjs: the contrapposto checker and a physics-built pose generator, frontal view in centimetres (+x to the
// figure's left as we see it, +y up, ground at y = 0). The centre of mass comes from segment mass fractions and
// segment centre positions (Winter's anthropometric table, from memory, moderate confidence).
import { rngFrom } from '../seed.mjs';

const RAD = Math.PI / 180;
export const FOOT_HALF_CM = 4.5, TILT_MIN_DEG = 1;
// [fraction of body mass, from point, to point, centre at this share of the way]
export const SEGMENTS = [
  [0.081, 'neck', 'head', 0.5], [0.497, 'hipMid', 'neck', 0.5],
  [0.028, 'shoulderL', 'elbowL', 0.436], [0.028, 'shoulderR', 'elbowR', 0.436],
  [0.022, 'elbowL', 'wristL', 0.682], [0.022, 'elbowR', 'wristR', 0.682],
  [0.100, 'hipL', 'kneeL', 0.433], [0.100, 'hipR', 'kneeR', 0.433],
  [0.0465, 'kneeL', 'ankleL', 0.433], [0.0465, 'kneeR', 'ankleR', 0.433],
  [0.0145, 'ankleL', 'ankleL', 0], [0.0145, 'ankleR', 'ankleR', 0],
];

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export function centreOfMass(P) {
  const Q = { ...P, hipMid: mid(P.hipL, P.hipR) };
  let x = 0, y = 0, m = 0;
  for (const [f, a, b, t] of SEGMENTS) { x += f * (Q[a][0] + t * (Q[b][0] - Q[a][0])); y += f * (Q[a][1] + t * (Q[b][1] - Q[a][1])); m += f; }
  return [x / m, y / m];
}

// Tilt of a girdle line, degrees, positive when the figure's left end (L) is higher.
const tilt = (L, R) => Math.atan2(L[1] - R[1], L[0] - R[0] === 0 ? 1e-9 : Math.abs(L[0] - R[0])) / RAD;

// Classes: contrapposto | same-direction (flag) | off-support (flag) | level.
export function checkStance(P, { tiltMin = TILT_MIN_DEG, footHalf = FOOT_HALF_CM } = {}) {
  const shoulder = tilt(P.shoulderL, P.shoulderR), pelvis = tilt(P.hipL, P.hipR), com = centreOfMass(P);
  const dL = Math.abs(com[0] - P.ankleL[0]), dR = Math.abs(com[0] - P.ankleR[0]), support = dL <= dR ? 'L' : 'R';
  const offset = Math.min(dL, dR), over = offset <= footHalf, tilted = Math.abs(shoulder) >= tiltMin && Math.abs(pelvis) >= tiltMin;
  const counter = tilted && Math.sign(shoulder) !== Math.sign(pelvis);
  const hipHighOnSupport = (support === 'L') === (pelvis > 0);
  const cls = !over ? 'off-support' : !tilted ? 'level' : counter ? 'contrapposto' : 'same-direction';
  return { cls, shoulder, pelvis, com, support, offset, hipHighOnSupport, flagged: cls === 'off-support' || cls === 'same-direction' };
}

const polar = (o, len, deg) => [o[0] + len * Math.sin(deg * RAD), o[1] - len * Math.cos(deg * RAD)];   // deg from straight down

// Build a standing pose. side: 'L' or 'R' support; the support ankle is at x = 0. pelvisDeg raises the support hip;
// shoulderDeg tilts the shoulder line (positive left end up). The pelvis and everything above it slide sideways
// (support leg straight, hip height from its length, free leg reaching the ground with a bent knee) until the
// centre of mass sits over the support ankle plus `extra` (secant solve; `shift` fixes the slide instead).
export function buildPose({ side = 'R', pelvisDeg = 6, shoulderDeg = -5, shift = null, extra = 0, stance = 20 } = {}) {
  const sgn = side === 'L' ? 1 : -1, make = dx => assemble(sgn, pelvisDeg, shoulderDeg, stance, dx);
  if (shift !== null) return make(shift);
  const f = dx => centreOfMass(make(dx))[0] - extra;
  let a = 0, b = -sgn * 4, fa = f(a), fb = f(b);
  for (let i = 0; i < 30 && Math.abs(fb) > 1e-10; i++) { const c = b - fb * (b - a) / (fb - fa); a = b; fa = fb; b = c; fb = f(b); }
  return make(b);
}

const THIGH = 43, SHIN = 41, HIP_W = 32, SH_W = 38;
function assemble(sgn, pelvisDeg, shoulderDeg, stance, dx) {
  const t = sgn * pelvisDeg * RAD, hw = HIP_W / 2, u = [Math.cos(t), Math.sin(t)], legLen = THIGH + SHIN;
  const sx = dx + sgn * hw * u[0], supHip = [sx, Math.sqrt(legLen * legLen - sx * sx)];
  const hc = [supHip[0] - sgn * hw * u[0], supHip[1] - sgn * hw * u[1]], freeHip = [2 * hc[0] - supHip[0], 2 * hc[1] - supHip[1]];
  const sup = [0, 0], fa = [-sgn * stance, 0], dist = Math.min(legLen - 1e-9, Math.hypot(fa[0] - freeHip[0], fa[1] - freeHip[1]));
  const bend = Math.acos(Math.min(1, (THIGH * THIGH + dist * dist - SHIN * SHIN) / (2 * THIGH * dist)));
  const toAnkle = Math.atan2(fa[0] - freeHip[0], freeHip[1] - fa[1]), freeKnee = polar(freeHip, THIGH, (toAnkle + sgn * bend) / RAD);
  const supKnee = [supHip[0] * SHIN / legLen, supHip[1] * SHIN / legLen];
  const legs = sgn > 0
    ? { hipL: supHip, kneeL: supKnee, ankleL: sup, hipR: freeHip, kneeR: freeKnee, ankleR: fa }
    : { hipR: supHip, kneeR: supKnee, ankleR: sup, hipL: freeHip, kneeL: freeKnee, ankleL: fa };
  return { ...legs, ...upperBody(hc, shoulderDeg, SH_W) };
}

function upperBody(hc, shoulderDeg, shW) {
  const neck = [hc[0], hc[1] + 52], t = shoulderDeg * RAD, h = shW / 2;
  const shoulderL = [neck[0] + h * Math.cos(t), neck[1] - 4 + h * Math.sin(t)], shoulderR = [neck[0] - h * Math.cos(t), neck[1] - 4 - h * Math.sin(t)];
  return {
    neck, head: [neck[0], neck[1] + 16], shoulderL, shoulderR,
    elbowL: [shoulderL[0] + 3, shoulderL[1] - 29], wristL: [shoulderL[0] + 4, shoulderL[1] - 55],
    elbowR: [shoulderR[0] - 3, shoulderR[1] - 29], wristR: [shoulderR[0] - 4, shoulderR[1] - 55],
  };
}

export function jitter(P, sigma, rng) {
  const g = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
  return Object.fromEntries(Object.entries(P).map(([k, [x, y]]) => [k, [x + sigma * g(), y + sigma * g()]]));
}

// Seeded labelled sets. kind: contrapposto | same | off. Ranges are authored; tilts per the generator's physics.
export function poseSet(kind, n = 200, { seed = 'body/pose', sigma = 0.5 } = {}) {
  const rng = rngFrom(`${seed}/${kind}`), u = (a, b) => a + (b - a) * rng(), out = [];
  for (let i = 0; i < n; i++) {
    const side = rng() < 0.5 ? 'L' : 'R', sg = side === 'L' ? 1 : -1, pel = u(3, 10), sh = u(2, 8);
    const shoulderDeg = kind === 'same' ? sg * sh : -sg * sh;
    const extra = kind === 'off' ? sg * u(8, 14) : 0;   // centre of mass pushed outward past the support foot
    out.push({ kind, side, pose: jitter(buildPose({ side, pelvisDeg: pel, shoulderDeg, extra }), sigma, rng) });
  }
  return out;
}

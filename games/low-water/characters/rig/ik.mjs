// Two-bone arm IK on a solved skeleton (rig/skeleton.mjs solve()), for two-handed grips: the left
// hand is put on the shaft the right hand holds, whatever the clip does with the right arm.
// Works on world frames in character space; rotates the upper arm, then the forearm, by the
// smallest rotations that reach the target, keeping the elbow's current bend plane.
import { JOINTS, INDEX, mul, apply } from "./skeleton.mjs";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]), nrm = (a) => scl(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Rotation matrix taking unit u to unit v (Rodrigues), row-major 3 x 3.
function between(u, v) {
  const c = dot(u, v), k = cross(u, v), s = len(k);
  if (s < 1e-8) return c > 0 ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : [-1, 0, 0, 0, -1, 0, 0, 0, 1];
  const a = scl(k, 1 / s), t = 1 - c, [x, y, z] = a;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
const descendants = (j) => { const out = [j]; for (let i = 0; i < JOINTS.length; i++) if (JOINTS[i][1] && out.includes(INDEX[JOINTS[i][1]])) out.push(i); return out; };
const DESC = {}; for (const s of ["L", "R"]) for (const j of ["arm", "fore", "thigh", "shin"]) DESC[j + s] = descendants(INDEX[j + s]);

function rotateChain(S, joint, R, pivot) {
  for (const i of DESC[joint]) {
    S[i].p = add(pivot, apply(R, sub(S[i].p, pivot)));
    if (!JOINTS[i][0].startsWith("hang")) S[i].R = mul(R, S[i].R);
  }
}

// Move side s's wrist to target (character space). weight 0..1 blends from the clip's arm.
export const ikArm = (S, s, target, weight = 1) => ikChain(S, "arm" + s, "fore" + s, "hand" + s, target, weight, [0, -0.6, -0.4]);
// Plant side s's ankle on target (foot locking): the same solver on thigh, shin and foot.
export const ikLeg = (S, s, target, weight = 1) => ikChain(S, "thigh" + s, "shin" + s, "foot" + s, target, weight, "forward");
// hint: the side the middle joint bends toward when the limb is near straight (knees forward, in
// the body's facing; elbows down and back), mixed into the current bend so it never flips.
function ikChain(S, ja, jf, jh, target, weight = 1, hint = null) {
  if (weight <= 0) return S;
  const A = INDEX[ja], F = INDEX[jf], H = INDEX[jh];
  const sh = S[A].p, el = S[F].p, wr = S[H].p, a = len(sub(el, sh)), b = len(sub(wr, el));
  const goal = add(wr, scl(sub(target, wr), weight)), toT = sub(goal, sh), d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, len(toT))), dir = nrm(toT);
  // the bend plane: where the elbow sits now, off the shoulder-wrist line (else down and back)
  let pole = sub(el, add(sh, scl(dir, dot(sub(el, sh), dir))));
  const fw = hint === "forward" ? apply(S[INDEX.pelvis].R, [0, 0, 1]) : hint || [0, -1, -0.5];
  pole = add(pole, scl(fw, 0.08));
  const n = nrm(sub(pole, scl(dir, dot(pole, dir)))), cosA = (a * a + d * d - b * b) / (2 * a * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const elbow = add(sh, add(scl(dir, a * cosA), scl(n, a * sinA)));
  rotateChain(S, ja, between(nrm(sub(el, sh)), nrm(sub(elbow, sh))), sh);
  const wr2 = S[H].p, tip = add(sh, scl(dir, d));
  rotateChain(S, jf, between(nrm(sub(wr2, S[F].p)), nrm(sub(tip, S[F].p))), S[F].p);
  return S;
}

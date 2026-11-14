// rig.mjs: the skeleton under the cast, taken from lib/body rather than invented here.
//   - standing(): the physics-built contrapposto pose (lib/body/pose.mjs buildPose). Weight on one leg, pelvis up on
//     that side, centre of mass solved over the standing ankle, shoulders tilted the other way. A deadpan character
//     stands like this because real people do: the comedy needs the stance to be true.
//   - jaw(): the two-phase mandible (lib/body/jaw.mjs). Talking first hinges the jaw, then slides it forward and down,
//     so a big mouth shape drops the chin and pushes it out; a small one only hinges.
//   - ik2(): a two-bone reach in a plane with a pole, for arms that lift a cup or point.
import { buildPose, centreOfMass } from '../body/pose.mjs';
import { jawPose, alphaFor, K_TWO_PHASE, JAW } from '../body/jaw.mjs';

// The pose in model units (y down, z toward the viewer). u is model units per centimetre.
export function standing({ u = 6, side = 'R', pelvisDeg = 5, shoulderDeg = -4, stance = 16, z = 0 } = {}) {
  const P = buildPose({ side, pelvisDeg, shoulderDeg, stance }), out = {};
  for (const [k, [x, y]] of Object.entries(P)) out[k] = [x * u, -y * u, z];
  const [cx, cy] = centreOfMass(P);
  out.com = [cx * u, -cy * u, z];
  out.hipMid = [(out.hipL[0] + out.hipR[0]) / 2, (out.hipL[1] + out.hipR[1]) / 2, z];
  return out;
}

// Jaw state for a talk amount 0..1 (a share of the 50 mm full opening). open: 0..1 of the incisor opening; drop and
// fwd: the chin's travel down and forward as a share of full opening (fwd is near 0 until phase 2 starts).
export function jaw(talk) {
  const target = Math.max(0, Math.min(1, talk)) * JAW.maxOpening;
  if (target < 1e-6) return { open: 0, drop: 0, fwd: 0, phase: 1 };
  const P = jawPose(alphaFor(target, K_TWO_PHASE), K_TWO_PHASE), dm = [P.menton[0] - JAW.menton[0], P.menton[1] - JAW.menton[1]];
  return { open: target / JAW.maxOpening, drop: -dm[1] / JAW.maxOpening, fwd: (P.condyle[0]) / JAW.maxOpening, phase: P.s > 0 ? 2 : 1 };
}

// Two-bone reach from a toward target t with bone lengths l1, l2; the elbow bends toward pole. 3D points.
export function ik2(a, t, l1, l2, pole) {
  const d = t.map((v, i) => v - a[i]), L = Math.min(l1 + l2 - 1e-6, Math.max(Math.abs(l1 - l2) + 1e-6, Math.hypot(...d)));
  const dir = d.map(v => v / (Math.hypot(...d) || 1)), pv = pole.map((v, i) => v - a[i]), along = pv.reduce((s, v, i) => s + v * dir[i], 0);
  const perp = pv.map((v, i) => v - along * dir[i]), pl = Math.hypot(...perp) || 1, up = perp.map(v => v / pl);
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), y = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const elbow = a.map((v, i) => v + dir[i] * x + up[i] * y), wrist = a.map((v, i) => v + dir[i] * L);
  return { elbow, wrist };
}

export const add3 = (p, q) => [p[0] + q[0], p[1] + q[1], (p[2] ?? 0) + (q[2] ?? 0)];
export const mid3 = (p, q, t = 0.5) => p.map((v, i) => v + (q[i] - v) * t);

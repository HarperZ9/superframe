// Gaits solved from the foot's path, so a planted foot cannot slide: during stance the foot moves
// straight back along the ground at exactly the body's speed, and the leg angles come from two-bone
// IK in the leg's plane. Swing carries the foot forward on a lifted arc. Per character, from its
// proportions, at sample time (anim/library.mjs applies it to clips that name a gait).
//   gait: { stance (share of the cycle a foot is down), lift (m), bob (m), drop (hip lowered, m), reach
//           (share of the leg's forward reach used), lean (deg) }; the speed follows from the leg.
import { restOffsets } from "../rig/skeleton.mjs";

const D = 180 / Math.PI, sm = (t) => t * t * (3 - 2 * t);

// Leg channels for one foot at cycle phase u (0 = heel strike), cycle length T seconds.
export function stanceHalf(P, g) {
  const R = restOffsets(P), a = Math.abs(R.shinL[1]), b = Math.abs(R.footL[1]), ankle = Math.max(0.03, R._ankle), dy = R.root[1] - (g.drop ?? 0.05) - ankle;
  return (g.reach ?? 0.92) * Math.sqrt(Math.max(0, (a + b) ** 2 - dy * dy));
}
// Ground speed of a gait for a body: the stance path over the stance time.
export const gaitSpeed = (P, g, frames, fps = 30) => (2 * stanceHalf(P, g)) / (g.stance * (frames / fps));
function leg(P, g, u, T, hipY) {
  const R = restOffsets(P), a = Math.abs(R.shinL[1]), b = Math.abs(R.footL[1]), ankle = Math.max(0.03, R._ankle);
  const half = stanceHalf(P, g), travel = 2 * half;   // the stance foot's path under the hip
  let z, y, toe = 0;
  if (u < g.stance) { const s = u / g.stance; z = half - travel * s; y = ankle; toe = s > 0.85 ? (s - 0.85) * 120 : 0; }
  else { const s = (u - g.stance) / (1 - g.stance), e = sm(s); z = -half + travel * e; y = ankle + g.lift * Math.sin(Math.PI * s) * (1 - 0.35 * s); toe = (1 - s) * 30 - 10 * Math.sin(Math.PI * s); }
  const dy = hipY - y, dz = z, d = Math.min(a + b - 1e-4, Math.hypot(dy, dz));
  const knee = Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - d * d) / (2 * a * b)))), bend = 180 - knee * D;
  const thigh = (Math.atan2(dz, dy) + Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))))) * D;
  const shinWorld = thigh - bend;
  return { thigh, bend, foot: shinWorld + toe };
}

// Overwrite a sampled pose's legs and bob with the gait at frame f of a cycle of `frames` frames.
export function applyGait(p, g, P, f, frames, fps = 30) {
  const T = frames / fps, u = (((f / frames) % 1) + 1) % 1, R = restOffsets(P);
  const bob = g.bob * Math.cos(4 * Math.PI * (u - g.stance / 2)) * 0 + (g.bob * (Math.cos(4 * Math.PI * u) - 1)) / 2, drop = g.drop ?? 0.05;
  const hipY = R.root[1] - drop + bob;
  const L = leg(P, g, u, T, hipY), Rr = leg(P, g, (u + 0.5) % 1, T, hipY);
  p.root = { ...(p.root || {}), y: hipY - R.root[1] };
  p.thighL = { ...(p.thighL || {}), fwd: L.thigh }; p.shinL = { bend: L.bend }; p.footL = { bend: L.foot };
  p.thighR = { ...(p.thighR || {}), fwd: Rr.thigh }; p.shinR = { bend: Rr.bend }; p.footR = { bend: Rr.foot };
  if (g.lean) p.spine = { ...(p.spine || {}), bend: (p.spine?.bend || 0) + g.lean };
  return p;
}
export const GAITS = {
  walk: { stance: 0.6, lift: 0.1, bob: 0.0, drop: 0.07 },
  run: { stance: 0.38, lift: 0.28, bob: 0.0, drop: 0.14, lean: 6 },
  wade: { stance: 0.66, lift: 0.24, bob: 0.0, drop: 0.08 },
};

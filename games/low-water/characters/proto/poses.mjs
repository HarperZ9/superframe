// A small pose library for portraits and play-size figures (coordinator, 2026-10-21): named poses
// built on the shared clips, each with its ground contact. Standing poses keep the lowest foot on the
// ground (the actor's own ground shift); seated poses fit the hips to a seat height and solve the
// ankles so the feet stay on the ground (runtime/fightdrawer.mjs fitSeat, the same code the game runs
// when a scene says `pose: seated` with a seat height).
//   pose(a, name, drawer) -> { contact }   drives actor a into the pose; contact: feet and seat error (m)
import { INDEX } from "../rig/skeleton.mjs";

export const POSES = {
  stand: { anim: "idle", t: 1 },
  talk: { anim: "talkA", t: 0.6 },
  examine: { anim: "examine", t: 0.8 },
  "seated-bollard": { anim: "sit", seatY: 0.45, note: "a quay bollard, about 0.45 m (Wenna on the mole, Act 2)" },
  "seated-chair": { anim: "sit", seatY: 0.487, note: "Keel's chair in the Brine" },
  "seated-bench": { anim: "sit", seatY: 0.458, note: "Merrow's wet bench" },
};

export function pose(a, name, drawer) {
  const P = POSES[name]; if (!P) throw new Error(`poses: no pose ${name}`);
  for (let i = 0; i < 30; i++) a.drive({ x: 0, z: 0, face: 0, pose: { anim: P.anim, loop: true }, dt: 1 / 30 });
  let seat = null;
  if (P.seatY != null) seat = drawer.fitSeat(a, P.seatY);
  const S = a.skeleton(), feet = Math.min(S[INDEX.footL].p[1], S[INDEX.footR].p[1]);
  return { contact: { feet_m: +feet.toFixed(3), seat_err_m: seat ? +seat.err.toFixed(4) : null }, seatY: P.seatY ?? null };
}

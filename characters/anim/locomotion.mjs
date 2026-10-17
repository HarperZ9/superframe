// Locomotion and calm clips: idle, walk, run, turn, stop, talk gestures, examine.
// Walk and run are keyed as a half cycle of the legs (contact, down, passing, up) and mirrored for
// the other foot; the arms swing additively over the stance so the lantern hand keeps its carry.
import { merge, add, mirror } from "./pose.mjs";
import { STAND } from "./stances.mjs";

const LEGS = ["thighL", "shinL", "footL", "thighR", "shinR", "footR"];
const legsOnly = (p) => Object.fromEntries(Object.entries(p).filter(([k]) => LEGS.includes(k) || k === "root" || k === "pelvis" || k === "spine" || k === "chest" || k === "head"));

function cycle(name, frames, half, swing, extra = {}) {
  const keys = [];
  half.forEach((h, i) => {
    const u = i / (half.length * 2), ph = 2 * Math.PI * u;
    const arms = { armR: { fwd: swing.arm * Math.cos(ph) }, armL: { fwd: -swing.arm * swing.lantern * Math.cos(ph) }, foreR: { bend: swing.fore * Math.max(0, Math.cos(ph)) }, hangL: { swing: -swing.hang * Math.sin(ph) } };
    keys.push({ at: u, pose: add(merge(STAND, extra, h), arms) });
    const u2 = u + 0.5, ph2 = 2 * Math.PI * u2;
    const arms2 = { armR: { fwd: swing.arm * Math.cos(ph2) }, armL: { fwd: -swing.arm * swing.lantern * Math.cos(ph2) }, foreR: { bend: swing.fore * Math.max(0, Math.cos(ph2)) }, hangL: { swing: -swing.hang * Math.sin(ph2) } };
    const m = mirror(legsOnly(h));
    keys.push({ at: u2, pose: add(merge(STAND, extra, m), arms2) });
  });
  keys.sort((a, b) => a.at - b.at);
  return { name, loop: true, frames, keys, tags: ["calm", "move"] };
}

// Left foot forward half cycle.
export const walk = cycle("walk", 32, [
  { root: { y: -0.015 }, pelvis: { turn: -5, side: 2 }, chest: { turn: 5 }, thighL: { fwd: 26 }, shinL: { bend: 4 }, footL: { bend: -16 }, thighR: { fwd: -20 }, shinR: { bend: 10 }, footR: { bend: 18 } },
  { root: { y: -0.04 }, pelvis: { turn: -3, side: 4 }, chest: { turn: 3 }, thighL: { fwd: 20 }, shinL: { bend: 16 }, footL: { bend: -2 }, thighR: { fwd: -14 }, shinR: { bend: 34 }, footR: { bend: 24 } },
  { root: { y: 0.0 }, pelvis: { turn: 0, side: 2 }, chest: { turn: 0 }, thighL: { fwd: 2 }, shinL: { bend: 6 }, footL: { bend: 0 }, thighR: { fwd: 14 }, shinR: { bend: 58 }, footR: { bend: 8 } },
  { root: { y: 0.02 }, pelvis: { turn: 3, side: 0 }, chest: { turn: -3 }, thighL: { fwd: -12 }, shinL: { bend: 4 }, footL: { bend: 10 }, thighR: { fwd: 26 }, shinR: { bend: 26 }, footR: { bend: -8 } },
], { arm: 16, fore: 10, lantern: 0.45, hang: 7 }, { spine: { bend: 4 }, head: { bend: 6 } });

export const run = cycle("run", 20, [
  { root: { y: -0.03 }, pelvis: { turn: -8, side: 3 }, chest: { turn: 9 }, thighL: { fwd: 38 }, shinL: { bend: 12 }, footL: { bend: -12 }, thighR: { fwd: -28 }, shinR: { bend: 40 }, footR: { bend: 26 } },
  { root: { y: -0.08 }, pelvis: { turn: -5, side: 5 }, chest: { turn: 6 }, thighL: { fwd: 24 }, shinL: { bend: 34 }, footL: { bend: 6 }, thighR: { fwd: -10 }, shinR: { bend: 90 }, footR: { bend: 30 } },
  { root: { y: 0.0 }, pelvis: { turn: 0, side: 2 }, chest: { turn: 0 }, thighL: { fwd: -6 }, shinL: { bend: 18 }, footL: { bend: 18 }, thighR: { fwd: 40 }, shinR: { bend: 100 }, footR: { bend: 10 } },
  { root: { y: 0.06 }, pelvis: { turn: 5, side: 0 }, chest: { turn: -6 }, thighL: { fwd: -26 }, shinL: { bend: 30 }, footL: { bend: 28 }, thighR: { fwd: 52 }, shinR: { bend: 60 }, footR: { bend: -4 } },
], { arm: 34, fore: 40, lantern: 0.5, hang: 16 }, { spine: { bend: 14 }, chest: { bend: 4 }, head: { bend: -4 }, foreR: { bend: 40 }, foreL: { bend: 50 } });

export const idle = { name: "idle", loop: true, frames: 96, tags: ["calm"], keys: [
  { at: 0, pose: merge(STAND, { chest: { bend: 0 }, head: { turn: 0 }, hangL: { swing: 0 } }) },
  { at: 0.25, pose: merge(STAND, { root: { x: 0.01 }, pelvis: { side: -1.5 }, chest: { bend: -1.5, side: 0.8 }, head: { turn: 6, bend: 6 }, hangL: { swing: 2 } }) },
  { at: 0.5, pose: merge(STAND, { chest: { bend: 0.8 }, head: { turn: 2, bend: 10 }, hangL: { swing: -1 } }) },
  { at: 0.75, pose: merge(STAND, { root: { x: -0.01 }, pelvis: { side: 1.5 }, chest: { bend: -1.5, side: -0.8 }, head: { turn: -8, bend: 7 }, hangL: { swing: 1.5 } }) },
] };

// Seated on a chair or bench (the scene's `pose: seated`): thighs level, shins down, hands on the
// thighs, a slow breath and a look about. The root drops by the thigh's length; the body's ground
// shift then sets the feet on the floor, so the seat height follows each body's own legs.
const SEAT = merge(STAND, {
  root: { y: -0.46 }, pelvis: { bend: 0 }, spine: { bend: 8 }, chest: { bend: 4 }, head: { bend: 10 },
  thighL: { fwd: 88, out: 8 }, shinL: { bend: 86 }, footL: { bend: -4 }, thighR: { fwd: 86, out: 10 }, shinR: { bend: 90 }, footR: { bend: 0 },
  armL: { fwd: 10, out: 14 }, foreL: { bend: 74 }, handL: { bend: -12 }, armR: { fwd: 8, out: 14 }, foreR: { bend: 78 }, handR: { bend: -10 },
  skirtL: { swing: 38, sway: 4 }, skirtR: { swing: 38, sway: 4 },   // the coat's skirts eased forward over the thighs (a full 72 opened the tube into a disc)
  hangL: { swing: 0 }, hangR: { swing: 0 },
});
export const sit = { name: "sit", loop: true, frames: 120, tags: ["calm"], keys: [
  { at: 0, pose: SEAT },
  { at: 0.3, pose: merge(SEAT, { spine: { bend: 7 }, chest: { bend: 2.5 }, head: { turn: 12, bend: 8 } }) },
  { at: 0.55, pose: merge(SEAT, { chest: { bend: 5 }, head: { turn: 4, bend: 14 } }) },
  { at: 0.8, pose: merge(SEAT, { spine: { bend: 9 }, chest: { bend: 3 }, head: { turn: -10, bend: 9 } }) },
] };

// A 180 degree turn in place, in two steps (yaw is relative: the game adds 180 when it ends).
export const turn = { name: "turn", frames: 22, tags: ["calm"], keys: [
  { at: 0, pose: STAND },
  { at: 0.25, pose: merge(STAND, { root: { yaw: 40, y: -0.02 }, chest: { turn: 25 }, head: { turn: 30 }, thighL: { fwd: 14, out: 12 }, shinL: { bend: 30 }, hangL: { sway: 8 } }) },
  { at: 0.55, pose: merge(STAND, { root: { yaw: 120, y: -0.03 }, chest: { turn: 18 }, head: { turn: 15 }, thighR: { fwd: 16, out: 10 }, shinR: { bend: 34 }, hangL: { sway: 12 } }) },
  { at: 0.8, pose: merge(STAND, { root: { yaw: 172 }, chest: { turn: 4 }, hangL: { sway: -5 } }) },
  { at: 1, pose: merge(STAND, { root: { yaw: 180 } }) },
] };

// Stop from a run: a braking step, the weight thrown back, a settle.
export const stop = { name: "stop", frames: 18, tags: ["calm"], keys: [
  { at: 0, pose: merge(run.keys[0].pose) },
  { at: 0.3, pose: merge(STAND, { root: { y: -0.08, zf: 0.85 }, spine: { bend: -6 }, chest: { bend: -4 }, thighL: { fwd: 34 }, shinL: { bend: 14 }, footL: { bend: -20 }, thighR: { fwd: -16 }, shinR: { bend: 40 }, armR: { fwd: 30 }, armL: { fwd: 30, out: 24 }, hangL: { swing: 22 } }) },
  { at: 0.65, pose: merge(STAND, { root: { y: -0.03, zf: 1 }, spine: { bend: 6 }, thighL: { fwd: 10 }, shinL: { bend: 12 }, hangL: { swing: -10 } }) },
  { at: 1, pose: merge(STAND, { root: { zf: 1 } }) },
] };

// Talk gestures. A: points with the rod. B: raises the lantern to see a face. C: a shrug.
export const talkA = { name: "talk_a", frames: 54, tags: ["calm", "talk"], keys: [
  { at: 0, pose: STAND },
  { at: 0.2, pose: merge(STAND, { chest: { turn: -6, bend: 2 }, armR: { fwd: 52, out: 6 }, foreR: { bend: 20 }, handR: { bend: 20 }, head: { bend: 4 } }) },
  { at: 0.35, pose: merge(STAND, { chest: { turn: -8, bend: 4 }, armR: { fwd: 64, out: 4 }, foreR: { bend: 12 }, handR: { bend: 24 }, head: { bend: 2, side: -3 } }) },
  { at: 0.5, pose: merge(STAND, { chest: { turn: -7, bend: 3 }, armR: { fwd: 58, out: 5 }, foreR: { bend: 16 }, handR: { bend: 18 } }) },
  { at: 0.62, pose: merge(STAND, { chest: { turn: -8, bend: 4 }, armR: { fwd: 64, out: 4 }, foreR: { bend: 10 }, handR: { bend: 26 } }) },
  { at: 1, pose: STAND },
] };
export const talkB = { name: "talk_b", frames: 60, tags: ["calm", "talk"], keys: [
  { at: 0, pose: STAND },
  { at: 0.25, pose: merge(STAND, { clavL: { lift: 10 }, armL: { fwd: 70, out: 20 }, foreL: { bend: 70 }, chest: { bend: -2, turn: 6 }, head: { bend: 2 }, hangL: { swing: -10 } }) },
  { at: 0.4, pose: merge(STAND, { clavL: { lift: 12 }, armL: { fwd: 78, out: 18 }, foreL: { bend: 64 }, chest: { bend: 2, turn: 6 }, neck: { bend: 8 }, head: { bend: 8, side: 4 }, hangL: { swing: 6 } }) },
  { at: 0.7, pose: merge(STAND, { clavL: { lift: 12 }, armL: { fwd: 76, out: 18 }, foreL: { bend: 66 }, chest: { bend: 2, turn: 5 }, neck: { bend: 8 }, head: { bend: 6, side: 2 }, hangL: { swing: -2 } }) },
  { at: 1, pose: STAND },
] };
export const talkC = { name: "talk_c", frames: 42, tags: ["calm", "talk"], keys: [
  { at: 0, pose: STAND },
  { at: 0.3, pose: merge(STAND, { hands: ["open", "open"], clavL: { lift: 14 }, clavR: { lift: 14 }, armR: { out: 24, fwd: 14 }, foreR: { bend: 50 }, handR: { bend: -10 }, armL: { out: 22 }, head: { side: 8, bend: 2 }, chest: { bend: -2 } }) },
  { at: 0.55, pose: merge(STAND, { hands: ["open", "open"], clavL: { lift: 10 }, clavR: { lift: 10 }, armR: { out: 22, fwd: 12 }, foreR: { bend: 46 }, armL: { out: 20 }, head: { side: 6, bend: 6 } }) },
  { at: 1, pose: STAND },
] };

// Examine: crouch, the lantern brought down and forward, head bent to look; held at 0.4 to 0.75.
export const examine = { name: "examine", frames: 72, tags: ["calm"], keys: [
  { at: 0, pose: STAND },
  { at: 0.22, pose: merge(STAND, { root: { y: -0.38, zf: 0.6 }, pelvis: { bend: 10 }, spine: { bend: 22 }, chest: { bend: 16 }, neck: { bend: 10 }, head: { bend: 26 }, thighL: { fwd: 74, out: 10 }, shinL: { bend: 98 }, footL: { bend: -18 }, thighR: { fwd: 20, out: 12 }, shinR: { bend: 105 }, footR: { bend: 40 }, armL: { fwd: 62, out: 10 }, foreL: { bend: 20 }, hangL: { swing: 2 }, armR: { fwd: 20, out: 18 }, foreR: { bend: 50 }, handR: { bend: -10 } }) },
  { at: 0.42, pose: merge(STAND, { root: { y: -0.4, zf: 0.6 }, pelvis: { bend: 12 }, spine: { bend: 24 }, chest: { bend: 18 }, neck: { bend: 12 }, head: { bend: 30, turn: 10 }, thighL: { fwd: 76, out: 10 }, shinL: { bend: 100 }, footL: { bend: -18 }, thighR: { fwd: 22, out: 12 }, shinR: { bend: 106 }, footR: { bend: 40 }, armL: { fwd: 66, out: 8 }, foreL: { bend: 16 }, armR: { fwd: 20, out: 18 }, foreR: { bend: 52 }, handR: { bend: -10 } }) },
  { at: 0.75, pose: merge(STAND, { root: { y: -0.4, zf: 0.6 }, pelvis: { bend: 12 }, spine: { bend: 24 }, chest: { bend: 18, turn: 4 }, neck: { bend: 12 }, head: { bend: 30, turn: -12 }, thighL: { fwd: 76, out: 10 }, shinL: { bend: 100 }, footL: { bend: -18 }, thighR: { fwd: 22, out: 12 }, shinR: { bend: 106 }, footR: { bend: 40 }, armL: { fwd: 70, out: 4 }, foreL: { bend: 14 }, armR: { fwd: 20, out: 18 }, foreR: { bend: 52 }, handR: { bend: -10 } }) },
  { at: 1, pose: merge(STAND, { root: { zf: 0.6 } }) },
] };

// Wading: knee to waist water. Slow, knees lifted high, arms out for balance, the lantern held up.
export const wade = cycle("wade", 44, [
  { root: { y: -0.05 }, pelvis: { turn: -6, side: 3 }, chest: { turn: 6 }, thighL: { fwd: 30 }, shinL: { bend: 10 }, footL: { bend: -10 }, thighR: { fwd: -14 }, shinR: { bend: 20 }, footR: { bend: 20 } },
  { root: { y: -0.08 }, pelvis: { turn: -3, side: 5 }, chest: { turn: 3 }, thighL: { fwd: 22 }, shinL: { bend: 22 }, thighR: { fwd: 6 }, shinR: { bend: 50 }, footR: { bend: 30 } },
  { root: { y: -0.03 }, pelvis: { turn: 0, side: 3 }, chest: { turn: 0 }, thighL: { fwd: 0 }, shinL: { bend: 10 }, thighR: { fwd: 46 }, shinR: { bend: 80 }, footR: { bend: 20 } },
  { root: { y: 0.0 }, pelvis: { turn: 4, side: 0 }, chest: { turn: -4 }, thighL: { fwd: -14 }, shinL: { bend: 8 }, thighR: { fwd: 44 }, shinR: { bend: 40 }, footR: { bend: -6 } },
], { arm: 10, fore: 10, lantern: 0.3, hang: 10 }, { spine: { bend: 10 }, armL: { fwd: 30, out: 30 }, foreL: { bend: 60 }, armR: { out: 30 } });
wade.tags = ["calm", "move", "combat"];

// A 180 degree turn out of a run: braking lean, a planted pivot, root carried 0.25 m through it.
export const turnRun = { name: "turn_run", frames: 28, tags: ["calm", "move"], keys: [
  { at: 0, pose: merge(run.keys[0].pose) },
  { at: 0.25, pose: merge(STAND, { root: { yaw: 30, y: -0.1, zf: 0.6 }, spine: { bend: -4, side: 6 }, chest: { turn: 30 }, head: { turn: 40 }, thighL: { fwd: 36, out: 14 }, shinL: { bend: 30 }, thighR: { fwd: -20 }, shinR: { bend: 40 }, hangL: { swing: 25, sway: 10 } }) },
  { at: 0.55, pose: merge(STAND, { root: { yaw: 120, y: -0.12, zf: 0.9 }, spine: { bend: 10, side: 8 }, chest: { turn: 16 }, head: { turn: 20 }, thighR: { fwd: 30, out: 12 }, shinR: { bend: 44 }, thighL: { fwd: -10 }, shinL: { bend: 36 }, hangL: { sway: 18 } }) },
  { at: 0.8, pose: merge(STAND, { root: { yaw: 172, y: -0.05, zf: 1 }, spine: { bend: 10 }, hangL: { sway: -8 } }) },
  { at: 1, pose: merge(STAND, { root: { yaw: 180, zf: 1 } }) },
] };

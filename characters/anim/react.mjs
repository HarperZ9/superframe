// Reactions and the world's answers to kiting, keyed for weight (combat engineer's feel capture,
// 2026-10-17; author: the moves "will need to feel incredible, and have weight to them").
//   knockdown   a real fall over the move's 48 frames (60 fps): the hit lifts and twists the body,
//               the knees go, it drops (accelerating) to the ground by 0.55, the impact compresses and
//               bounces it (0.55 to 0.72), and it settles flat; getup follows as combat's own move
//   getup       roll to a side, a knee and a hand, push up, guard
//   world.lunge combat's 28-frame wind-up: coil and hold the tell (frames 4 to 27), the drive across
//               the ground (combat carries the body 4 m from frame 12), the shoulder-and-tool strike on
//               the active frames, a stumbling recovery
//   world.throw combat's 48-frame wind-up with its tell (6 to 47): reach down for a stone, draw the arm
//               back and the weight onto the back foot, hold, the release on the active frame, the follow-through
//   step_l/_r   the sidestep with a clear lean and the weight carried across onto the landing leg
// Keyed as fractions (fr) where combat's timing is one span, in phases (ph) where it has a wind-up,
// so combat's warp lands the art's wind-up end on the move's last startup frame.
import { merge, mirror } from "./pose.mjs";
import { STAND, GUARD, DOWN } from "./stances.mjs";

const P3 = ["startup", "active", "recovery"], G = (b, p) => merge(b, p);
const fr = (name, keys, tags = ["combat", "react"]) => ({ name, keys, tags, smooth: true });
const grounded = (c) => ({ ...c, grounded: true });   // the body's lowest point is held on the floor (no float as it pitches over)
const ph = (name, keys, tags = ["combat", "attack"]) => ({ name, phases: P3, keys, tags, shaped: true, smooth: true });   // keyed through their own wind-up: no generic sweep

const knockdown = fr("knockdown", [
  { at: 0, pose: GUARD },
  // struck: chest thrown back, head snaps, arms fly, the weight goes onto the heels
  { at: 0.1, pose: G(GUARD, { root: { y: -0.02, zf: 0.12, pitch: -10, roll: 4 }, spine: { bend: -16 }, chest: { bend: -22, turn: 14 }, neck: { bend: -14 }, head: { bend: -24, turn: 16 }, armR: { fwd: 80, out: 60 }, foreR: { bend: 20 }, armL: { fwd: 70, out: 80 }, foreL: { bend: 20 }, thighL: { fwd: 26 }, shinL: { bend: 8 }, thighR: { fwd: -16 }, shinR: { bend: 14 }, hangL: { swing: 40 } }) },
  // the knees go: the body folds and starts to drop backward
  { at: 0.28, pose: G(GUARD, { root: { y: -0.3, zf: 0.35, pitch: -32, roll: 6 }, pelvis: { bend: 10 }, spine: { bend: -4 }, chest: { bend: -12, turn: 10 }, head: { bend: -6, turn: 10 }, armR: { fwd: 90, out: 55 }, foreR: { bend: 30 }, armL: { fwd: 85, out: 60 }, foreL: { bend: 30 }, thighL: { fwd: 70 }, shinL: { bend: 70 }, thighR: { fwd: 40 }, shinR: { bend: 80 }, hangL: { swing: 30 } }) },
  // falling fast, nearly flat, arms reaching back for the ground
  { at: 0.45, pose: G(DOWN, { root: { y: -0.62, zf: 0.62, pitch: -70, roll: 4 }, spine: { bend: 14 }, chest: { bend: 12 }, head: { bend: 30 }, armR: { fwd: 120, out: 50 }, foreR: { bend: 20 }, armL: { fwd: 115, out: 55 }, foreL: { bend: 20 }, thighL: { fwd: 70 }, shinL: { bend: 60 }, thighR: { fwd: 55 }, shinR: { bend: 50 } }) },
  // impact: the back meets the ground, the head and legs whip, the body compresses
  { at: 0.55, pose: G(DOWN, { root: { y: -0.82, zf: 0.85, pitch: -92 }, spine: { bend: -4 }, chest: { bend: -6 }, head: { bend: -4 }, armR: { fwd: 60, out: 70 }, armL: { fwd: 50, out: 75 }, thighL: { fwd: 50 }, shinL: { bend: 40 }, thighR: { fwd: 26 }, shinR: { bend: 20 } }) },
  // the bounce: the shoulders and knees come up off the ground once
  { at: 0.64, pose: G(DOWN, { root: { y: -0.74, zf: 0.95, pitch: -84 }, spine: { bend: 14 }, chest: { bend: 12 }, head: { bend: 34 }, armR: { fwd: 30, out: 55 }, armL: { fwd: 30, out: 60 }, thighL: { fwd: 40 }, shinL: { bend: 50 }, thighR: { fwd: 12 }, shinR: { bend: 20 } }) },
  { at: 0.74, pose: G(DOWN, { root: { y: -0.8, zf: 1, pitch: -90 }, spine: { bend: 4 }, head: { bend: 16, turn: 18 } }) },
  { at: 1, pose: G(DOWN, { root: { zf: 1 }, head: { bend: 22, turn: 22 } }) },
]);

const getup = fr("getup", [
  { at: 0, pose: G(DOWN, { head: { bend: 22, turn: 22 } }) },
  { at: 0.2, pose: G(DOWN, { root: { roll: 30, pitch: -78 }, chest: { turn: 26 }, head: { bend: 30, turn: 30 }, thighL: { fwd: 70 }, shinL: { bend: 100 }, armL: { fwd: 70, out: 20 }, foreL: { bend: 40 } }) },
  { at: 0.42, pose: G(STAND, { root: { y: -0.56, pitch: -38, zf: 0.1 }, pelvis: { bend: 24 }, spine: { bend: 34 }, chest: { bend: 22 }, head: { bend: 10 }, thighL: { fwd: 95, out: 10 }, shinL: { bend: 120 }, thighR: { fwd: 30, out: 10 }, shinR: { bend: 110 }, armL: { fwd: 70, out: 10 }, foreL: { bend: 10 }, handL: { bend: -60 }, armR: { fwd: 40, out: 30 } }) },
  { at: 0.65, pose: G(STAND, { root: { y: -0.36, pitch: -6, zf: 0.25 }, pelvis: { bend: 12 }, spine: { bend: 26 }, chest: { bend: 12 }, thighL: { fwd: 82, out: 8 }, shinL: { bend: 96 }, footL: { bend: -10 }, thighR: { fwd: -12, out: 8 }, shinR: { bend: 96 }, footR: { bend: 30 }, armR: { fwd: 30, out: 25 }, foreR: { bend: 10 } }) },
  { at: 0.85, pose: G(GUARD, { root: { y: -0.12, zf: 0.38 }, spine: { bend: 14 } }) },
  { at: 1, pose: G(GUARD, { root: { zf: 0.4 } }) },
]);

const lunge = ph("world.lunge", [
  { at: ["s", 0], pose: GUARD },
  // combat warps the wind-up's time as (f / 28)^1.8 under a tell, so these keys land on frames 9, 12, 14,
  // 21 and 28: the coil shows from the tell's start, the drive from frame 12 when combat starts the travel
  // coil: sink, lean in, tool drawn back along the body (the tell from frame 4 holds this shape)
  { at: ["s", 0.1], pose: G(GUARD, { root: { y: -0.2 }, pelvis: { bend: 14, turn: 26 }, spine: { bend: 22, turn: -10 }, chest: { bend: 12, turn: -26 }, head: { bend: -6, turn: 20 }, thighL: { fwd: 44, out: 6 }, shinL: { bend: 62 }, thighR: { fwd: -30, out: 6 }, shinR: { bend: 40 }, footR: { bend: 22 }, armR: { fwd: -20, out: 24 }, foreR: { bend: 70 }, armL: { fwd: 30, out: 20 }, foreL: { bend: 80 }, hangL: { swing: -20 } }) },
  { at: ["s", 0.2], pose: G(GUARD, { root: { y: -0.24 }, pelvis: { bend: 16, turn: 28 }, spine: { bend: 26, turn: -12 }, chest: { bend: 14, turn: -28 }, head: { bend: -8, turn: 22 }, thighL: { fwd: 48, out: 6 }, shinL: { bend: 68 }, thighR: { fwd: -32, out: 6 }, shinR: { bend: 42 }, footR: { bend: 26 }, armR: { fwd: -24, out: 24 }, foreR: { bend: 72 }, armL: { fwd: 34, out: 20 }, foreL: { bend: 84 }, hangL: { swing: -24 } }) },
  // the drive (combat carries the body 4 m from frame 12): low, long strides, the shoulder leading
  { at: ["s", 0.3], pose: G(GUARD, { root: { y: -0.2, pitch: 12 }, pelvis: { bend: 18, turn: 14 }, spine: { bend: 30, turn: -6 }, chest: { bend: 18, turn: -16 }, head: { bend: -16 }, thighL: { fwd: 64 }, shinL: { bend: 50 }, thighR: { fwd: -46 }, shinR: { bend: 70 }, footR: { bend: 30 }, armR: { fwd: 10, out: 20 }, foreR: { bend: 50 }, armL: { fwd: 50, out: 24 }, foreL: { bend: 60 }, hangL: { swing: 30 } }) },
  { at: ["s", 0.6], pose: G(GUARD, { root: { y: -0.16, pitch: 14 }, pelvis: { bend: 18, turn: 10 }, spine: { bend: 30 }, chest: { bend: 18, turn: -10 }, head: { bend: -18 }, thighL: { fwd: -40 }, shinL: { bend: 66 }, footL: { bend: 30 }, thighR: { fwd: 62 }, shinR: { bend: 48 }, armR: { fwd: 30, out: 20 }, foreR: { bend: 40 }, armL: { fwd: 40, out: 30 }, foreL: { bend: 60 }, hangL: { swing: -26 } }) },
  { at: ["s", 1], pose: G(GUARD, { root: { y: -0.22, pitch: 10 }, pelvis: { turn: 30 }, spine: { bend: 28, turn: -14 }, chest: { bend: 16, turn: -30 }, head: { bend: -14, turn: 18 }, thighL: { fwd: 66, out: 6 }, shinL: { bend: 60 }, thighR: { fwd: -44 }, shinR: { bend: 30 }, footR: { bend: 30 }, armR: { fwd: -10, out: 26 }, foreR: { bend: 80 }, armL: { fwd: 60, out: 20 }, foreL: { bend: 70 } }) },
  // the strike: hips and shoulders unwind together, the tool thrown through the target
  { at: ["a", 0.5], pose: G(GUARD, { root: { y: -0.26, pitch: 14 }, pelvis: { turn: -16 }, spine: { bend: 34, turn: 8 }, chest: { bend: 22, turn: 20 }, head: { bend: -10, turn: -8 }, thighL: { fwd: 72, out: 6 }, shinL: { bend: 66 }, thighR: { fwd: -50 }, shinR: { bend: 24 }, footR: { bend: 34 }, armR: { fwd: 96, out: 8 }, foreR: { bend: 6 }, handR: { bend: 20 }, armL: { fwd: 20, out: 40 }, foreL: { bend: 50 }, hangL: { swing: 40 } }) },
  { at: ["a", 1], pose: G(GUARD, { root: { y: -0.28, pitch: 16 }, pelvis: { turn: -20 }, spine: { bend: 38, turn: 10 }, chest: { bend: 24, turn: 24 }, head: { bend: -8, turn: -10 }, thighL: { fwd: 74, out: 6 }, shinL: { bend: 70 }, thighR: { fwd: -50 }, shinR: { bend: 22 }, footR: { bend: 36 }, armR: { fwd: 84, out: 12 }, foreR: { bend: 4 }, handR: { bend: 24 }, armL: { fwd: 10, out: 46 }, foreL: { bend: 40 } }) },
  // overcommitted: a stumble step to catch the weight, then back to guard
  { at: ["r", 0.35], pose: G(GUARD, { root: { y: -0.18, pitch: 6 }, spine: { bend: 22 }, chest: { bend: 12, turn: 10 }, thighR: { fwd: 40 }, shinR: { bend: 50 }, thighL: { fwd: -10 }, shinL: { bend: 30 }, armR: { fwd: 50, out: 20 }, foreR: { bend: 30 }, armL: { fwd: 20, out: 50 }, hangL: { swing: -30 } }) },
  { at: ["r", 1], pose: GUARD },
]);

const throwIt = ph("world.throw", [
  { at: ["s", 0], pose: GUARD },
  // under combat's (f / 48)^1.8 warp these land on frames 7, 17, 39 and 48: the dip as the tell begins,
  // the full draw by frame 17, held to the release
  // a stone from the ground: a quick dip with the free hand
  { at: ["s", 0.03], pose: G(GUARD, { root: { y: -0.36 }, pelvis: { bend: 26 }, spine: { bend: 40 }, chest: { bend: 20, turn: 10 }, head: { bend: 6 }, thighL: { fwd: 70 }, shinL: { bend: 90 }, thighR: { fwd: 10 }, shinR: { bend: 80 }, armL: { fwd: 70, out: 10 }, foreL: { bend: 10 }, handL: { bend: 20 }, hands: [null, "fist"] }) },
  // the draw: turn side-on, the arm goes back and up, the weight onto the back foot (the tell from frame 6)
  { at: ["s", 0.15], pose: G(GUARD, { root: { y: -0.1 }, pelvis: { turn: 50 }, spine: { bend: -4, side: -6, turn: 10 }, chest: { bend: -10, turn: 30 }, head: { turn: -40 }, thighL: { fwd: 30, out: 8 }, shinL: { bend: 14 }, thighR: { fwd: -14, out: 10 }, shinR: { bend: 34 }, armL: { fwd: 150, out: 30, twist: 30 }, foreL: { bend: 70 }, handL: { bend: -30 }, armR: { fwd: 50, out: 30 }, foreR: { bend: 50 }, hangL: { swing: -30 }, hands: [null, "fist"] }) },
  // the hold at full draw (the long tell): a slight settle, the eyes on the target
  { at: ["s", 0.7], pose: G(GUARD, { root: { y: -0.14 }, pelvis: { turn: 56 }, spine: { bend: -8, side: -10, turn: 12 }, chest: { bend: -14, turn: 36 }, head: { turn: -46 }, thighL: { fwd: 34, out: 8 }, shinL: { bend: 10 }, thighR: { fwd: -18, out: 10 }, shinR: { bend: 40 }, armL: { fwd: 165, out: 34, twist: 34 }, foreL: { bend: 80 }, handL: { bend: -40 }, armR: { fwd: 60, out: 30 }, foreR: { bend: 46 }, hands: [null, "fist"] }) },
  { at: ["s", 1], pose: G(GUARD, { root: { y: -0.12 }, pelvis: { turn: 40 }, spine: { bend: -4, side: -8, turn: 8 }, chest: { bend: -8, turn: 22 }, head: { turn: -40 }, thighL: { fwd: 40, out: 8 }, shinL: { bend: 16 }, thighR: { fwd: -22, out: 10 }, shinR: { bend: 34 }, armL: { fwd: 170, out: 28, twist: 20 }, foreL: { bend: 50 }, handL: { bend: -20 }, armR: { fwd: 50, out: 30 }, foreR: { bend: 50 }, hands: [null, "fist"] }) },
  // release: hips then shoulders unwind, the arm whips over and through
  { at: ["a", 1], pose: G(GUARD, { root: { y: -0.16, zf: 0.3 }, pelvis: { turn: -20 }, spine: { bend: 24, side: 4, turn: -8 }, chest: { bend: 20, turn: -30 }, head: { turn: -6, bend: 4 }, thighL: { fwd: 56, out: 6 }, shinL: { bend: 40 }, thighR: { fwd: -36 }, shinR: { bend: 24 }, footR: { bend: 30 }, armL: { fwd: 70, out: 10, twist: -10 }, foreL: { bend: 6 }, handL: { bend: 20 }, armR: { fwd: 10, out: 40 }, foreR: { bend: 60 }, hangL: { swing: 36 }, hands: [null, "open"] }) },
  // follow-through and recover
  { at: ["r", 0.35], pose: G(GUARD, { root: { y: -0.2, zf: 0.5 }, pelvis: { turn: -24 }, spine: { bend: 30 }, chest: { bend: 22, turn: -34 }, thighR: { fwd: 30 }, shinR: { bend: 40 }, armL: { fwd: 30, out: 30 }, foreL: { bend: 20 }, hands: [null, "open"] }) },
  { at: ["r", 1], pose: G(GUARD, { root: { zf: 0.5 } }) },
]);

// the sidestep: the weight carried across. The pushing leg extends, the body leans into the move and
// drops, the landing leg takes it with a deep knee, the trailing foot drags in; the chest counters so
// the head stays on the target. Left as keyed; right is the mirror with the hands kept.
const stepL = fr("step_l", [
  { at: 0, pose: GUARD },
  { at: 0.18, pose: G(GUARD, { root: { y: -0.12, xf: 0.06, roll: 6 }, pelvis: { side: 8 }, spine: { side: 6 }, chest: { side: -4 }, thighR: { out: 10, fwd: -6 }, shinR: { bend: 36 }, thighL: { out: 4 }, shinL: { bend: 20 } }) },
  { at: 0.45, pose: G(GUARD, { root: { y: -0.26, xf: 0.6, roll: -20 }, pelvis: { side: -20, turn: 30 }, spine: { side: 26, bend: 12 }, chest: { side: 14, bend: 8, turn: -24 }, head: { side: -20, turn: -6 }, thighL: { out: 34, fwd: 20 }, shinL: { bend: 46 }, thighR: { out: 30, fwd: -12 }, shinR: { bend: 8 }, footR: { bend: 20 }, armL: { out: 58, fwd: 20 }, hangL: { sway: -32 } }) },
  { at: 0.7, pose: G(GUARD, { root: { y: -0.28, xf: 0.92, roll: -12 }, pelvis: { side: -14, turn: 26 }, spine: { side: 18, bend: 14 }, chest: { side: 8, turn: -20 }, head: { side: -12 }, thighL: { out: 22, fwd: 30 }, shinL: { bend: 56 }, thighR: { out: 16, fwd: -8 }, shinR: { bend: 30 }, armL: { out: 44 }, hangL: { sway: 18 } }) },
  { at: 1, pose: G(GUARD, { root: { xf: 1 } }) },
], ["combat", "move"]);
const KEEP = ["clavL", "armL", "foreL", "handL", "clavR", "armR", "foreR", "handR", "hangL", "hangR"];
const keepArms = (p) => { const m = mirror(p); for (const k of KEEP) if (p[k]) m[k] = p[k]; if (m.root) m.root = { ...m.root, xf: -(p.root?.xf || 0) }; return m; };
const stepR = { ...stepL, name: "step_r", keys: stepL.keys.map((k) => ({ ...k, pose: keepArms(k.pose) })) };

export const REACT = [grounded(knockdown), grounded({ ...knockdown, name: "fall" }), grounded(getup), lunge, throwIt, stepL, stepR];

// Combat clips: dodges, the light string, the heavy, hit react, stagger, fall, get up.
// Every combat clip is keyed in phases (startup, active, recovery); their lengths in frames come from
// anim/timing.json, which the combat engineer tunes from the clean-room spec without touching keys.
// Root motion is written as a fraction of the clip's "move" distance (zf forward, xf to own left).
import { merge, mirror } from "./pose.mjs";
import { GUARD, DOWN, STAND } from "./stances.mjs";

const P3 = ["startup", "active", "recovery"];
const G = (p) => merge(GUARD, p);

// Forward roll: tuck, over the shoulder, up into guard. Pitch 0 to 360 across the active phase.
export const dodgeF = { name: "dodge_f", phases: P3, tags: ["combat", "dodge"], keys: [
  { at: ["s", 0], pose: GUARD },
  { at: ["s", 1], pose: G({ root: { y: -0.3, zf: 0.08, pitch: 10 }, spine: { bend: 30 }, chest: { bend: 20 }, head: { bend: 30 }, thighL: { fwd: 60 }, shinL: { bend: 70 }, thighR: { fwd: -10 }, shinR: { bend: 50 }, armR: { fwd: 70 }, armL: { fwd: 60, out: 20 } }) },
  ...[0.25, 0.5, 0.75].map((u, i) => ({ at: ["a", u], pose: G({ root: { y: [-0.55, -0.62, -0.5][i], zf: 0.08 + 0.84 * u, pitch: 10 + 350 * u }, pelvis: { bend: 30 }, spine: { bend: 45 }, chest: { bend: 35 }, neck: { bend: 20 }, head: { bend: 30 }, thighL: { fwd: 110, out: 10 }, shinL: { bend: 130 }, thighR: { fwd: 100, out: 10 }, shinR: { bend: 130 }, armR: { fwd: 60, out: 10 }, foreR: { bend: 80 }, armL: { fwd: 50, out: 25 }, foreL: { bend: 90 } }) })),
  { at: ["a", 1], pose: G({ root: { y: -0.32, zf: 0.95, pitch: 360 }, spine: { bend: 30 }, chest: { bend: 15 }, head: { bend: 10 }, thighL: { fwd: 70 }, shinL: { bend: 100 }, thighR: { fwd: 10 }, shinR: { bend: 80 } }) },
  { at: ["r", 1], pose: G({ root: { zf: 1, pitch: 360 } }) },
] };

// Backstep: a hop back, the body leaning over the front foot, the rod kept up.
export const dodgeB = { name: "dodge_b", phases: P3, tags: ["combat", "dodge"], keys: [
  { at: ["s", 0], pose: GUARD },
  { at: ["s", 1], pose: G({ root: { y: -0.1, zf: -0.05 }, spine: { bend: 14 }, thighL: { fwd: 30 }, shinL: { bend: 34 }, thighR: { fwd: -12 }, shinR: { bend: 36 } }) },
  { at: ["a", 0.45], pose: G({ root: { y: 0.08, zf: -0.6 }, spine: { bend: 18 }, chest: { bend: 10 }, thighL: { fwd: 20 }, shinL: { bend: 50 }, thighR: { fwd: -30 }, shinR: { bend: 30 }, footR: { bend: 30 }, armL: { out: 50, fwd: 10 }, hangL: { swing: 30 } }) },
  { at: ["a", 1], pose: G({ root: { y: -0.12, zf: -0.95 }, spine: { bend: 16 }, thighL: { fwd: 30 }, shinL: { bend: 40 }, thighR: { fwd: -24 }, shinR: { bend: 46 }, hangL: { swing: -15 } }) },
  { at: ["r", 1], pose: G({ root: { zf: -1 } }) },
] };

// Sidestep to the own left (the right one is its mirror): a low lateral lunge.
export const dodgeL = { name: "dodge_l", phases: P3, tags: ["combat", "dodge"], keys: [
  { at: ["s", 0], pose: GUARD },
  { at: ["s", 1], pose: G({ root: { y: -0.12, xf: 0.05 }, pelvis: { side: -6 }, chest: { side: -8 }, thighR: { out: 18 }, shinR: { bend: 34 } }) },
  { at: ["a", 0.5], pose: G({ root: { y: -0.02, xf: 0.6, roll: -6 }, pelvis: { side: 8 }, chest: { side: 12, bend: 10 }, head: { side: -8 }, thighL: { out: 30, fwd: 18 }, shinL: { bend: 30 }, thighR: { out: 26, fwd: -10 }, shinR: { bend: 40 }, armL: { out: 55 }, hangL: { sway: -25 } }) },
  { at: ["a", 1], pose: G({ root: { y: -0.16, xf: 0.95 }, pelvis: { side: 4 }, chest: { side: 6 }, thighL: { out: 22, fwd: 24 }, shinL: { bend: 44 }, thighR: { out: 14 }, shinR: { bend: 30 }, hangL: { sway: 15 } }) },
  { at: ["r", 1], pose: G({ root: { xf: 1 } }) },
] };
export const dodgeR = { ...dodgeL, name: "dodge_r", keys: dodgeL.keys.map((k) => ({ ...k, pose: mirrorKeepArms(k.pose) })) };
// Mirror the body but keep the rod in the right hand and the lantern in the left.
function mirrorKeepArms(p) {
  const m = mirror(p), keep = ["clavL", "armL", "foreL", "handL", "clavR", "armR", "foreR", "handR", "hangL", "hangR"];
  for (const k of keep) m[k] = p[k];
  if (m.root) m.root = { ...m.root, xf: -(p.root?.xf || 0) };
  for (const k of ["pelvis", "spine", "chest", "neck", "head"]) if (m[k]) m[k] = { ...m[k], turn: p[k]?.turn ?? 0 };
  return m;
}

// The light string. 1: a thrust. 2: a backhand sweep. 3: an overhead chop that ends the string.
export const light1 = { name: "light_1", phases: P3, tags: ["combat", "attack"], keys: [
  { at: ["s", 0], pose: GUARD },
  { at: ["s", 1], pose: G({ chest: { turn: -26 }, pelvis: { turn: 28 }, armR: { fwd: 22, out: 20 }, foreR: { bend: 100 }, handR: { bend: 30 }, thighR: { fwd: -24 }, shinR: { bend: 30 } }) },
  { at: ["a", 0.5], pose: G({ root: { zf: 0.7 }, chest: { turn: 14, bend: 10 }, pelvis: { turn: 6 }, spine: { bend: 12 }, armR: { fwd: 84, out: 2 }, foreR: { bend: 4 }, handR: { bend: 36 }, thighL: { fwd: 36 }, shinL: { bend: 28 }, thighR: { fwd: -30 }, shinR: { bend: 10 } }) },
  { at: ["a", 1], pose: G({ root: { zf: 0.9 }, chest: { turn: 16, bend: 12 }, pelvis: { turn: 6 }, spine: { bend: 12 }, armR: { fwd: 86, out: 2 }, foreR: { bend: 2 }, handR: { bend: 36 }, thighL: { fwd: 38 }, shinL: { bend: 30 }, thighR: { fwd: -32 }, shinR: { bend: 10 } }) },
  { at: ["r", 1], pose: G({ root: { zf: 1 } }) },
] };
export const light2 = { name: "light_2", phases: P3, tags: ["combat", "attack"], keys: [
  { at: ["s", 0], pose: G({ chest: { turn: 10 }, armR: { fwd: 70 }, foreR: { bend: 20 } }) },
  { at: ["s", 1], pose: G({ chest: { turn: 40 }, pelvis: { turn: 10 }, armR: { fwd: 60, out: -40, twist: 30 }, foreR: { bend: 80 }, handR: { bend: 20, side: 30 } }) },
  { at: ["a", 0.5], pose: G({ root: { zf: 0.6 }, chest: { turn: -15, bend: 8 }, pelvis: { turn: 30 }, armR: { fwd: 80, out: 40, twist: -10 }, foreR: { bend: 10 }, handR: { bend: 30, side: -10 } }) },
  { at: ["a", 1], pose: G({ root: { zf: 0.8 }, chest: { turn: -45, bend: 10 }, pelvis: { turn: 40 }, armR: { fwd: 50, out: 85, twist: -20 }, foreR: { bend: 14 }, handR: { bend: 30, side: -20 } }) },
  { at: ["r", 1], pose: G({ root: { zf: 1 } }) },
] };
export const light3 = { name: "light_3", phases: P3, tags: ["combat", "attack"], keys: [
  { at: ["s", 0], pose: G({ chest: { turn: -30 }, armR: { fwd: 50, out: 70 }, foreR: { bend: 14 } }) },
  { at: ["s", 0.6], pose: G({ root: { y: 0.02 }, spine: { bend: -6 }, chest: { turn: -4, bend: -10 }, clavR: { lift: 14 }, armR: { fwd: 165, out: 10 }, foreR: { bend: 70 }, handR: { bend: 30 }, armL: { fwd: 40, out: 30 } }) },
  { at: ["s", 1], pose: G({ root: { y: 0.03, zf: 0.1 }, spine: { bend: -10 }, chest: { turn: 0, bend: -14 }, clavR: { lift: 18 }, armR: { fwd: 175, out: 8 }, foreR: { bend: 80 }, handR: { bend: 34 }, armL: { fwd: 46, out: 30 } }) },
  { at: ["a", 0.6], pose: G({ root: { y: -0.16, zf: 0.8 }, spine: { bend: 26 }, chest: { bend: 20, turn: 6 }, armR: { fwd: 60, out: 4 }, foreR: { bend: 4 }, handR: { bend: 40 }, thighL: { fwd: 48 }, shinL: { bend: 50 }, thighR: { fwd: -30 }, shinR: { bend: 30 } }) },
  { at: ["a", 1], pose: G({ root: { y: -0.2, zf: 0.9 }, spine: { bend: 30 }, chest: { bend: 22, turn: 6 }, armR: { fwd: 40, out: 4 }, foreR: { bend: 2 }, handR: { bend: 44 }, thighL: { fwd: 50 }, shinL: { bend: 56 }, thighR: { fwd: -30 }, shinR: { bend: 34 } }) },
  { at: ["r", 0.5], pose: G({ root: { y: -0.12, zf: 1 }, spine: { bend: 22 }, chest: { bend: 12 }, armR: { fwd: 36 }, foreR: { bend: 20 } }) },
  { at: ["r", 1], pose: G({ root: { zf: 1 } }) },
] };

// The heavy: a long wind-up, then a whole turn of the body with the rod out (yaw 0 to 360).
export const heavy = { name: "heavy", phases: P3, tags: ["combat", "attack"], keys: [
  { at: ["s", 0], pose: GUARD },
  { at: ["s", 0.7], pose: G({ root: { y: -0.12, yaw: 30 }, pelvis: { turn: 30 }, chest: { turn: 55, bend: 10 }, head: { turn: -45 }, armR: { fwd: 30, out: -30, twist: 30 }, foreR: { bend: 90 }, handR: { side: 30 }, thighL: { fwd: 30 }, shinL: { bend: 40 }, thighR: { fwd: -26 }, shinR: { bend: 44 }, armL: { out: 60 } }) },
  { at: ["s", 1], pose: G({ root: { y: -0.14, yaw: 36 }, pelvis: { turn: 34 }, chest: { turn: 62, bend: 12 }, head: { turn: -55 }, armR: { fwd: 26, out: -36, twist: 30 }, foreR: { bend: 96 }, handR: { side: 34 }, thighL: { fwd: 32 }, shinL: { bend: 44 }, thighR: { fwd: -28 }, shinR: { bend: 48 }, armL: { out: 64 } }) },
  ...[0.33, 0.66].map((u) => ({ at: ["a", u], pose: G({ root: { y: -0.1, yaw: 36 - 360 * u, zf: 0.6 * u }, pelvis: { turn: 0 }, chest: { turn: -20, bend: 8 }, head: { turn: 10 }, armR: { fwd: 80, out: 70 }, foreR: { bend: 6 }, handR: { bend: 30, side: -10 }, armL: { out: 70, fwd: -10 }, hangL: { sway: -30 }, thighL: { fwd: 20 }, thighR: { fwd: -20 } }) })),
  { at: ["a", 1], pose: G({ root: { y: -0.16, yaw: -324, zf: 0.8 }, chest: { turn: -40, bend: 14 }, armR: { fwd: 60, out: 90 }, foreR: { bend: 8 }, handR: { bend: 30 }, armL: { out: 60 }, hangL: { sway: 20 } }) },
  { at: ["r", 0.6], pose: G({ root: { y: -0.1, yaw: -350, zf: 0.95 }, chest: { turn: -24, bend: 10 }, armR: { fwd: 50, out: 50 } }) },
  { at: ["r", 1], pose: G({ root: { yaw: -360, zf: 1 } }) },
] };

// Hit react: the head and chest knocked back, a short step, back to guard.
export const hit = { name: "hit", phases: P3, tags: ["combat", "react"], keys: [
  { at: ["s", 0], pose: GUARD },
  { at: ["a", 0.3], pose: G({ root: { zf: 0.5, y: -0.06 }, spine: { bend: -8 }, chest: { bend: -14, turn: 10 }, neck: { bend: -10 }, head: { bend: -16, turn: 14 }, armR: { fwd: 30, out: 30 }, armL: { out: 45 }, hangL: { swing: 20 } }) },
  { at: ["a", 1], pose: G({ root: { zf: 0.9, y: -0.08 }, spine: { bend: 2 }, chest: { bend: -4 }, head: { bend: 0, turn: 6 } }) },
  { at: ["r", 1], pose: G({ root: { zf: 1 } }) },
] };

// Stagger: knocked off balance, two stumbling steps back, arms wide.
export const stagger = { name: "stagger", phases: P3, tags: ["combat", "react"], keys: [
  { at: ["s", 0], pose: GUARD },
  { at: ["a", 0.2], pose: G({ root: { zf: 0.25, y: -0.04, pitch: -8 }, spine: { bend: -14 }, chest: { bend: -18 }, head: { bend: -20 }, armR: { fwd: 50, out: 60 }, foreR: { bend: 20 }, armL: { fwd: 40, out: 70 }, hangL: { swing: 35 }, thighL: { fwd: 30 }, shinL: { bend: 10 } }) },
  { at: ["a", 0.5], pose: G({ root: { zf: 0.55, y: -0.1, pitch: -4 }, spine: { bend: -6 }, chest: { bend: -10 }, head: { bend: -8 }, armR: { fwd: 30, out: 70 }, armL: { fwd: 20, out: 75 }, thighR: { fwd: -40 }, shinR: { bend: 50 }, thighL: { fwd: 26 }, hangL: { swing: -20 } }) },
  { at: ["a", 0.8], pose: G({ root: { zf: 0.85, y: -0.14 }, spine: { bend: 10 }, chest: { bend: 6 }, head: { bend: 10 }, armR: { fwd: 20, out: 40 }, armL: { out: 50 }, thighL: { fwd: 10 }, shinL: { bend: 40 }, thighR: { fwd: -30 }, shinR: { bend: 50 } }) },
  { at: ["a", 1], pose: G({ root: { zf: 0.95, y: -0.16 }, spine: { bend: 18 }, chest: { bend: 10 }, head: { bend: 14 }, thighL: { fwd: 30 }, shinL: { bend: 50 }, thighR: { fwd: -20 }, shinR: { bend: 50 } }) },
  { at: ["r", 1], pose: G({ root: { zf: 1 } }) },
] };

// Fall: knocked down onto the back. Ends in DOWN.
export const fall = { name: "fall", phases: P3, tags: ["combat", "react"], keys: [
  { at: ["s", 0], pose: GUARD },
  { at: ["a", 0.25], pose: G({ root: { zf: 0.3, y: -0.1, pitch: -18 }, spine: { bend: -10 }, chest: { bend: -16 }, head: { bend: -20 }, armR: { fwd: 70, out: 50 }, armL: { fwd: 60, out: 60 }, thighL: { fwd: 40 }, shinL: { bend: 20 }, hangL: { swing: 40 } }) },
  { at: ["a", 0.6], pose: merge(DOWN, { root: { zf: 0.75, y: -0.45, pitch: -55 }, spine: { bend: 20 }, chest: { bend: 16 }, head: { bend: 30 }, armR: { fwd: 80, out: 40 }, armL: { fwd: 70, out: 50 }, thighL: { fwd: 70 }, shinL: { bend: 60 }, thighR: { fwd: 40 }, shinR: { bend: 50 } }) },
  { at: ["a", 1], pose: merge(DOWN, { root: { zf: 1, y: -0.8, pitch: -88 }, head: { bend: 10 } }) },
  { at: ["r", 0.4], pose: merge(DOWN, { root: { zf: 1, y: -0.76, pitch: -86 }, head: { bend: 30 } }) },
  { at: ["r", 1], pose: merge(DOWN, { root: { zf: 1 } }) },
] };

// Get up: roll to the left side, onto a knee, push up with the rod, guard.
export const getup = { name: "getup", phases: P3, tags: ["combat", "react"], keys: [
  { at: ["s", 0], pose: DOWN },
  { at: ["s", 1], pose: merge(DOWN, { root: { roll: 20, pitch: -80 }, chest: { turn: 20 }, thighL: { fwd: 60 }, shinL: { bend: 90 } }) },
  { at: ["a", 0.5], pose: merge(STAND, { root: { y: -0.5, pitch: -30, zf: 0.15 }, pelvis: { bend: 20 }, spine: { bend: 30 }, chest: { bend: 20 }, head: { bend: 10 }, thighL: { fwd: 90, out: 10 }, shinL: { bend: 110 }, thighR: { fwd: 30, out: 10 }, shinR: { bend: 100 }, armR: { fwd: 40, out: 30 }, foreR: { bend: 10 }, handR: { bend: -40 }, armL: { fwd: 30, out: 20 } }) },
  { at: ["a", 1], pose: merge(STAND, { root: { y: -0.4, pitch: 0, zf: 0.3 }, pelvis: { bend: 10 }, spine: { bend: 24 }, chest: { bend: 10 }, thighL: { fwd: 80, out: 8 }, shinL: { bend: 95 }, footL: { bend: -10 }, thighR: { fwd: -10, out: 8 }, shinR: { bend: 95 }, footR: { bend: 30 }, armR: { fwd: 30, out: 25 }, foreR: { bend: 10 }, handR: { bend: -50 } }) },
  { at: ["r", 0.6], pose: G({ root: { y: -0.12, zf: 0.4 }, spine: { bend: 14 } }) },
  { at: ["r", 1], pose: G({ root: { zf: 0.4 } }) },
] };

export const COMBAT = [dodgeF, dodgeB, dodgeL, dodgeR, light1, light2, light3, heavy, hit, stagger, fall, getup];
export { STAND };

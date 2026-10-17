// Base stances every clip is keyed against. Degrees and metres (rig/skeleton.mjs channels).
import { merge } from "./pose.mjs";

// Calm: weight even, the lantern a little forward in the left hand, the rod leaning like a cane.
export const STAND = {
  root: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 },
  pelvis: { bend: 0, side: 0, turn: 0 }, spine: { bend: 2, side: 0, turn: 0 }, chest: { bend: 0, side: 0, turn: 0 },
  neck: { bend: 0, side: 0, turn: 0 }, head: { bend: 8, side: 0, turn: 0 },
  clavL: { lift: 0, fwd: 0 }, armL: { fwd: 12, out: 13, twist: 0 }, foreL: { bend: 28, twist: 0 }, handL: { bend: 0, side: 0 },
  clavR: { lift: 0, fwd: 0 }, armR: { fwd: 8, out: 11, twist: 0 }, foreR: { bend: 22, twist: 0 }, handR: { bend: -8, side: 0 },
  thighL: { fwd: 2, out: 3, twist: 0 }, shinL: { bend: 3 }, footL: { bend: -2 },
  thighR: { fwd: -2, out: 3, twist: 0 }, shinR: { bend: 3 }, footR: { bend: 2 },
  hangL: { swing: 0, sway: 0 }, hangR: { swing: 0, sway: 0 },
};

// Guard: the fighting stance. Left foot forward, hips turned, knees soft, rod raised before the
// body, the lantern held out to the side and back, away from blows.
export const GUARD = merge(STAND, {
  root: { y: -0.05 }, pelvis: { turn: 22 }, spine: { bend: 8, turn: -6 }, chest: { bend: 6, turn: -14 }, head: { bend: 6, turn: -4 },
  thighL: { fwd: 24, out: 7 }, shinL: { bend: 20 }, footL: { bend: -8 },
  thighR: { fwd: -20, out: 9 }, shinR: { bend: 24 }, footR: { bend: 12 },
  armR: { fwd: 42, out: 14, twist: 0 }, foreR: { bend: 58 }, handR: { bend: 6 },
  armL: { fwd: -6, out: 34 }, foreL: { bend: 44 }, clavL: { lift: 4 },
});

// Lying on the back (the end of a fall, the start of the get-up).
export const DOWN = merge(STAND, {
  root: { y: -0.78, pitch: -90, z: -0.1 }, pelvis: { bend: 0 }, spine: { bend: 6 }, chest: { bend: 4 }, head: { bend: 25, turn: 20 },
  armL: { fwd: 20, out: 55 }, foreL: { bend: 30 }, armR: { fwd: 30, out: 40 }, foreR: { bend: 20 }, handR: { bend: 0 },
  thighL: { fwd: 25, out: 10 }, shinL: { bend: 40 }, thighR: { fwd: 5, out: 6 }, shinR: { bend: 8 },
});

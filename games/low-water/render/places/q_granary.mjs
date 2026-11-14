// The granary door at night, The Quota era 2 (story fight 1). 23:40 of day 41: the lantern over the door, the
// militia's brazier, a thin moon over the snow, the gate lamp where the villagers come in.
import { granary } from "../worlds/granary.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { EXTERIOR, exteriorPpm } from "./_q2.mjs";
const R = granary();
const moon = { pos: [-90, 80, 140], I: 16000 };
export default {
  name: "q_granary", world: R.world, lights: R.lights, surf, sky: (d, V, o) => sky(d, { ...V, skyLevel: 0.012, stars: 2 }, o), paintId,
  camera: { ...EXTERIOR, target: [0, 2.4, -2.0], ppm: exteriorPpm(74, 34), W: 1920, H: 1300, dist: 70 },   // the one exterior angle (design/CAMERA.md, 2026-10-22)
  paint: { seed: 89, radii: [13, 7.5, 4.5, 2.6], relief: 0.28 }, language: { era: 2, decay: 0.3 }, strokeLight: { strength: 1 },
  variants: { night: { hour: 23.7, note: "23:40, day 41: the door lantern, the brazier, a thin moon on the snow", V: { frost: 0.8, moon, fill: 9 }, plan: { ambient: 0.012, mist: 0.004, extinct: 0.0015 }, gain: 1.7,
    // the night carried by warm brown-black ground under a lit sky, not a flat navy (the author's references, 2026-10-22)
    grade: { shadowTint: [0.74, 0.66, 0.74], lift: [0.004, 0.003, 0.003], saturation: 0.75 } } },
  dark: { lights: [{ pos: [3.1, 1.0, -1.1], radius: 3.5, intensity: 1.4 }], emit: ["lantern"], plan: { dark: 0.02 } },
  walk: walkIds("mud", "slab"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the granary door at night (story fight 1). The yard before the ramp is kept open for the fight.",
};

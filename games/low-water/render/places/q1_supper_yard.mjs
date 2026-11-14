// The yard outside Orme's barn on the night of the harvest supper (era 1, e1.s06: Ilo eats in the yard with a plate on
// his knees and hears the toast through the window). The granary door's yard, warm: the lantern, a full moon low.
import { yard } from "../worlds/q1_rooms.mjs";
import { withDetail, ID } from "../props/kinds.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { EXTERIOR, exteriorPpm } from "./_q2.mjs";
import { NIGHT_GRADE } from "./_q1.mjs";
const R = yard();
const moon = { pos: [120, 60, 160], I: 26000 };   // the harvest moon, full and low
export default {
  name: "q1_supper_yard", world: R.world, lights: R.lights, surf: withDetail(surf), sky: (d, V, o) => sky(d, { ...V, skyLevel: 0.02, stars: 2 }, o), paintId,
  camera: { ...EXTERIOR, target: [0, 2.4, -2.0], ppm: exteriorPpm(74, 34), W: 1920, H: 1300, dist: 70 },
  paint: { seed: 349, radii: [13, 7.5, 4.5, 2.6], relief: 0.28 }, language: { era: 1, decay: 0.08 }, strokeLight: { strength: 1 },
  variants: { night: { hour: 21.0, note: "harvest supper, 21:00: the lantern and the full moon low over the stubble, a warm night, no frost", V: { frost: 0, moon, fill: 12 }, plan: { ambient: 0.016, mist: 0.004, extinct: 0.0015 }, gain: 1.8, grade: NIGHT_GRADE } },
  walk: [...walkIds("mud", "slab", "sand"), ID.hay], footing: footing(), marks: R.marks,
  notes: "The Quota era 1: the yard outside Orme's barn on the supper night.",
};

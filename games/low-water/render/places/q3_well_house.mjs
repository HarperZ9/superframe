// The Quota era 3: the Well House in Pask's rented yard, fenced for health. Plates package, 2026-10-22:
// render/worlds/q3_rooms_b.mjs wellHouse(). Look L11 in era3.md: a thinner, wetter paint until the fire.
import { wellHouse } from "../worlds/q3_rooms_b.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail } from "../props/kinds.mjs";
import { STREET_CAM } from "./_q2.mjs";
import { L3_GRADE, AUTUMN_DAY } from "./_q3.mjs";
const R = wellHouse({ burning: false });
export default {
  name: "q3_well_house", world: R.world, lights: R.lights, surf: withDetail(surf), sky, paintId,
  camera: { ...STREET_CAM, target: [-1.0, 1.1, -2.0], ppm: 150, dist: 40 },
  paint: { seed: 453, radii: [12, 7, 4, 2.2], relief: 0.22 }, language: { era: 3, decay: 0.1 }, strokeLight: { strength: 1 },
  variants: { dusk: { hour: 16.6, note: "November, 16:40: the Well House fenced for health, the last grey light, a cold wind off the plain", V: AUTUMN_DAY([-120, 12, -200], 30000), plan: { ambient: 0.05, mist: 0.012, extinct: 0.002 }, gain: 1.6, grade: L3_GRADE } },
  figureLights: [{ pos: [1.5, 2.4, 2.5], kind: "white", I: 4, reach: 10 }],
  walk: walkIds("mud", "cobble"), footing: footing(), marks: R.marks,
  notes: "The Quota era 3: the Well House.",
};

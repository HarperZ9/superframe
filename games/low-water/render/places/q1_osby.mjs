// Osby fair, era 1: the fair on the grass below the hill (e1_frost). The Tesks' hill (q_hill) in late summer: the
// bracken green going to rust, haze on the plain, no frost.
import { hill } from "../worlds/q_country.mjs";
import { dressFair } from "../props/fair.mjs";
import { withDetail } from "../props/kinds.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { LAND_CAM, exteriorPpm } from "./_q2.mjs";
import { HARVEST_DAY, HARVEST_GRADE } from "./_q1.mjs";
const R = hill({ season: "harvest", dress: dressFair });   // the bracken green going to rust; the stalls, the crowd, the goat pen
export default {
  name: "q1_osby", world: R.world, lights: R.lights, surf: withDetail(surf), sky, paintId,
  camera: { ...LAND_CAM, target: [2.0, 1.0, 1.6], ppm: exteriorPpm(70, 32) },
  paint: { seed: 359, radii: [12, 7, 4, 2.4], relief: 0.3 }, language: { era: 1, decay: 0.05 }, strokeLight: { strength: 1 },
  variants: { noon: { hour: 13.0, note: "Osby fair, 13:00: a high warm sun, haze on the plain, the grass dry", V: HARVEST_DAY([-80, 160, -120], 110000), plan: { ambient: 0.22, mist: 0.012, extinct: 0.003 }, gain: 0.95, grade: HARVEST_GRADE } },
  walk: walkIds("mud", "rust", "wall", "straw", "bracken_harvest"), footing: footing(), marks: R.marks,
  notes: "The Quota era 1: Osby fair on the grass below the hill.",
};

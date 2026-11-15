// The Tesks' hill above Krall's End, era 1 (year 0, harvest): era 1's own plate of q_hill, on the hill world in its
// harvest season (worlds/_season.mjs): the bracken green going to rust, the track dry. The area q.hill shows it
// while var.era is 1 (wiring/quota-areas.lwd, plate: q1_hill ? var.era == 1). W3-C addendum, 2026-10-22.
import { hill } from "../worlds/q_country.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail } from "../props/kinds.mjs";
import { LAND_CAM, exteriorPpm } from "./_q2.mjs";
import { HARVEST_DAY, HARVEST_GRADE } from "./_q1.mjs";
const R = hill({ season: "harvest" });
export default {
  name: "q1_hill", world: R.world, lights: R.lights, surf: withDetail(surf), sky, paintId,
  camera: { ...LAND_CAM, target: [-3.0, 1.6, -2.5], ppm: exteriorPpm(70, 32) },
  paint: { seed: 389, radii: [12, 7, 4, 2.4], relief: 0.3 }, language: { era: 1, decay: 0.05 }, strokeLight: { strength: 1 },
  variants: { harvest: { hour: 16.0, note: "harvest, year 0, 16:00: the bracken turning, the sun warm on the slope, haze on the top", V: HARVEST_DAY([-200, 45, -140], 260000), plan: { ambient: 0.3, mist: 0.016, extinct: 0.004 }, gain: 1.0, grade: { ...HARVEST_GRADE, saturation: 0.7 } } },
  walk: walkIds("mud", "rust", "wall", "straw", "sand", "weed", "bracken_harvest"), footing: footing(), marks: R.marks,
  notes: "The Quota era 1: the Tesks' hill and the fold at harvest.",
};

// The post road walking back from the district line (q_sheaf.lwd the Haldanes walking home; q_cells.lwd day 48).
// afternoon: day 41, after the post, a low red sun and the hard wind off the hill; morning: a week on, snow lying.
import { road } from "../worlds/q_country.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { LAND_CAM, SNOW_DAY } from "./_q2.mjs";
const R = road();
export default {
  name: "q_road_home", world: R.world, lights: R.lights, surf, sky, paintId,
  camera: { ...LAND_CAM, target: [-1.0, 1.0, 0] },
  paint: { seed: 263, radii: [12, 7, 4, 2.4], relief: 0.26 }, language: { era: 2, decay: 0.3 }, strokeLight: { strength: 1 },
  variants: {
    afternoon: { hour: 15.2, note: "day 41, 15:10: a low red sun behind the poplars, frost, the wind off the hill", V: { day: "dawn", frost: 0.75, sun: { pos: [-220, 26, -80], I: 200000, soft: 3 }, fill: 5 }, plan: { ambient: 0.32, mist: 0.007, extinct: 0.002 }, gain: 1.35, grade: { saturation: 0.72 } },
    morning: { hour: 8.0, note: "a week on, 08:00: snow lying on the plain, a grey sky", V: SNOW_DAY(8.0, 50000), plan: { ambient: 0.4, mist: 0.01, extinct: 0.0025 }, gain: 1.3, grade: { saturation: 0.6 } },
  },
  walk: walkIds("cobble", "mud"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the post road walking back.",
};

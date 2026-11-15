// The Furrowes' front step on Exchange Street (q_week.lwd q.fate.gate.furrowe, the district's notice): afternoon,
// snow down, the queue's rope along the kerb.
import { furrowe } from "../worlds/q_streets.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { STREET_CAM, SNOW_DAY } from "./_q2.mjs";
const R = furrowe();
export default {
  name: "q_furrowe_door", world: R.world, lights: R.lights, surf, sky, paintId,
  camera: { ...STREET_CAM, target: [-0.6, 2.2, -2.4] },
  paint: { seed: 241, radii: [13, 7.5, 4.4, 2.5], relief: 0.26 }, language: { era: 2, decay: 0.25 }, strokeLight: { strength: 1 },
  variants: { afternoon: { hour: 14.6, note: "a week on, 14:35: snow lying, the sky low, the queue's rope along the kerb", V: { ...SNOW_DAY(14.6), lamp: 0 }, plan: { ambient: 0.4, mist: 0.008, extinct: 0.002 }, gain: 1.3, grade: { saturation: 0.62 } } },
  walk: walkIds("cobble", "slab", "steps"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the Furrowes' front step.",
};

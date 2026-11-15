// The gate of the Furrow Church's home on Tilney Road (q_week.lwd H1): a week on, 14:00, snow, the brass plate.
import { tilney } from "../worlds/q_streets.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { STREET_CAM, SNOW_DAY, exteriorPpm } from "./_q2.mjs";
const R = tilney();
export default {
  name: "q_tilney", world: R.world, lights: R.lights, surf, sky, paintId,
  camera: { ...STREET_CAM, target: [0.8, 2.6, -3.0], ppm: exteriorPpm(100, 34) },
  paint: { seed: 251, radii: [13, 7.5, 4.4, 2.5], relief: 0.26 }, language: { era: 2, decay: 0.2 }, strokeLight: { strength: 1 },
  variants: { afternoon: { hour: 14.1, note: "a week on, 14:05: snow lying, a low grey sky over the home's brick", V: SNOW_DAY(14.1), plan: { ambient: 0.4, mist: 0.008, extinct: 0.002 }, gain: 1.3, grade: { saturation: 0.6 } } },
  walk: walkIds("cobble", "slab", "mud", "steps"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the gate of the children's home on Tilney Road.",
};

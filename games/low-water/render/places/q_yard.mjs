// Haldane Yard at the barn door (q_week.lwd H2, Gedge at the yard): Monday, 09:00, snow, the barn barred.
import { yard } from "../worlds/q_country.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { STREET_CAM, SNOW_DAY, exteriorPpm } from "./_q2.mjs";
const R = yard();
export default {
  name: "q_yard", world: R.world, lights: R.lights, surf, sky, paintId,
  camera: { ...STREET_CAM, target: [0.6, 1.2, -0.6], ppm: exteriorPpm(105, 34) },
  paint: { seed: 257, radii: [13, 7.5, 4.4, 2.5], relief: 0.28 }, language: { era: 2, decay: 0.45 }, strokeLight: { strength: 1 },
  variants: { morning: { hour: 9.0, note: "Monday, 09:00: snow on the yard, the butt iced, the barn barred", V: SNOW_DAY(9.0, 60000), plan: { ambient: 0.38, mist: 0.008, extinct: 0.002 }, gain: 1.3, grade: { saturation: 0.6 } } },
  walk: walkIds("mud", "cobble"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: Haldane Yard at the barn door.",
};

// The barns at Haldane's, era 1: Haldane Yard in its harvest, the barn door open on the stored crop. The yard era 2
// shows under snow with the barn barred (q_yard).
import { yard } from "../worlds/q_country.mjs";
import { dressYardHarvest } from "../props/yard_harvest.mjs";
import { withDetail } from "../props/kinds.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { STREET_CAM, exteriorPpm } from "./_q2.mjs";
import { HARVEST_DAY, HARVEST_GRADE } from "./_q1.mjs";
const R = yard({ season: "harvest", dress: dressYardHarvest });   // the harvest ground, the doors open on the crop
export default {
  name: "q1_barns", world: R.world, lights: R.lights, surf: withDetail(surf), sky, paintId,
  camera: { ...STREET_CAM, target: [0.6, 1.2, -0.6], ppm: exteriorPpm(105, 34) },
  paint: { seed: 353, radii: [13, 7.5, 4.4, 2.5], relief: 0.28 }, language: { era: 1, decay: 0.1 }, strokeLight: { strength: 1 },
  variants: { evening: { hour: 17.6, note: "harvest, 17:35: low gold sun across the yard, dust off the threshing, the barn door open", V: HARVEST_DAY([-200, 32, -40], 130000), plan: { ambient: 0.2, mist: 0.01, extinct: 0.002 }, gain: 1.05, grade: HARVEST_GRADE } },
  walk: walkIds("mud", "cobble"), footing: footing(), marks: R.marks,
  notes: "The Quota era 1: the barns at Haldane's at harvest.",
};

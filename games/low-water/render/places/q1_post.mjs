// The road post at the district line, era 1 (year 0, harvest): era 1's own plate of q_post, on the post world in its
// harvest season (worlds/_season.mjs): stubble on the plain, the poplars in leaf, open water in the ditches. The area
// q.post shows it while var.era is 1 (wiring/quota-areas.lwd, plate: q1_post ? var.era == 1). W3-C addendum, 2026-10-22.
import { roadPost } from "../worlds/roadpost.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { EXTERIOR, exteriorPpm } from "./_q2.mjs";
import { HARVEST_DAY, HARVEST_GRADE } from "./_q1.mjs";
const R = roadPost({ season: "harvest" });
export default {
  name: "q1_post", world: R.world, lights: R.lights, surf, sky, paintId,
  camera: { ...EXTERIOR, target: [0.5, 0.8, 0], ppm: exteriorPpm(80, 32), W: 1920, H: 1080, dist: 70 },
  paint: { seed: 383, radii: [12, 7, 4, 2.4], relief: 0.26 }, language: { era: 1, decay: 0.1 }, strokeLight: { strength: 1 },
  variants: { harvest: { hour: 17.2, note: "harvest, year 0, 17:10: the low gold sun down the road, the stubble shorn, the poplars in leaf, no frost", V: HARVEST_DAY([-220, 30, -60], 130000), plan: { ambient: 0.2, mist: 0.008, extinct: 0.002 }, gain: 1.05, grade: HARVEST_GRADE } },
  walk: walkIds("cobble", "mud", "sand"), footing: footing(), marks: R.marks,
  notes: "The Quota era 1: the road post at the district line at harvest.",
};

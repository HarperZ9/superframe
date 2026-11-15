// The road post at the district line, The Quota era 2 ("the requisition"). Day 41, 15:40: a low red sun going down
// over the white plain behind the poplars, the guards' brazier and the hut lamp already lit, frost on everything.
import { roadPost } from "../worlds/roadpost.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { EXTERIOR, exteriorPpm } from "./_q2.mjs";
const R = roadPost();
export default {
  name: "q_post", world: R.world, lights: R.lights, surf, sky, paintId,
  camera: { ...EXTERIOR, target: [0.5, 0.8, 0], ppm: exteriorPpm(80, 32), W: 1920, H: 1080, dist: 70 },   // the one exterior angle (design/CAMERA.md, 2026-10-22)
  paint: { seed: 83, radii: [12, 7, 4, 2.4], relief: 0.26 }, language: { era: 2, decay: 0.3 }, strokeLight: { strength: 1 },
  variants: { afternoon: { hour: 15.7, note: "15:40, day 41: a low red sun over the white plain, the brazier and the hut lamp lit, frost", V: { day: "dawn", frost: 0.75, sun: { pos: [-220, 30, -60], I: 220000, soft: 3, fill: [200, 140, 200] }, fill: 6 }, plan: { ambient: 0.35, mist: 0.006, extinct: 0.002 }, gain: 1.35, grade: { saturation: 0.7 } } },
  walk: walkIds("cobble", "mud"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the road post at the district line (the perspective pair 'the requisition').",
};

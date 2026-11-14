// The Furrowe kitchen, The Quota era 2 (the 4.1 dinner): evening, the paraffin lamp lit on the table, the range's
// fire, the street dark blue in the window. The inspector's household still has paraffin; that is the point.
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era2.mjs";
import { withDetail } from "../props/kinds.mjs";
import { kitchen } from "../worlds/kitchen.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = layered(kitchen({ who: "furrowe" }), DRESS.q_furrowe_kitchen());
export default {
  name: "q_furrowe_kitchen", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.01, paintId,
  camera: { yawDeg: 34, elevDeg: 36, target: [0.2, 0.9, -0.2], ppm: 220, W: 1920, H: 1300, dist: 20 },
  paint: { seed: 67, radii: [15, 8.5, 5, 2.8], relief: 0.3 }, language: { era: 2, decay: 0.3 }, strokeLight: { strength: 1 },
  variants: { evening: { hour: 18.6, note: "18:35, the evening meal: the paraffin lamp, the range, the street dark blue", V: { window: 1.2, fill: 0.3 }, plan: { ambient: 0.006, mist: 0.003, extinct: 0.001 }, gain: 2.3 } },
  walk: walkIds("slab"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the Furrowe kitchen at the evening meal (the Inspector line's dinner).",
};

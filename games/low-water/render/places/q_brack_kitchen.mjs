// The Brack kitchen, The Quota era 2 (the Militia line's dinner and the perspective pair "the house"): evening,
// one candle on the table, the small stove, the stair and the cupboard under it in shadow.
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era2.mjs";
import { withDetail } from "../props/kinds.mjs";
import { kitchen } from "../worlds/kitchen.mjs";
import F from "./q_furrowe_kitchen.mjs";
const R = layered(kitchen({ who: "brack" }), DRESS.q_brack_kitchen());
export default { ...F, name: "q_brack_kitchen", world: R.world, lights: R.lights, marks: R.marks, camera: { ...F.camera, target: [0.1, 0.9, -0.2], ppm: 235 }, paint: { ...F.paint, seed: 71 },
  variants: { evening: { hour: 19.1, note: "19:05: one candle, the stove, the cupboard under the stair in shadow", V: { window: 0.8, fill: 0.15 }, plan: { ambient: 0.005, mist: 0.003, extinct: 0.001 }, gain: 2.5 } },
  walk: F.walk, notes: "The Quota slice: the Brack kitchen at the evening meal." };

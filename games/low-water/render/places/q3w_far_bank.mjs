// The Quota era 3, the witness: Aaron's estate kitchen on the far bank at year 46. Plates package, 2026-10-22: render/worlds/q3_rooms_b.mjs farBank().
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era3.mjs";
import { farBank } from "../worlds/q3_rooms_b.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { L3_GRADE, L3_NIGHT, BULB, WINDOW } from "./_q3.mjs";
const R = layered(farBank(), DRESS.q3w_far_bank());
export default {
  name: "q3w_far_bank", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, target: [0.0, 1.0, -0.4], ppm: 200 },
  paint: { seed: 451, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 4, decay: 0.05 }, strokeLight: { strength: 1 },
  variants: { afternoon: { hour: 15.0, note: "year 46, 15:00: a grey afternoon through the big window, the tube off, the town across the river", V: WINDOW([-60, 35, -240], 60000, 1.0), plan: { ambient: 0.03, mist: 0.005, extinct: 0.0015 }, gain: 2.2, grade: { shadowTint: [0.96, 0.86, 0.8], lift: [0.0045, 0.0035, 0.0035], saturation: 0.5 } } },
  figureLights: [{ pos: [0.4, 2.0, 1.0], kind: "white", I: 5, reach: 8 }],
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "The Quota era 3, the witness: Aaron's estate kitchen on the far bank at year 46.",
};

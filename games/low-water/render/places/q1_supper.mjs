// Orme's barn laid for the harvest supper. Era 1 interior, render/worlds/q1_rooms.mjs (package W3-C, 2026-10-22).
import { barn } from "../worlds/q1_rooms.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail, ID } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { HARVEST_GRADE } from "./_q1.mjs";
const R = barn();
export default {
  name: "q1_supper", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, target: [0.2, 1.0, -0.3], ppm: 150 },
  paint: { seed: 347, radii: [15, 8.5, 5, 2.8], relief: 0.3 }, language: { era: 1, decay: 0.05 }, strokeLight: { strength: 1 },
  variants: { supper: { hour: 20.3, note: "harvest supper, 20:20: the lanterns on the tie-beam, the last blue in the doors, the whole district at one table", V: { fill: 0, dusk: 2.0 }, plan: { ambient: 0.004, mist: 0.006, extinct: 0.0015 }, gain: 1.6, grade: { ...HARVEST_GRADE, shadowTint: [0.62, 0.55, 0.46], lift: [0.0025, 0.0025, 0.003], saturation: 0.7 } },
    unlit: { hour: 19.6, note: "19:35, before the supper: the lanterns out, the last blue through the yard door, the tables laid and waiting", V: { emit: { lantern: 0 }, fill: 0, dusk: 3.5 }, plan: { ambient: 0.03, mist: 0.006, extinct: 0.0015 }, gain: 2.4, grade: { ...HARVEST_GRADE, shadowTint: [0.6, 0.6, 0.62], lift: [0.002, 0.003, 0.005], saturation: 0.7 } } },
  figureLights: [{ pos: [1.0, 2.3, 2.6], kind: "paraffin", I: 6, reach: 9 }],
  walk: [...walkIds("boards", "plank", "straw", "chaff", "oakx", "greyx", "greyz"), ID.hay], footing: footing(), marks: R.marks,
  notes: "The Quota era 1: Orme's barn laid for the harvest supper.",
};

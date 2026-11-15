// The Quota era 3: the militia squad room. Plates package, 2026-10-22: render/worlds/q3_rooms_b.mjs squad().
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era3.mjs";
import { squad } from "../worlds/q3_rooms_b.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { L3_GRADE, L3_NIGHT, BULB, WINDOW } from "./_q3.mjs";
const R = layered(squad(), DRESS.q3_squad());
export default {
  name: "q3_squad", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, target: [0.0, 1.0, -0.3], ppm: 165 },
  paint: { seed: 447, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 3, decay: 0.12 }, strokeLight: { strength: 1 },
  variants: { dawn: { hour: 6.5, note: "October, 06:30: the squad bulb on before the day, rain on the yard window, the stove lit", V: BULB(1.0, 0.3, 0.25), plan: { ambient: 0.01, mist: 0.006, extinct: 0.0015 }, gain: 1.9, grade: L3_GRADE } },
  figureLights: [{ pos: [0.6, 2.1, 1.0], kind: "white", I: 5, reach: 8 }],
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "The Quota era 3: the militia squad room.",
};

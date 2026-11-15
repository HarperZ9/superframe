// The Quota era 3: the schoolroom in the old exchange offices. Plates package, 2026-10-22: render/worlds/q3_rooms.mjs school().
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era3.mjs";
import { school } from "../worlds/q3_rooms.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { L3_GRADE, L3_NIGHT, BULB, WINDOW } from "./_q3.mjs";
const R = layered(school(), DRESS.q3_school());
export default {
  name: "q3_school", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, target: [0.0, 1.0, -0.2], ppm: 150 },
  paint: { seed: 431, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 3, decay: 0.12 }, strokeLight: { strength: 1 },
  variants: { morning: { hour: 10.5, note: "September, 10:30: grey light in through the two tall windows, the bulb off, chalk dust in the air", V: WINDOW([-200, 50, 40], 70000, 1.0), plan: { ambient: 0.03, mist: 0.006, extinct: 0.0015 }, gain: 2.2, grade: L3_GRADE } },
  figureLights: [{ pos: [0.4, 2.2, 1.2], kind: "white", I: 5, reach: 8 }],
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "The Quota era 3: the schoolroom in the old exchange offices.",
};

// The Quota era 3: the Furrow Church, the pulpit. Plates package, 2026-10-22: render/worlds/q3_rooms.mjs church().
import { church } from "../worlds/q3_rooms.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { L3_GRADE, L3_NIGHT, BULB, WINDOW } from "./_q3.mjs";
const R = church();
export default {
  name: "q3_church", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, target: [-0.2, 1.4, -0.6], ppm: 120 },
  paint: { seed: 441, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 3, decay: 0.1 }, strokeLight: { strength: 1 },
  variants: { morning: { hour: 11.0, note: "November, 11:00: sleet light down through the tall window onto the pulpit, the altarpiece under its sheet", V: WINDOW([-150, 75, 20], 55000, 0.8), plan: { ambient: 0.025, mist: 0.008, extinct: 0.0015 }, gain: 2.6, grade: L3_GRADE } },
  figureLights: [{ pos: [0.8, 2.4, 1.6], kind: "white", I: 5, reach: 8 }],
  walk: walkIds("slab"), footing: footing(), marks: R.marks,
  notes: "The Quota era 3: the Furrow Church, the pulpit.",
};

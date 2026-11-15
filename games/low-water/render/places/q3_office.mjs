// The Quota era 3: the allocation counter in the old district office. Plates package, 2026-10-22: render/worlds/q3_rooms.mjs office().
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era3.mjs";
import { office } from "../worlds/q3_rooms.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { L3_GRADE, L3_NIGHT, BULB, WINDOW } from "./_q3.mjs";
const R = layered(office(), DRESS.q3_office());
export default {
  name: "q3_office", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, target: [0.0, 1.0, -0.3], ppm: 160 },
  paint: { seed: 433, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 3, decay: 0.12 }, strokeLight: { strength: 1 },
  variants: { afternoon: { hour: 14.3, note: "September, 14:20: the counter bulb on in the day, rain on the one window, the queue to the rail", V: BULB(0.9, 0.5, 0.3), plan: { ambient: 0.012, mist: 0.006, extinct: 0.0015 }, gain: 1.8, grade: L3_GRADE } },
  figureLights: [{ pos: [0.6, 2.2, 1.0], kind: "white", I: 5, reach: 8 }],
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "The Quota era 3: the allocation counter in the old district office.",
};

// The Quota era 3: the Brack kitchen, the cracked wedding photograph. Plates package, 2026-10-22: render/worlds/q3_rooms_b.mjs brackKitchen().
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era3.mjs";
import { brackKitchen } from "../worlds/q3_rooms_b.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { L3_GRADE, L3_NIGHT, BULB, WINDOW } from "./_q3.mjs";
const R = layered(brackKitchen(), DRESS.q3_brack_kitchen());
export default {
  name: "q3_brack_kitchen", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, target: [0.0, 0.95, -0.3], ppm: 195 },
  paint: { seed: 449, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 3, decay: 0.12 }, strokeLight: { strength: 1 },
  variants: { night: { hour: 21.2, note: "December, 21:10: the bulb over the table, the range banked, frost on the window", V: BULB(0.85, 0.2, 0.2), plan: { ambient: 0.008, mist: 0.006, extinct: 0.0015 }, gain: 2.0, grade: L3_NIGHT } },
  figureLights: [{ pos: [0.6, 2.0, 1.0], kind: "white", I: 5, reach: 8 }],
  walk: walkIds("slab"), footing: footing(), marks: R.marks,
  notes: "The Quota era 3: the Brack kitchen, the cracked wedding photograph.",
};

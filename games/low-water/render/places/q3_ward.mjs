// The Quota era 3: the fever ward in the church hall. Plates package, 2026-10-22: render/worlds/q3_rooms_b.mjs ward().
import { ward } from "../worlds/q3_rooms_b.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { L3_GRADE, L3_NIGHT, BULB, WINDOW } from "./_q3.mjs";
const R = ward();
export default {
  name: "q3_ward", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, target: [-0.4, 0.9, -0.3], ppm: 125 },
  paint: { seed: 443, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 3, decay: 0.15 }, strokeLight: { strength: 1 },
  variants: { night: { hour: 3.7, note: "November, 03:40: the brownout, two bulbs at half, the stove door glowing, coughs behind the screens", V: BULB(0.55, 0.15, 0.5), plan: { ambient: 0.012, mist: 0.01, extinct: 0.0015 }, gain: 2.4, grade: L3_NIGHT } },
  figureLights: [{ pos: [0.0, 2.2, 1.0], kind: "white", I: 5, reach: 8 }],
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "The Quota era 3: the fever ward in the church hall.",
};

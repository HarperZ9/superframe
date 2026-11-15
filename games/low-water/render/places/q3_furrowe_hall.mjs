// The Quota era 3: the Furrowe hall, the front door and the mirror. Plates package, 2026-10-22: render/worlds/q3_rooms.mjs hall().
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era3.mjs";
import { hall } from "../worlds/q3_rooms.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { L3_GRADE, L3_NIGHT, BULB, WINDOW } from "./_q3.mjs";
const R = layered(hall(), DRESS.q3_furrowe_hall());
export default {
  name: "q3_furrowe_hall", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, target: [-0.2, 1.1, -0.4], ppm: 200 },
  paint: { seed: 437, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 3, decay: 0.1 }, strokeLight: { strength: 1 },
  variants: { evening: { hour: 19.6, note: "September, 19:40: one bulb in the hall, the last of the dusk in the fanlight, the door opening", V: BULB(0.85, 0.6, 0.25), plan: { ambient: 0.01, mist: 0.006, extinct: 0.0015 }, gain: 1.9, grade: L3_GRADE } },
  figureLights: [{ pos: [0.0, 2.2, 0.6], kind: "white", I: 5, reach: 8 }],
  walk: walkIds("slab", "rug"), footing: footing(), marks: R.marks,
  notes: "The Quota era 3: the Furrowe hall, the front door and the mirror.",
};

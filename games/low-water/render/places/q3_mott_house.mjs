// The Quota era 3: the old Mott house front room, the door table. Plates package, 2026-10-22: render/worlds/q3_rooms.mjs mott().
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era3.mjs";
import { mott } from "../worlds/q3_rooms.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { L3_GRADE, L3_NIGHT, BULB, WINDOW } from "./_q3.mjs";
const R = layered(mott(), DRESS.q3_mott_house());
export default {
  name: "q3_mott_house", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, target: [-0.2, 0.9, -0.3], ppm: 140 },
  paint: { seed: 439, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 3, decay: 0.15 }, strokeLight: { strength: 1 },
  variants: { evening: { hour: 18.5, note: "October, 18:30: the door table under one bulb on a flex, the stove low, the second shift waiting on the stair", V: BULB(0.8, 0.25, 0.08), plan: { ambient: 0.01, mist: 0.007, extinct: 0.0015 }, gain: 1.9, grade: L3_GRADE } },
  figureLights: [{ pos: [0.8, 2.1, 1.2], kind: "white", I: 5, reach: 8 }],
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "The Quota era 3: the old Mott house front room, the door table.",
};

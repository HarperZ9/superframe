// The registrar's upstairs room, era 1: the census board sits in a warm room (design/eras/era1.md e1.s04). The meeting
// room era 2 uses cold (q_office), here at harvest: the windows open on the afternoon, the stove unlit.
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era1.mjs";
import { board } from "../worlds/q1_rooms.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail, ID } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { HARVEST_GRADE } from "./_q1.mjs";
const R = layered(board(), DRESS.q1_board());
export default {
  name: "q1_board", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, elevDeg: 35, target: [0.2, 1.0, -0.4], ppm: 180 },
  paint: { seed: 313, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 1, decay: 0.05 }, strokeLight: { strength: 1 },
  variants: { afternoon: { hour: 16.3, note: "harvest, 16:20: the low sun across the table through the open windows, dust in it, the stove cold", V: { day: true, sun: { pos: [-60, 50, -200], I: 900000, soft: 40 }, fill: 1.2 }, plan: { ambient: 0.02, mist: 0.004, extinct: 0.001 }, gain: 1.7, grade: { ...HARVEST_GRADE, shadowTint: [0.62, 0.55, 0.46], lift: [0.003, 0.003, 0.0035], saturation: 0.7 } },
    work: { hour: 12, note: "a flat work light for judging build stages: no sun, a strong even fill", V: { fill: 7 }, plan: { ambient: 0.1, mist: 0.004, extinct: 0.001 }, gain: 1.6, grade: HARVEST_GRADE } },
  figureLights: [{ pos: [1.0, 2.6, 2.8], kind: "paraffin", I: 7, reach: 10 }],
  walk: [...walkIds("boards", "rug", "oakx", "greyx", "oakz")], footing: footing(), marks: R.marks,
  notes: "The Quota era 1: the registrar's upstairs room, the census board.",
};

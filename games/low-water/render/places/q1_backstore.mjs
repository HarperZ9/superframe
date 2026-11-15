// Orme's back store at the mill: the year's sacks to the beams. Era 1 interior, render/worlds/q1_rooms.mjs (package W3-C, 2026-10-22).
import { backstore } from "../worlds/q1_rooms.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail, ID } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { HARVEST_GRADE } from "./_q1.mjs";
const R = backstore();
export default {
  name: "q1_backstore", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, target: [0.1, 0.9, -0.4], ppm: 190 },
  paint: { seed: 331, radii: [15, 8.5, 5, 2.8], relief: 0.3 }, language: { era: 1, decay: 0.05 }, strokeLight: { strength: 1 },
  variants: { afternoon: { hour: 15.8, note: "harvest, 15:50: a shaft of low sun through the west window across the sacks, the desk lamp lit", V: { day: true, sun: { pos: [-196, 9.4, 17], I: 250000, soft: 40 }, fill: 0.2 }, plan: { ambient: 0.01, mist: 0.006, extinct: 0.001 }, gain: 2.2, grade: { ...HARVEST_GRADE, shadowTint: [0.62, 0.55, 0.46], lift: [0.003, 0.003, 0.0035], saturation: 0.7 } },
    lamp: { hour: 18.6, note: "18:35, the sun off the window: the desk lamp alone", V: { fill: 0.8, emit: {} }, plan: { ambient: 0.012, mist: 0.006, extinct: 0.001 }, gain: 2.6, grade: { ...HARVEST_GRADE, shadowTint: [0.62, 0.56, 0.5], lift: [0.003, 0.003, 0.004], saturation: 0.7 } } },
  figureLights: [{ pos: [1.0, 2.3, 2.6], kind: "paraffin", I: 6, reach: 9 }],
  walk: [...walkIds("boards", "plank", "straw", "chaff", "oakx", "greyx", "greyz"), ID.hay], footing: footing(), marks: R.marks,
  notes: "The Quota era 1: Orme's back store at the mill: the year's sacks to the beams.",
};

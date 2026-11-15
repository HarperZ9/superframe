// Abel Furrowe's hayloft over the horse, at harvest evening. Era 1 interior, render/worlds/q1_rooms.mjs (package W3-C, 2026-10-22).
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era1.mjs";
import { hayloft } from "../worlds/q1_rooms.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail, ID } from "../props/kinds.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { HARVEST_GRADE } from "./_q1.mjs";
const R = layered(hayloft(), DRESS.q1_loft());
export default {
  name: "q1_loft", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { ...ROOM_CAM, target: [0, 0.9, -0.3], ppm: 210 },
  paint: { seed: 337, radii: [15, 8.5, 5, 2.8], relief: 0.3 }, language: { era: 1, decay: 0.05 }, strokeLight: { strength: 1 },
  variants: { evening: { hour: 18.9, note: "harvest, 18:50: the last sun level through the loading door, the hay gold, the lantern just lit", V: { day: true, sun: { pos: [-194, 25, -38], I: 170000, soft: 40 }, fill: 0.5, fillx: 1.2, leak: 12000 }, plan: { ambient: 0.01, mist: 0.008, extinct: 0.0015 }, gain: 2.3, grade: { ...HARVEST_GRADE, shadowTint: [0.62, 0.55, 0.46], lift: [0.003, 0.003, 0.0035], saturation: 0.7 } },
    lamp: { hour: 19.8, note: "19:50, the sun gone: the lantern alone, a little sky through the roof seams", V: { fill: 0.5, fillx: 0.4, leak: 3000 }, plan: { ambient: 0.006, mist: 0.008, extinct: 0.0015 }, gain: 2.8, grade: { ...HARVEST_GRADE, shadowTint: [0.62, 0.55, 0.46], lift: [0.003, 0.003, 0.0035], saturation: 0.7 } } },
  figureLights: [{ pos: [1.0, 2.3, 2.6], kind: "paraffin", I: 6, reach: 9 }],
  walk: [...walkIds("boards", "plank", "straw", "chaff", "oakx", "greyx", "greyz"), ID.hay], footing: footing(), marks: R.marks,
  notes: "The Quota era 1: Abel Furrowe's hayloft over the horse, at harvest evening.",
};

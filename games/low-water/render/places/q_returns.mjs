// The district office, The Quota era 2 (the record entering: the figure the player reports). Mid-morning of day
// 41: flat winter daylight from the square through the tall window, the clerk's paraffin lamp lit anyway.
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era2.mjs";
import { withDetail } from "../props/kinds.mjs";
import { district } from "../worlds/district.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = layered(district(), DRESS.q_returns());
export default {
  name: "q_returns", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.03, paintId,
  camera: { yawDeg: 34, elevDeg: 34, target: [0.2, 1.1, -0.3], ppm: 175, W: 1920, H: 1300, dist: 22 },
  paint: { seed: 73, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 2, decay: 0.3 }, strokeLight: { strength: 1 },
  variants: { morning: { hour: 10.2, note: "10:10, day 41: flat winter light from the square, the clerk's lamp lit", V: { day: "dawn", window: 7, fill: 0.6 }, plan: { ambient: 0.014, mist: 0.003, extinct: 0.001 }, gain: 1.55 } },
  // the figures take the room's daylight from the camera side (they read black against the lit room, 2026-10-22)
  figureLights: [{ pos: [1.2, 2.4, 2.6], kind: "white", I: 7, reach: 9 }, { pos: [-2.6, 1.8, 0.4], kind: "white", I: 4, reach: 7 }],
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the district office, where the figure is reported.",
};

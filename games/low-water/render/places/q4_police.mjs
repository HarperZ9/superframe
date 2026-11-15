// The Quota era 4: the police station desk, Ann's report. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era4.mjs";
import { police } from "../worlds/q4_rooms.mjs";
import { place, ROOM4 } from "./_q4.mjs";
// a neutral tube grade for this room (2026-10-24): TUBE_GRADE's green shadow tint cast the whole room green; the walls keep their own green paint
const TUBE_NEUTRAL = { shadowTint: [0.9, 0.92, 0.95], lift: [0.003, 0.003, 0.0034], saturation: 0.62 };
export default place("q4_police", layered(police(), DRESS.q4_police()), {
  indoor: true, camera: { ...ROOM4, target: [0.0, 1.0, -0.3], ppm: 180 }, seed: 613, walk: ["terrazzo"],
  variants: { morning: { hour: 8.7, note: "year 70, 08:40: the tubes on, one failing, grey day at the street door", V: { fill: 0.15 }, plan: { ambient: 0.012, mist: 0.001, extinct: 0.001 }, gain: 2.3, grade: TUBE_NEUTRAL } },
  notes: "The Quota era 4: the police station desk, Ann's report.",
});

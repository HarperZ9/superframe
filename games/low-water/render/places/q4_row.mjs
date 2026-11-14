// The Quota era 4: the Row, the Vell terrace by the race. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { row } from "../worlds/q4_rooms.mjs";
import { place, STREET4, SODIUM_GRADE } from "./_q4.mjs";
export default place("q4_row", row(), {
  indoor: false, camera: { ...STREET4, target: [4.0, 2.0, -2.5], ppm: 92 }, seed: 677, walk: ["cobble", "slab", "steps"],
  variants: { night: { hour: 23.2, note: "year 70, 23:10: the Row under its sodium, windows lit, the race loud below the rail", V: { skyLevel: 0.012, wet: 0.5 }, plan: { ambient: 0.03, mist: 0.006, extinct: 0.002 }, gain: 2.1, grade: SODIUM_GRADE } },
  notes: "The Quota era 4: the Row, the Vell terrace by the race.",
});

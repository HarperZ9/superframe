// The Quota era 5: square. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { square } from "../worlds/q5_rooms.mjs";
import { place, STREET5, SODIUM5 } from "./_q5.mjs";
export default place("q5_square", square(), {
  indoor: false, camera: { ...STREET5, target: [0.5, 1.8, 0], ppm: 80 }, seed: 729, walk: ["concrete", "slab", "steps"],
  variants: { evening: { hour: 20.6, note: "year 115, April, 20:35: the car park under sodium, the sheaf under its tarpaulin", V: { skyLevel: 0.02, wet: 0.2 }, plan: { ambient: 0.03, mist: 0.006, extinct: 0.002 }, gain: 2, grade: SODIUM5 } },
  notes: "The Quota era 5: the car park under sodium, the sheaf under its tarpaulin.",
});

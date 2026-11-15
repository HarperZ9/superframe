// The Quota era 5: mill street. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { millStreet } from "../worlds/q5_rooms.mjs";
import { place, STREET5, SODIUM5 } from "./_q5.mjs";
export default place("q5_mill_street", millStreet(), {
  indoor: false, camera: { ...STREET5, target: [0.5, 1.6, -1.5], ppm: 96 }, seed: 703, walk: ["cobble", "slab", "steps"],
  variants: { night: { hour: 23.1, note: "year 115, April, 23:05: Mill Street under sodium, the flowers on the paving, the shutter down", V: { skyLevel: 0.01, wet: 0.35 }, plan: { ambient: 0.03, mist: 0.006, extinct: 0.002 }, gain: 2.1, grade: SODIUM5 } },
  notes: "The Quota era 5: Mill Street under sodium, the flowers on the paving, the shutter down.",
});

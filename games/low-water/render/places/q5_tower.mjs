// The Quota era 5: tower. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { tower } from "../worlds/q5_rooms.mjs";
import { place, STREET5, APRIL5 } from "./_q5.mjs";
export default place("q5_tower", tower(), {
  indoor: false, camera: { ...STREET5, target: [0.6, 6.4, -2.2], ppm: 40 }, seed: 701, walk: ["turf5", "gravel5", "tarmac5", "slab"],
  variants: { evening: { hour: 19.6, note: "year 115, April, 19:35: overcast going to dusk, the gate lamp lit on the path, the mast's red light over the stones", V: { skyLevel: 0.08 }, plan: { ambient: 0.06, mist: 0.006, extinct: 0.002 }, gain: 2.2, grade: APRIL5 } },
  notes: "The Quota era 5: overcast going to dusk, the mast's red light over the stones.",
});

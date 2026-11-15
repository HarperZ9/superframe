// The Quota era 5: shop. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { shop } from "../worlds/q5_rooms.mjs";
import { place, STREET5, SODIUM5 } from "./_q5.mjs";
export default place("q5_shop", shop(), {
  indoor: false, camera: { ...STREET5, target: [0, 1.2, -2.4], ppm: 175 }, seed: 737, walk: ["cobble", "slab", "steps"],
  variants: { evening: { hour: 20.2, note: "year 115, April, 20:10: the window's spots on the dressed table, the hill street dark", V: { skyLevel: 0.015 }, plan: { ambient: 0.03, mist: 0.006, extinct: 0.002 }, gain: 2.1, grade: SODIUM5 } },
  notes: "The Quota era 5: the window's spots on the dressed table, the hill street dark.",
});

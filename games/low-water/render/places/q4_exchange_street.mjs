// The Quota era 4: Exchange Street at night, the sign. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { exchangeStreet } from "../worlds/q4_rooms.mjs";
import { place, STREET4, SODIUM_GRADE } from "./_q4.mjs";
export default place("q4_exchange_street", exchangeStreet(), {
  indoor: false, camera: { ...STREET4, target: [-2.5, 2.6, -2.5], ppm: 88 }, seed: 683, walk: ["cobble", "slab", "steps"],
  variants: { night: { hour: 1.4, note: "year 70, 01:25: CHAFFERS OUT wet on the sign, the pavement wet, two sodium posts", V: { skyLevel: 0.01, wet: 0.65 }, plan: { ambient: 0.03, mist: 0.006, extinct: 0.002 }, gain: 2.1, grade: SODIUM_GRADE } },
  notes: "The Quota era 4: Exchange Street at night, the sign.",
});

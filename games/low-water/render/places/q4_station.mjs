// The Quota era 4: the station platform, the Saros' bags. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { station } from "../worlds/q4_rooms.mjs";
import { place, STREET4, SODIUM_GRADE } from "./_q4.mjs";
export default place("q4_station", station(), {
  indoor: false, camera: { ...STREET4, target: [0.5, 1.2, 0.0], ppm: 95 }, seed: 661, walk: ["slab"],
  variants: { dusk: { hour: 18.1, note: "year 70, 18:05: the train gone out, sodium under the canopy, the last of the light over the line", V: { day: "dawn", emit: { window: 0.45 } }, plan: { ambient: 0.08, mist: 0.008, extinct: 0.002 }, gain: 2.2, grade: SODIUM_GRADE } },
  notes: "The Quota era 4: the station platform, the Saros' bags.",
});

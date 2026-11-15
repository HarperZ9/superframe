// The Quota era 4: Joss Haldane's flat in Haldane Yard. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era4.mjs";
import { jossFlat } from "../worlds/q4_rooms.mjs";
import { place, ROOM4, SODIUM_GRADE } from "./_q4.mjs";
export default place("q4_joss_flat", layered(jossFlat(), DRESS.q4_joss_flat()), {
  indoor: true, camera: { ...ROOM4, target: [-0.1, 0.9, -0.3], ppm: 205 }, seed: 641, walk: ["lino"],
  variants: { evening: { hour: 19.5, note: "year 70, 19:30: the bulb over the door table, the yard dark in the window", V: { fill: 0.3 }, plan: { ambient: 0.008, mist: 0.003, extinct: 0.001 }, gain: 2.3, grade: SODIUM_GRADE } },
  notes: "The Quota era 4: Joss Haldane's flat in Haldane Yard.",
});

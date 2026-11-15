// The Quota era 4: Pell Furrowe's kitchen. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era4.mjs";
import { furroweHouse } from "../worlds/q4_rooms.mjs";
import { place, ROOM4, DAY4 } from "./_q4.mjs";
export default place("q4_furrowe_house", layered(furroweHouse(), DRESS.q4_furrowe_house()), {
  indoor: true, camera: { ...ROOM4, target: [0.0, 0.9, -0.3], ppm: 205 }, seed: 619, walk: ["lino"],
  variants: { afternoon: { hour: 16.2, note: "year 70, 16:10: grey autumn light over the sink, the bulb not lit", V: { fill: 0.6 }, plan: { ambient: 0.014, mist: 0.003, extinct: 0.001 }, gain: 2.4, grade: DAY4 } },
  notes: "The Quota era 4: Pell Furrowe's kitchen.",
});

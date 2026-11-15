// The Quota era 4: Davey Brack's flat over the Crown. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era4.mjs";
import { brackFlat } from "../worlds/q4_rooms.mjs";
import { place, ROOM4, SODIUM_GRADE } from "./_q4.mjs";
export default place("q4_brack_flat", layered(brackFlat(), DRESS.q4_brack_flat()), {
  indoor: true, camera: { ...ROOM4, target: [0.0, 0.9, -0.3], ppm: 205 }, seed: 631, walk: ["carpet"],
  variants: { night: { hour: 22.2, note: "year 70, 22:10: the street's sodium up through the glass, the bulb low", V: { fill: 0.25 }, plan: { ambient: 0.006, mist: 0.003, extinct: 0.001 }, gain: 2.4, grade: SODIUM_GRADE } },
  notes: "The Quota era 4: Davey Brack's flat over the Crown.",
});

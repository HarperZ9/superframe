// Anni's kitchen at year 38 (The Quota's witness and its cold open; design/spine-plan/02-WITNESS.md). An interlude
// out of era time, between Allocation and the Closure (design/sensory/01-LOOKS.md L3, L4): a bare bulb over the
// table, era 3's patched paint and its colour printed out of register with the line, and through the window the
// first sodium of the Closure, early. The look differs from every era 2 room by light, palette and print.
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era2.mjs";
import { withDetail } from "../props/kinds.mjs";
import { annikitchen } from "../worlds/q_rooms.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { ROOM_CAM } from "./_q2.mjs";
const R = layered(annikitchen(), DRESS.q_anni_room());
export default {
  name: "q_anni_room", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.01, paintId,
  camera: { ...ROOM_CAM, target: [0.3, 0.9, -0.3], ppm: 235 },
  paint: { seed: 211, radii: [16, 9, 5.5, 3], relief: 0.22 }, language: { era: 3, decay: 0.15 }, strokeLight: { strength: 0.8 },
  variants: { evening: { hour: 19.9, note: "year 38, evening: the bulb over the table, the street's first sodium lamp in the window",
    V: { sodium: 110, fill: 0.35 }, plan: { ambient: 0.006, mist: 0.002, extinct: 0.001 }, gain: 2.4, misregister: { dx: 3, dy: 1 },
    grade: { shadowTint: [0.86, 0.9, 0.8], lift: [0.006, 0.007, 0.005], saturation: 0.82 } } },
  figureLights: [{ pos: [1.2, 2.2, 2.2], kind: "paraffin", I: 5, reach: 8 }],   // the room's key on the figures from the camera side (render/bake2.mjs)
  walk: walkIds("boards", "oxblood"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the witness's kitchen, year 38 (era 3 to 4 dress, bulb and sodium).",
};

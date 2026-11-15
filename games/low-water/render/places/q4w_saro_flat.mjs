// The Quota era 4: Mira Saro's kitchen, year 103 (the witness). Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era4.mjs";
import { saroFlat } from "../worlds/q4_rooms.mjs";
import { place, ROOM4 } from "./_q4.mjs";
export default place("q4w_saro_flat", layered(saroFlat(), DRESS.q4w_saro_flat()), {
  indoor: true, camera: { ...ROOM4, target: [-0.1, 0.9, -0.3], ppm: 210 }, seed: 643, walk: ["terrazzo"],
  variants: { evening: { hour: 20.5, note: "year 103, 20:30: the table lamp on the tea glasses; behind the curtain, year 70's sodium", V: { fill: 0.3 }, plan: { ambient: 0.008, mist: 0.003, extinct: 0.001 }, gain: 2.2, grade: { shadowTint: [0.92, 0.84, 0.74], lift: [0.004, 0.003, 0.0025], saturation: 0.8 } } },
  notes: "The Quota era 4: Mira Saro's kitchen, year 103 (the witness).",
});

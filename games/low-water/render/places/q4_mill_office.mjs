// The Quota era 4: the mill manager's office. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { millOffice } from "../worlds/q4_rooms.mjs";
import { place, ROOM4 } from "./_q4.mjs";
// a neutral tube grade for this room (2026-10-24): TUBE_GRADE's green shadow tint cast the whole room green; the walls keep their own green paint
const TUBE_NEUTRAL = { shadowTint: [0.9, 0.92, 0.95], lift: [0.003, 0.003, 0.0034], saturation: 0.62 };
export default place("q4_mill_office", millOffice(), {
  indoor: true, camera: { ...ROOM4, target: [0.1, 1.0, -0.4], ppm: 190 }, seed: 601, walk: ["lino"],
  variants: { morning: { hour: 10.5, note: "year 70, 10:30: the tube on over the desk, the floor through the glass already half dark", V: { fill: 0.15, emit: { window: 0.4 } }, plan: { ambient: 0.012, mist: 0.003, extinct: 0.001 }, gain: 2.1, grade: TUBE_NEUTRAL } },
  notes: "The Quota era 4: the mill manager's office.",
});

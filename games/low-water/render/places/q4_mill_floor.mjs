// The Quota era 4: the mill floor, the last shift. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { millFloor } from "../worlds/q4_rooms.mjs";
import { place, ROOM4, SODIUM_GRADE } from "./_q4.mjs";
export default place("q4_mill_floor", millFloor(), {
  indoor: true, camera: { ...ROOM4, dist: 34, target: [0.0, 1.4, -0.6], ppm: 108 }, seed: 647, walk: ["concrete"],
  variants: { last_shift: { hour: 17.3, note: "year 70, 17:20: the last shift, sodium high bays over the frames, dusk in the tall windows", V: { fill: 0.6, emit: { window: 0.45 } }, plan: { ambient: 0.01, mist: 0.006, extinct: 0.0015 }, gain: 1.9, grade: SODIUM_GRADE } },
  notes: "The Quota era 4: the mill floor, the last shift.",
});

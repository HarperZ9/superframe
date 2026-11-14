// The Quota era 5: police. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { police } from "../worlds/q5_rooms.mjs";
import { place, ROOM5, SCREEN5 } from "./_q5.mjs";
export default place("q5_police", police(), {
  indoor: true, camera: { ...ROOM5, target: [0, 1.1, -0.2], ppm: 198 }, seed: 739, walk: ["lino"],
  variants: { day: { hour: 11.2, note: "year 115, April, 11:10: the corridor tubes in a line, the bench outside Professional Standards", V: { fill: 0.1 }, plan: { ambient: 0.012, mist: 0.003, extinct: 0.001 }, gain: 2.05, grade: SCREEN5 } },
  notes: "The Quota era 5: the corridor tubes in a line, the bench outside Professional Standards.",
});

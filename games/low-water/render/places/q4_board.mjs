// The Quota era 4: the bank's boardroom, the map on the easel. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { board } from "../worlds/q4_rooms.mjs";
import { place, ROOM4, DAY4 } from "./_q4.mjs";
export default place("q4_board", board(), {
  indoor: true, camera: { ...ROOM4, target: [-0.2, 1.1, -0.3], ppm: 165 }, seed: 607, walk: ["carpet"],
  variants: { afternoon: { hour: 15.5, note: "year 70, 15:30: the low autumn sun across the table from the tall window, the pendant lit and weak against it", V: { fill: 0.5 }, plan: { ambient: 0.012, mist: 0.004, extinct: 0.001 }, gain: 2.0, grade: DAY4 } },
  notes: "The Quota era 4: the bank's boardroom, the map on the easel.",
});

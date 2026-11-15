// The Quota era 5: council. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { council } from "../worlds/q5_rooms.mjs";
import { place, ROOM5, APRIL5 } from "./_q5.mjs";
export default place("q5_council", council(), {
  indoor: true, camera: { ...ROOM5, target: [0.4, 1.1, -0.2], ppm: 168 }, seed: 721, walk: ["carpet"],
  variants: { afternoon: { hour: 16.2, note: "year 115, April, 16:10: the tall windows' afternoon, the CCTV still on the wall screen", V: { fill: 0.15 }, plan: { ambient: 0.014, mist: 0.003, extinct: 0.001 }, gain: 2.05, grade: APRIL5 } },
  notes: "The Quota era 5: the tall windows' afternoon, the CCTV still on the wall screen.",
});

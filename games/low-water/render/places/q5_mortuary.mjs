// The Quota era 5: mortuary. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { mortuary } from "../worlds/q5_rooms.mjs";
import { place, ROOM5, SCREEN5 } from "./_q5.mjs";
export default place("q5_mortuary", mortuary(), {
  indoor: true, camera: { ...ROOM5, target: [0, 1, -0.3], ppm: 234 }, seed: 719, walk: ["terrazzo"],
  variants: { night: { hour: 2.6, note: "year 115, April, 02:35: the tubes, one failing, on the tile and the sheet", V: { fill: 0.8 }, plan: { ambient: 0.01, mist: 0.003, extinct: 0.001 }, gain: 2.05, grade: SCREEN5 } },
  notes: "The Quota era 5: the tubes, one failing, on the tile and the sheet.",
});

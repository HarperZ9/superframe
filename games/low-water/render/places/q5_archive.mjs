// The Quota era 5: archive. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { archive } from "../worlds/q5_rooms.mjs";
import { place, ROOM5, SODIUM5 } from "./_q5.mjs";
export default place("q5_archive", archive(), {
  indoor: true, camera: { ...ROOM5, target: [0.3, 1, -0.3], ppm: 216 }, seed: 727, walk: ["boards"],
  variants: { afternoon: { hour: 15.4, note: "year 115, April, 15:25: the reading lamp on the Tesk book, the high window grey", V: { fill: 0.35 }, plan: { ambient: 0.012, mist: 0.003, extinct: 0.001 }, gain: 2.25, grade: SODIUM5 } },
  notes: "The Quota era 5: the reading lamp on the Tesk book, the high window grey.",
});

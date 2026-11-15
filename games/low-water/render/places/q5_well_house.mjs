// The Quota era 5: well house. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { wellHouse } from "../worlds/q5_rooms.mjs";
import { place, ROOM5, SODIUM5 } from "./_q5.mjs";
export default place("q5_well_house", wellHouse(), {
  indoor: true, camera: { ...ROOM5, target: [0, 1, -0.2], ppm: 204 }, seed: 731, walk: ["boards"],
  variants: { night: { hour: 21.8, note: "year 115, April, 21:50: sodium through the mesh, cut into squares on the rugs", V: { fill: 0.2 }, plan: { ambient: 0.007, mist: 0.003, extinct: 0.001 }, gain: 2.65, grade: SODIUM5 } },
  notes: "The Quota era 5: sodium through the mesh, cut into squares on the rugs.",
});

// The Quota era 4: the Well House floor, rebuilt. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { wellFloor } from "../worlds/q4_rooms.mjs";
import { place, ROOM4 } from "./_q4.mjs";
export default place("q4_well_floor", wellFloor(), {
  indoor: true, camera: { ...ROOM4, target: [0.0, 0.9, -0.3], ppm: 175 }, seed: 653, walk: ["oakx"],
  variants: { prayer: { hour: 19, note: "year 70, 19:00: evening prayer, brass lamps low over the rugs", V: { fill: 0.3 }, plan: { ambient: 0.008, mist: 0.004, extinct: 0.001 }, gain: 2.2, grade: { shadowTint: [0.95, 0.82, 0.68], lift: [0.004, 0.003, 0.002], saturation: 0.78 } } },
  notes: "The Quota era 4: the Well House floor, rebuilt.",
});

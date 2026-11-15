// The Quota era 5: ring verge. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { ringVerge } from "../worlds/q5_rooms.mjs";
import { place, STREET5, SODIUM5 } from "./_q5.mjs";
export default place("q5_ring_verge", ringVerge(), {
  indoor: false, camera: { ...STREET5, target: [0.4, 0.6, 1.0], ppm: 110 }, seed: 733, walk: ["turf5", "mud", "gravel5"],
  variants: { night: { hour: 0.4, note: "year 115, April, 00:25: the footpath lamp at the foot of the bank lights the stone and the path; the road's sodium along the top", V: { skyLevel: 0.01 }, plan: { ambient: 0.012, mist: 0.004, extinct: 0.002 }, gain: 2.4, grade: SODIUM5 } },
  notes: "The Quota era 5: the ring road's sodium along the top, the verge dark, the stone.",
});

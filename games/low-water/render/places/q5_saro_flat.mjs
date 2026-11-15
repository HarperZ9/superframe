// The Quota era 5: saro flat. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { saroFlat } from "../worlds/q5_rooms.mjs";
import { place, ROOM5, SODIUM5 } from "./_q5.mjs";
export default place("q5_saro_flat", saroFlat(), {
  indoor: true, camera: { ...ROOM5, target: [-0.1, 0.9, -0.3], ppm: 246 }, seed: 713, walk: ["carpet"],
  variants: { night: { hour: 22.4, note: "year 115, April, 22:25: the street's sodium through the net, the phone lit on the low table", V: { fill: 0.15 }, plan: { ambient: 0.006, mist: 0.003, extinct: 0.001 }, gain: 2.65, grade: SODIUM5 } },
  notes: "The Quota era 5: the street's sodium through the net, the phone lit on the low table.",
});

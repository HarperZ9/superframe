// The Quota era 5: syndicate. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { syndicate } from "../worlds/q5_rooms.mjs";
import { place, ROOM5, APRIL5 } from "./_q5.mjs";
export default place("q5_syndicate", syndicate(), {
  indoor: true, camera: { ...ROOM5, target: [0.4, 1, -0.2], ppm: 204 }, seed: 741, walk: ["carpet"],
  variants: { afternoon: { hour: 14.6, note: "year 115, April, 14:35: flat window light on the model of the ring road", V: { fill: 0.12 }, plan: { ambient: 0.014, mist: 0.003, extinct: 0.001 }, gain: 2.05, grade: APRIL5 } },
  notes: "The Quota era 5: flat window light on the model of the ring road.",
});

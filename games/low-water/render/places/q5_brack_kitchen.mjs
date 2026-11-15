// The Quota era 5: brack kitchen. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { brackKitchen } from "../worlds/q5_rooms.mjs";
import { place, ROOM5, SODIUM5 } from "./_q5.mjs";
export default place("q5_brack_kitchen", brackKitchen(), {
  indoor: true, camera: { ...ROOM5, target: [0, 0.9, -0.3], ppm: 240 }, seed: 709, walk: ["vinyl"],
  variants: { night: { hour: 1.7, note: "year 115, April, 01:40: the hood light only, the estate's sodium in the window", V: { fill: 0.2 }, plan: { ambient: 0.008, mist: 0.003, extinct: 0.001 }, gain: 2.55, grade: SODIUM5 } },
  notes: "The Quota era 5: the hood light only, the estate's sodium in the window.",
});

// The Quota era 5: furrowe kitchen. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { furroweKitchen } from "../worlds/q5_rooms.mjs";
import { place, ROOM5, SODIUM5 } from "./_q5.mjs";
export default place("q5_furrowe_kitchen", furroweKitchen(), {
  indoor: true, camera: { ...ROOM5, target: [0.1, 0.9, -0.2], ppm: 228 }, seed: 707, walk: ["vinyl"],
  variants: { evening: { hour: 19.1, note: "year 115, April, 19:05: the pendant low over the table, the phone face up among the plates", V: { fill: 0.1 }, plan: { ambient: 0.01, mist: 0.003, extinct: 0.001 }, gain: 2.25, grade: SODIUM5 } },
  notes: "The Quota era 5: the pendant low over the table, the phone face up among the plates.",
});

// The Quota era 4: the mill yard and the gate. Plates agent, 2026-10-22 (render/worlds/q4_rooms.mjs, render/props/e4_*.mjs).
import { millYard } from "../worlds/q4_rooms.mjs";
import { place, STREET4, SODIUM_GRADE } from "./_q4.mjs";
export default place("q4_mill_yard", millYard(), {
  indoor: false, camera: { ...STREET4, target: [-0.5, 2.6, -0.5], ppm: 72 }, seed: 673, walk: ["cobble"],
  variants: { dusk: { hour: 17.4, note: "year 70, 17:25: the gate lamp on, the picket's brazier, the stack against the last light", V: { day: "dawn" }, plan: { ambient: 0.05, mist: 0.008, extinct: 0.002 }, gain: 1.6, grade: SODIUM_GRADE } },
  notes: "The Quota era 4: the mill yard and the gate.",
});

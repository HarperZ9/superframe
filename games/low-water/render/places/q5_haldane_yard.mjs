// The Quota era 5: haldane yard. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { haldaneYard } from "../worlds/q5_rooms.mjs";
import { place, STREET5, APRIL5 } from "./_q5.mjs";
export default place("q5_haldane_yard", haldaneYard(), {
  indoor: false, camera: { ...STREET5, target: [0.5, 1.4, -0.5], ppm: 92 }, seed: 723, walk: ["cobble", "mud"],
  variants: { dawn: { hour: 5.9, note: "year 115, April, 05:55: first light, grey; the van's lightbar turning blue on the brick", V: { skyLevel: 0.04, wet: 0.3 }, plan: { ambient: 0.035, mist: 0.006, extinct: 0.002 }, gain: 2, grade: APRIL5 } },
  notes: "The Quota era 5: first light, grey; the van's lightbar turning blue on the brick.",
});

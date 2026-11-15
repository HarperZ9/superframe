// The Quota era 5: mara flat. Plates agent, 2026-10-23 (render/worlds/q5_rooms.mjs, render/props/e5_*.mjs).
import { maraFlat } from "../worlds/q5_rooms.mjs";
import { place, ROOM5, APRIL5 } from "./_q5.mjs";
export default place("q5_mara_flat", maraFlat(), {
  indoor: true, camera: { ...ROOM5, target: [0, 0.9, -0.3], ppm: 234 }, seed: 717, walk: ["vinyl"],
  variants: { morning: { hour: 9.3, note: "year 115, April, 09:20: grey spring light in the yard window, the ledger open", V: { fill: 0.3 }, plan: { ambient: 0.02, mist: 0.003, extinct: 0.001 }, gain: 2.15, grade: APRIL5 } },
  notes: "The Quota era 5: grey spring light in the yard window, the ledger open.",
});

// The Haldane table a week later (the coda, The Quota slice): four bowls, the fifth turned over on the Well
// shelf and its stool pushed to the wall. Evening: one candle on the table, the embers lower, the window dark blue.
import { haldane } from "../worlds/haldane.mjs";
import H from "./q_haldane.mjs";
const R = haldane({ set: "coda" });
export default { ...H, language: { era: 2, decay: 0.65 }, name: "q_haldane_coda", world: R.world, lights: R.lights, marks: R.marks,
  variants: { dusk: { hour: 17.2, note: "17:10, a week later: one candle, the embers low, the window going dark blue", V: { window: 3, windowType: 3, fill: 0.2 }, plan: { ambient: 0.006, mist: 0.003, extinct: 0.001 }, gain: 2.6 } },
  notes: "The Quota slice coda: the Haldane table, four bowls." };

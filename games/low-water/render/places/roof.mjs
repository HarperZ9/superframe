// The weigh-house roof (design/PLACES-NEW.md section 5): night (wet lead under the quay's sodium) and frost
// (after 04:10: the roof white, the beam frozen at its tilt). The lantern on the hook is run-time light.
// Blackout: the sodium goes; starlight and the town's paraffin only.
import { roof } from "../worlds/roof.mjs";
import { surf, footing, walkIds, paintId, sky } from "./_common.mjs";
const R = roof();
export default {
  name: "roof", world: R.world, lights: R.lights, surf, sky: (d, V, o) => sky(d, { ...V, skyLevel: 0.012, stars: 0 }, o), paintId,
  camera: { yawDeg: 34, elevDeg: 40, target: [-0.3, 0.9, -0.3], ppm: 250, W: 2200, H: 1600, dist: 40 },
  paint: { seed: 41, radii: [14, 8, 4.5, 2.6], relief: 0.26 },
  variants: {
    night: { hour: 23.0, note: "wet lead; the quay's sodium up past the parapet", V: { wet: 0.8, fill: 14 }, plan: { ambient: 0.02, mist: 0.006, extinct: 0.002 }, gain: 1.9 },
    frost: { hour: 4.3, note: "after 04:10: the roof white, the beam frozen at its tilt", V: { frost: 1, fill: 10, moon: { pos: [-80, 70, -120], I: 6000 } }, plan: { ambient: 0.02, mist: 0.002, extinct: 0.0015 }, gain: 1.6 },
  },
  dark: { lights: [], emit: ["lantern"], plan: { dark: 0.02 } },
  walk: walkIds("roof"), footing: footing(), marks: R.marks,
  notes: "Lead at y 0, -z toward the harbour; the quay 7 m below. Hobb is drawn by the game.",
};

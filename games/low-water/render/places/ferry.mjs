// The ferry deck (design/PLACES-NEW.md section 1): the Saint Cuthwin's after deck at 22:20 to 22:41 on
// Low Night, closer than the quay so people read at deck scale. One variant, night. Blackout: the
// binnacle and the masthead light (the ship has its own oil).
import { ferry } from "../worlds/ferry.mjs";
import { surf, footing, walkIds, paintId, sky } from "./_common.mjs";
import { vnoise } from "../sdf.mjs";
// the open sea round the hull: a swell and a chop, so the lamps break into streaks on it (the gameplay
// lead: the water read as flat navy with no surface)
const seaRipple = (P) => P[1] < -1.0 ? [0.16 * (vnoise(P[0] * 0.9, P[2] * 0.35) - 0.5) + 0.07 * (vnoise(P[0] * 3.1 + 5, P[2] * 3.1) - 0.5), 0.22 * (vnoise(P[0] * 0.9 + 9, P[2] * 0.35 + 3) - 0.5) + 0.07 * (vnoise(P[0] * 3.1, P[2] * 3.1 + 7) - 0.5)] : [0, 0];
const R = ferry();
export default {
  name: "ferry", world: R.world, lights: R.lights, surf, ripple: seaRipple, rippleLight: true, sky: (d, V, o) => sky(d, { ...V, skyLevel: 0.012, stars: 1 }, o), paintId,
  camera: { yawDeg: 206, elevDeg: 30, target: [0, 0.4, 1.6], ppm: 150, W: 2400, H: 1520, dist: 40 },   // from astern, looking forward to the town
  paint: { seed: 23, radii: [14, 8, 4.5, 2.6], relief: 0.26 },
  variants: {
    night: { hour: 22.5, note: "22:20 to 22:41: the binnacle and the masthead light; the quay's sodium ahead", V: { wet: 0.3, fill: 9, moon: { pos: [-60, 25, 140], I: 26000 } }, plan: { ambient: 0.02, mist: 0.004, extinct: 0.0015 }, gain: 2.2 },
  },
  dark: { lights: [{ pos: [-0.8, 1.75, 4.6], radius: 4, intensity: 1.5 }, { pos: [0.9, 5.95, 4.3], radius: 6, intensity: 1.2 }], emit: ["lantern"], plan: { dark: 0.02 } },
  walk: walkIds("deck", "plank"), footing: footing(), marks: R.marks,
  notes: "After deck at y 0 (heeled 0.05 rad to starboard), +z forward to the town. Penhallow and the passengers are drawn by the game.",
};

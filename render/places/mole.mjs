// The mole and Mother's foot, a camera on the harbour world: the stone arm with no rail on the
// windward side and the lee rail over the weed ledge, the halfway bollard, the mole steps and the
// Saint Cuthwin, the KEEPER door with its boathook brackets and red pilot. Variants: night (spray on
// the windward side), frost (04:10 to 06:20: white fur on every stone, the frost run), dark.
import { harbour, MOTHER } from "../worlds/harbour.mjs";
import { surf, sky, ripple, footing, walkIds, paintId } from "./_common.mjs";
const H = harbour({ set: "night" });
export default {
  name: "mole", world: H.world, lights: H.lights, surf, sky, ripple, paintId,
  camera: { yawDeg: 26, elevDeg: 32, target: [31, 5.5, -2.4], ppm: 80, W: 3200, H: 2160, dist: 70 },
  paint: { seed: 17, radii: [14, 8, 4.6, 2.6], relief: 0.25 },
  variants: {
    night: { hour: 23.4, note: "Night 1: spray over the windward side, the Saint Cuthwin at the mole steps", V: { wet: 0.5, moon: { pos: [150, 90, 120], I: 14000 }, stars: 1.4 }, plan: { ambient: 0.018, mist: 0.004, extinct: 0.002 }, gain: 1.5 },
    frost: { hour: 4.6, note: "04:10 to 06:20 on Night 1 and from 01:00 on Night 2: white fur on every stone", V: { frost: 1.2, moon: { pos: [150, 90, 120], I: 22000 }, stars: 2, emit: { lantern: 0.8, candle: 0 } }, plan: { ambient: 0.02, mist: 0.002, extinct: 0.0015 }, gain: 1.5 },
  },
  dark: { lights: [{ pos: [27.6, 3.3, -3.1], radius: 7, intensity: 2.2 }, { pos: [MOTHER[0] - 1.55, 2.6, MOTHER[2] + 0.5], radius: 3, intensity: 1.2 }], emit: ["lantern", "window"], plan: { dark: 0.06 } },
  walk: walkIds("mole", "steps", "cobble", "slab"), footing: footing(), marks: H.marks,
  notes: "The mole. Mother's beam and the sea spray are the game's.",
};

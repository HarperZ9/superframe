// The Municipal substation (Act 2, place substation): test (03:00, frost: the caged white bulb on, the
// engineer's tools out; the e.substation fight) and unlit (the bulb off: frost light through the louvres
// only). Blackout: nothing in the room burns.
import { substation } from "../worlds/substation.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = substation();
export default {
  name: "substation", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.003, paintId,
  camera: { yawDeg: 34, elevDeg: 34, target: [0, 0.9, -0.2], ppm: 230, W: 2000, H: 1500, dist: 25 },
  paint: { seed: 59, radii: [15, 8.5, 5, 2.8], relief: 0.26 },
  variants: {
    test: { hour: 3.0, note: "03:00, the equipment test: the caged white bulb, the board, the hum", V: { fill: 1.5 }, plan: { ambient: 0.008, mist: 0.002, extinct: 0.001 }, gain: 1.4 },
    unlit: { hour: 2.0, note: "the bulb off: frost light through the louvres", V: { emit: { white: 0 }, fill: 2.0 }, plan: { ambient: 0.006, mist: 0.002, extinct: 0.001 }, gain: 2.0 },
  },
  dark: { lights: [{ pos: [-2.2, 1.9, -0.2], radius: 2.5, intensity: 0.6 }], emit: [], plan: { dark: 0.02 } },
  walk: walkIds("slab"), footing: footing(), marks: R.marks,
  notes: "Act 2, place substation. Board on the back wall (-z), louvres at -x, the duct's grating at the front right, the door at the front right. Fisk and the Trust guards are drawn by the game.",
};

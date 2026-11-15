// Brother Ash's vestry (Act 2, place gas_vestry): one night variant by candle. Blackout: the candles.
import { vestry } from "../worlds/vestry.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = vestry();
export default {
  name: "vestry", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.003, paintId,
  camera: { yawDeg: 34, elevDeg: 32, target: [0, 0.8, -0.1], ppm: 250, W: 2000, H: 1500, dist: 25 },
  paint: { seed: 61, radii: [15, 8.5, 5, 2.8], relief: 0.28 },
  variants: {
    candles: { hour: 22.0, note: "the old valve house by candle: the red ledger, the poor box, the spare jars", V: { fill: 1.6 }, plan: { ambient: 0.008, mist: 0.006, extinct: 0.002 }, gain: 1.7 },
  },
  dark: { lights: [{ pos: [1.7, 1.7, -0.25], radius: 2.5, intensity: 1.0 }, { pos: [0.25, 1.0, -1.2], radius: 2, intensity: 0.8 }], emit: ["candle"], plan: { dark: 0.02 } },
  walk: walkIds("slab"), footing: footing(), marks: R.marks,
  notes: "Act 2, place gas_vestry. The door to the frame at -x, the gas main and its valve at the back right. Brother Ash is drawn by the game.",
};

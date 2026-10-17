// The Brine's bar at the closer room camera: night (23:00), the Wet Hour (01:30, rain on the hull,
// every lamp up), and the blackout (the stove's red mouth). Same coordinates as the Phase 3 room.
import { brineRoom } from "../worlds/brine_in.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
const R = brineRoom({ set: "night" });
export default {
  name: "brine", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.006, paintId,
  camera: { yawDeg: 34, elevDeg: 34, target: [0.2, 1.2, -0.6], ppm: 190, W: 3040, H: 1720, dist: 30 },
  paint: { seed: 7, radii: [15, 8.5, 5, 2.8], relief: 0.28 },
  variants: {
    night: { hour: 23.2, note: "23:00: paraffin, the stove, the quay's sodium in the portholes", V: { sodiumIn: 14, fill: 5 }, plan: { ambient: 0.012, mist: 0.002, extinct: 0.001 }, gain: 1.6 },
    wethour: { hour: 1.8, note: "the Wet Hour, 01:30 to 02:40: rain on the hull, every lamp turned up", V: { sodiumIn: 8, fill: 7, emit: { lantern: 1.35, fire: 1.3 } }, plan: { ambient: 0.01, mist: 0.004, extinct: 0.001 }, gain: 1.6 },
  },
  dark: { lights: [{ pos: [-3.7, 0.5, -0.6], radius: 5, intensity: 2.2 }, { pos: [3.7, 0.95, -1.9], radius: 3.5, intensity: 1.2 }], emit: ["fire"], sky: 0.0, plan: { dark: 0.015 } },
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "The Brine's bar. People are drawn by the game. The blackout plate keeps only the stove and the oven.",
};

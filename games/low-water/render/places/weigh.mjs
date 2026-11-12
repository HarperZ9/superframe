// The weigh-house after the vote at the closer room camera: the after-vote (23:30, four lamps) and the
// lights-out vote and blackout (e.afterdark: the wicks down, one candle). Phase 3 room coordinates.
import { weighRoom } from "../worlds/weigh_in.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = weighRoom({ set: "night" });
export default {
  name: "weigh", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.006, paintId,
  camera: { yawDeg: 42, elevDeg: 33, target: [-0.3, 1.9, -0.6], ppm: 190, W: 3320, H: 2400, dist: 30 },
  paint: { seed: 9, radii: [15, 8.5, 5, 2.8], relief: 0.28 },
  variants: {
    night: { hour: 23.4, note: "the after-vote, 23:30: four lamps, the quay's sodium through the louvre", V: { fill: 3 }, plan: { ambient: 0.008, mist: 0.004, extinct: 0.001 }, gain: 1.6 },
  },
  dark: { lights: [{ pos: [3.4, 1.2, -4.4], radius: 4.5, intensity: 1.6 }, { pos: [-5.8, 2.9, 0.6], radius: 6, intensity: 1.4 }, { pos: [-4.8, 1.85, -3.9], radius: 3.5, intensity: 1.6 }], emit: ["lantern"], lit: (id, p) => p[0] < -4.5, plan: { dark: 0.02 } },
  walk: walkIds("boards", "iron"), footing: footing(), marks: R.marks,
  notes: "The after-vote. The Guild are drawn by the game (no baked crowd). The blackout keeps Pip's lamp at the tube, the louvre and the door crack.",
};

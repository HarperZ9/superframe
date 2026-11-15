// The Low Company's net loft (design/PLACES-NEW.md section 4): one night variant, very dark (place light
// 0.15): a shuttered lantern and the lane's light up the hatch. Lamb's own lantern matters here; the game
// lights it. Blackout: the shuttered lantern.
import { loftRoom } from "../worlds/loft.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = loftRoom();
export default {
  name: "loft", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.003, paintId,
  camera: { yawDeg: 34, elevDeg: 30, target: [0, 0.6, -0.2], ppm: 200, W: 2000, H: 1400, dist: 25 },
  paint: { seed: 37, radii: [15, 8.5, 5, 2.8], relief: 0.28 },
  variants: {
    night: { hour: 1.0, note: "a shuttered lantern, the lane's light up the hatch; very dark", V: { fill: 3.0 }, plan: { ambient: 0.006, mist: 0.004, extinct: 0.001 }, gain: 2.0 },
  },
  dark: { lights: [{ pos: [-1.3, 1.6, -0.15], radius: 3, intensity: 1.0 }], emit: ["lantern"], plan: { dark: 0.02 } },
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "The hatch and its ladder at +x near the front; the lowest beam over the sack. Lugg and Merrow are drawn by the game.",
};

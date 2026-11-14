// The Gannet house's front room (Act 2, place gannet_house): one night variant: the stove, a candle on the
// crossword, the light under the back room's door. Blackout: the stove and the candle (place light 0.4
// in the dark too).
import { gannet } from "../worlds/gannet.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = gannet();
export default {
  name: "gannet", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.003, paintId,
  camera: { yawDeg: 34, elevDeg: 32, target: [0, 0.8, -0.2], ppm: 250, W: 2000, H: 1500, dist: 25 },
  paint: { seed: 71, radii: [15, 8.5, 5, 2.8], relief: 0.26 },
  variants: {
    night: { hour: 23.0, note: "the stove ticks; a candle on the crossword; light under the back room's door", V: { fill: 1.5 }, plan: { ambient: 0.008, mist: 0.003, extinct: 0.001 }, gain: 1.6 },
  },
  dark: { lights: [{ pos: [-1.6, 0.4, -0.9], radius: 3, intensity: 1.2 }, { pos: [0.5, 0.95, -0.1], radius: 2, intensity: 0.8 }], emit: ["fire", "candle"], plan: { dark: 0.02 } },
  walk: walkIds("boards", "rug"), footing: footing(), marks: R.marks,
  notes: "Act 2, place gannet_house. The back room's door in the back wall (-z), the window at -x, the stove in the back left corner. Pip is drawn by the game.",
};

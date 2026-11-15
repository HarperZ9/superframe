// The Alderman's study (Act 2, place crake_study): lit (20:00 to 23:00: the yellow shade, the stove, the
// lane's white arc at the window) and switched (the second switch: the arc out; stove and yellow lamp
// only). Blackout: the stove and the lamp.
import { crakeStudy } from "../worlds/crakestudy.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = crakeStudy();
export default {
  name: "crakestudy", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.003, paintId,
  camera: { yawDeg: 34, elevDeg: 32, target: [-0.1, 0.9, -0.4], ppm: 240, W: 2000, H: 1500, dist: 25 },
  paint: { seed: 53, radii: [15, 8.5, 5, 2.8], relief: 0.26 },
  variants: {
    lit: { hour: 21.0, note: "the yellow shade, the stove, the lane's white arc at the window", V: { fill: 1.2 }, plan: { ambient: 0.008, mist: 0.003, extinct: 0.001 }, gain: 1.6 },
    switched: { hour: 21.5, note: "the second switch thrown: the arc out; the stove and the yellow lamp", V: { emit: { white: 0, window: 0 }, fill: 0.8 }, plan: { ambient: 0.006, mist: 0.003, extinct: 0.001 }, gain: 1.9 },
  },
  dark: { lights: [{ pos: [-1.75, 0.4, -0.85], radius: 2.5, intensity: 1.0 }, { pos: [1.05, 1.0, -1.15], radius: 2.2, intensity: 0.9 }], emit: ["lantern", "fire"], plan: { dark: 0.02 } },
  walk: walkIds("boards", "rug"), footing: footing(), marks: R.marks,
  notes: "Act 2, place crake_study. Window at -z over the desk, the side door at -x, the stove in the back corner. The Alderman and Fisk are drawn by the game.",
};

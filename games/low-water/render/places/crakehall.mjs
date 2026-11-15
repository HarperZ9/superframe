// The Alderman's hall (Act 2, place crake_hall): lit (the white bulb, 20:00 to 23:00) and dark (the
// substation's second switch: the hill's arcs and the house's white light out for six minutes; the study's
// stove and yellow lamp through the door). Blackout: the study's spill.
import { crakeHall } from "../worlds/crakehall.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = crakeHall();
export default {
  name: "crakehall", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.003, paintId,
  camera: { yawDeg: 34, elevDeg: 32, target: [0, 1.0, -0.2], ppm: 220, W: 2000, H: 1500, dist: 25 },
  paint: { seed: 47, radii: [15, 8.5, 5, 2.8], relief: 0.26 },
  variants: {
    lit: { hour: 21.0, note: "the white bulb: a bare white hall, nothing casts a shadow it can keep", V: { fill: 1.5 }, plan: { ambient: 0.01, mist: 0.003, extinct: 0.001 }, gain: 1.4 },
    switched: { hour: 21.5, note: "the second switch thrown: six minutes dark; the study's stove and lamp through the door", V: { emit: { white: 0 }, fill: 1.3 }, plan: { ambient: 0.006, mist: 0.003, extinct: 0.001 }, gain: 2.0 },
  },
  dark: { lights: [{ pos: [0.9, 1.2, -2.6], radius: 3, intensity: 1.0 }], emit: ["lantern"], plan: { dark: 0.02 } },
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "Act 2, place crake_hall. Front door and the study door in the back wall (-z), the stair up the left (-x). Mrs Pellow and the Alderman are drawn by the game.",
};

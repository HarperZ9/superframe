// The Lamplighters' station, laid out on the HILL fight arena (arena x, z = world x, z): lit (the
// three white lamps, "no dark anywhere") and dark (the lamps cut: the stove's red line).
import { station } from "../worlds/station.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = station();
export default {
  name: "station", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.004, paintId,
  camera: { yawDeg: 40, elevDeg: 36, target: [6.6, 1.6, 4.6], ppm: 190, W: 3440, H: 2560, dist: 30 },
  paint: { seed: 29, radii: [15, 8.5, 5, 2.8], relief: 0.28 },
  variants: {
    lit: { hour: 21.0, note: "the three white lamps: lit so hard the whitewash hums", V: { fill: 4 }, plan: { ambient: 0.02, mist: 0.002, extinct: 0.001 }, gain: 1.05, grade: { saturation: 0.7 } },
    dark: { hour: 3.0, note: "the lamps cut: the stove a red line", V: { emit: { white: 0 } }, plan: { ambient: 0.004, mist: 0.002, extinct: 0.001 }, gain: 2.0 },
  },
  walk: walkIds("slab"), footing: footing(), marks: R.marks,
  arena: { name: "hill", worldOfArena: "x = arena x, z = arena z, y = 0 (arena h 40)", cell: 1, origin: [0, 0], note: "white lamps over x 3, 7, 11 at z 1; door 6..8 at z 10; stove proposed as cover at 1.6, 7.4" },
  notes: "The station interior, matched to the combat arena HILL.",
};

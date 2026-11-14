// The telegraph office (Act 2, place telegraph): open (to 22:00, Rook at the grille under her lamp) and
// shut (22:00 to 23:00: the office empty, the lamp out, the stove low). Blackout: the lamp and the stove.
import { telegraph } from "../worlds/telegraph.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = telegraph();
export default {
  name: "telegraph", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.003, paintId,
  camera: { yawDeg: 34, elevDeg: 32, target: [0, 0.9, -0.2], ppm: 230, W: 2000, H: 1500, dist: 25 },
  paint: { seed: 67, radii: [15, 8.5, 5, 2.8], relief: 0.26 },
  variants: {
    open: { hour: 21.0, note: "to 22:00: Rook behind the grille under the paraffin lamp", V: { fill: 1.6 }, plan: { ambient: 0.008, mist: 0.003, extinct: 0.001 }, gain: 1.6 },
    shut: { hour: 22.5, note: "22:00 to 23:00: the office empty, the lamp out, the stove low", V: { emit: { lantern: 0, fire: 0.5 }, fill: 1.2 }, plan: { ambient: 0.006, mist: 0.003, extinct: 0.001 }, gain: 2.0 },
  },
  dark: { lights: [{ pos: [-1.5, 1.05, -0.6], radius: 2.5, intensity: 1.0 }, { pos: [-1.9, 0.4, -1.0], radius: 2, intensity: 0.7 }], emit: ["lantern", "fire"], plan: { dark: 0.02 } },
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "Act 2, place telegraph. The counter runs front to back at x -0.3 (Rook's side behind it at -x), the street door in the back wall on the public side. Rook is drawn by the game.",
};

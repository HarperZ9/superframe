// The harbour office and the cells, one section at the closer room camera: night (00:10 to 04:15, the
// desk lamp, the stove, the quay's sodium through the grating) and late (05:30: the stove gone to ash,
// frost on the window, the moon in it). Blackout: the desk lamp and the candle below.
import { officeRoom, CELL_Y } from "../worlds/office_in.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const R = officeRoom();
export default {
  name: "office", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.004, paintId,
  camera: { yawDeg: 34, elevDeg: 30, target: [0.1, -0.15, -0.2], ppm: 190, W: 2240, H: 1600, dist: 25 },
  paint: { seed: 19, radii: [15, 8.5, 5, 2.8], relief: 0.28 },
  variants: {
    night: { hour: 0.5, note: "00:10 to 04:15: the desk lamp, the stove, sodium through the grating below", V: { fill: 1.2 }, plan: { ambient: 0.006, mist: 0.003, extinct: 0.001 }, gain: 1.6 },
    late: { hour: 5.5, note: "05:30: the stove gone to ash, frost on the window, the moon in it", V: { emit: { fire: 0, sodium: 0.6 }, moonIn: 900 }, plan: { ambient: 0.008, mist: 0.002, extinct: 0.001 }, gain: 1.7 },
  },
  dark: { lights: [{ pos: [0.7, 1.05, -1.35], radius: 4, intensity: 1.8 }, { pos: [0.2, CELL_Y + 0.8, 0.9], radius: 3, intensity: 1.4 }], emit: ["lantern", "candle"], plan: { dark: 0.02 } },
  walk: walkIds("boards", "slab", "steps"), footing: footing(), marks: R.marks,
  notes: "Office above (y 0), cells below (y -2.6), joined by six steps on the right. Keel, Gorm and Merrow are drawn by the game.",
};

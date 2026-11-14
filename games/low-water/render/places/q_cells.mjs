// The cells under the district office (q_cells.lwd, q_will.lwd, q_week.lwd): the four days. morning: grey daylight down
// the grating, the guardroom lamp and the stove; night: the night shift, the stove gone down, the lamp the one light
// (the darks held brown-black, not navy).
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era2.mjs";
import { withDetail } from "../props/kinds.mjs";
import { cells } from "../worlds/q_office.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { ROOM_CAM, WARM_DARK } from "./_q2.mjs";
const R = layered(cells(), DRESS.q_cells());
export default {
  name: "q_cells", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.01, paintId,
  camera: { ...ROOM_CAM, target: [0.0, 0.9, -0.4], ppm: 185 },
  paint: { seed: 233, radii: [15, 8.5, 5, 2.8], relief: 0.3 }, language: { era: 2, decay: 0.3 }, strokeLight: { strength: 1 },
  variants: {
    morning: { hour: 7.2, note: "the cells by day: grey light down the grating, the lamp on its hook, the stove", V: { day: "dawn", grate: 6, fill: 0.55 }, plan: { ambient: 0.006, mist: 0.004, extinct: 0.001 }, gain: 2.4, grade: { saturation: 0.7 } },
    night: { hour: 2.0, note: "the night shift: the lamp, the stove down to its last", V: { stove: 0.5, fill: 0.2 }, plan: { ambient: 0.003, mist: 0.004, extinct: 0.001 }, gain: 2.8, grade: WARM_DARK },
  },
  figureLights: [{ pos: [1.4, 2.0, 2.2], kind: "paraffin", I: 4, reach: 7 }],   // the room's key on the figures from the camera side (render/bake2.mjs)
  walk: walkIds("slab"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the cells under the district office.",
};

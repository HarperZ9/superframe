// The Sheaf on Mill Street at dinner time, day 41 (q_sheaf.lwd: joy before the hinge). Grey noon through two small
// windows, a poor fire in the grate, the lamp over the bar turned low.
import { sheaf } from "../worlds/q_rooms.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { ROOM_CAM } from "./_q2.mjs";
import { HARVEST_DAY, HARVEST_GRADE } from "./_q1.mjs";   // era 1's variant (W3-C)
const R = sheaf();
export default {
  name: "q_sheaf", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.03, paintId,
  camera: { ...ROOM_CAM, target: [0.1, 0.9, -0.3], ppm: 200 },
  paint: { seed: 223, radii: [15, 8.5, 5, 2.8], relief: 0.3 }, language: { era: 2, decay: 0.35 }, strokeLight: { strength: 1 },
  variants: { harvest: { hour: 19.4, note: "rent night, year 12, 19:25: the last harvest light in the windows behind Ilo, the bar lamp lit", V: { day: "dawn", window: 12, fill: 1.4 }, plan: { ambient: 0.012, mist: 0.004, extinct: 0.001 }, gain: 2.0, grade: HARVEST_GRADE }, noon: { hour: 12.7, note: "12:40, day 41: grey noon in the windows, the grate low, the bar lamp turned down", V: { day: "dawn", window: 9, fill: 0.9 }, plan: { ambient: 0.012, mist: 0.004, extinct: 0.001 }, gain: 2.1, grade: { saturation: 0.75 } } },
  figureLights: [{ pos: [1.0, 2.3, 2.6], kind: "white", I: 6, reach: 9 }],   // the room's key on the figures from the camera side (render/bake2.mjs)
  walk: walkIds("boards"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the Sheaf at dinner time.",
};

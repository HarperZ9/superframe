// The district meeting room at eleven, day 41 (q_office.lwd): flat winter light from the square on the long table.
import { meeting } from "../worlds/q_office.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { ROOM_CAM } from "./_q2.mjs";
const R = meeting();
export default {
  name: "q_office", world: R.world, lights: R.lights, surf: (id, P, N, V) => surf(id, P, N, { ...V, indoor: true }), sky: () => 0.03, paintId,
  camera: { ...ROOM_CAM, elevDeg: 35, target: [0.2, 1.0, -0.4], ppm: 180 },
  paint: { seed: 229, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 2, decay: 0.2 }, strokeLight: { strength: 1 },
  variants: { morning: { hour: 11.0, note: "11:00, day 41: the square's flat light through the tall windows, the stove cold", V: { day: "dawn", window: 14, fill: 1.2 }, plan: { ambient: 0.014, mist: 0.003, extinct: 0.001 }, gain: 1.9, grade: { saturation: 0.72 } } },
  figureLights: [{ pos: [1.0, 2.6, 2.8], kind: "white", I: 7, reach: 10 }],   // the room's key on the figures from the camera side (render/bake2.mjs)
  walk: walkIds("boards", "rug"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the district meeting room.",
};

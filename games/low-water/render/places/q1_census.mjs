// The registrar's front counter, era 1: Edwin Mott's census, the hands in a line to give their names. The office era 2
// reports to (q_returns), on a harvest morning: the street door propped open, the clerk's lamp not lit.
import { layered } from "../props/dress.mjs";
import { DRESS } from "./layers/era1.mjs";
import { census } from "../worlds/q1_rooms.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail, ID } from "../props/kinds.mjs";
import { HARVEST_GRADE } from "./_q1.mjs";
const R = layered(census(), DRESS.q1_census());
export default {
  name: "q1_census", world: R.world, lights: R.lights, surf: withDetail((id, P, N, V) => surf(id, P, N, { ...V, indoor: true })), sky: () => 0.05, paintId,
  camera: { yawDeg: 34, elevDeg: 34, target: [0.2, 1.1, -0.3], ppm: 175, W: 1920, H: 1300, dist: 22 },
  paint: { seed: 317, radii: [15, 8.5, 5, 2.8], relief: 0.28 }, language: { era: 1, decay: 0.08 }, strokeLight: { strength: 1 },
  variants: { morning: { hour: 9.4, note: "harvest, 09:20: warm morning light from the square, the door propped, the lamp not lit", V: { day: true, sun: { pos: [-183, 35.4, -69], I: 150000, soft: 40 }, fill: 0.35, emit: { lantern: 0 } }, plan: { ambient: 0.035, mist: 0.004, extinct: 0.001 }, gain: 1.9, grade: { ...HARVEST_GRADE, shadowTint: [0.62, 0.55, 0.46], lift: [0.003, 0.003, 0.0035], saturation: 0.7 } },
    work: { hour: 12, note: "a flat work light for judging build stages: no sun, a strong even fill", V: { fill: 7 }, plan: { ambient: 0.1, mist: 0.004, extinct: 0.001 }, gain: 1.6, grade: HARVEST_GRADE } },
  figureLights: [{ pos: [1.2, 2.4, 2.6], kind: "paraffin", I: 7, reach: 9 }, { pos: [-2.6, 1.8, 0.4], kind: "white", I: 4, reach: 7 }],
  walk: [...walkIds("boards", "rug", "oakx", "greyx", "oakz")], footing: footing(), marks: R.marks,
  notes: "The Quota era 1: the registrar's front counter, the census.",
};

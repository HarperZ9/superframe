// The Sheaf on closure night, era 4 (year 70): era 2's room with the jukebox lit against the back wall, pints and full
// ashtrays at the back table (design/eras/era4.md section 5). Plates agent, 2026-10-22.
import { sheaf4 } from "../worlds/q4_rooms.mjs";
import S from "./q_sheaf.mjs";
import { SODIUM_GRADE } from "./_q4.mjs";
import { withDetail } from "../props/kinds.mjs";
const R = sheaf4();
export default {
  ...S, name: "q4_sheaf", world: R.world, lights: R.lights, marks: R.marks, surf: withDetail(S.surf),
  paint: { ...S.paint, seed: 697 }, language: { era: 4, decay: 0.3 },
  variants: { closure: { hour: 21.2, note: "year 70, closure night, 21:10: the bar lamp up, the jukebox's arch lit, the street's sodium in the windows", V: { window: 5, windowType: 0, fill: 0.5 }, plan: { ambient: 0.008, mist: 0.006, extinct: 0.0015 }, gain: 2.1, grade: SODIUM_GRADE } },
  figureLights: [{ pos: [1.0, 2.3, 2.6], kind: "paraffin", I: 5, reach: 9 }],
  notes: "The Quota era 4: the Sheaf on closure night, with a jukebox.",
};

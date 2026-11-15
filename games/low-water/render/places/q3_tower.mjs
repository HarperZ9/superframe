// The Quota era 3, the wide lens from the bell tower, year 20: Exchange Square on the era 2 square world,
// the siding empty, no snow, era 3's washing lines across the street mouths (square() dress hook). Plates package, 2026-10-22.
import { square } from "../worlds/square.mjs";
import S from "./q_square_wide.mjs";
import { L3_GRADE, AUTUMN_DAY } from "./_q3.mjs";
import { dressAllocation } from "../props/e3_street.mjs";
const R = square({ train: false, standins: 50, dress: dressAllocation });
export default {
  ...S, name: "q3_tower", world: R.world, lights: R.lights, marks: R.marks, camera: { ...S.camera },
  paint: { ...S.paint, seed: 461 }, language: { era: 3, decay: 0.15 },
  variants: { morning: { hour: 9.2, note: "September, 09:10: washing lines across Exchange Street, the ration queue at the scale, a dry wind and a grey sky", V: AUTUMN_DAY([-160, 55, -150], 120000), plan: { ambient: 0.1, mist: 0.008, extinct: 0.0015 }, gain: 1.0, grade: L3_GRADE } },
  notes: "The Quota era 3: Exchange Square, from the bell tower.",
};

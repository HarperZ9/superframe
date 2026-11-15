// The Quota era 3, the square at the scale, the riot, year 20: Exchange Square on the era 2 square world,
// the siding empty, no snow, era 3's washing lines across the street mouths (square() dress hook). Plates package, 2026-10-22.
import { square } from "../worlds/square.mjs";
import S from "./q_square_wide.mjs";
import { surf, walkIds, footing } from "./_common.mjs";
import { ID } from "../kit/ids.mjs";
import { withDetail } from "../props/kinds.mjs";
import { L3_GRADE, AUTUMN_DAY } from "./_q3.mjs";
import { dressAllocation } from "../props/e3_street.mjs";
const R = square({ train: false, standins: 90, dress: dressAllocation, season: "autumn" });
export default {
  ...S, surf: withDetail(surf), walk: walkIds("cobble", "steps", "setts_autumn"), footing: { ...footing(), [ID.setts_autumn]: "stone" }, name: "q3_square", world: R.world, lights: R.lights, marks: R.marks, camera: { ...S.camera, yawDeg: 30, elevDeg: 40, target: [-1, 1.2, -7], ppm: 36, dist: 130 },
  paint: { ...S.paint, seed: 463 }, language: { era: 3, decay: 0.15, mist: -0.25 },
  variants: { noon: { hour: 12.2, note: "September, 12:10: the scale weighing rations, the queue gone to a crowd, dust off the plain", V: AUTUMN_DAY([-160, 55, -150], 90000), plan: { ambient: 0.06, mist: 0.008, extinct: 0.0015 }, gain: 1.15, grade: L3_GRADE } },
  notes: "The Quota era 3: Exchange Square, at the scale.",
};

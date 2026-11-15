// Exchange Square from the bell tower, era 1 (year 0, harvest): era 1's own plate of the tower view (q_square_wide),
// the siding empty (no export train in year 0), a warm mid-morning sun, no frost on the cobbles. The area q.tower shows
// it while var.era is 1 (wiring/quota-areas.lwd, plate: q1_tower ? var.era == 1). W3-C addendum, 2026-10-22.
import { square } from "../worlds/square.mjs";
import S from "./q_square_wide.mjs";
import { surf, walkIds, footing } from "./_common.mjs";
import { ID } from "../kit/ids.mjs";
import { withDetail } from "../props/kinds.mjs";
import { HARVEST_DAY, HARVEST_GRADE } from "./_q1.mjs";
const R = square({ train: false, season: "harvest" });
export default {
  ...S, surf: withDetail(surf), walk: walkIds("cobble", "steps", "setts_harvest"), footing: { ...footing(), [ID.setts_harvest]: "stone" }, name: "q1_tower", world: R.world, lights: R.lights, marks: R.marks,
  paint: { ...S.paint, seed: 397 }, language: { era: 1, decay: 0.05, mist: -0.25 },
  variants: { harvest: { hour: 10.7, note: "harvest, year 0, 10:40: a warm sun high over the plain, the square dry, no train at the siding", V: HARVEST_DAY([-150, 70, -90], 100000), plan: { ambient: 0.1, mist: 0.006, extinct: 0.0015 }, gain: 0.95, grade: HARVEST_GRADE } },
  notes: "The Quota era 1: Exchange Square from the bell tower at harvest, the siding empty.",
};

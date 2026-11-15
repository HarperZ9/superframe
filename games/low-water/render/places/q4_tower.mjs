// Exchange Square from the bell tower, era 4 (year 70, shift's end): the first sodium on the square's corners, the
// mill's stack over the roofs where era 3 hung its washing (design/eras/era4.md, design/CINEMATICS.md). Plates agent,
// 2026-10-22. The area q.tower shows it while var.era is 4.
import { tower } from "../worlds/q4_rooms.mjs";
import S from "./q_square_wide.mjs";
import { surf, walkIds, footing } from "./_common.mjs";
import { ID } from "../kit/ids.mjs";
import { withDetail } from "../props/kinds.mjs";
import { SODIUM_GRADE } from "./_q4.mjs";
const R = tower();
export default {
  ...S, surf: withDetail(surf), walk: walkIds("cobble", "steps", "setts_autumn"), footing: { ...footing(), [ID.setts_autumn]: "stone" }, name: "q4_tower", world: R.world, lights: R.lights, marks: R.marks,
  paint: { ...S.paint, seed: 691 }, language: { era: 4, decay: 0.3 },
  variants: { dusk: { hour: 17.7, note: "year 70, 17:40: shift's end, the first sodium coming up orange on the corners, the sky not yet dark", V: { day: "dawn", wet: 0.35, emit: { window: 1, sodium: 1 } }, plan: { ambient: 0.06, mist: 0.006, extinct: 0.0015 }, gain: 1.5, grade: SODIUM_GRADE } },
  notes: "The Quota era 4: Exchange Square from the bell tower at shift's end, the first sodium.",
};

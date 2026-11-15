// Era 3's dressing for the era 2 square world (square({ dress })): washing lines strung between the houses across the
// street mouths and the square's west side, chalked crosses on two doors, a ration notice by the scale, a handcart.
// Plates package, 2026-10-22. Original code.
import * as K from "../kit/props.mjs";
import { chalkCross, notice } from "./e3_room.mjs";
import { ID } from "./kinds.mjs";
export function dressAllocation({ add }) {
  const lines = [[[-20.3, 7.5, -13], [-15, 7.0, -14.6]], [[-20.3, 6.8, -6], [-14, 6.2, -9]], [[-20.3, 7.2, 2], [-13, 6.8, 4.5]], [[-20.3, 6.6, 8.5], [-16, 6.2, 13.3]], [[-16, 7.2, 13.3], [-10.5, 6.8, 13.3]], [[-6, 6.9, 13.3], [0, 7.4, 13.3]], [[4.5, 6.6, 13.3], [11, 7.0, 13.3]], [[9, 7.2, -16.3], [15, 6.9, -16.3]]];
  lines.forEach(([a, b], i) => add(K.washing(a, b, 7 + (i % 3), 300 + i)));
  add(chalkCross([-20.25, 1.4, -1.2], "x", { s: 0.35 })); add(chalkCross([-12.5, 1.4, 13.25], "z", { s: 0.35 }));
  add(notice(-2.4, 1.5, -6.85, { name: "ration_scale_notice", w: 0.45, h: 0.6, seed: 61 }));
  add(K.shape([5.5, 0, 6.5, 7.5, 1.0, 8.0], (x, y, z, T) => T(Math.max(Math.abs(x - 6.5) - 0.7, Math.abs(y - 0.5) - 0.05, Math.abs(z - 7.2) - 0.4), ID.timber)));
}

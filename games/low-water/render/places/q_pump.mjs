// The pump at the end of Mill Street, day 41 after dinner (q_sheaf.lwd q.pump): grey noon, frost, the chalk.
import { pump } from "../worlds/q_streets.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { STREET_CAM } from "./_q2.mjs";
const R = pump();
export default {
  name: "q_pump", world: R.world, lights: R.lights, surf, sky, paintId,
  camera: { ...STREET_CAM, target: [0.5, 2.0, -2.4] },
  paint: { seed: 239, radii: [13, 7.5, 4.4, 2.5], relief: 0.26 }, language: { era: 2, decay: 0.4 }, strokeLight: { strength: 1 },
  variants: { noon: { hour: 12.9, note: "12:55, day 41: grey noon, frost on the setts and the trough iced", V: { day: "dawn", frost: 0.7, sun: { pos: [-150, 60, -220], I: 120000, soft: 40 }, fill: 4, emit: { lantern: 0, window: 0.3 } }, plan: { ambient: 0.3, mist: 0.006, extinct: 0.002 }, gain: 1.35, grade: { saturation: 0.68 } } },
  walk: walkIds("cobble", "slab"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the pump on Mill Street (the fever and the Well).",
};

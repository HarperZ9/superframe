// The Tesks' hill above Krall's End (q_ned.lwd q.ned.hill): day 41, about 15:00, an hour up in the frost. The land
// after the author's Highland references (method only): rust bracken, rock through it, one white house, low mist.
import { hill } from "../worlds/q_country.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { LAND_CAM, exteriorPpm } from "./_q2.mjs";
const R = hill();
export default {
  name: "q_hill", world: R.world, lights: R.lights, surf, sky, paintId,
  camera: { ...LAND_CAM, target: [-3.0, 1.6, -2.5], ppm: exteriorPpm(70, 32) },
  paint: { seed: 269, radii: [12, 7, 4, 2.4], relief: 0.3 }, language: { era: 2, decay: 0.2 }, strokeLight: { strength: 1 },
  variants: { afternoon: { hour: 15.0, note: "day 41, 15:00: frost on the bracken, low cloud on the top, the sun a smear in it", V: { day: "dawn", frost: 0.55, sun: { pos: [-200, 40, -140], I: 160000, soft: 25 }, fill: 6 }, plan: { ambient: 0.34, mist: 0.016, extinct: 0.004 }, gain: 1.35, grade: { saturation: 0.8 } } },
  walk: walkIds("mud", "rust", "wall", "straw"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: the Tesks' hill and the fold.",
};

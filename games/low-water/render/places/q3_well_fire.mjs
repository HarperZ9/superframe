// The Quota era 3: the Well House in Pask's rented yard, the night it burns. Plates package, 2026-10-22:
// render/worlds/q3_rooms_b.mjs wellHouse(). The area q3.well_house shows this plate once the fire starts (wiring/era3-areas.lwd).
import { wellHouse } from "../worlds/q3_rooms_b.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { withDetail } from "../props/kinds.mjs";
import { STREET_CAM } from "./_q2.mjs";
import { L3_GRADE, AUTUMN_DAY } from "./_q3.mjs";
const R = wellHouse({ burning: true });
export default {
  name: "q3_well_fire", world: R.world, lights: R.lights, surf: withDetail(surf), sky, paintId,
  camera: { ...STREET_CAM, target: [-1.0, 1.1, -2.0], ppm: 150, dist: 40 },
  paint: { seed: 457, radii: [12, 7, 4, 2.2], relief: 0.22 }, language: { era: 3, decay: 0.1 }, strokeLight: { strength: 1 },
  variants: { fire: { hour: 22.7, note: "December, 22:40: the Well House burning, the door barred, the roof gone at the back; slow swells of firelight, no strobe", V: { frost: 0.35, fire: 1, moon: { pos: [-80, 70, -120], I: 2500 }, emit: { window: 0 } }, plan: { ambient: 0.006, mist: 0.02, extinct: 0.002 }, gain: 1.45, grade: { shadowTint: [0.86, 0.9, 0.88], lift: [0.002, 0.002, 0.002], saturation: 0.82 } } },
  figureLights: [{ pos: [1.5, 2.4, 2.5], kind: "paraffin", I: 4, reach: 10 }],
  walk: walkIds("mud", "cobble"), footing: footing(), marks: R.marks,
  notes: "The Quota era 3: the Well House, burning.",
};

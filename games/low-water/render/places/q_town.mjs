// Edrin's Upper Town as one map in Oil and Ink (design/CAMERA.md, the approved camera proposal of 2026-10-22): the
// whole town at the one exterior angle, day 41 at dawn, frost and snow, every place the Quota visits where it is.
// A map plate (marks.places: each place's world point), not yet wired as an area.
import { edrin } from "../worlds/edrin.mjs";
import { surf, sky, footing, walkIds, paintId } from "./_common.mjs";
import { EXTERIOR } from "./_q2.mjs";
const R = edrin();
export default {
  name: "q_town", world: R.world, lights: R.lights, surf, sky, paintId,
  camera: { ...EXTERIOR, target: [12, 0, -12], ppm: 15, W: 3200, H: 1800, dist: 160 },
  paint: { seed: 271, radii: [11, 6.5, 3.8, 2.2], relief: 0.24 }, language: { era: 2, decay: 0.3 }, strokeLight: { strength: 0.4 }, ink: { w: 1.2 },
  variants: { dawn: { hour: 7.8, note: "day 41, 07:50: the low sun over the plain's rim, long blue shadows on the snow", V: { day: "dawn", frost: 0.7, sun: { pos: [300, 40, 160], I: 420000, soft: 3 }, fill: 40, emit: { window: 0.4 } }, plan: { ambient: 0.14, mist: 0.003, extinct: 0.001 }, gain: 1.35, grade: { saturation: 0.72 } } },
  walk: walkIds("cobble", "mud", "steps"), footing: footing(), marks: R.marks,
  notes: "The Quota slice: Edrin's Upper Town as one map (the town map plate).",
};

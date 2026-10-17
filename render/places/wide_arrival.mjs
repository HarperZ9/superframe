// Pull-back 1 (CAMERA.md): Lamb's arrival at the mole steps, 22:41 on Low Night. The camera eases out
// to the whole town from the mole: the Saint Cuthwin at the steps, the mole, the sodium line of the
// quay, the crooked row, the hill and the gasholder against the stars. A wide composition, 1920 x 1080.
import { harbour } from "../worlds/harbour.mjs";
import { surf, sky, ripple, paintId } from "./_common.mjs";
const H = harbour({ set: "night" });
export default {
  name: "wide_arrival", world: H.world, lights: H.lights, surf, sky, ripple, paintId,
  camera: { yawDeg: 62, elevDeg: 24, target: [4, 4, -6], ppm: 26, W: 1920, H: 1080, dist: 120 },
  paint: { seed: 51, radii: [9, 5, 3, 1.8], relief: 0.22 }, ink: { w: 1.4 },
  variants: { night: { hour: 22.7, note: "22:41: the arrival", V: { moon: { pos: [-70, 60, -140], I: 5000 }, stars: 1.6 }, plan: { ambient: 0.018, mist: 0.004, extinct: 0.0015 }, gain: 1.5 } },
  walk: [], marks: {}, notes: "Wide pull-back for the arrival (22:41).",
};

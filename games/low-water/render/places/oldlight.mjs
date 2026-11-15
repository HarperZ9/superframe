// The Old Light (Act 3; places oldlight_door, oldlight_mid, oldlight_low, oldlight_stair and eye_water): the
// drowned lighthouse in the eye of the gale, 00:15 to 01:00, under every star there is. Variants: eye (the eye's
// starlight only), strippers (their two lanterns on the middle room's floor). Blackout: starlight.
import { oldLight } from "../worlds/oldlight.mjs";
import { surf, sky, ripple, footing, walkIds, paintId } from "./_common.mjs";
const R = oldLight();
const moon = { pos: [-60, 90, 120], I: 20000 };
export default {
  name: "oldlight", world: R.world, lights: R.lights, surf, sky: (d, V, o) => sky(d, { ...V, skyLevel: 0.01, stars: 3 }, o), ripple, paintId,
  camera: { yawDeg: 34, elevDeg: 40, target: [0.4, 0.4, 0.8], ppm: 165, W: 2200, H: 1600, dist: 40 },
  paint: { seed: 79, radii: [14, 8, 4.5, 2.6], relief: 0.28 },
  variants: {
    eye: { hour: 0.4, note: "00:15 to 01:00, the eye: flat black water, every star there is; inside, dark", V: { wet: 0.6, moon, fill: 14, emit: { lantern: 0 } }, plan: { ambient: 0.02, mist: 0.003, extinct: 0.0015 }, gain: 1.9 },
    strippers: { hour: 0.6, note: "the strippers in the middle room, two lanterns on the floor round the gear", V: { wet: 0.6, moon, fill: 9 }, plan: { ambient: 0.018, mist: 0.004, extinct: 0.0015 }, gain: 1.8 },
  },
  dark: { lights: [{ pos: [0.9, 0.35, 0.6], radius: 2.5, intensity: 0.8 }], emit: ["lantern"], plan: { dark: 0.02 } },
  walk: walkIds("slab", "weed", "weedrock"), footing: footing(), marks: R.marks,
  notes: "Act 3. One plate for the Old Light's places: the door and flooded passage at +z (oldlight_door), the middle room and its gear at the centre (oldlight_mid), the low room a step down at the back right (oldlight_low), the broken stair round the back wall (oldlight_stair), the boat at the base outside (eye_water).",
};

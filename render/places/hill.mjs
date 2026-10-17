// Chancel Hill under the white trial lamps, Night 2: lit (19:10 to 01:00), frost (from 01:00, -2 C),
// dark (the second switch thrown: the stars come down to the roofs, only the candles and the houses).
import { hill } from "../worlds/hill.mjs";
import { surf, sky, ripple, footing, walkIds, paintId } from "./_common.mjs";
const H = hill();
export default {
  name: "hill", world: H.world, lights: H.lights, surf, sky, ripple, paintId,
  camera: { yawDeg: 24, elevDeg: 32, target: [0, 6.5, 0], ppm: 80, W: 3840, H: 2160, dist: 70 },
  paint: { seed: 23, radii: [14, 8, 4.6, 2.6], relief: 0.25 },
  variants: {
    lit: { hour: 21.0, note: "Night 2, 19:10 to 01:00: clear and still, the white arcs, nothing casts a shadow", V: { stars: 1.6, moon: { pos: [-90, 70, -120], I: 5000 } }, plan: { ambient: 0.02, mist: 0.003, extinct: 0.0015 }, gain: 1.35, grade: { saturation: 0.8 } },
    frost: { hour: 2.0, note: "from 01:00: hard frost, the guards stamping at the substation", V: { frost: 1, stars: 2, moon: { pos: [-90, 70, -120], I: 7000 } }, plan: { ambient: 0.02, mist: 0.002, extinct: 0.0015 }, gain: 1.35, grade: { saturation: 0.8 } },
    dark: { hour: 3.0, note: "03:00, the switch thrown: the stars come down to the roofs; candles and windows only", V: { frost: 1, stars: 3, moon: { pos: [-90, 70, -120], I: 9000 }, emit: { white: 0, sodium: 1 } }, plan: { ambient: 0.022, mist: 0.002, extinct: 0.0015 }, gain: 1.6 },
  },
  walk: walkIds("cobble", "slab", "steps"), footing: footing(), marks: H.marks,
  notes: "Chancel Hill path. The station interior is its own plate (station).",
};

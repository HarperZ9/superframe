// The room above the Brine (Lamb's lodging): night (the candle, the stove, the quay's sodium in the
// round window) and day (the interlude's first room: the afternoon through the planking in white
// stripes, the stove cold, the coat drying).
import { room } from "../worlds/room.mjs";
import { surf, footing, walkIds, paintId } from "./_common.mjs";
const N = room({ set: "night" });
export default {
  name: "room", world: N.world, lights: N.lights, surf: (id, P, Nn, V) => surf(id, P, Nn, { ...V, indoor: true }), sky: (d, V) => (V.day ? 0.03 : 0.01), paintId,
  camera: { yawDeg: 30, elevDeg: 36, target: [0, 0.9, 0], ppm: 190, W: 1920, H: 1300, dist: 20 },
  paint: { seed: 41, radii: [15, 8.5, 5, 2.8], relief: 0.28 },
  variants: {
    night: { hour: 23.5, note: "night: the candle on the bench, the stove, the sodium in the round window", V: { porthole: { type: 0, I: 6 }, fill: 0.8 }, plan: { ambient: 0.006, mist: 0.002, extinct: 0.001 }, gain: 1.7 },
  },
  walk: walkIds("boards"), footing: footing(), marks: N.marks,
  notes: "The room above the Brine. The daylight version is room_day.",
};

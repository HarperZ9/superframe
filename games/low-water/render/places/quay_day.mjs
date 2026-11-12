// Lamp Quay by day for the interlude "Two in the Afternoon" (14:00 to 16:00): the town's real
// colours, red washing across the street, the harbour a grey plain with pools holding the sky,
// Merrow's boat on the mud at the mole steps. Same world and camera as the night quay.
import { harbour } from "../worlds/harbour.mjs";
import { surf, sky, ripple, footing, walkIds, paintId } from "./_common.mjs";
import Q from "./quay.mjs";
const H = harbour({ set: "day" });
export default {
  name: "quay_day", world: H.world, lights: H.lights, surf, sky, ripple, paintId,
  camera: Q.camera, paint: { seed: 11, radii: [14, 8, 4.6, 2.6], relief: 0.22 },
  variants: {
    day: { hour: 14.2, note: "14:00: sun from the south-west over the harbour, the tide out", V: { day: true, sun: { pos: [140, 150, 200], I: 400000, fill: [-200, 160, -160] }, emit: { sodium: 0, lantern: 0, candle: 0, window: 0, gutter: 0.3 } }, plan: { ambient: 0.6, mist: 0.0015, extinct: 0.001 }, gain: 1.25, grade: { saturation: 0.72 } },
    late: { hour: 16.0, note: "16:00: the sun goes behind Chancel Hill; the colour drains from the bottom of the terraces up", V: { day: "dawn", sun: { pos: [-60, 22, -200], I: 220000, fill: [200, 160, 200] }, emit: { sodium: 0, lantern: 0, candle: 0, window: 0.2 } }, plan: { ambient: 0.4, mist: 0.002, extinct: 0.0012 }, gain: 1.35, grade: { saturation: 0.8 } },
  },
  walk: Q.walk, footing: footing(), marks: H.marks,
  notes: "Daylight quay for the interlude. Dawn (the minute of colour) is the night set's dawn variant on content/quay.",
};

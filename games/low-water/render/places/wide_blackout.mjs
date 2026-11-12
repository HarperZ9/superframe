// Pull-back 2 (CAMERA.md): the blackouts (21:38 told, 02:50 played). The whole quay at once in the
// engine's dither lighting: only paraffin survives, the walkers' lanterns, the Brine's door, the
// caged lamp at the mole steps, one window in three. 1920 x 1080.
import Q from "./quay.mjs";
export default { ...Q, name: "wide_blackout", camera: { yawDeg: 26, elevDeg: 30, target: [3, 3, -2], ppm: 30, W: 1920, H: 1080, dist: 120 }, variants: {}, notes: "Wide pull-back for the blackouts; dark.png is the plate." };

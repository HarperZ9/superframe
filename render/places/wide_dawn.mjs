// Pull-back 3 (CAMERA.md): the dawn minute of colour, 06:09. The low sun off the sea finds the town's
// real colours for a minute: oxblood, mustard, teal and bone, the frost going, the sodium out. 1920 x 1080.
import Q from "./quay.mjs";
export default { ...Q, name: "wide_dawn", camera: { yawDeg: 26, elevDeg: 28, target: [4, 4, -4], ppm: 28, W: 1920, H: 1080, dist: 120 }, paint: { seed: 53, radii: [9, 5, 3, 1.8], relief: 0.22 }, ink: { w: 1.4 }, variants: { dawn: Q.variants.dawn }, dark: null, notes: "Wide pull-back for the dawn minute of colour." };

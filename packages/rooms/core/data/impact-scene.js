// SPDX-License-Identifier: FSL-1.1-MIT
// The geometry of the impact scene: bars of measured materials lying on supports, balls held above them, and a
// listener, in metres (x along the bars, y up, z towards the listener). packages/daw/engine/impacts.mjs drops
// the balls through this geometry; where a ball lands along its bar sets which modes ring, and the path to the
// listener sets the delay and the spreading loss.
export const IMPACT_SCENE = {
  listener: [0.0, 1.2, 1.5],
  temperatureC: 20,
  bars: [
    { material: "steel_mild", length: 0.2, thickness: 0.008, x0: -0.6, y: 0.8, z: 0.0 },
    { material: "aluminium", length: 0.25, thickness: 0.012, x0: -0.3, y: 0.8, z: 0.05 },
    { material: "steel_mild", length: 0.16, thickness: 0.006, x0: 0.05, y: 0.8, z: -0.05 },
    { material: "aluminium", length: 0.32, thickness: 0.012, x0: 0.3, y: 0.8, z: 0.0 },
  ],
  balls: [
    { x: -0.5, y: 1.6, z: 0.0, radius: 0.01 },
    { x: -0.12, y: 1.9, z: 0.05, radius: 0.01 },
    { x: 0.09, y: 1.3, z: -0.05, radius: 0.01 },
    { x: 0.6, y: 2.2, z: 0.0, radius: 0.01 },
    { x: 1.2, y: 2.0, z: 0.0, radius: 0.01 },
  ],
};

// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Perception frames
// Each has one stated model. Sources are in the shader comments and the note shown to the viewer.
export const FRAMES = [
  { id: 0, name: "Human colour vision", note: "Linear sRGB, tone mapped." },
  {
    id: 1,
    name: "Protan dichromat",
    note: "Machado, Oliveira and Fernandes 2009, severity 1. What the model predicts from cone loss.",
  },
  { id: 2, name: "Deutan dichromat", note: "Machado et al. 2009, severity 1." },
  { id: 3, name: "Tritan dichromat", note: "Machado et al. 2009, severity 1." },
  {
    id: 4,
    name: "Rods only, night",
    note: "Scotopic luminance after Larson, Rushmeier and Piatko 1997. One channel, no colour.",
  },
  {
    id: 5,
    name: "Bee: UV, blue, green",
    lam: [0.54, 0.44, 0.35],
    note: "False colour. Bands at the honeybee photoreceptor peaks 344, 436, 544 nm (Peitsch et al. 1992): green shown as red, blue as green, UV as blue. Lens index follows each band. UV reflectance is extrapolated from blue and green because the worlds carry no measured UV. It shows what the sensor could sample and does not claim to show what the animal sees.",
  },
  {
    id: 6,
    name: "Bird: UV, short, medium",
    lam: [0.51, 0.44, 0.37],
    note: "False colour. Three of the four cone bands of a UV-sensitive bird (Hart 2001), with the same UV extrapolation. It shows what the sensor could sample and does not claim to show what the animal sees.",
  },
  {
    id: 7,
    name: "Compound eye facets",
    facet: true,
    note: "One sample per hexagonal facet at an interommatidial angle of 1.9 degrees, the honeybee value in Land 1997. It shows the sampling and does not claim to show what the animal sees.",
  },
  {
    id: 10,
    name: "Depth, false colour",
    data: 3,
    dmax: 25,
    note: "Distance to the first thing each ray meets, from the same rays. Blue near, red at 25 units.",
  },
  {
    id: 11,
    name: "Path in glass, false colour",
    data: 1,
    dmax: 4,
    note: "Geometric length inside the medium. Blue none, red 4 units.",
  },
  {
    id: 12,
    name: "Bounce count, false colour",
    data: 2,
    dmax: 12,
    note: "Surfaces met per ray. Blue none, red 12.",
  },
  {
    id: 13,
    name: "Optical path, false colour",
    data: 0,
    dmax: 30,
    note: "Sum of n ds to the first scene hit. Blue short, red 30 units.",
  },
  {
    id: 15,
    name: "Time of flight sweep",
    data: 0,
    dmax: 30,
    note: "A light pulse arriving: brightness marks the rays whose optical path matches the sweep, so slow paths through glass lag. One unit of path is one unit of time at c.",
  },
  {
    id: 16,
    name: "Heat study",
    note: "Assumption: warmth is read from how much light a surface returns. Lens treated as clear, though real glass blocks 8 to 14 micrometres (SCHOTT transmission data), so a real thermal camera sees glass as opaque.",
  },
  {
    id: 20,
    name: "Neural lens",
    note: "Pattern model after Ermentrout and Cowan 1979 and Bressloff et al. 2001.",
  },
];
export const frameOf = (St) => FRAMES.find((f) => f.id == (St.frame || 0)) || FRAMES[0];
export function frameFacet(St) {
  const fov = 2 * Math.atan(0.45 / St.zoom);
  return Math.tan((1.9 * Math.PI) / 180) / (2 * Math.tan(fov / 2));
}

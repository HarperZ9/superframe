// Character materials. Each has an id (the ink line runs where ids change), a true colour c
// (display sRGB 0..1, what paraffin and daylight show), a value v (0 black .. 1 white: what the
// sodium ramp shows, since under sodium only value survives), and a stroke recipe for the
// object-space brushwork: scale (m), stretch (along the limb), amount (value swing), sheen.
export const MATS = {
  coat:     { id: 1,  c: [0.20, 0.21, 0.24], v: 0.20, stroke: { scale: 0.06, stretch: 3.5, amount: 0.22 } },
  coatIn:   { id: 2,  c: [0.36, 0.20, 0.16], v: 0.26, stroke: { scale: 0.05, stretch: 2, amount: 0.15 } },
  collar:   { id: 3,  c: [0.88, 0.85, 0.77], v: 0.86, stroke: { scale: 0.03, stretch: 2, amount: 0.12 } },
  skin:     { id: 4,  c: [0.84, 0.64, 0.52], v: 0.60, stroke: { scale: 0.025, stretch: 1.2, amount: 0.10 }, sss: 0.35 },
  hair:     { id: 5,  c: [0.22, 0.17, 0.14], v: 0.18, stroke: { scale: 0.015, stretch: 5, amount: 0.3 } },
  hat:      { id: 6,  c: [0.09, 0.08, 0.09], v: 0.08, stroke: { scale: 0.05, stretch: 2, amount: 0.25 }, sheen: 0.25 },
  boot:     { id: 7,  c: [0.12, 0.09, 0.08], v: 0.10, stroke: { scale: 0.03, stretch: 2, amount: 0.2 }, sheen: 0.4 },
  trouser:  { id: 8,  c: [0.17, 0.16, 0.17], v: 0.16, stroke: { scale: 0.05, stretch: 4, amount: 0.2 } },
  strap:    { id: 9,  c: [0.40, 0.25, 0.14], v: 0.30, stroke: { scale: 0.02, stretch: 4, amount: 0.15 }, sheen: 0.3 },
  case:     { id: 10, c: [0.43, 0.27, 0.15], v: 0.32, stroke: { scale: 0.03, stretch: 2, amount: 0.25 }, sheen: 0.35 },
  brass:    { id: 11, c: [0.82, 0.62, 0.28], v: 0.70, stroke: { scale: 0.02, stretch: 2, amount: 0.15 }, sheen: 0.9 },
  wood:     { id: 12, c: [0.34, 0.22, 0.13], v: 0.26, stroke: { scale: 0.01, stretch: 12, amount: 0.25 }, sheen: 0.2 },
  glass:    { id: 13, c: [0.78, 0.86, 0.86], v: 0.75, stroke: { scale: 0.05, stretch: 1, amount: 0.05 }, sheen: 1.0, alpha: 0.35 },
  flame:    { id: 14, c: [1.00, 0.86, 0.55], v: 1.00, emit: 1 },
  eye:      { id: 15, c: [0.08, 0.05, 0.06], v: 0.05 },
  lip:      { id: 16, c: [0.55, 0.30, 0.28], v: 0.38 },
  surplice: { id: 17, c: [0.93, 0.92, 0.87], v: 0.94, stroke: { scale: 0.06, stretch: 4, amount: 0.12 } },
  oilskin:  { id: 18, c: [0.07, 0.07, 0.08], v: 0.06, stroke: { scale: 0.07, stretch: 3, amount: 0.2 }, sheen: 0.7 },
  apron:    { id: 19, c: [0.90, 0.88, 0.82], v: 0.90, stroke: { scale: 0.05, stretch: 3, amount: 0.18 }, stain: 0.35 },
  smock:    { id: 20, c: [0.25, 0.30, 0.42], v: 0.26, stroke: { scale: 0.05, stretch: 3, amount: 0.22 } },
  scales:   { id: 21, c: [0.80, 0.66, 0.56], v: 0.62, stroke: { scale: 0.008, stretch: 1, amount: 0.12 }, sheen: 0.8, sss: 0.3 },
  band:     { id: 22, c: [0.92, 0.90, 0.86], v: 0.92, stroke: { scale: 0.02, stretch: 3, amount: 0.1 } },
  steel:    { id: 23, c: [0.62, 0.63, 0.66], v: 0.62, stroke: { scale: 0.02, stretch: 6, amount: 0.1 }, sheen: 1.0 },
  shirt:    { id: 24, c: [0.70, 0.68, 0.62], v: 0.68, stroke: { scale: 0.03, stretch: 2, amount: 0.12 } },
  lens:     { id: 25, c: [0.65, 0.75, 0.70], v: 0.65, sheen: 1.0 },
  brow:     { id: 26, c: [0.18, 0.14, 0.12], v: 0.15 },
  white:    { id: 28, c: [0.86, 0.83, 0.76], v: 0.8 },
  cheek:    { id: 29, c: [0.86, 0.56, 0.48], v: 0.58, stroke: { scale: 0.02, stretch: 1, amount: 0.12 } },
  tin:      { id: 30, c: [0.6, 0.6, 0.58], v: 0.6, stroke: { scale: 0.01, stretch: 2, amount: 0.15 }, sheen: 0.6 },
  canvas:   { id: 31, c: [0.74, 0.69, 0.56], v: 0.72, stroke: { scale: 0.05, stretch: 3, amount: 0.22 }, stain: 0.3 },
  wader:    { id: 32, c: [0.16, 0.2, 0.15], v: 0.16, stroke: { scale: 0.06, stretch: 3, amount: 0.2 }, sheen: 0.6 },
  iron:     { id: 33, c: [0.3, 0.29, 0.3], v: 0.28, stroke: { scale: 0.01, stretch: 2, amount: 0.2 }, sheen: 0.7 },
  rope:     { id: 34, c: [0.55, 0.46, 0.3], v: 0.48, stroke: { scale: 0.008, stretch: 6, amount: 0.3 } },
  knit:     { id: 35, c: [0.42, 0.13, 0.11], v: 0.2, stroke: { scale: 0.012, stretch: 1, amount: 0.3 } },
  nail:     { id: 27, c: [0.24, 0.24, 0.27], v: 0.2, stroke: { scale: 0.03, stretch: 2, amount: 0.15 } },
};
export const BY_ID = [];
for (const [name, m] of Object.entries(MATS)) { m.name = name; BY_ID[m.id] = m; }

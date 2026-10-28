// gold.mjs: gold as tinted reflection. A metal has no diffuse body colour: its colour is the Fresnel reflectance of a
// conductor, computed band by band from the complex refractive index n + ik, multiplied into whatever it reflects.
// So the hue of a gold object is the environment's hue, tinted. Exact unpolarised Fresnel for an absorbing medium
// (Born and Wolf, the a^2 + b^2 form used in pbrt). Gold's n, k at the 16 bands of lib/medium/spectral.mjs are from
// Johnson and Christy (1972), recalled from memory: moderate confidence in the curve's shape, low in any one entry.
// The check in tests/value-gold.test.mjs is the familiar curve itself: under 0.5 in the blue, over 0.85 in the red.
import { BANDS } from '../medium/spectral.mjs';

export const GOLD_NK = {
  n: [1.47, 1.46, 1.43, 1.36, 1.18, 0.97, 0.62, 0.43, 0.31, 0.24, 0.2, 0.17, 0.16, 0.16, 0.16, 0.16],
  k: [1.95, 1.95, 1.89, 1.84, 1.8, 1.87, 2.08, 2.4, 2.75, 2.95, 3.09, 3.32, 3.53, 3.75, 3.95, 4.12],
  source: 'Johnson and Christy 1972, Phys. Rev. B 6, 4370; values recalled from memory, moderate confidence',
};

// unpolarised reflectance of an interface from air into n + ik at incidence angle with cosine cosi
export function fresnelConductor(cosi, n, k) {
  const c = Math.min(1, Math.max(1e-6, cosi)), s2 = 1 - c * c, t0 = n * n - k * k - s2, a2b2 = Math.sqrt(t0 * t0 + 4 * n * n * k * k);
  const a = Math.sqrt(Math.max(0, (a2b2 + t0) / 2));
  const Rs = (a2b2 - 2 * a * c + c * c) / (a2b2 + 2 * a * c + c * c);
  const st = s2 / c, Rp = Rs * (a2b2 - 2 * a * st + st * st) / (a2b2 + 2 * a * st + st * st);   // st = sin x tan
  return (Rs + Rp) / 2;
}

export const goldF = cosi => Array.from({ length: BANDS }, (_, i) => fresnelConductor(cosi, GOLD_NK.n[i], GOLD_NK.k[i]));
export const dielectricF = (cosi, ior = 1.5) => new Array(BANDS).fill(fresnelConductor(cosi, ior, 0));

// gold reflectance spectra cached on 256 steps of the cosine (the curve is smooth in angle)
const TABLE = Array.from({ length: 257 }, (_, i) => goldF(i / 256));
export function goldAt(cosi) {
  const f = Math.min(1, Math.max(0, cosi)) * 256, i = Math.min(255, Math.floor(f)), t = f - i, A = TABLE[i], B = TABLE[i + 1];
  return A.map((v, b) => v + (B[b] - v) * t);
}

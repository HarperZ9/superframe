// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// droplens.mjs: a water drop sitting on a window is a spherical cap, and a spherical cap is a plano-convex lens.
// Seen from inside the car, each drop shows a small, inverted, sharp image of the world behind it.
//
//   cap(a, theta)                 base radius a, contact angle theta -> { R, h, V } sphere radius, height, volume
//   baseFromVolume(V, theta)      the base radius of a cap of that volume
//   exitRay(u, v, a, theta, n, d) the eye ray d (unit, +z points out through the glass) entering the drop at offset
//                                 (u, v) from its centre leaves the cap in direction T, or null under total internal
//                                 reflection. Exact vector Snell at the cap; the flat glass layers between air and water
//                                 do not change the direction in water (parallel plates), so the ray enters water as if
//                                 straight from air. Returns { T, trans } with trans the Fresnel power transmittance
//                                 (mean of s and p) of the curved surface.
//   retention / slideRadius       when a drop starts to slide: gravity (and air drag) against the contact-angle
//                                 hysteresis force F = k gamma 2a (cos theta_r - cos theta_a) (Furmidge 1962, with
//                                 k = 48 / pi^3 for a near-circular drop after ElSherbini and Jacobi 2006, from memory,
//                                 moderate confidence).
// Paraxial check: a cap of radius R bends a ray at height u by -(n - 1) u / R, the thin plano-convex lens with focal
// length R / (n - 1). The minus sign is the inversion. tests/seattle-optics.test.mjs.
import { index, fresnel } from '../medium/refraction.mjs';

export const WATER = { gamma: 0.072, rho: 1000, g: 9.81 };   // N/m, kg/m^3, m/s^2 at about 20 C
export const K_RET = 48 / Math.PI ** 3;

export function cap(a, theta) {
  const s = Math.sin(theta), R = a / s, h = R * (1 - Math.cos(theta));
  return { R, h, V: Math.PI * h * h * (3 * R - h) / 3 };
}
// V = pi a^3 (2 - 3 cos + cos^3) / (3 sin^3): the cap volume is a^3 times a constant for a fixed contact angle
export const capShape = theta => { const c = Math.cos(theta), s = Math.sin(theta); return Math.PI * (2 - 3 * c + c ** 3) / (3 * s ** 3); };
export const baseFromVolume = (V, theta) => Math.cbrt(V / capShape(theta));

export const waterIndex = nm => index('water', nm);

export function exitRay(u, v, a, theta, n, d = [0, 0, 1]) {
  const { R, h } = cap(a, theta), r2 = u * u + v * v;
  if (r2 > a * a) return null;
  // refraction from air into water at the flat side: tangential components scale by 1 / n
  const tx = d[0] / n, ty = d[1] / n, tz = Math.sqrt(Math.max(0, 1 - tx * tx - ty * ty)), I = [tx, ty, tz];
  // surface point and outward normal; sphere centre sits R - h below the glass plane
  const z = -(R - h) + Math.sqrt(R * R - r2), N = [u / R, v / R, (z + (R - h)) / R];
  const cosi = I[0] * N[0] + I[1] * N[1] + I[2] * N[2], eta = n, k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  const cosT = Math.sqrt(k), m = eta * cosi - cosT;
  const T = [eta * I[0] - m * N[0], eta * I[1] - m * N[1], eta * I[2] - m * N[2]];
  const f = fresnel(n, 1, cosi);
  return { T, trans: (f.ts + f.tp) / 2 };
}

// hysteresis retention force (N) for base radius a (m)
export const retention = (a, { thetaR, thetaA, gamma = WATER.gamma, k = K_RET }) => k * gamma * 2 * a * (Math.cos(thetaR) - Math.cos(thetaA));

// the base radius (m) at which gravity along the glass alone overcomes retention; tilt is the glass angle from horizontal
export function slideRadius({ theta, thetaR, thetaA, tilt = Math.PI / 2 }) {
  const c = K_RET * WATER.gamma * 2 * (Math.cos(thetaR) - Math.cos(thetaA)), gV = WATER.rho * WATER.g * capShape(theta) * Math.sin(tilt);
  return Math.sqrt(c / gV);
}

// terminal fall speed of a raindrop of diameter D (mm), m/s: Atlas, Srivastava and Sekhon (1973) fit to Gunn and
// Kinzer (1949): v = 9.65 - 10.3 exp(-0.6 D)
export const rainSpeed = D => Math.max(0, 9.65 - 10.3 * Math.exp(-0.6 * D));

// Marshall and Palmer (1948): N(D) = N0 exp(-L D), N0 = 8000 m^-3 mm^-1, L = 4.1 R^-0.21 mm^-1 for rain rate R mm/h.
// Draw a drop diameter (mm) with rng; returns also the total number density (m^-3).
export function marshallPalmer(R) { const L = 4.1 * R ** -0.21; return { N0: 8000, L, density: 8000 / L, draw: rng => -Math.log(1 - rng()) / L }; }

// SPDX-License-Identifier: FSL-1.1-MIT
import { CONSTANTS } from "./constants.js";
// ======================================================================= Liquid lenses
// Spinning mirror: free surface z = omega^2 r^2 / (2 g), focal length g/(2 omega^2). Scene unit read as a metre.
export const G = CONSTANTS.standardGravity.value;
export function liqValue(St) {
  if (St.shape === 52) {
    return (St.omega * St.omega) / (2 * G);
  }
  if (St.shape === 51) {
    return ewCurv(St.volt);
  }
  return 0;
}
// Young-Lippmann: cos(theta) = cos(theta0) + eps0 eps V^2/(2 gamma d), Mugele and Baret 2005; lens layout after Berge and Peseux 2000. Assumed cell: theta0 160 deg, eps 3, d 1 um, gamma 0.04 N/m.
export function ewCurv(V) {
  const c0 = Math.cos((CONSTANTS.electrowettingAngle0.value * Math.PI) / 180),
    c = Math.min(
      1,
      c0 +
        (CONSTANTS.vacuumPermittivity.value * CONSTANTS.electrowettingEpsR.value * V * V) /
          (2 * CONSTANTS.electrowettingTension.value * CONSTANTS.electrowettingThickness.value)
    );
  return -c;
}
// Young-Laplace for an axisymmetric hanging drop, Bashforth and Adams form: d(phi)/ds = 2 - Bo z - sin(phi)/r (pressure falls going up a hanging drop), with lengths in apex radii. Integrated by RK4 from the apex to a 75 degree edge angle, then scaled to the 1.2 aperture.
export const profCache = {};
export function dropProfile(Bo) {
  const key = Bo.toFixed(3);
  if (profCache[key]) return profCache[key];
  let r = 1e-5,
    z = 0,
    ph = 1e-5;
  const pts = [[0, 0]],
    ds = 0.004;
  const F = (r, z, ph) => [
    Math.cos(ph),
    Math.sin(ph),
    2 - Bo * z - (r > 1e-4 ? Math.sin(ph) / r : 1),
  ];
  for (let i = 0; i < 4000 && ph < 1.31; i++) {
    const k1 = F(r, z, ph),
      k2 = F(r + (ds / 2) * k1[0], z + (ds / 2) * k1[1], ph + (ds / 2) * k1[2]),
      k3 = F(r + (ds / 2) * k2[0], z + (ds / 2) * k2[1], ph + (ds / 2) * k2[2]),
      k4 = F(r + ds * k3[0], z + ds * k3[1], ph + ds * k3[2]);
    r += (ds / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    z += (ds / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    ph += (ds / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    pts.push([r, z]);
  }
  const Rb = r,
    zb = z,
    sc = 1.2 / Rb,
    h = new Float32Array(33);
  for (let i = 0; i < 33; i++) {
    const x = Math.sqrt(i / 32) * Rb;
    let k = 0;
    while (k < pts.length - 2 && pts[k + 1][0] < x) k++;
    const a = pts[k],
      b = pts[k + 1],
      t = (x - a[0]) / Math.max(b[0] - a[0], 1e-9);
    h[i] = (zb - (a[1] + (b[1] - a[1]) * t)) * sc;
  }
  return (profCache[key] = { h, apexR: sc, height: zb * sc });
}

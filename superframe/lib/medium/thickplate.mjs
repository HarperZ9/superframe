// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// thickplate.mjs: the coloured rings of a thick silvered glass plate (Newton, Opticks II.4). Two coherent paths reach a
// direction theta (in air) from one normally incident beam: one scattered by the front surface on the way in, crossing
// the glass at the internal angle and reflecting off the back; one crossing normally, reflecting, and scattered by the
// same front-surface point on the way out. Both carry one scatter and one mirror reflection.
//   pathDifference(thetaAir, t, n)            -> 2 n t (1 / cos(thetaGlass) - 1), same units as t
//   intensity(thetaAir, t, n, nm, { a1, a2 })  -> |a1 + a2 e^{i 2 pi delta / lambda}|^2 (a1 = 0: a metal mirror)
//   ringAngle(order, t, n, nm)                 -> the air angle where delta = order * lambda (order 0.5, 1.5 ... dark)
//   ringDiameter(order, t, n, nm, L)           -> 2 L tan(ringAngle)
// Units: t, L and nm must share a length unit; helpers take t and L in inches and nm in nanometres.
// Study: docs/prereg/THICKPLATE-PREREG.md.

const NM_PER_INCH = 25.4e6;

export function pathDifference(thetaAir, t, n) {
  const sg = Math.sin(thetaAir) / n, cg = Math.sqrt(1 - sg * sg);
  return 2 * n * t * (1 / cg - 1);
}

export function intensity(thetaAir, tInch, n, nm, { a1 = 1, a2 = 1 } = {}) {
  const ph = 2 * Math.PI * pathDifference(thetaAir, tInch * NM_PER_INCH, n) / nm;
  return a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(ph);
}

export function ringAngle(order, tInch, n, nm) {
  // 1/cos(thetaGlass) = 1 + order * lambda / (2 n t)
  const c = 1 / (1 + order * nm / (2 * n * tInch * NM_PER_INCH)), sg = Math.sqrt(1 - c * c), sa = n * sg;
  return sa >= 1 ? null : Math.asin(sa);
}

export const ringDiameter = (order, tInch, n, nm, L) => { const a = ringAngle(order, tInch, n, nm); return a === null ? null : 2 * L * Math.tan(a); };

// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// rings.mjs: Newton's rings. A thin air gap between two glasses, reflected with exact Airy multiple-beam theory.
//   gapReflectance(d, nm, { nGlass, cosGlass, sameSign }) -> { s, p, u }: power reflectance of glass | air (d nm) | glass
//                    for light arriving in the glass at cos(theta) = cosGlass; u is the unpolarised mean.
//                    sameSign: true forces both interface reflections to the same sign (a control that removes the
//                    half-wave flip; physically wrong for this stack).
//   cosAir(nGlass, cosGlass) -> cos of the angle in the air gap (Snell); null past the critical angle
//   whiteLuminance(d, cmf, illum, opts) -> relative luminance of white light reflected by the gap
// cmf and illum are { nm: number[], v: number[] } tables (CIE data: ybar and an illuminant), sampled at the same nm.
// Study: docs/prereg/RINGS-PREREG.md.

export function cosAir(nGlass, cosGlass) {
  const s2 = nGlass * nGlass * (1 - cosGlass * cosGlass);
  return s2 >= 1 ? null : Math.sqrt(1 - s2);
}

// Fresnel amplitude coefficients from medium a to b
function fresnelAmp(na, nb, ca, cb) {
  return { s: (na * ca - nb * cb) / (na * ca + nb * cb), p: (nb * ca - na * cb) / (nb * ca + na * cb) };
}

export function gapReflectance(d, nm, { nGlass = 1.5168, cosGlass = 1, sameSign = false } = {}) {
  const ca = cosAir(nGlass, cosGlass);
  if (ca === null) return { s: 1, p: 1, u: 1 };            // total internal reflection (frustrated TIR not modelled)
  const r1 = fresnelAmp(nGlass, 1, cosGlass, ca);         // glass -> air
  const r2 = fresnelAmp(1, nGlass, ca, cosGlass);         // air -> glass (equals -r1)
  const delta = 4 * Math.PI * d * ca / nm, c = Math.cos(delta);
  const R = (a, b) => {
    const bb = sameSign ? -b : b;                          // control: flip the sign of the second reflection
    // |a + b e^{i delta}|^2 / |1 + a b e^{i delta}|^2
    return (a * a + bb * bb + 2 * a * bb * c) / (1 + a * a * bb * bb + 2 * a * bb * c);
  };
  const s = R(r1.s, r2.s), p = R(r1.p, r2.p);
  return { s, p, u: 0.5 * (s + p) };
}

export function whiteLuminance(d, cmf, illum, opts = {}) {
  let num = 0, den = 0;
  for (let i = 0; i < cmf.nm.length; i++) {
    const w = cmf.v[i] * illum.v[i];
    num += w * gapReflectance(d, cmf.nm[i], opts).u; den += w;
  }
  return num / den;
}

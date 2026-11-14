// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// tone.mjs: the display transform shared by every renderer. Two curves, both on linear-light RGB in place.
//
//   display(px, { knee })     For display-referred art (palette hexes must survive). Identity while the largest channel
//                             is under the knee. Above it the largest channel rolls off along the old shoulder curve and
//                             the other two scale by the same factor, so hue holds. Energy past 1.0 then pushes the colour
//                             toward white (path to white), the way an over-exposed print highlight goes, instead of
//                             each channel clipping on its own (which turns a hot amber into a flat lemon plateau).
//   agx(px, { exposure })     For scene-referred light (glow cores, bloom, glass caustics). An AgX-style transform:
//                             inset the primaries toward the achromatic axis, encode each channel in log2 between
//                             -12.47 and +4.03 stops around 0.18, run the 6th-order sigmoid fit, outset, decode to linear.
//                             The constants are the published Blender AgX fit (Sobotka; polynomial by Wrensch), quoted
//                             from memory and checked by the tests (monotone, 0 maps near 0, +8 stops maps under 1).
// Both leave values finite and in [0, 1].
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const KNEE = 0.85;
export const shoulder = (v, k = KNEE) => (v <= k ? v : k + (1 - k) * (1 - Math.exp(-(v - k) / (1 - k))));

// One pixel, display-referred. Returns [r, g, b].
export function displayPixel(r, g, b, k = KNEE) {
  r = r > 0 ? r : 0; g = g > 0 ? g : 0; b = b > 0 ? b : 0;
  const m = Math.max(r, g, b);
  if (m <= k) return [r, g, b];
  const s = shoulder(m, k) / m, R = r * s, G = g * s, B = b * s, top = m * s;
  // path to white: only light past 1.0 desaturates, so in-gamut colours above the knee keep their chroma
  const d = m > 1 ? 1 - Math.exp(-(m - 1) / 1.5) : 0;
  return [R + (top - R) * d, G + (top - G) * d, B + (top - B) * d];
}
export function display(px, { knee = KNEE, stride = 3 } = {}) {
  for (let i = 0; i < px.length; i += stride) { const o = displayPixel(px[i], px[i + 1], px[i + 2], knee); px[i] = o[0]; px[i + 1] = o[1]; px[i + 2] = o[2]; }
  return px;
}

// AgX inset and outset matrices (rows give output channels).
const IN = [[0.842479062253094, 0.0784335999999992, 0.0792237451477643], [0.0423282422610123, 0.878468636469772, 0.0791661274605434], [0.0423756549057051, 0.0784336, 0.879142973793104]];
const OUT = [[1.19687900512017, -0.0980208811401368, -0.0990297440797205], [-0.0528968517574562, 1.15190312990417, -0.0989611768448433], [-0.0529716355144438, -0.0980434501171241, 1.15107367264116]];
const MIN_EV = -12.47393, MAX_EV = 4.026069;
const sigmoid = x => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; };
// punch > 1 is the "punchy" look: chroma lifted around the achromatic axis after the curve, in the display encoding
export function agxPixel(r, g, b, { exposure = 0, punch = 1 } = {}) {
  const e = 2 ** exposure, c = [r * e, g * e, b * e].map(v => (v > 1e-10 ? v : 1e-10)), o = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const v = IN[k][0] * c[0] + IN[k][1] * c[1] + IN[k][2] * c[2];
    o[k] = sigmoid(clamp((Math.log2(Math.max(v, 1e-10)) - MIN_EV) / (MAX_EV - MIN_EV)));
  }
  const y = 0.2126 * o[0] + 0.7152 * o[1] + 0.0722 * o[2];
  for (let k = 0; k < 3; k++) o[k] = y + (o[k] - y) * punch;
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) out[k] = clamp(OUT[k][0] * o[0] + OUT[k][1] * o[1] + OUT[k][2] * o[2]) ** 2.2;
  return out;
}
export function agx(px, { exposure = 0, punch = 1, stride = 3 } = {}) {
  for (let i = 0; i < px.length; i += stride) { const o = agxPixel(px[i], px[i + 1], px[i + 2], { exposure, punch }); px[i] = o[0]; px[i + 1] = o[1]; px[i + 2] = o[2]; }
  return px;
}

// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// pixq.mjs: the pixel-art pass. Scene light (HDR, linear) -> a tone curve -> a fixed palette with ordered dither.
//
// The tone curve is extended Reinhard, x (1 + x / W^2) / (1 + x), mostly hue-kept (see toneRGB). It is a display
// convention, not physics.
// Dither mixes two palette colours in linear light, because light adds: at viewing distance, the local mean of the
// emitted codes equals the scene in the quantity the eye integrates (the era quantizer's rule, lib/quantize).
// Ordered dither (Bayer) keeps every static pixel the same from frame to frame, so a GIF loop does not boil.
// Pair choice follows the pattern-dither idea credited to Joel Yliluoma: for each colour, the best pair of palette
// entries and the mix between them, with a penalty on pairs far apart so the pattern stays quiet.
//
//   tone(F, { exposure, white })        HDR frame -> display-linear Float32Array (3 per pixel, 0..1)
//   pairTable(cb)                       a 64^3 lookup of the best pair for each sRGB cell (built once per palette)
//   dither(lin, w, h, cb, table, { matrix })  -> { index: Uint8Array, rgba: Uint8ClampedArray }
//   measureDE(lin, out, w, h, ppd)      mean eye-filtered CIEDE2000 between the tone-mapped frame and its pixel art
import { bayer } from '../quantize/dither.mjs';
import { deStats } from '../quantize/eye.mjs';
import { lin8, enc, linToXYZ, xyzToLab } from '../study/cmath.mjs';

// Per channel, a light far over white goes to white. Hue-kept (scale all channels by the curve of the largest), it
// keeps its hue to the end. A sodium lamp seen by eye is orange-yellow at the core, not white, so the curve is mostly
// hue-kept (70%) with some per-channel roll-off (30%) for the bleached look of the brightest highlights.
export function toneRGB(r, g, b, exposure = 1, white = 6) {
  const W2 = white * white, f = x => Math.min(1, x * (1 + x / W2) / (1 + x));
  const R = Math.max(0, r * exposure), G = Math.max(0, g * exposure), B = Math.max(0, b * exposure), m = Math.max(R, G, B);
  if (m <= 0) return [0, 0, 0];
  const k = f(m) / m;
  return [0.7 * R * k + 0.3 * f(R), 0.7 * G * k + 0.3 * f(G), 0.7 * B * k + 0.3 * f(B)];
}
export function tone(F, { exposure = 1, white = 6 } = {}) {
  const out = new Float32Array(F.w * F.h * 3);
  for (let i = 0; i < F.w * F.h; i++) { const c = toneRGB(F.d[3 * i], F.d[3 * i + 1], F.d[3 * i + 2], exposure, white); out[3 * i] = c[0]; out[3 * i + 1] = c[1]; out[3 * i + 2] = c[2]; }
  return out;
}

const labLin = v => xyzToLab(linToXYZ(v));
const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

export function pairTable(cb, { bitsPer = 6, keep = 6, penalty = 0.08 } = {}) {
  const N = 1 << bitsPer, T = new Uint8Array(N * N * N * 2), labs = cb.lin.map(labLin);
  for (let r = 0; r < N; r++) for (let g = 0; g < N; g++) for (let b = 0; b < N; b++) {
    const v = [r, g, b].map(c => lin8(Math.round((c + 0.5) * 255 / N))), L = labLin(v);
    const near = labs.map((q, i) => [d2(q, L), i]).sort((p, q) => p[0] - q[0]).slice(0, keep).map(p => p[1]);
    let best = Infinity, bi = near[0], bj = near[0];
    for (let x = 0; x < near.length; x++) for (let y = x; y < near.length; y++) {
      const i = near[x], j = near[y], t = mixT(v, cb.lin[i], cb.lin[j]);
      const m = cb.lin[i].map((c, k) => c + (cb.lin[j][k] - c) * t);
      const cost = Math.sqrt(d2(labLin(m), L)) + penalty * Math.sqrt(d2(labs[i], labs[j]));
      if (cost < best) { best = cost; bi = i; bj = j; }
    }
    const o = 2 * ((r * N + g) * N + b); T[o] = bi; T[o + 1] = bj;
  }
  return { T, N };
}
// mix fraction of q along p -> q that best matches v, in linear light
function mixT(v, p, q) {
  const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], L = dx * dx + dy * dy + dz * dz;
  if (L < 1e-12) return 0;
  return Math.max(0, Math.min(1, ((v[0] - p[0]) * dx + (v[1] - p[1]) * dy + (v[2] - p[2]) * dz) / L));
}

export function dither(lin, w, h, cb, table, { matrix = bayer(4) } = {}) {
  const index = new Uint8Array(w * h), rgba = new Uint8ClampedArray(w * h * 4), n = matrix.length, { T, N } = table;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, v = [lin[3 * i], lin[3 * i + 1], lin[3 * i + 2]];
    const cell = v.map(c => Math.min(N - 1, Math.floor(enc(c) * N))), o = 2 * ((cell[0] * N + cell[1]) * N + cell[2]);
    const a = T[o], b = T[o + 1], t = mixT(v, cb.lin[a], cb.lin[b]), k = t > matrix[y % n][x % n] ? b : a;
    index[i] = k; rgba.set(cb.code[k], 4 * i); rgba[4 * i + 3] = 255;
  }
  return { index, rgba };
}

export function measureDE(lin, rgba, w, h, ppd = 60) {
  const out = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) out[3 * i + c] = lin8(rgba[4 * i + c]);
  return deStats(lin, out, w, h, ppd);
}

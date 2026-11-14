// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// print.mjs: a newsprint press, modelled. A linear RGB picture is separated to CMYK, each plate is screened with
// round-to-chain dots at its own angle, and the plates are laid onto newsprint in press order (K, C, M, Y) with:
//   dot gain     ink spreads in the fibre: apparent coverage a + gain x 4a(1 - a) (Murray-Davies-style midtone gain)
//   ink trap     a wet ink takes less of the next one: density x (1 - trap x coverage already down)
//   misregister  each plate shifted and turned a little, so colour slips off the key line
//   mottle       absorption varies across the sheet (low-frequency density noise per plate)
//   paper        a yellowed sheet with long fibres, and a faint show-through of the mirrored page
// Inks are subtractive: reflectance = paper x product of ink transmittance^coverage, in linear light.
// Every quantity is in output px or 0..1 shares; the frame is deterministic per seed.
import { gauss } from './blur.mjs';
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// Process ink transmittances (linear RGB), lurid newsprint flavour: a hot magenta and a lemon yellow.
export const INKS = { K: [0.045, 0.045, 0.055], C: [0.02, 0.42, 0.78], M: [0.82, 0.05, 0.3], Y: [0.96, 0.8, 0.02] };
export const ORDER = ['K', 'C', 'M', 'Y'];
export const ANGLES = { K: 45, C: 15, M: 75, Y: 0 };

// Spot function threshold for a target coverage: the share of a cell where (cos 2pi u + cos 2pi v) / 2 > t.
const SPOT = (() => {
  const n = 64, v = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) v.push((Math.cos(2 * Math.PI * (i + 0.5) / n) + Math.cos(2 * Math.PI * (j + 0.5) / n)) / 2);
  return Float32Array.from(v).sort().reverse();
})();
export const spotThreshold = a => (a <= 0 ? 1.01 : a >= 1 ? -1.01 : SPOT[Math.min(SPOT.length - 1, Math.floor(a * SPOT.length))]);

// show-through mirrors this page as a stand-in for the back of the sheet.
// RGB (linear, 0..1) to CMYK shares, with grey-component replacement `gcr` (0..1).
export function separate(r, g, b, gcr = 0.8) {
  const c = 1 - Math.cbrt(clamp(r)), m = 1 - Math.cbrt(clamp(g)), y = 1 - Math.cbrt(clamp(b)), k = Math.min(c, m, y) * gcr;
  const s = k < 1 ? 1 / (1 - k) : 0;
  return { C: clamp((c - k) * s), M: clamp((m - k) * s), Y: clamp((y - k) * s), K: clamp(k) };
}

// The yellowed sheet: base tone, long fibres along x, blotchy foxing, in linear light.
export function paper(w, h, { tone = [0.78, 0.68, 0.46], age = 0.5, fibre = 0.05, seed = 7, scale = 1 } = {}) {
  const n = w * h, R = new Float32Array(n), F = new Float32Array(n);
  for (let i = 0; i < n; i++) { R[i] = hash(i % w, (i / w) | 0, seed) - 0.5; F[i] = hash(i % w, (i / w) | 0, seed + 3) - 0.5; }
  const fib = gauss(R, w, h, 0.7 * scale, 1), blot = gauss(F, w, h, 40 * scale, 1);
  // fibres: stretch the fine noise along x with a running average
  const L = Math.max(3, Math.round(9 * scale)), out = new Float32Array(n * 3);
  let bs = 0; for (const v of blot) bs = Math.max(bs, Math.abs(v)); bs = bs || 1;
  for (let y = 0; y < h; y++) {
    let run = 0; for (let x = 0; x < w; x++) {
      run += fib[y * w + x] - (x >= L ? fib[y * w + x - L] : 0);
      const i = y * w + x, f = 1 + fibre * 3 * run / L, fox = 1 - 0.12 * age * smooth(0.2, 1, blot[i] / bs);
      for (let c = 0; c < 3; c++) out[3 * i + c] = tone[c] * f * fox * (c === 2 ? 1 - 0.25 * age : 1);
    }
  }
  return out;
}

// Coverage of one screened plate at pixel (x, y): a is the wanted coverage, p the pitch, th the angle (rad).
function dot(x, y, a, p, th, gain) {
  if (a <= 0.002) return 0;
  const ag = clamp(a + gain * 4 * a * (1 - a)), t = spotThreshold(ag);
  const u = (x * Math.cos(th) + y * Math.sin(th)) / p, v = (-x * Math.sin(th) + y * Math.cos(th)) / p;
  const f = (Math.cos(2 * Math.PI * u) + Math.cos(2 * Math.PI * v)) / 2;
  const gw = (Math.PI / p) * Math.hypot(Math.sin(2 * Math.PI * u), Math.sin(2 * Math.PI * v)) + 0.6 / p; // |grad f| per px
  return smooth(-0.5, 0.5, (f - t) / gw);
}

// Lay the plates. src(x, y) -> { C, M, Y, K } shares (sampled at the misregistered position of each plate).
// key(x, y) -> 0..1 is solid line art (unscreened), printed with the K plate and misregistered with it.
export function press(w, h, src, { key = null, pitch = 18, gain = 0.18, trap = 0.25, register = 6, turn = 0.004, mottle = 0.12, seed = 11, paperOpts = {}, showThrough = 0.04 } = {}) {
  const P = paper(w, h, { seed, ...paperOpts }), out = new Float32Array(w * h * 3), down = new Float32Array(w * h);
  const mot = gauss(Float32Array.from({ length: w * h }, (_, i) => hash(i % w, (i / w) | 0, seed + 9) - 0.5), w, h, 18 * (paperOpts.scale ?? 1), 1);
  let ms = 0; for (const v of mot) ms = Math.max(ms, Math.abs(v)); ms = ms || 1;
  out.set(P);
  ORDER.forEach((ink, k) => {
    const dx = register * (hash(k, 1, seed) - 0.5) * 2, dy = register * (hash(k, 2, seed) - 0.5) * 2, rot = turn * (hash(k, 3, seed) - 0.5) * 2;
    const th = (ANGLES[ink] * Math.PI) / 180, T = INKS[ink], cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, X = cx + (x - cx) * Math.cos(rot) - (y - cy) * Math.sin(rot) - dx, Y = cy + (x - cx) * Math.sin(rot) + (y - cy) * Math.cos(rot) - dy;
      const a = src(X, Y)[ink], kl = ink === 'K' && key ? key(X, Y) : 0; if (!(a > 0) && !(kl > 0)) continue;
      const cov = Math.max(a > 0 ? dot(x, y, a, ink === 'K' ? pitch * 0.85 : pitch, th, gain) : 0, kl) * (1 - trap * down[i]) * (1 + mottle * mot[i] / ms);
      if (cov <= 0) continue;
      for (let c = 0; c < 3; c++) out[3 * i + c] *= T[c] ** clamp(cov, 0, 1.2);
      down[i] = clamp(down[i] + cov);
    }
  });
  if (showThrough > 0) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, j = y * w + (w - 1 - x), dark = clamp(down[j]);
    for (let c = 0; c < 3; c++) out[3 * i + c] *= 1 - showThrough * dark;
  }
  return { w, h, px: out };
}

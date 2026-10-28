// dither.mjs: ordered dither, error diffusion and the PS1 GPU's own dither. Dither works in linear light by default:
// light adds, so the local mean of the emitted codes then equals the source in the quantity the eye integrates.
// `space: 'srgb'` dithers on the code values instead, as most period hardware did; that is kept for the authentic
// presets and for exploratory check E1.
import { lin8, enc } from '../study/cmath.mjs';
import { replicate } from './codebook.mjs';

// Bayer index matrix of size n (a power of two), as thresholds (k + 0.5) / n^2.
export function bayer(n) {
  let M = [[0]];
  while (M.length < n) { const m = M.length; M = Array.from({ length: 2 * m }, (_, y) => Array.from({ length: 2 * m }, (_, x) => 4 * M[y % m][x % m] + [[0, 2], [3, 1]][y >= m ? 1 : 0][x >= m ? 1 : 0])); }
  return M.map(r => r.map(v => (v + 0.5) / (n * n)));
}

// PS1 GPU dither: offsets added to 8-bit values before truncation to 5 bits (no$psx / psx-spx GPU notes, from
// memory, moderate confidence).
export const PS1_OFFSETS = [[-4, 0, -3, 1], [2, -2, 3, -1], [-3, 1, -4, 0], [3, -1, 2, -2]];

const toSpace = (v8, space) => (space === 'linear' ? lin8(v8) : v8 / 255);
const fromSpace = (v, space) => Math.round(255 * (space === 'linear' ? enc(Math.min(1, Math.max(0, v))) : Math.min(1, Math.max(0, v))));

// Bracketing pair in a sorted level list, and the fraction of the way from lo to hi.
function bracket(L, v) {
  if (v <= L[0]) return [0, 0, 0]; if (v >= L[L.length - 1]) return [L.length - 1, L.length - 1, 0];
  let k = 0; while (L[k + 1] < v) k++;
  return [k, k + 1, (v - L[k]) / (L[k + 1] - L[k])];
}

export function ordered({ w, h, rgba }, cb, { matrix = bayer(4), space = 'linear' } = {}) {
  const out = new Uint8ClampedArray(w * h * 4), n = matrix.length;
  const lv = cb.kind === 'channels' ? cb.code.map(c => c.map(v => toSpace(v, space))) : null;
  if (!lv && !cb.ramp) throw new Error('quantize: ordered dither needs a channel codebook or a ramp palette');
  const rampY = cb.ramp ? cb.order.map(i => (space === 'linear' ? cb.Y[i] : enc(cb.Y[i]))) : null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, t = matrix[y % n][x % n], px = [rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]];
    if (lv) for (let c = 0; c < 3; c++) { const [lo, hi, f] = bracket(lv[c], toSpace(px[c], space)); out[4 * i + c] = cb.code[c][f > t ? hi : lo]; }
    else {
      const Y = 0.2126729 * lin8(px[0]) + 0.7151522 * lin8(px[1]) + 0.0721750 * lin8(px[2]);
      const [lo, hi, f] = bracket(rampY, space === 'linear' ? Y : enc(Y)); out.set(cb.code[cb.order[f > t ? hi : lo]], 4 * i);
    }
    out[4 * i + 3] = 255;
  }
  return { w, h, rgba: out };
}

export const KERNELS = {
  'floyd-steinberg': { div: 16, taps: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
  atkinson: { div: 8, taps: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] },
  'jarvis-judice-ninke': { div: 48, taps: [[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]] },
};

// Nearest codebook colour to a working-space triple; returns its 8-bit code.
function pick(cb, lvs, v) {
  if (cb.kind === 'channels') return v.map((x, c) => { const L = lvs[c]; let k = 0; for (let j = 1; j < L.length; j++) if (Math.abs(L[j] - x) < Math.abs(L[k] - x)) k = j; return cb.code[c][k]; });
  let best = 0, bd = Infinity;
  lvs.forEach((q, j) => { const d = (q[0] - v[0]) ** 2 + (q[1] - v[1]) ** 2 + (q[2] - v[2]) ** 2; if (d < bd) { bd = d; best = j; } });
  return cb.code[best];
}

export function diffuse({ w, h, rgba }, cb, { kernel = 'floyd-steinberg', space = 'linear', serpentine = true } = {}) {
  const K = KERNELS[kernel]; if (!K) throw new Error(`quantize: unknown kernel ${kernel}`);
  const buf = new Float32Array(w * h * 3), out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) buf[3 * i + c] = toSpace(rgba[4 * i + c], space);
  const lvs = cb.kind === 'channels' ? cb.code.map(L => L.map(v => toSpace(v, space))) : cb.code.map(p => p.map(v => toSpace(v, space)));
  for (let y = 0; y < h; y++) {
    const rev = serpentine && y % 2 === 1;
    for (let k = 0; k < w; k++) {
      const x = rev ? w - 1 - k : k, i = y * w + x, v = [0, 1, 2].map(c => Math.min(1.5, Math.max(-0.5, buf[3 * i + c])));
      const code = pick(cb, lvs, v); out.set([code[0], code[1], code[2], 255], 4 * i);
      for (let c = 0; c < 3; c++) {
        const e = v[c] - toSpace(code[c], space);
        for (const [dx, dy, wt] of K.taps) { const X = x + (rev ? -dx : dx), Y = y + dy; if (X >= 0 && X < w && Y < h) buf[3 * (Y * w + X) + c] += (e * wt) / K.div; }
      }
    }
  }
  return { w, h, rgba: out };
}

// The PS1 path as the hardware ran it: offset, clamp, truncate to 5 bits, expand by bit replication for display.
export function ps1({ w, h, rgba }, { dither = true } = {}) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, d = dither ? PS1_OFFSETS[y & 3][x & 3] : 0;
    for (let c = 0; c < 3; c++) out[4 * i + c] = replicate(Math.min(255, Math.max(0, rgba[4 * i + c] + d)) >> 3, 5);
    out[4 * i + 3] = 255;
  }
  return { w, h, rgba: out };
}


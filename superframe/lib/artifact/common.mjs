// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// common.mjs: what every medium shares and none should re-implement.
//
// weightOf(r, o, m)   the element's pass-through into medium m: transparency[m] x media[m]. Every mapping in the
//                     artifact is this weight; no medium has a fixed rule about which element it shows.
// fieldFor(r, L, m)   the elements' ticks summed into one scalar field at sim resolution, each scaled by its weight.
// upsample(F, ...)    bilinear sim -> output. A change at one sim pixel moves output pixels within 2 px of it.
// detail(r, W, H)     full-resolution grain from the superstack pixel hash of the recipe seed. It never reads a
//                     weight, so it cannot carry an edit anywhere; it only adds the resolution the sim grid lacks.
import { pixelHash01 } from '../../../substrate/lib/vendor/superstack.mjs';
import { encodePNG } from '../../../creation/lib/ir/png.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const weightOf = (r, o, m) => o.element.transparency[m] * r.media[m];

export function fieldFor(r, layers, m) {
  const [w, h] = r.sim, F = new Float32Array(w * h);
  for (const o of layers) {
    const wt = weightOf(r, o, m); if (!wt) continue;
    const A = o.layer.fields.amount, B = o.bbox;
    for (let y = B.y0; y < B.y1; y++) for (let x = B.x0; x < B.x1; x++) { const k = y * w + x; F[k] += wt * A[k]; }
  }
  for (let k = 0; k < F.length; k++) if (F[k] > 1) F[k] = 1;
  return F;
}

// where detail lives: each element's own detail weight times its ticks (sim resolution), over a light paper tooth
export function detailMap(r, layers, m) {
  const [w, h] = r.sim, F = new Float32Array(w * h).fill(0.12 + 0.18 * r.detail);
  for (const o of layers) {
    const wt = weightOf(r, o, m) * o.element.detail; if (!wt) continue;
    const A = o.layer.fields.amount, M = o.mask, B = o.bbox;
    for (let y = B.y0; y < B.y1; y++) for (let x = B.x0; x < B.x1; x++) { const k = y * w + x; F[k] += wt * (0.35 * M[k] + 1.6 * A[k]); }
  }
  return F;
}

export function upsample(F, w, h, W, H, C = 1) {
  const out = new Float32Array(W * H * C), sx = w / W, sy = h / H;
  for (let Y = 0; Y < H; Y++) {
    const y = Math.min(h - 1.0001, Math.max(0, (Y + 0.5) * sy - 0.5)), j = y | 0, fy = y - j;
    for (let X = 0; X < W; X++) {
      const x = Math.min(w - 1.0001, Math.max(0, (X + 0.5) * sx - 0.5)), i = x | 0, fx = x - i, o = (Y * W + X) * C;
      const a = (j * w + i) * C, b = a + C, c = a + w * C, d = c + C;
      for (let q = 0; q < C; q++) out[o + q] = (F[a + q] * (1 - fx) + F[b + q] * fx) * (1 - fy) + (F[c + q] * (1 - fx) + F[d + q] * fx) * fy;
    }
  }
  return out;
}

// three octaves of hashed value noise (3, 9 and 27 px), mean 0, roughly -0.5..0.5
export function detail(r, W, H) {
  const seed = `${r.seed}/detail`, out = new Float32Array(W * H), oct = [[3, 0.3], [9, 0.4], [27, 0.3]];
  for (const [s, amp] of oct) {
    const gw = Math.ceil(W / s) + 2, gh = Math.ceil(H / s) + 2, G = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) G[j * gw + i] = pixelHash01(i, j, `${seed}/${s}`) - 0.5;
    for (let Y = 0; Y < H; Y++) {
      const y = Y / s, j = y | 0, fy = y - j, ey = fy * fy * (3 - 2 * fy);
      for (let X = 0; X < W; X++) {
        const x = X / s, i = x | 0, fx = x - i, ex = fx * fx * (3 - 2 * fx), a = j * gw + i;
        out[Y * W + X] += amp * ((G[a] * (1 - ex) + G[a + 1] * ex) * (1 - ey) + (G[a + gw] * (1 - ex) + G[a + gw + 1] * ex) * ey);
      }
    }
  }
  return out;
}

// height to unit normals (x, y, z interleaved), central differences at output resolution
export function normals(Hf, W, H, strength) {
  const N = new Float32Array(3 * W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const l = Hf[y * W + Math.max(0, x - 1)], rr = Hf[y * W + Math.min(W - 1, x + 1)], u = Hf[Math.max(0, y - 1) * W + x], d = Hf[Math.min(H - 1, y + 1) * W + x];
    const nx = -(rr - l) * strength, ny = -(d - u) * strength, inv = 1 / Math.hypot(nx, ny, 1), k = 3 * (y * W + x);
    N[k] = nx * inv; N[k + 1] = ny * inv; N[k + 2] = inv;
  }
  return N;
}

// unsharp mask, radius r px (box blur twice), on an interleaved C-channel image. Each blurred value is a direct
// window sum, never a running one: a running sum would carry float rounding along the row and break locality.
export function sharpen(X, W, H, C, r = 3, amount = 0.6) {
  const B = Float32Array.from(X), T = new Float32Array(X.length), n = 2 * r + 1;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < C; c++) { let s = 0; for (let d = -r; d <= r; d++) s += B[(y * W + Math.min(W - 1, Math.max(0, x + d))) * C + c]; T[(y * W + x) * C + c] = s / n; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < C; c++) { let s = 0; for (let d = -r; d <= r; d++) s += T[(Math.min(H - 1, Math.max(0, y + d)) * W + x) * C + c]; B[(y * W + x) * C + c] = s / n; }
  }
  for (let i = 0; i < X.length; i++) X[i] = Math.max(0, X[i] + amount * (X[i] - B[i]));
  return X;
}

export const grey = F => { const o = new Float32Array(3 * F.length); for (let k = 0; k < F.length; k++) o[3 * k] = o[3 * k + 1] = o[3 * k + 2] = F[k]; return o; };
// grey maps are data, not light: store them so the 8-bit code is the value (encodePNG applies the sRGB curve)
export const asData = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

export function writePNG(path, rgbLinear, W, H) { mkdirSync(dirname(path), { recursive: true }); const b = encodePNG(rgbLinear, W, H); writeFileSync(path, b); return b; }

// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// comic.mjs: a panel compositor for the weird-print family. A panel is a stack of layers, back to front; each layer is
// a signed distance field (px, negative inside), a flat colour given as CMYK shares (the way a comic colourist marks a
// guide: 0, 0.25, 0.5, 1), and an optional brush line and shadow hatching. The painter's rule holds for line work: a
// layer covers the lines beneath it and lays its own contour on top. press() in print.mjs then prints the result.
import { brushLine, hatch, gradient } from './ink.mjs';
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

// ---- primitives (px), and a smooth union
export const circle = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;
export const ellipse = (cx, cy, rx, ry) => (x, y) => { const k = Math.hypot((x - cx) / rx, (y - cy) / ry); return (k - 1) * Math.min(rx, ry) * (k > 1 ? 1 : 1); };
export function capsule(ax, ay, bx, by, r, r2 = r) {
  return (x, y) => {
    const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
    return Math.hypot(x - ax - t * dx, y - ay - t * dy) - (r + (r2 - r) * t);
  };
}
export function star(cx, cy, r1, r2, n, rot = 0, jag = 0, seed = 1) {
  return (x, y) => {
    const a = Math.atan2(y - cy, x - cx) - rot, k = ((a / (2 * Math.PI)) * n % 1 + 1) % 1, tooth = Math.floor(((a / (2 * Math.PI)) * n % n + n) % n);
    const j = 1 + jag * (Math.sin(tooth * 12.9898 + seed) * 43758.5453 % 1);
    return Math.hypot(x - cx, y - cy) - (r2 + (r1 * j - r2) * Math.abs(1 - 2 * k) ** 1.5);
  };
}
export const union = (...fs) => (x, y) => Math.min(...fs.map(f => f(x, y)));
export const smin = (k, ...fs) => (x, y) => {
  let d = fs[0](x, y);
  for (let i = 1; i < fs.length; i++) { const b = fs[i](x, y), h = clamp(0.5 + 0.5 * (b - d) / k); d = b + (d - b) * h - k * h * (1 - h); }
  return d;
};
export const subtract = (a, b) => (x, y) => Math.max(a(x, y), -b(x, y));
export const through = (f, map) => (x, y) => { const [X, Y] = map(x, y); return f(X, Y); };

// Evaluate a primitive into a field over the frame (pixel centres).
export function field(w, h, f) {
  const D = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) D[y * w + x] = f(x + 0.5, y + 0.5);
  return D;
}

// The panel: shares (C, M, Y, K per pixel) and key line coverage.
export function panel(w, h, ground) {
  const S = new Float32Array(w * h * 4), K = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const g = ground(x + 0.5, y + 0.5), i = y * w + x; S[4 * i] = g.C ?? 0; S[4 * i + 1] = g.M ?? 0; S[4 * i + 2] = g.Y ?? 0; S[4 * i + 3] = g.K ?? 0; }
  return { w, h, S, K };
}

// Lay one layer. fill is { C, M, Y, K } or a function (x, y, d) -> shares; line is a brushLine options object or null;
// shade, if given, is (x, y, d, nx, ny) -> darkness 0..1 for hatching (with hatchOpts).
export function lay(P, D, { fill, line = null, shade = null, hatchOpts = {} }) {
  const { w, h, S, K } = P, n = w * h, g = shade ? gradient(D, w, h) : null;
  for (let i = 0; i < n; i++) {
    const cov = clamp(0.5 - D[i]); if (cov <= 0) continue;
    const x = (i % w) + 0.5, y = ((i / w) | 0) + 0.5, f = typeof fill === 'function' ? fill(x, y, D[i]) : fill;
    S[4 * i] += ((f.C ?? 0) - S[4 * i]) * cov; S[4 * i + 1] += ((f.M ?? 0) - S[4 * i + 1]) * cov;
    S[4 * i + 2] += ((f.Y ?? 0) - S[4 * i + 2]) * cov; S[4 * i + 3] += ((f.K ?? 0) - S[4 * i + 3]) * cov;
    K[i] *= 1 - cov;
  }
  if (shade) {
    const H = hatch(D, w, h, i => { const q = Math.hypot(g.gx[i], g.gy[i]) || 1; return shade((i % w) + 0.5, ((i / w) | 0) + 0.5, D[i], g.gx[i] / q, g.gy[i] / q); }, hatchOpts);
    for (let i = 0; i < n; i++) if (H[i] > K[i]) K[i] = H[i];
  }
  if (line) { const L = brushLine(D, w, h, line); for (let i = 0; i < n; i++) if (L[i] > K[i]) K[i] = L[i]; }
  return P;
}
export function inkOver(P, F) { for (let i = 0; i < F.length; i++) if (F[i] > P.K[i]) P.K[i] = F[i]; return P; }

// Bilinear samplers for press(): shares at a (misregistered) position, and the key line.
export function samplers(P) {
  const { w, h, S, K } = P, out = { C: 0, M: 0, Y: 0, K: 0 }, names = ['C', 'M', 'Y', 'K'];
  const at = (A, st, c, x, y) => {
    const fx = clamp(x - 0.5, 0, w - 1.001), fy = clamp(y - 0.5, 0, h - 1.001), x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0, i = y0 * w + x0;
    return (A[i * st + c] * (1 - ax) + A[(i + 1) * st + c] * ax) * (1 - ay) + (A[(i + w) * st + c] * (1 - ax) + A[(i + w + 1) * st + c] * ax) * ay;
  };
  return { src: (x, y) => { for (let c = 0; c < 4; c++) out[names[c]] = at(S, 4, c, x, y); return out; }, key: (x, y) => at(K, 1, 0, x, y) };
}

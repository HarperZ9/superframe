// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// stokes.mjs: slow viscous flow in a thin layer (Stokes flow with floor friction, the Brinkman form), on a periodic
// unit square, solved spectrally. The physics level under the marbling bath: ink drops are sources, combs are moving
// point forces, and the flow has no inertia, so it is time-reversible.
//   mu lap(u) - (mu / lambda^2) u - grad p + f = 0,   div u = s
//   makeGrid(n)                          -> grid with 2D FFT helpers (reuses the visualizer's radix-2 FFT)
//   forceKernel(g, { w, lambda, mu })    -> { ux, uy } velocity of a unit force along +x at the origin (Gaussian width w)
//   sourceKernel(g, { w })               -> { ux, uy } velocity of a unit-rate source at the origin (Gaussian width w)
//   sample(g, field, x, y)               -> periodic bicubic (Catmull-Rom) value at (x, y)
//   drop(g, pts, { cx, cy, r, w, steps, sign }) -> moves points as a source injects area pi r^2 (sign -1 runs it back)
//   tine(g, pts, { y0 | x0, dir, z, lambda, w, mu, steps, sign }) -> moves points as a stylus crosses the whole bath
// Points are [x, y] pairs in the unit square, updated in place. Derivation and tests:
// docs/prereg/FLUID-INK-PREREG.md.
import { makeFFT } from '../../../visualizer/lib/fft.mjs';

export function makeGrid(n) {
  const F = makeFFT(n), k = new Float64Array(n);
  for (let i = 0; i < n; i++) k[i] = 2 * Math.PI * (i < n / 2 ? i : i - n);
  const row = { re: new Float64Array(n), im: new Float64Array(n) };
  // 2D transform in place (forward when inverse is false). The inverse returns sum_k c_k e^{ikx}, no 1/N factor.
  function fft2(re, im, inverse = false) {
    if (inverse) for (let i = 0; i < n * n; i++) im[i] = -im[i];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) { row.re[c] = re[r * n + c]; row.im[c] = im[r * n + c]; }
      F.transform(row.re, row.im);
      for (let c = 0; c < n; c++) { re[r * n + c] = row.re[c]; im[r * n + c] = row.im[c]; }
    }
    for (let c = 0; c < n; c++) {
      for (let r = 0; r < n; r++) { row.re[r] = re[r * n + c]; row.im[r] = im[r * n + c]; }
      F.transform(row.re, row.im);
      for (let r = 0; r < n; r++) { re[r * n + c] = row.re[r]; im[r * n + c] = row.im[r]; }
    }
    if (inverse) for (let i = 0; i < n * n; i++) im[i] = -im[i];
  }
  return { n, k, fft2 };
}

// velocity coefficients -> real grids (index [row = y][col = x]); the coefficient arrays are consumed
function toGrid(g, uxr, uxi, uyr, uyi) {
  g.fft2(uxr, uxi, true); g.fft2(uyr, uyi, true);
  return { ux: uxr, uy: uyr };
}

export function forceKernel(g, { w = 0.004, lambda = 0.04, mu = 1 } = {}) {
  const { n, k } = g, N = n * n, uxr = new Float64Array(N), uxi = new Float64Array(N), uyr = new Float64Array(N), uyi = new Float64Array(N);
  const fric = Number.isFinite(lambda) ? 1 / (lambda * lambda) : 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const kx = k[c], ky = k[r], k2 = kx * kx + ky * ky;
    // k = 0: with floor friction a uniform push is balanced by drag, so the mean flow is 1 / (mu fric) (uniform flow is
    // divergence-free, so the projection is the identity). Without friction (plain 2D Stokes) it has no finite value.
    if (k2 === 0) { if (fric > 0) uxr[0] = 1 / (mu * fric); continue; }
    const f = Math.exp(-0.5 * k2 * w * w) / (mu * (k2 + fric)); // unit-integral Gaussian force along x
    uxr[r * n + c] = f * (1 - kx * kx / k2);                  // incompressible projection of (1, 0)
    uyr[r * n + c] = f * (-ky * kx / k2);
  }
  return toGrid(g, uxr, uxi, uyr, uyi);
}

export function sourceKernel(g, { w = 0.004 } = {}) {
  const { n, k } = g, N = n * n, uxr = new Float64Array(N), uxi = new Float64Array(N), uyr = new Float64Array(N), uyi = new Float64Array(N);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const kx = k[c], ky = k[r], k2 = kx * kx + ky * ky;
    if (k2 === 0) continue;                                   // the mean is removed: a uniform sink balances the source
    const s = Math.exp(-0.5 * k2 * w * w) / k2;               // u = grad(phi), lap(phi) = s  ->  u^ = -i k s^ / k^2
    uxi[r * n + c] = -kx * s; uyi[r * n + c] = -ky * s;
  }
  return toGrid(g, uxr, uxi, uyr, uyi);
}

const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
export function sample(g, field, x, y) {
  const n = g.n, fx = x * n, fy = y * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const at = (r, c) => field[((r % n + n) % n) * n + ((c % n + n) % n)];
  const rows = [-1, 0, 1, 2].map(dr => cr(at(iy + dr, ix - 1), at(iy + dr, ix), at(iy + dr, ix + 1), at(iy + dr, ix + 2), tx));
  return cr(rows[0], rows[1], rows[2], rows[3], ty);
}

const wrap = v => v - Math.floor(v);
// signed shortest offset on the unit torus
const off = d => d - Math.round(d);

// RK4 over [0, T] for a velocity v(t, x, y) -> [vx, vy]
function integrate(pts, v, T, steps) {
  const dt = T / steps;
  for (const p of pts) {
    let x = p[0], y = p[1];
    for (let s = 0; s < steps; s++) {
      const t = s * dt;
      const [ax, ay] = v(t, x, y), [bx, by] = v(t + dt / 2, x + ax * dt / 2, y + ay * dt / 2);
      const [cx, cy] = v(t + dt / 2, x + bx * dt / 2, y + by * dt / 2), [dx, dy] = v(t + dt, x + cx * dt, y + cy * dt);
      x += dt * (ax + 2 * bx + 2 * cx + dx) / 6; y += dt * (ay + 2 * by + 2 * cy + dy) / 6;
    }
    p[0] = wrap(x); p[1] = wrap(y);
  }
  return pts;
}

// A drop of radius r at (cx, cy): a unit-rate source runs for T = pi r^2. sign -1 runs the same flow backward.
export function drop(g, pts, { cx, cy, r, w = 0.004, steps = 4000, sign = 1, kernel = null } = {}) {
  const K = kernel ?? sourceKernel(g, { w });
  const v = (t, x, y) => { const X = wrap(x - cx), Y = wrap(y - cy); return [sign * sample(g, K.ux, X, Y), sign * sample(g, K.uy, X, Y)]; };
  return integrate(pts, v, Math.PI * r * r, steps);
}

// A stylus crossing the whole bath once at speed V = 1 along +x (dir 'x', on the line y = y0) or +y (dir 'y', on x =
// x0). The force F = 2 mu V z / lambda gives the predicted displacement z at the path; sign -1 runs it back.
export function tine(g, pts, { y0 = 0.5, x0 = 0.5, dir = 'x', z = 0.01, lambda = 0.04, w = 0.004, mu = 1, steps = 1000, sign = 1, kernel = null } = {}) {
  const K = kernel ?? forceKernel(g, { w, lambda, mu });
  const F = Number.isFinite(lambda) ? 2 * mu * z / lambda : z;
  const v = dir === 'x'
    ? (t, x, y) => { const s = sign > 0 ? t : 1 - t, X = wrap(x - s), Y = wrap(y - y0); return [sign * F * sample(g, K.ux, X, Y), sign * F * sample(g, K.uy, X, Y)]; }
    : (t, x, y) => { const s = sign > 0 ? t : 1 - t, X = wrap(x - x0), Y = wrap(y - s); return [sign * F * sample(g, K.uy, Y, X), sign * F * sample(g, K.ux, Y, X)]; };
  return integrate(pts, v, 1, steps);
}

export { off as torusOffset };

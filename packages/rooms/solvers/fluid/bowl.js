// SPDX-License-Identifier: FSL-1.1-MIT
// A bowl-like swirl with a drain, on the 2D solver. Stated method and limits:
//  Wall: Brinkman penalty on a ring, target velocity tangential; a soft wall of thickness about sqrt(nu eta). It rings at the grid scale when that thickness
//  falls under one cell, and the vorticity view shows it.
//  Drain: a fixed potential flow from a uniform sink disc to a source ring just inside the wall, zero net volume so it
//  lives on a torus. Inside the sink disc the 2D divergence is -a, the same term as axial strain a in the third
//  dimension, so the core obeys the Burgers equation for vertical vorticity. The plane sees stretching only as a
//  divergence.
//  Not modelled: free surface and air core, gravity, the curved floor, 3D instability, and the floor boundary layer.
import { fft2d, ifft2d } from "./fftn.js";
import { Spectral2 } from "./spectral2.js";

const smooth = (x, w) => 0.5 * (1 + Math.tanh(x / w));
/** Radial flow on the grid: sink disc radius R with divergence -a, balanced by a Gaussian source ring at radius Rs. */
export function drainFlow(sim, a, R, Rs, width = 0.1) {
  const { nx, ny, dx, dy, n, kx, ky, k2, Lx, Ly } = sim, cx = Lx / 2, cy = Ly / 2;
  const div = new Float64Array(n), im = new Float64Array(n), ring = new Float64Array(n);
  let sink = 0, total = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const r = Math.hypot(i * dx - cx, j * dy - cy), s = smooth(R - r, width), g = Math.exp(-(((r - Rs) / (2 * width)) ** 2));
    div[j * nx + i] = -a * s; ring[j * nx + i] = g; sink += s; total += g;
  }
  const scale = (a * sink) / total;
  for (let i = 0; i < n; i++) div[i] += scale * ring[i];
  fft2d(div, im, nx, ny);
  const ur = new Float64Array(n), ui = new Float64Array(n), vr = new Float64Array(n), vi = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    if (!k2[i]) continue;
    // phi hat = -div hat / k^2 and u = grad phi, so u hat = -i k div hat / k^2.
    ur[i] = (kx[i] * im[i]) / k2[i]; ui[i] = (-kx[i] * div[i]) / k2[i];
    vr[i] = (ky[i] * im[i]) / k2[i]; vi[i] = (-ky[i] * div[i]) / k2[i];
  }
  ifft2d(ur, ui, nx, ny); ifft2d(vr, vi, nx, ny);
  return { ux: ur, uy: vr, a, R, Rs };
}
/** Ring wall from radius Rw outward, turning at tangential speed V. */
export function bowlWall(sim, Rw, V, eta, width = 0.08) {
  const { nx, ny, dx, dy, n, Lx, Ly } = sim, cx = Lx / 2, cy = Ly / 2, chi = new Float64Array(n), ux = new Float64Array(n), uy = new Float64Array(n);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const X = i * dx - cx, Y = j * dy - cy, r = Math.hypot(X, Y), q = j * nx + i;
    chi[q] = smooth(r - Rw, width);
    // The target falls to zero before the box edge: a jump there would ring across the whole grid.
    const fade = 0.5 * (1 - Math.tanh((r - Rw - 0.22) / 0.05));
    if (r > 0) { ux[q] = (-V * fade * Y) / r; uy[q] = (V * fade * X) / r; }
  }
  return { chi, ux, uy, eta };
}
/** The model case: a bowl of radius Rw with a rim swirl V, a drain of strain a, and dyes. */
export function bowl({ N = 128, nu = 0.02, a = 2, R = 0.7, Rw = 2.6, V = 1, eta = 0.02, wallWidth = 0.08, dyes = 1, kappa = 0, scheme = "rk4" } = {}) {
  const sim = new Spectral2(N, N, { nu, dyes, kappa, scheme });
  sim.flow = drainFlow(sim, a, R, Rw - 0.35);
  sim.wall = bowlWall(sim, Rw, V, eta, wallWidth);
  return sim;
}
/** Azimuthal average of a physical field about the box centre. */
export function radialProfile(sim, field, nbins = 40, rmax = Math.PI) {
  const { nx, ny, dx, dy, Lx, Ly } = sim, s = new Float64Array(nbins), c = new Float64Array(nbins), h = rmax / nbins;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const b = Math.floor(Math.hypot(i * dx - Lx / 2, j * dy - Ly / 2) / h);
    if (b < nbins) { s[b] += field[j * nx + i]; c[b]++; }
  }
  return Array.from(s, (v, b) => ({ r: (b + 0.5) * h, v: c[b] ? v / c[b] : NaN }));
}
/** Azimuthal velocity about the centre on the grid. */
export function azimuthal(sim) {
  const { u, v } = sim.velocity(), { nx, ny, dx, dy, Lx, Ly } = sim, out = new Float64Array(sim.n);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const X = i * dx - Lx / 2, Y = j * dy - Ly / 2, r = Math.hypot(X, Y), q = j * nx + i;
    out[q] = r ? (-Y * u[q] + X * v[q]) / r : 0;
  }
  return out;
}

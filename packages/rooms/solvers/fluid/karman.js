// SPDX-License-Identifier: FSL-1.1-MIT
// Cylinder wake on the torus. Boundary method: Brinkman penalty for the cylinder (soft wall, first order in
// sqrt(nu eta)) and a fringe that resets the flow to uniform before it wraps round. Limit: the box is not an open
// domain, and the penalised cylinder is a little larger than its nominal diameter. Both shift the Strouhal number.
import { Spectral2 } from "./spectral2.js";

const smooth = (x, w) => 0.5 * (1 + Math.tanh(x / w));
export function karman({ nx = 256, ny = 128, Lx = 32, Ly = 16, D = 1, U = 1, Re = 100, eta = 0.02, fringe = 4, scheme = "rk4" } = {}) {
  const sim = new Spectral2(nx, ny, { nu: (U * D) / Re, Lx, Ly, scheme });
  sim.Umean = [U, 0];
  const cx = 0.25 * Lx, cy = Ly / 2, chi = new Float64Array(sim.n), ux = new Float64Array(sim.n), uy = new Float64Array(sim.n);
  const w = Math.max(sim.dx, sim.dy);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = i * sim.dx, y = j * sim.dy, q = j * nx + i;
    const body = smooth(D / 2 - Math.hypot(x - cx, y - cy), w * 0.5);
    const sponge = 0.5 * smooth(x - (Lx - fringe), 0.5) * (1 - smooth(x - (Lx - 0.5), 0.2));
    chi[q] = Math.max(body, sponge);
    ux[q] = sponge > body ? U : 0;
  }
  sim.wall = { chi, ux, uy, eta };
  // A small off-centre vortex pair breaks symmetry so shedding starts soon.
  sim.setField(0, (x, y) => 0.5 * Math.exp(-((x - cx - 2) ** 2 + (y - cy - 0.5) ** 2)) - 0.1 * Math.exp(-((x - cx - 3) ** 2 + (y - cy + 0.5) ** 2)));
  sim.probe = { i: Math.round((cx + 3 * D) / sim.dx), j: Math.round((cy + D) / sim.dy) };
  return sim;
}
/** Dominant frequency of a uniformly sampled signal by a Hann-windowed DFT with a parabolic peak. */
export function dominantFrequency(x, dt, fmin = 0.02, fmax = 1) {
  const n = x.length, mean = x.reduce((a, b) => a + b, 0) / n, P = [];
  const df = 1 / (n * dt * 4);
  for (let f = fmin; f <= fmax; f += df) {
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)), a = 2 * Math.PI * f * i * dt; re += h * (x[i] - mean) * Math.cos(a); im -= h * (x[i] - mean) * Math.sin(a); }
    P.push([f, re * re + im * im]);
  }
  let b = 1;
  for (let i = 1; i < P.length - 1; i++) if (P[i][1] > P[b][1]) b = i;
  const [p0, p1, p2] = [P[b - 1][1], P[b][1], P[b + 1][1]];
  return P[b][0] + (df * 0.5 * (p0 - p2)) / (p0 - 2 * p1 + p2);
}

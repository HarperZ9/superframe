// SPDX-License-Identifier: FSL-1.1-MIT
// Blasius boundary layer: f''' + f f'' / 2 = 0 with f(0) = f'(0) = 0, f'(inf) = 1. Solved here by shooting, so the
// constant f''(0) = 0.33206 (Howarth 1938, from memory) is computed and not copied. An inviscid mode has no layer to
// grow and must fail this. The plate is a Brinkman strip with a fringe upstream, as in the cylinder wake.
import { Spectral2 } from "./spectral2.js";

function integrate(fpp0, etaMax = 12, h = 0.01) {
  const out = [];
  let y = [0, 0, fpp0];
  const d = (s) => [s[1], s[2], -0.5 * s[0] * s[2]];
  const add = (a, b, w) => a.map((v, i) => v + w * b[i]);
  for (let n = 0; n <= etaMax / h; n++) {
    out.push(y);
    const k1 = d(y), k2 = d(add(y, k1, h / 2)), k3 = d(add(y, k2, h / 2)), k4 = d(add(y, k3, h));
    y = y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  }
  return { rows: out, h };
}
/** f''(0) by bisection on f'(inf) = 1. */
export function blasiusShear() {
  let lo = 0.1, hi = 1;
  for (let i = 0; i < 50; i++) {
    const m = 0.5 * (lo + hi), { rows } = integrate(m);
    if (rows[rows.length - 1][1] > 1) hi = m;
    else lo = m;
  }
  return 0.5 * (lo + hi);
}
/** u/U at similarity variable eta, and the displacement constant, delta* = c sqrt(nu x / U). */
export function blasiusProfile() {
  const { rows, h } = integrate(blasiusShear());
  const at = (eta) => { const e = Math.max(0, Math.min(eta / h, rows.length - 1.001)), i = Math.floor(e); return rows[i][1] + (e - i) * (rows[i + 1][1] - rows[i][1]); };
  let c = 0;
  rows.forEach((r, i) => { c += (1 - r[1]) * h * (i === 0 || i === rows.length - 1 ? 0.5 : 1); });
  return { at, displacement: c };
}
/** A plate on the torus. Stated limits: soft wall, blunt under-resolved leading edge, images in y, fixed free stream. */
export function plate({ nx = 64, ny = 128, Lx = 6, Ly = 4, nu = 0.01, U = 1, eta = 0.01, x0 = 0.5, x1 = 4.5, half = 0.05, fringeAmp = 0.2 } = {}) {
  const s = new Spectral2(nx, ny, { nu, Lx, Ly });
  s.Umean = [U, 0];
  const smooth = (x, w) => 0.5 * (1 + Math.tanh(x / w));
  const chi = new Float64Array(s.n), ux = new Float64Array(s.n), uy = new Float64Array(s.n), yc = Ly / 2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = i * s.dx, y = j * s.dy, q = j * nx + i;
    const body = smooth(half - Math.abs(y - yc), s.dy * 0.5) * smooth(x - x0, s.dx * 0.5) * smooth(x1 - x, s.dx * 0.5);
    const fringe = fringeAmp * Math.max(smooth(x - (x1 + 0.6), 0.4), smooth(x0 - 0.8 - x, 0.3));
    chi[q] = Math.max(body, fringe);
    ux[q] = fringe > body ? U : 0;
  }
  s.wall = { chi, ux, uy, eta };
  s.plateAt = { yc, half, x0 };
  return s;
}
/** Measured displacement thickness and profile error at distance d along the plate. */
export function plateReading(s, d, nu = s.nu) {
  const { u } = s.velocity(), i = Math.round((s.plateAt.x0 + d) / s.dx), yw = s.plateAt.yc + s.plateAt.half, top = s.Ly / 2 - s.plateAt.half;
  const speed = (j) => u[(j % s.ny) * s.nx + i] + s.Umean[0];
  // Blockage speeds the outer flow on a torus, so the free stream is read from the far line between the plate and its image.
  const Ue = speed(Math.round((s.plateAt.yc + s.Ly / 2) / s.dy)), B = blasiusProfile(), scale = Math.sqrt(Ue / (nu * d));
  let dstar = 0, err = 0, n = 0;
  for (let j = 0; j < s.ny; j++) {
    const y = j * s.dy - yw;
    if (y < 0 || y > top) continue;
    const v = speed(j) / Ue;
    dstar += (1 - v) * s.dy;
    if (y > s.dy && y * scale < 7) { err = Math.max(err, Math.abs(v - B.at(y * scale))); n++; }
  }
  return { Ue, dstar, ref: B.displacement / scale, profileErr: err, samples: n };
}

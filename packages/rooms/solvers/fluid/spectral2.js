// SPDX-License-Identifier: FSL-1.1-MIT
// 2D periodic pseudospectral vorticity solver with 2/3 dealiasing and exact integration of viscosity (IFRK4 or IF
// Heun, the scheme the GPU view runs). Carries any number of passive dyes. Extras are physical-space hooks:
//   drive: a body force on vorticity in spectral space, f(q, t) -> [re, im] per unit time (Kolmogorov forcing)
//   flow:  a fixed extra velocity {ux, uy} per cell, may have divergence (a drain); advection is in conservative form
//   wall:  Brinkman penalty mask chi in 0..1 with target velocity, strength 1/eta; first order in sqrt(nu eta)
// Limit stated plainly: the penalty is a soft wall, not a no-slip boundary condition.
import { fft2d, ifft2d, waveInt } from "./fftn.js";

export class Spectral2 {
  constructor(nx, ny, o = {}) {
    const { nu = 0, Lx = 2 * Math.PI, Ly = 2 * Math.PI, dyes = 0, kappa = 0, dealias = true, scheme = "rk4", drag = 0, dynamicMean = false } = o;
    Object.assign(this, { nx, ny, nu, Lx, Ly, kappa, scheme, drag, t: 0, n: nx * ny, drive: null, flow: null, wall: null, Umean: [0, 0], dynamicMean, meanForce: [0, 0] });
    const n = this.n;
    this.kx = new Float64Array(n); this.ky = new Float64Array(n); this.k2 = new Float64Array(n); this.mask = new Uint8Array(n);
    const kxMax = nx / 3, kyMax = ny / 3;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const ix = waveInt(i, nx), iy = waveInt(j, ny), q = j * nx + i;
      this.kx[q] = (ix * 2 * Math.PI) / Lx; this.ky[q] = (iy * 2 * Math.PI) / Ly;
      this.k2[q] = this.kx[q] ** 2 + this.ky[q] ** 2;
      this.mask[q] = dealias ? (Math.abs(ix) < kxMax && Math.abs(iy) < kyMax ? 1 : 0) : 1;
    }
    this.fields = [0, ...Array(dyes).fill(1)].map(() => ({ re: new Float64Array(n), im: new Float64Array(n) }));
    this.fields[0].visc = nu;
    for (let d = 1; d <= dyes; d++) this.fields[d].visc = kappa;
    this.dx = Lx / nx; this.dy = Ly / ny;
  }
  /** Set a field from f(x, y). Field 0 is vorticity, 1 onward are dyes. */
  setField(q, f) {
    const { nx, ny, dx, dy } = this, F = this.fields[q];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { F.re[j * nx + i] = f(i * dx, j * dy); F.im[j * nx + i] = 0; }
    fft2d(F.re, F.im, nx, ny);
    for (let i = 0; i < this.n; i++) if (!this.mask[i]) { F.re[i] = 0; F.im[i] = 0; }
    if (q === 0) { F.re[0] = 0; F.im[0] = 0; } // mean vorticity is zero on a torus
  }
  /** Physical copy of a field. */
  physical(q) {
    const F = this.fields[q], re = F.re.slice(), im = F.im.slice();
    ifft2d(re, im, this.nx, this.ny);
    return re;
  }
  /** Velocity on the grid from the stream function of the given vorticity spectrum. */
  velocity(F = this.fields[0]) {
    const { n, kx, ky, k2, nx, ny } = this, ur = new Float64Array(n), ui = new Float64Array(n), vr = new Float64Array(n), vi = new Float64Array(n);
    for (let i = 1; i < n; i++) {
      if (!k2[i]) continue;
      const pr = F.re[i] / k2[i], pi = F.im[i] / k2[i]; // psi hat, from del^2 psi = -omega
      ur[i] = -ky[i] * pi; ui[i] = ky[i] * pr; // u = d psi / dy
      vr[i] = kx[i] * pi; vi[i] = -kx[i] * pr; // v = -d psi / dx
    }
    ifft2d(ur, ui, nx, ny); ifft2d(vr, vi, nx, ny);
    return { u: ur, v: vr };
  }
  /** Time derivative in spectral space for one state (array of {re, im}), viscosity excluded. */
  rhs(state, tNow) {
    const { n, nx, ny, kx, ky, mask, flow, wall, Umean, drive, drag } = this;
    const { u: U, v: V } = this.velocity(state[0]);
    const ux = new Float64Array(n), uy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      ux[i] = U[i] + Umean[0] + (flow ? flow.ux[i] : 0);
      uy[i] = V[i] + Umean[1] + (flow ? flow.uy[i] : 0);
    }
    const out = state.map((S) => {
      // Conservative flux, so the divergence of a drain stretches vorticity the way a third dimension would.
      const pr = S.re.slice(), pi = S.im.slice();
      ifft2d(pr, pi, nx, ny);
      const ar = new Float64Array(n), ai = new Float64Array(n), br = new Float64Array(n), bi = new Float64Array(n);
      for (let i = 0; i < n; i++) { ar[i] = ux[i] * pr[i]; br[i] = uy[i] * pr[i]; }
      fft2d(ar, ai, nx, ny); fft2d(br, bi, nx, ny);
      const R = new Float64Array(n), I = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        if (!mask[i]) continue;
        R[i] = kx[i] * ai[i] + ky[i] * bi[i]; // -i k . F
        I[i] = -(kx[i] * ar[i] + ky[i] * br[i]);
      }
      return { re: R, im: I };
    });
    const W = out[0], S0 = state[0];
    if (drag) for (let i = 0; i < n; i++) { W.re[i] -= drag * S0.re[i]; W.im[i] -= drag * S0.im[i]; }
    if (drive) for (let i = 1; i < n; i++) if (mask[i]) { const f = drive(i, tNow); if (f) { W.re[i] += f[0]; W.im[i] += f[1]; } }
    if (wall) this.addWall(W, U, V);
    W.re[0] = 0; W.im[0] = 0;
    return out;
  }
  addWall(W, U, V) {
    const { n, nx, ny, kx, ky, mask, wall } = this, fr = new Float64Array(n), fi = new Float64Array(n), gr = new Float64Array(n), gi = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const c = wall.chi[i] / wall.eta;
      fr[i] = -c * (U[i] + this.Umean[0] - wall.ux[i]);
      gr[i] = -c * (V[i] + this.Umean[1] - wall.uy[i]);
    }
    fft2d(fr, fi, nx, ny); fft2d(gr, gi, nx, ny);
    for (let i = 1; i < n; i++) if (mask[i]) {
      W.re[i] += -kx[i] * gi[i] + ky[i] * fi[i]; // curl f = dg/dx - df/dy, i kx g - i ky f
      W.im[i] += kx[i] * gr[i] - ky[i] * fr[i];
    }
  }
  /** One step of length dt; scheme "rk4" (IFRK4) or "heun" (IF Heun, as the GPU does). */
  step(dt) {
    if (this.scheme === "heun") this.stepHeun(dt);
    else this.stepRK4(dt);
    if (this.dynamicMean) this.stepMean(dt);
    this.t += dt;
  }
  /** The k = 0 velocity has no vorticity, so a channel carries it separately: first order, and right at steady state. */
  stepMean(dt) {
    const { n, wall, meanForce, Umean } = this, { u, v } = this.velocity();
    let fx = 0, fy = 0;
    if (wall) for (let i = 0; i < n; i++) { const c = wall.chi[i] / wall.eta; fx -= c * (u[i] + Umean[0] - wall.ux[i]); fy -= c * (v[i] + Umean[1] - wall.uy[i]); }
    Umean[0] += dt * (fx / n + meanForce[0]);
    Umean[1] += dt * (fy / n + meanForce[1]);
  }
  stepHeun(dt) {
    const { n, k2, fields } = this;
    const a = this.rhs(fields, this.t);
    const pred = fields.map((F, q) => {
      const re = new Float64Array(n), im = new Float64Array(n);
      for (let i = 0; i < n; i++) { const e = Math.exp(-F.visc * k2[i] * dt); re[i] = e * (F.re[i] + dt * a[q].re[i]); im[i] = e * (F.im[i] + dt * a[q].im[i]); }
      return { re, im, visc: F.visc };
    });
    const b = this.rhs(pred, this.t + dt);
    fields.forEach((F, q) => {
      for (let i = 0; i < n; i++) {
        const e = Math.exp(-F.visc * k2[i] * dt);
        F.re[i] = e * (F.re[i] + 0.5 * dt * a[q].re[i]) + 0.5 * dt * b[q].re[i];
        F.im[i] = e * (F.im[i] + 0.5 * dt * a[q].im[i]) + 0.5 * dt * b[q].im[i];
      }
    });
  }
  stepRK4(dt) {
    const { n, k2, fields, t } = this;
    const E = fields.map((F) => Float64Array.from(k2, (k) => Math.exp((-F.visc * k * dt) / 2)));
    const comb = (inc, w, useE) => fields.map((F, q) => {
      const re = new Float64Array(n), im = new Float64Array(n), e = E[q];
      for (let i = 0; i < n; i++) {
        const g = useE ? e[i] : 1;
        re[i] = e[i] * F.re[i] + w * g * inc[q].re[i];
        im[i] = e[i] * F.im[i] + w * g * inc[q].im[i];
      }
      return { re, im, visc: F.visc };
    });
    const k1 = this.rhs(fields, t);
    const k2s = this.rhs(comb(k1, dt / 2, true), t + dt / 2);
    const k3s = this.rhs(comb(k2s, dt / 2, false), t + dt / 2);
    const s4 = fields.map((F, q) => {
      const re = new Float64Array(n), im = new Float64Array(n), e = E[q];
      for (let i = 0; i < n; i++) { const e2 = e[i] * e[i]; re[i] = e2 * F.re[i] + dt * e[i] * k3s[q].re[i]; im[i] = e2 * F.im[i] + dt * e[i] * k3s[q].im[i]; }
      return { re, im, visc: F.visc };
    });
    const k4 = this.rhs(s4, t + dt);
    fields.forEach((F, q) => {
      const e = E[q];
      for (let i = 0; i < n; i++) {
        const e2 = e[i] * e[i];
        F.re[i] = e2 * F.re[i] + (dt / 6) * (e2 * k1[q].re[i] + 2 * e[i] * (k2s[q].re[i] + k3s[q].re[i]) + k4[q].re[i]);
        F.im[i] = e2 * F.im[i] + (dt / 6) * (e2 * k1[q].im[i] + 2 * e[i] * (k2s[q].im[i] + k3s[q].im[i]) + k4[q].im[i]);
      }
    });
  }
  /** Mean kinetic energy per unit area, 1/2 <|u|^2>, without the mean flow. */
  energy() {
    const F = this.fields[0], N2 = this.n ** 2;
    let s = 0;
    for (let i = 1; i < this.n; i++) if (this.k2[i]) s += (F.re[i] ** 2 + F.im[i] ** 2) / this.k2[i];
    return (0.5 * s) / N2;
  }
  /** Mean enstrophy per unit area, 1/2 <omega^2>. */
  enstrophy() {
    const F = this.fields[0], N2 = this.n ** 2;
    let s = 0;
    for (let i = 1; i < this.n; i++) s += F.re[i] ** 2 + F.im[i] ** 2;
    return (0.5 * s) / N2;
  }
  /** Okubo-Weiss, the 2D Q-criterion: Q = (omega^2 - Sn^2 - Ss^2) / 4, positive where rotation wins. */
  qField() {
    const { n, nx, ny, kx, ky, k2 } = this, F = this.fields[0];
    const ar = new Float64Array(n), ai = new Float64Array(n), br = new Float64Array(n), bi = new Float64Array(n);
    for (let i = 1; i < n; i++) {
      if (!k2[i]) continue;
      const pr = F.re[i] / k2[i], pi = F.im[i] / k2[i];
      // Sn = u_x - v_y = 2 psi_xy; Ss = u_y + v_x = psi_yy - psi_xx.
      ar[i] = -2 * kx[i] * ky[i] * pr; ai[i] = -2 * kx[i] * ky[i] * pi;
      br[i] = (kx[i] ** 2 - ky[i] ** 2) * pr; bi[i] = (kx[i] ** 2 - ky[i] ** 2) * pi;
    }
    ifft2d(ar, ai, nx, ny); ifft2d(br, bi, nx, ny);
    const w = this.physical(0);
    return ar.map((sn, i) => 0.25 * (w[i] ** 2 - sn ** 2 - br[i] ** 2));
  }
  /** Shell energy spectrum E(k), integer shells of |k| in units of 2 pi / Lx. Sums to energy(). */
  spectrum() {
    const F = this.fields[0], N2 = this.n ** 2, unit = (2 * Math.PI) / this.Lx, E = new Float64Array(Math.ceil(Math.hypot(this.nx, this.ny)) + 2);
    for (let i = 1; i < this.n; i++) if (this.k2[i]) E[Math.round(Math.sqrt(this.k2[i]) / unit)] += (0.5 * (F.re[i] ** 2 + F.im[i] ** 2)) / this.k2[i] / N2;
    return E;
  }
}

// SPDX-License-Identifier: FSL-1.1-MIT
// 3D periodic pseudospectral Navier-Stokes on a 2 pi cube, rotational form with projection, 2/3 dealiasing, IFRK4.
// Readouts: vorticity, Q-criterion, helicity, enstrophy, energy, shell spectrum, divergence.
import { fft3d, ifft3d, waveInt } from "./fftn.js";

const blank = (N) => [0, 1, 2].map(() => ({ re: new Float64Array(N), im: new Float64Array(N) }));

export class Spectral3 {
  constructor(n, o = {}) {
    const { nu = 0, dealias = true, project = true, forceFn = null } = o;
    Object.assign(this, { n, nu, t: 0, project, forceFn, N3: n ** 3 });
    const N = this.N3, k = Float64Array.from({ length: n }, (_, i) => waveInt(i, n));
    this.kx = new Float64Array(N); this.ky = new Float64Array(N); this.kz = new Float64Array(N); this.k2 = new Float64Array(N); this.mask = new Uint8Array(N);
    const kc = n / 3;
    for (let z = 0, q = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++, q++) {
      this.kx[q] = k[x]; this.ky[q] = k[y]; this.kz[q] = k[z]; this.k2[q] = k[x] ** 2 + k[y] ** 2 + k[z] ** 2;
      this.mask[q] = dealias ? (Math.abs(k[x]) < kc && Math.abs(k[y]) < kc && Math.abs(k[z]) < kc ? 1 : 0) : 1;
    }
    this.u = blank(N);
  }
  /** Set velocity from f(x, y, z) -> [u, v, w]; projected and masked. */
  setVelocity(f) {
    const { n } = this, h = (2 * Math.PI) / n;
    for (let z = 0, q = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++, q++) {
      const v = f(x * h, y * h, z * h);
      for (let c = 0; c < 3; c++) { this.u[c].re[q] = v[c]; this.u[c].im[q] = 0; }
    }
    for (const c of this.u) fft3d(c.re, c.im, n);
    this.clean(this.u);
  }
  clean(U) {
    const { N3, kx, ky, kz, k2, mask, project } = this;
    for (let i = 0; i < N3; i++) {
      if (!mask[i]) { for (const c of U) { c.re[i] = 0; c.im[i] = 0; } continue; }
      if (!project || !k2[i]) continue;
      const dr = (kx[i] * U[0].re[i] + ky[i] * U[1].re[i] + kz[i] * U[2].re[i]) / k2[i];
      const di = (kx[i] * U[0].im[i] + ky[i] * U[1].im[i] + kz[i] * U[2].im[i]) / k2[i];
      U[0].re[i] -= kx[i] * dr; U[1].re[i] -= ky[i] * dr; U[2].re[i] -= kz[i] * dr;
      U[0].im[i] -= kx[i] * di; U[1].im[i] -= ky[i] * di; U[2].im[i] -= kz[i] * di;
    }
  }
  /** Spectral vorticity of a velocity spectrum: i k x u. */
  curlHat(U) {
    const { N3, kx, ky, kz } = this, W = blank(N3);
    for (let i = 0; i < N3; i++) {
      W[0].re[i] = -(ky[i] * U[2].im[i] - kz[i] * U[1].im[i]); W[0].im[i] = ky[i] * U[2].re[i] - kz[i] * U[1].re[i];
      W[1].re[i] = -(kz[i] * U[0].im[i] - kx[i] * U[2].im[i]); W[1].im[i] = kz[i] * U[0].re[i] - kx[i] * U[2].re[i];
      W[2].re[i] = -(kx[i] * U[1].im[i] - ky[i] * U[0].im[i]); W[2].im[i] = kx[i] * U[1].re[i] - ky[i] * U[0].re[i];
    }
    return W;
  }
  toPhysical(F) { const re = F.re.slice(), im = F.im.slice(); ifft3d(re, im, this.n); return re; }
  /** u x omega, projected: the nonlinear term of the rotational form. Pressure is the projection. */
  rhs(U, tNow) {
    const { N3, n } = this, W = this.curlHat(U), u = U.map((c) => this.toPhysical(c)), w = W.map((c) => this.toPhysical(c));
    const out = blank(N3);
    for (let i = 0; i < N3; i++) {
      out[0].re[i] = u[1][i] * w[2][i] - u[2][i] * w[1][i];
      out[1].re[i] = u[2][i] * w[0][i] - u[0][i] * w[2][i];
      out[2].re[i] = u[0][i] * w[1][i] - u[1][i] * w[0][i];
    }
    for (const c of out) fft3d(c.re, c.im, n);
    if (this.forceFn) this.forceFn(out, U, tNow, this);
    this.clean(out);
    return out;
  }
  step(dt) {
    const { N3, k2, u, nu, t } = this, E = Float64Array.from(k2, (k) => Math.exp((-nu * k * dt) / 2));
    const mix = (inc, w, useE) => u.map((F, c) => {
      const re = new Float64Array(N3), im = new Float64Array(N3);
      for (let i = 0; i < N3; i++) { const g = useE ? E[i] : 1; re[i] = E[i] * F.re[i] + w * g * inc[c].re[i]; im[i] = E[i] * F.im[i] + w * g * inc[c].im[i]; }
      return { re, im };
    });
    const a = this.rhs(u, t), b = this.rhs(mix(a, dt / 2, true), t + dt / 2), c3 = this.rhs(mix(b, dt / 2, false), t + dt / 2);
    const s4 = u.map((F, c) => {
      const re = new Float64Array(N3), im = new Float64Array(N3);
      for (let i = 0; i < N3; i++) { const e2 = E[i] * E[i]; re[i] = e2 * F.re[i] + dt * E[i] * c3[c].re[i]; im[i] = e2 * F.im[i] + dt * E[i] * c3[c].im[i]; }
      return { re, im };
    });
    const d = this.rhs(s4, t + dt);
    u.forEach((F, c) => {
      for (let i = 0; i < N3; i++) {
        const e = E[i], e2 = e * e;
        F.re[i] = e2 * F.re[i] + (dt / 6) * (e2 * a[c].re[i] + 2 * e * (b[c].re[i] + c3[c].re[i]) + d[c].re[i]);
        F.im[i] = e2 * F.im[i] + (dt / 6) * (e2 * a[c].im[i] + 2 * e * (b[c].im[i] + c3[c].im[i]) + d[c].im[i]);
      }
    });
    this.t += dt;
  }
  sum(fn) {
    const { N3 } = this, N2 = N3 ** 2;
    let s = 0;
    for (let i = 0; i < N3; i++) s += fn(i);
    return s / N2;
  }
  energy() {
    const U = this.u;
    return 0.5 * this.sum((i) => U[0].re[i] ** 2 + U[0].im[i] ** 2 + U[1].re[i] ** 2 + U[1].im[i] ** 2 + U[2].re[i] ** 2 + U[2].im[i] ** 2);
  }
  /** Enstrophy in Brachet's normalisation, 1/2 <|omega|^2>. */
  enstrophy() {
    const W = this.curlHat(this.u);
    return 0.5 * this.sum((i) => W[0].re[i] ** 2 + W[0].im[i] ** 2 + W[1].re[i] ** 2 + W[1].im[i] ** 2 + W[2].re[i] ** 2 + W[2].im[i] ** 2);
  }
  /** Helicity, <u . omega>. */
  helicity() {
    const U = this.u, W = this.curlHat(U);
    return this.sum((i) => U[0].re[i] * W[0].re[i] + U[0].im[i] * W[0].im[i] + U[1].re[i] * W[1].re[i] + U[1].im[i] * W[1].im[i] + U[2].re[i] * W[2].re[i] + U[2].im[i] * W[2].im[i]);
  }
  /** Largest |k . u hat| over the grid, normalised by the largest |k| |u hat|. Zero for a solenoidal field. */
  maxDivergence() {
    const { N3, kx, ky, kz, u } = this;
    let d = 0, s = 0;
    for (let i = 0; i < N3; i++) {
      const r = kx[i] * u[0].re[i] + ky[i] * u[1].re[i] + kz[i] * u[2].re[i], m = kx[i] * u[0].im[i] + ky[i] * u[1].im[i] + kz[i] * u[2].im[i];
      d = Math.max(d, Math.hypot(r, m));
      s = Math.max(s, Math.sqrt(this.k2[i] * (u[0].re[i] ** 2 + u[0].im[i] ** 2 + u[1].re[i] ** 2 + u[1].im[i] ** 2 + u[2].re[i] ** 2 + u[2].im[i] ** 2)));
    }
    return d / (s || 1);
  }
  vorticity() { return this.curlHat(this.u).map((c) => this.toPhysical(c)); }
  /** Q = -1/2 du_i/dx_j du_j/dx_i, positive where rotation beats strain. Mean is zero on a torus. */
  qField() {
    const { N3, n, u, kx, ky, kz } = this, K = [kx, ky, kz], G = [];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const re = new Float64Array(N3), im = new Float64Array(N3);
      for (let i = 0; i < N3; i++) { re[i] = -K[b][i] * u[a].im[i]; im[i] = K[b][i] * u[a].re[i]; }
      ifft3d(re, im, n);
      G.push(re);
    }
    const Q = new Float64Array(N3);
    for (let i = 0; i < N3; i++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) Q[i] -= 0.5 * G[3 * a + b][i] * G[3 * b + a][i];
    return Q;
  }
  helicityField() {
    const u = this.u.map((c) => this.toPhysical(c)), w = this.vorticity();
    return u[0].map((_, i) => u[0][i] * w[0][i] + u[1][i] * w[1][i] + u[2][i] * w[2][i]);
  }
  spectrum() {
    const { N3, n, k2, u } = this, E = new Float64Array(Math.ceil(n * 0.9) + 2), N2 = N3 ** 2;
    for (let i = 0; i < N3; i++) {
      const b = Math.round(Math.sqrt(k2[i]));
      if (b < E.length) E[b] += (0.5 * (u[0].re[i] ** 2 + u[0].im[i] ** 2 + u[1].re[i] ** 2 + u[1].im[i] ** 2 + u[2].re[i] ** 2 + u[2].im[i] ** 2)) / N2;
    }
    return E;
  }
}
/** Brachet's Taylor-Green start: (sin x cos y cos z, -cos x sin y cos z, 0). */
export const taylorGreen3 = (x, y, z) => [Math.sin(x) * Math.cos(y) * Math.cos(z), -Math.cos(x) * Math.sin(y) * Math.cos(z), 0];
/** Arnold-Beltrami-Childress flow; helicity is exact for it. */
export const abc = (A, B, C) => (x, y, z) => [A * Math.sin(z) + C * Math.cos(y), B * Math.sin(x) + A * Math.cos(z), C * Math.sin(y) + B * Math.cos(x)];

// SPDX-License-Identifier: FSL-1.1-MIT
// Vortex tubes on the 3D solver: closed curves with a Gaussian core, velocity by the spectral Biot-Savart law.
// Moffatt 1969: linked tubes carry helicity 2 Lk Gamma^2 (the Gauss linking number Lk). Volume integral, not mean.
import { fft3d } from "./fftn.js";
import { Spectral3 } from "./spectral3.js";

export function ring(c, axis, R, flip = 1, n = 256) {
  const a = (axis + 1) % 3, b = (axis + 2) % 3;
  return Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n, P = [c[0], c[1], c[2]];
    P[a] += R * Math.cos(flip * t);
    P[b] += R * Math.sin(flip * t);
    return P;
  });
}
/** Gauss linking integral over two closed polylines. */
export function gaussLink(P, Q) {
  let s = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], pn = P[(i + 1) % P.length], T = [pn[0] - p[0], pn[1] - p[1], pn[2] - p[2]], M = [(p[0] + pn[0]) / 2, (p[1] + pn[1]) / 2, (p[2] + pn[2]) / 2];
    for (let j = 0; j < Q.length; j++) {
      const q = Q[j], qn = Q[(j + 1) % Q.length], U = [qn[0] - q[0], qn[1] - q[1], qn[2] - q[2]];
      const d = [M[0] - (q[0] + qn[0]) / 2, M[1] - (q[1] + qn[1]) / 2, M[2] - (q[2] + qn[2]) / 2], r = Math.hypot(...d);
      s += ((T[1] * U[2] - T[2] * U[1]) * d[0] + (T[2] * U[0] - T[0] * U[2]) * d[1] + (T[0] * U[1] - T[1] * U[0]) * d[2]) / (r * r * r);
    }
  }
  return s / (4 * Math.PI);
}
/** A solver holding tubes of circulation G and core a. */
export function tubes(curves, n, { a = 0.3, G = 1, nu = 0 } = {}) {
  const s = new Spectral3(n, { nu }), h = (2 * Math.PI) / n, W = [0, 1, 2].map(() => ({ re: new Float64Array(s.N3), im: new Float64Array(s.N3) }));
  const rad = Math.ceil((4 * a) / h), norm = G / (Math.PI ** 1.5 * a ** 3);
  for (const P of curves) for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2], t = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
    const c = m.map((v) => Math.round(v / h));
    for (let dz = -rad; dz <= rad; dz++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const X = (c[0] + dx) * h - m[0], Y = (c[1] + dy) * h - m[1], Z = (c[2] + dz) * h - m[2], g = norm * Math.exp(-(X * X + Y * Y + Z * Z) / (a * a));
      const k = (((c[2] + dz) % n + n) % n) * n * n + (((c[1] + dy) % n + n) % n) * n + (((c[0] + dx) % n + n) % n);
      for (let e = 0; e < 3; e++) W[e].re[k] += g * t[e];
    }
  }
  for (const w of W) fft3d(w.re, w.im, n);
  // u hat = i k x w hat / k^2
  const { kx, ky, kz, k2 } = s;
  for (let i = 0; i < s.N3; i++) {
    if (!k2[i]) continue;
    const cr = [ky[i] * W[2].re[i] - kz[i] * W[1].re[i], kz[i] * W[0].re[i] - kx[i] * W[2].re[i], kx[i] * W[1].re[i] - ky[i] * W[0].re[i]];
    const ci = [ky[i] * W[2].im[i] - kz[i] * W[1].im[i], kz[i] * W[0].im[i] - kx[i] * W[2].im[i], kx[i] * W[1].im[i] - ky[i] * W[0].im[i]];
    for (let e = 0; e < 3; e++) { s.u[e].re[i] = -ci[e] / k2[i]; s.u[e].im[i] = cr[e] / k2[i]; }
  }
  s.clean(s.u);
  return s;
}
/** Hopf link of two rings, or its mirror, or the same rings unlinked. */
export function hopf(kind = "linked", R = 1.2) {
  const c = [Math.PI, Math.PI, Math.PI], d = kind === "unlinked" ? [Math.PI + 2.5 * R, Math.PI, Math.PI] : [Math.PI + R, Math.PI, Math.PI];
  return [ring(c, 2, R), ring(d, 1, R, kind === "mirror" ? -1 : 1)];
}

// SPDX-License-Identifier: FSL-1.1-MIT
// Wave propagation on top of the view's FFT: focal field of a pupil (Fraunhofer) and the angular spectrum method.
// The pupil grid and padding are the page's: 128 samples padded to 1024.
import { fft2 } from "./wave.js";

export function focalField({ P = 128, N = 1024, D, lam, z, phase = null }) {
  const dx = (D * 1.02) / P,
    R = D / 2,
    re = new Float64Array(N * N),
    im = new Float64Array(N * N);
  for (let y = 0; y < P; y++)
    for (let x = 0; x < P; x++) {
      const xx = (x + 0.5 - P / 2) * dx,
        yy = (y + 0.5 - P / 2) * dx,
        cover = Math.max(0, Math.min(1, (R - Math.hypot(xx, yy)) / dx + 0.5));
      if (cover <= 0) continue;
      const ph = phase ? phase(xx, yy) : 0,
        o = ((y + N / 2 - P / 2) % N) * N + ((x + N / 2 - P / 2) % N);
      re[o] = cover * Math.cos(ph);
      im[o] = cover * Math.sin(ph);
    }
  fft2(re, im, N);
  const I = new Float64Array(N * N);
  let peak = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const o = ((y + N / 2) % N) * N + ((x + N / 2) % N),
        q = re[o] * re[o] + im[o] * im[o];
      I[y * N + x] = q;
      if (q > peak) peak = q;
    }
  return { I, N, peak, binSize: (lam * z) / (N * dx), pred: (1.22 * lam * z) / D };
}
export function radialProfile({ I, N }) {
  const bins = new Float64Array(N / 2),
    cn = new Float64Array(N / 2);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r = Math.hypot(x - N / 2, y - N / 2) | 0;
      if (r < N / 2) {
        bins[r] += I[y * N + x];
        cn[r]++;
      }
    }
  return bins.map((v, i) => v / (cn[i] || 1));
}
/** First dark ring by the page's rule: a local minimum under a fifth of the centre, placed by a parabola. */
export function firstDark(f) {
  const b = radialProfile(f);
  for (let i = 2; i < f.N / 4; i++)
    if (b[i] < b[i - 1] && b[i] <= b[i + 1] && b[i] < b[0] * 0.2) {
      const off = (0.5 * (b[i - 1] - b[i + 1])) / (b[i - 1] - 2 * b[i] + b[i + 1] || 1);
      return (i + off) * f.binSize;
    }
  return null;
}
export const centreRatio = (f) => f.I[(f.N / 2) * f.N + f.N / 2] / (f.peak || 1);

export function gaussianBeam(N, dx, w0) {
  const re = new Float64Array(N * N),
    im = new Float64Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r2 = ((x - N / 2) * dx) ** 2 + ((y - N / 2) * dx) ** 2;
      re[y * N + x] = Math.exp(-r2 / (w0 * w0));
    }
  return { re, im };
}
export const energy = ({ re, im }) => re.reduce((s, v, i) => s + v * v + im[i] * im[i], 0);
/** Angular spectrum: multiply the plane-wave spectrum by exp(i kz z). Evanescent components are dropped. */
export function asmPropagate(a, N, dx, lam, z) {
  const re = Float64Array.from(a.re),
    im = Float64Array.from(a.im);
  fft2(re, im, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const fx = (x < N / 2 ? x : x - N) / (N * dx),
        fy = (y < N / 2 ? y : y - N) / (N * dx),
        q = 1 / (lam * lam) - fx * fx - fy * fy,
        o = y * N + x;
      if (q <= 0) {
        re[o] = im[o] = 0;
        continue;
      }
      const ph = 2 * Math.PI * z * Math.sqrt(q),
        c = Math.cos(ph),
        s = Math.sin(ph),
        u = re[o],
        v = im[o];
      re[o] = u * c - v * s;
      im[o] = u * s + v * c;
    }
  // Inverse by conjugation.
  for (let i = 0; i < N * N; i++) im[i] = -im[i];
  fft2(re, im, N);
  const s = 1 / (N * N);
  for (let i = 0; i < N * N; i++) {
    re[i] *= s;
    im[i] *= -s;
  }
  return { re, im };
}

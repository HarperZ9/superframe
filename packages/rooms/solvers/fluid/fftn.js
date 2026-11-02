// SPDX-License-Identifier: FSL-1.1-MIT
// Forward and inverse transforms over N-dimensional grids, built on the one FFT in core/wave.js. Inverse scales by
// 1/N, and swapping re and im is the inverse: the convention here is the forward sign exp(-ikx).
import { fft1 } from "../../core/wave.js";

const TW = new Map();
export function twiddles(n) {
  if (!Number.isInteger(Math.log2(n))) throw new Error(`grid size ${n} must be a power of two`);
  if (TW.has(n)) return TW.get(n);
  const tw = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    tw[2 * i] = Math.cos((-2 * Math.PI * i) / n);
    tw[2 * i + 1] = Math.sin((-2 * Math.PI * i) / n);
  }
  TW.set(n, tw);
  return tw;
}
export function fft2d(re, im, nx, ny) {
  const tx = twiddles(nx), ty = twiddles(ny);
  for (let y = 0; y < ny; y++) fft1(re, im, nx, 1, y * nx, tx);
  for (let x = 0; x < nx; x++) fft1(re, im, ny, nx, x, ty);
}
export function ifft2d(re, im, nx, ny) {
  fft2d(im, re, nx, ny);
  const s = 1 / (nx * ny);
  for (let i = 0; i < re.length; i++) { re[i] *= s; im[i] *= s; }
}
export function fft3d(re, im, n) {
  const t = twiddles(n), n2 = n * n;
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) fft1(re, im, n, 1, z * n2 + y * n, t);
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) fft1(re, im, n, n, z * n2 + x, t);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) fft1(re, im, n, n2, y * n + x, t);
}
export function ifft3d(re, im, n) {
  fft3d(im, re, n);
  const s = 1 / (n * n * n);
  for (let i = 0; i < re.length; i++) { re[i] *= s; im[i] *= s; }
}
/** The integer wavenumber on an n point axis: 0, 1, ..., n/2-1, -n/2, ..., -1. */
export const waveInt = (i, n) => (i < n / 2 ? i : i - n);

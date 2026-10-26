// lib/mosaic/analysis.mjs: the two readouts a marks law is checked by (CORE.md, "Marks", bedrock checks).
//   readout(marks, ink, W, H, sigma)   the eye: blur the marks and the source alike; mean absolute tone error
//   noiseSpectrum(marks, N, tone)      radially averaged power of (marks - tone) on an N x N tile (N a power of 2)
//   blueness(spec)                     low-band power over high-band power: far below 1 for blue noise, near 1 white
//   latticeShare(marks, N, period)     share of the noise power on the lattice of a period-p tiling (1 for Bayer)
import { eye } from './marks.mjs';

export function readout(marks, ink, W, H, sigma = 2, margin = null) {
  const a = eye(Float32Array.from(marks), W, H, sigma), b = eye(ink, W, H, sigma), m = margin ?? Math.ceil(sigma * 3);
  let e = 0, n = 0, worst = 0;
  for (let y = m; y < H - m; y++) for (let x = m; x < W - m; x++) { const d = Math.abs(a[y * W + x] - b[y * W + x]); e += d; n++; if (d > worst) worst = d; }
  return { mae: e / n, worst };
}

function fft1(re, im, inv = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) {
      const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
      re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
}
export function power2(field, N) {
  const re = Float64Array.from(field), im = new Float64Array(N * N), r = new Float64Array(N), i2 = new Float64Array(N);
  for (let y = 0; y < N; y++) { const R = re.subarray(y * N, y * N + N), I = im.subarray(y * N, y * N + N); fft1(R, I); }
  for (let x = 0; x < N; x++) { for (let y = 0; y < N; y++) { r[y] = re[y * N + x]; i2[y] = im[y * N + x]; } fft1(r, i2); for (let y = 0; y < N; y++) { re[y * N + x] = r[y]; im[y * N + x] = i2[y]; } }
  const P = new Float64Array(N * N); for (let k = 0; k < N * N; k++) P[k] = re[k] * re[k] + im[k] * im[k];
  return P;
}
export function noiseSpectrum(marks, N, tone) {
  const f = new Float64Array(N * N); for (let k = 0; k < N * N; k++) f[k] = marks[k] - tone;
  const P = power2(f, N), bins = new Float64Array(N / 2 + 1), cnt = new Float64Array(N / 2 + 1);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const fx = x <= N / 2 ? x : x - N, fy = y <= N / 2 ? y : y - N, r = Math.round(Math.hypot(fx, fy)); if (r > N / 2 || r === 0) continue; bins[r] += P[y * N + x]; cnt[r]++; }
  for (let r = 0; r <= N / 2; r++) bins[r] = cnt[r] ? bins[r] / cnt[r] : 0;
  return { N, bins, P };
}
// mean power in the lowest tenth of frequencies over the mean in the top half
export function blueness({ N, bins }) {
  const h = N / 2; let lo = 0, nl = 0, hi = 0, nh = 0;
  for (let r = 1; r <= h; r++) { if (r <= Math.max(1, Math.round(0.1 * h))) { lo += bins[r]; nl++; } else if (r >= h / 2) { hi += bins[r]; nh++; } }
  return (lo / nl) / (hi / nh);
}
export function latticeShare(marks, N, period, tone) {
  const f = new Float64Array(N * N); for (let k = 0; k < N * N; k++) f[k] = marks[k] - tone;
  const P = power2(f, N), step = N / period; let on = 0, all = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (!x && !y) continue; all += P[y * N + x]; if (x % step === 0 && y % step === 0) on += P[y * N + x]; }
  return all ? on / all : 1;
}

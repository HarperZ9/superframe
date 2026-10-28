// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// moments.mjs: directional light at a point from 9 numbers, read back two ways.
//   sphere(n)                  -> Fibonacci directions with equal weights (quadrature, total 4 pi)
//   basis(w)                   -> the 9 real SH functions to order 2 at direction w
//   project(L, dirs)           -> 9 coefficients of radiance samples L (one per direction)
//   shIrradiance(c, n)         -> irradiance for normal n from SH-2 (Ramamoorthi-Hanrahan cosine convolution)
//   maxentFit(c, dirs)         -> { lambda, ok, steps }: L(w) = exp(lambda . basis(w)) with the same 9 moments
//   maxentRadiance(fit, dirs)  -> radiance samples of the fitted density
//   irradiance(L, dirs, n)     -> irradiance for normal n by quadrature: sum L max(0, n . w) dA
// The 9 SH coefficients are also the 9 moments a maximum-entropy density is fitted to, so SH-2 and MaxEnt-2 differ
// only in how the light is read back from the same data. MaxEnt-2 is positive by construction; SH-2 can ring.
// Idea from arXiv 2608.20429 (maximum-entropy spherical moments, abstract only); this is our own construction.

export function sphere(n) {
  const dirs = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * i + 1) / n, r = Math.sqrt(1 - z * z), a = g * i;
    dirs.push([r * Math.cos(a), r * Math.sin(a), z]);
  }
  dirs.dA = (4 * Math.PI) / n;
  return dirs;
}

export function basis([x, y, z]) {
  return [0.282095, 0.488603 * y, 0.488603 * z, 0.488603 * x,
    1.092548 * x * y, 1.092548 * y * z, 0.315392 * (3 * z * z - 1), 1.092548 * x * z, 0.546274 * (x * x - y * y)];
}

export function project(L, dirs) {
  const c = new Array(9).fill(0);
  dirs.forEach((w, i) => { const b = basis(w); for (let k = 0; k < 9; k++) c[k] += L[i] * b[k] * dirs.dA; });
  return c;
}

// cosine-lobe convolution weights per band (pi, 2 pi / 3, pi / 4)
const A = [Math.PI, (2 * Math.PI) / 3, (2 * Math.PI) / 3, (2 * Math.PI) / 3, Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4];
export function shIrradiance(c, n) {
  const b = basis(n);
  let e = 0;
  for (let k = 0; k < 9; k++) e += A[k] * c[k] * b[k];
  return e;
}

export function irradiance(L, dirs, n) {
  let e = 0;
  dirs.forEach((w, i) => { const d = n[0] * w[0] + n[1] * w[1] + n[2] * w[2]; if (d > 0) e += L[i] * d; });
  return e * dirs.dA;
}

// solve a 9x9 system by Gaussian elimination with partial pivoting
function solve(M, v) {
  const n = v.length, a = M.map((r, i) => [...r, v[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    if (Math.abs(a[c][c]) < 1e-300) return null;
    for (let r = c + 1; r < n; r++) { const f = a[r][c] / a[c][c]; for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = a[r][n]; for (let k = r + 1; k < n; k++) s -= a[r][k] * x[k]; x[r] = s / a[r][r]; }
  return x;
}

// Newton on the dual: minimise log-partition minus lambda . c. The gradient is (model moments - c), the Hessian
// the model's covariance of the basis. A backtracking step keeps the dual decreasing.
export function maxentFit(c, dirs, { steps = 60, tol = 1e-9 } = {}) {
  const B = dirs.map(basis), scale = Math.abs(c[0]) || 1, t = c.map(v => v / scale);
  let lambda = new Array(9).fill(0);
  lambda[0] = Math.log(t[0] / (0.282095 * 4 * Math.PI)) / 0.282095;
  const evalAt = (lam) => {
    let Z = 0; const m = new Array(9).fill(0), H = Array.from({ length: 9 }, () => new Array(9).fill(0)), p = [];
    for (let i = 0; i < B.length; i++) {
      let s = 0; for (let k = 0; k < 9; k++) s += lam[k] * B[i][k];
      const q = Math.exp(s) * dirs.dA; p.push(q); Z += q;
      for (let k = 0; k < 9; k++) { m[k] += q * B[i][k]; for (let j = k; j < 9; j++) H[k][j] += q * B[i][k] * B[i][j]; }
    }
    for (let k = 0; k < 9; k++) for (let j = 0; j < k; j++) H[k][j] = H[j][k];
    let dual = Z; for (let k = 0; k < 9; k++) dual -= lam[k] * t[k];
    return { m, H, dual };
  };
  let cur = evalAt(lambda);
  for (let it = 0; it < steps; it++) {
    const g = cur.m.map((v, k) => v - t[k]);
    if (Math.max(...g.map(Math.abs)) < tol * Math.max(1, t[0])) return { lambda: lambda.map((v, k) => (k === 0 ? v + Math.log(scale) / 0.282095 : v)), ok: true, steps: it };
    const d = solve(cur.H, g.map(v => -v));
    if (!d || !d.every(Number.isFinite)) break;
    let a = 1, next;
    for (; a > 1e-8; a *= 0.5) {
      const lam = lambda.map((v, k) => v + a * d[k]);
      next = evalAt(lam);
      if (Number.isFinite(next.dual) && next.dual <= cur.dual + 1e-12) { lambda = lam; break; }
    }
    if (a <= 1e-8) break;
    cur = next;
  }
  return { lambda: lambda.map((v, k) => (k === 0 ? v + Math.log(scale) / 0.282095 : v)), ok: false, steps };
}

export function maxentRadiance(fit, dirs) {
  return dirs.map(w => { const b = basis(w); let s = 0; for (let k = 0; k < 9; k++) s += fit.lambda[k] * b[k]; return Math.exp(s); });
}

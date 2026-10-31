// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/sim/linalg: dense LU with partial pivoting, real and complex. Circuits here have tens of unknowns,
   so a dense factor is exact enough and fast enough; the factor is kept so one matrix can be solved against many
   right-hand sides (every noise source at one frequency, every time step of a linear transient). */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const S = (D.SIM = D.SIM || {});

  /* A is n*n row-major Float64Array, overwritten by its factor. Throws on a singular matrix, naming the row. */
  S.luFactor = (A, n) => {
    const piv = new Int32Array(n);
    for (let k = 0; k < n; k++) {
      let p = k, m = Math.abs(A[k * n + k]);
      for (let i = k + 1; i < n; i++) { const v = Math.abs(A[i * n + k]); if (v > m) { m = v; p = i; } }
      if (m < 1e-300) throw new Error("sim: singular matrix at unknown " + k);
      piv[k] = p;
      if (p !== k) for (let j = 0; j < n; j++) { const t = A[k * n + j]; A[k * n + j] = A[p * n + j]; A[p * n + j] = t; }
      const d = A[k * n + k];
      for (let i = k + 1; i < n; i++) {
        const f = (A[i * n + k] /= d);
        if (f !== 0) for (let j = k + 1; j < n; j++) A[i * n + j] -= f * A[k * n + j];
      }
    }
    return { A, n, piv };
  };

  S.luSolve = (F, b) => {
    const { A, n, piv } = F, x = Float64Array.from(b);
    for (let k = 0; k < n; k++) { const p = piv[k]; if (p !== k) { const t = x[k]; x[k] = x[p]; x[p] = t; } }
    for (let i = 1; i < n; i++) { let s = x[i]; for (let j = 0; j < i; j++) s -= A[i * n + j] * x[j]; x[i] = s; }
    for (let i = n - 1; i >= 0; i--) { let s = x[i]; for (let j = i + 1; j < n; j++) s -= A[i * n + j] * x[j]; x[i] = s / A[i * n + i]; }
    return x;
  };

  /* Complex: separate real and imaginary arrays. */
  S.luFactorC = (Ar, Ai, n) => {
    const piv = new Int32Array(n);
    for (let k = 0; k < n; k++) {
      let p = k, m = Math.hypot(Ar[k * n + k], Ai[k * n + k]);
      for (let i = k + 1; i < n; i++) { const v = Math.hypot(Ar[i * n + k], Ai[i * n + k]); if (v > m) { m = v; p = i; } }
      if (m < 1e-300) throw new Error("sim: singular complex matrix at unknown " + k);
      piv[k] = p;
      if (p !== k) for (let j = 0; j < n; j++) {
        let t = Ar[k * n + j]; Ar[k * n + j] = Ar[p * n + j]; Ar[p * n + j] = t;
        t = Ai[k * n + j]; Ai[k * n + j] = Ai[p * n + j]; Ai[p * n + j] = t;
      }
      const dr = Ar[k * n + k], di = Ai[k * n + k], dd = dr * dr + di * di;
      for (let i = k + 1; i < n; i++) {
        const ar = Ar[i * n + k], ai = Ai[i * n + k], fr = (ar * dr + ai * di) / dd, fi = (ai * dr - ar * di) / dd;
        Ar[i * n + k] = fr; Ai[i * n + k] = fi;
        if (fr === 0 && fi === 0) continue;
        for (let j = k + 1; j < n; j++) {
          const br = Ar[k * n + j], bi = Ai[k * n + j];
          Ar[i * n + j] -= fr * br - fi * bi; Ai[i * n + j] -= fr * bi + fi * br;
        }
      }
    }
    return { Ar, Ai, n, piv };
  };

  S.luSolveC = (F, br, bi) => {
    const { Ar, Ai, n, piv } = F, xr = Float64Array.from(br), xi = Float64Array.from(bi);
    for (let k = 0; k < n; k++) { const p = piv[k]; if (p !== k) { let t = xr[k]; xr[k] = xr[p]; xr[p] = t; t = xi[k]; xi[k] = xi[p]; xi[p] = t; } }
    for (let i = 1; i < n; i++) {
      let sr = xr[i], si = xi[i];
      for (let j = 0; j < i; j++) { const lr = Ar[i * n + j], li = Ai[i * n + j]; sr -= lr * xr[j] - li * xi[j]; si -= lr * xi[j] + li * xr[j]; }
      xr[i] = sr; xi[i] = si;
    }
    for (let i = n - 1; i >= 0; i--) {
      let sr = xr[i], si = xi[i];
      for (let j = i + 1; j < n; j++) { const ur = Ar[i * n + j], ui = Ai[i * n + j]; sr -= ur * xr[j] - ui * xi[j]; si -= ur * xi[j] + ui * xr[j]; }
      const dr = Ar[i * n + i], di = Ai[i * n + i], dd = dr * dr + di * di;
      xr[i] = (sr * dr + si * di) / dd; xi[i] = (si * dr - sr * di) / dd;
    }
    return { re: xr, im: xi };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = S;
})(typeof globalThis !== "undefined" ? globalThis : this);

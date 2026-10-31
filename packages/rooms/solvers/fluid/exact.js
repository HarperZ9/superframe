// SPDX-License-Identifier: FSL-1.1-MIT
// Known answers in closed form, plus the small eigenproblems that are not. Sources are named per function, and the
// values read from a paper are held here with where they were read.
import { constant } from "../../core/provenance.js";

const checked = (against, result) => ({ against, result });
export const FLUID_CONSTANTS = {
  kolmogorovRec: constant(Math.SQRT2, "1", {
    source: "Meshalkin and Sinai 1961, as stated in arXiv:1902.08916 and arXiv:2007.06513",
    verified: checked("kolmogorovCritical in this file, Galerkin matrix", "within 0.003 at wavenumber 0.02; tests/fluid-known.test.mjs"),
  }),
};
/** Omega = 1/2 <omega^2> of the inviscid Taylor-Green start. Brachet et al. 1983, JFM 130, table 3, infinite order column. */
export const BRACHET_TABLE3 = [[0, 0.375], [0.5, 0.38495], [1, 0.41691], [1.5, 0.47686], [2, 0.57435], [2.5, 0.72333], [2.75, 0.82347]];

/** 2D Taylor-Green: omega = 2 k sin(kx) sin(ky) exp(-2 nu k^2 t). */
export const taylorGreen2Omega = (k, nu, t) => (x, y) => 2 * k * Math.sin(k * x) * Math.sin(k * y) * Math.exp(-2 * nu * k * k * t);
export const taylorGreen2Energy = (k, nu, t) => 0.25 * Math.exp(-4 * nu * k * k * t);
/** Plane Poiseuille between walls a and b, body force g along the channel. */
export const poiseuille = (g, nu, a, b) => (y) => (y <= a || y >= b ? 0 : (g / (2 * nu)) * (y - a) * (b - y));
/** Annular Couette, the steady Stokes flow of a turning inner wall: u_theta(r) = A r + B / r. */
export function annularCouette(a, b, omegaInner) {
  const B = (omegaInner * a * a * b * b) / (b * b - a * a), A = (-omegaInner * a * a) / (b * b - a * a);
  return (r) => A * r + B / r;
}
/** Rankine: solid core inside radius a, potential outside. */
export const rankine = (G, a) => (r) => (r < a ? (G * r) / (2 * Math.PI * a * a) : G / (2 * Math.PI * Math.max(r, 1e-30)));
/** Lamb-Oseen: u_theta and vorticity for a line vortex diffusing from an impulse at time 0. */
export const lambOseen = (G, nu, t) => (r) => (r === 0 ? 0 : (G / (2 * Math.PI * r)) * (1 - Math.exp((-r * r) / (4 * nu * t))));
export const lambOseenOmega = (G, nu, t) => (r) => (G / (4 * Math.PI * nu * t)) * Math.exp((-r * r) / (4 * nu * t));
/** Burgers vortex: steady vorticity under axial strain a, where stretching balances diffusion. */
export const burgersOmega = (G, a, nu) => (r) => ((G * a) / (4 * Math.PI * nu)) * Math.exp((-a * r * r) / (4 * nu));
/** Burgers budget at radius r: stretching plus inflow, then diffusion. They sum to zero for the exact profile. */
export function burgersBudget(profile, a, nu, r, h = 1e-3) {
  const f = profile, d1 = (f(r + h) - f(r - h)) / (2 * h), d2 = (f(r + h) - 2 * f(r) + f(r - h)) / (h * h);
  const strain = a * f(r) + (a * r * d1) / 2, diff = nu * (d2 + d1 / r);
  return { strain, diff, residual: strain + diff };
}
/** Steady Stokes annulus shear: angle moved per unit wall angle, same formula as the reversal study. */
export const stokesShear = (a, b) => (r) => ((a * a) / (b * b - a * a)) * ((b * b) / (r * r) - 1);

/** Largest real growth rate of U = sin y to a perturbation with x wavenumber alpha: Galerkin in y, nu = 1/Re. */
export function kolmogorovGrowth(alpha, Re, modes = 12) {
  const M = 2 * modes + 1, A = Array.from({ length: M }, () => new Float64Array(M)), q = (n) => alpha * alpha + n * n;
  for (let i = 0; i < M; i++) {
    const n = i - modes;
    A[i][i] = -q(n) / Re;
    if (i > 0) A[i][i - 1] = (alpha / 2) * (1 - 1 / q(n - 1));
    if (i < M - 1) A[i][i + 1] = -(alpha / 2) * (1 - 1 / q(n + 1));
  }
  return largestRealEig(A);
}
/** Spectral abscissa of a real matrix by QR iteration, for real and complex pairs. Small matrices only. */
export function largestRealEig(A0, iters = 300) {
  let A = A0.map((r) => Float64Array.from(r));
  const n = A.length;
  for (let it = 0; it < iters; it++) {
    const Q = Array.from({ length: n }, (_, i) => Float64Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    const R = A.map((r) => Float64Array.from(r));
    for (let j = 0; j < n - 1; j++) {
      const a = R[j][j], b = R[j + 1][j], h = Math.hypot(a, b);
      if (!h) continue;
      const c = a / h, s = b / h;
      for (let k = j; k < n; k++) { const t = c * R[j][k] + s * R[j + 1][k]; R[j + 1][k] = -s * R[j][k] + c * R[j + 1][k]; R[j][k] = t; }
      for (let k = 0; k < n; k++) { const t = c * Q[k][j] + s * Q[k][j + 1]; Q[k][j + 1] = -s * Q[k][j] + c * Q[k][j + 1]; Q[k][j] = t; }
    }
    const B = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) for (let k = i ? i - 1 : 0; k < n; k++) { let t = 0; for (let m = i; m < n; m++) t += R[i][m] * Q[m][k]; B[i][k] = t; }
    A = B;
  }
  let best = -Infinity;
  for (let i = 0; i < n; ) {
    if (i < n - 1 && Math.abs(A[i + 1][i]) > 1e-9 * (Math.abs(A[i][i]) + Math.abs(A[i + 1][i + 1]) + 1e-30)) {
      const m = (A[i][i] + A[i + 1][i + 1]) / 2, d = ((A[i][i] - A[i + 1][i + 1]) / 2) ** 2 + A[i][i + 1] * A[i + 1][i];
      best = Math.max(best, m + Math.sqrt(Math.max(0, d)));
      i += 2;
    } else { best = Math.max(best, A[i][i]); i += 1; }
  }
  return best;
}
/** Re at which the growth rate crosses zero for a given alpha, by bisection. */
export function kolmogorovCritical(alpha, lo = 0.5, hi = 40, modes = 12) {
  for (let i = 0; i < 30; i++) {
    const m = 0.5 * (lo + hi);
    if (kolmogorovGrowth(alpha, m, modes) > 0) hi = m;
    else lo = m;
  }
  return 0.5 * (lo + hi);
}
/** Least-squares slope of log E on log k over integer shells k1 to k2. */
export function spectralSlope(E, k1, k2) {
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let k = k1; k <= k2; k++) if (E[k] > 0) { const x = Math.log(k), y = Math.log(E[k]); n++; sx += x; sy += y; sxx += x * x; sxy += x * y; }
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}
/** A check result a test holds to a tolerance, which a planted bad value must fail. */
export const within = (value, ref, tol) => ({ value, ref, tol, ok: Number.isFinite(value) && Math.abs(value - ref) <= tol });

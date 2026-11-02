// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Spherical harmonics, sphere quadrature, test environments and reflection kernels for the SH demo (sh.js).
   Directions are unit vectors with +Y up, as in raw-native's sky.hpp. Radiance is relative (unit "1").
   Real orthonormal SH by the associated-Legendre recurrence, no Condon-Shortley phase (any consistent sign works
   for projection and reconstruction). Kernels enter through Funk-Hecke: a rotationally symmetric kernel k(n . w)
   acts on band l by Lambda_l = 2 pi integral_{-1}^{1} k(mu) P_l(mu) dmu. */
"use strict";

const PI = Math.PI;

/* Equal-area Fibonacci sphere (Gonzalez 2010): n directions, each 4 pi / n steradians. */
const fibonacci = (n, offset = 0.5) => {
  const d = new Float64Array(3 * n), ga = PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + offset)) / n, r = Math.sqrt(Math.max(0, 1 - y * y)), p = ga * i;
    d[3 * i] = r * Math.cos(p); d[3 * i + 1] = y; d[3 * i + 2] = r * Math.sin(p);
  }
  return d;
};

const fact = (k) => { let f = 1; for (let i = 2; i <= k; i++) f *= i; return f; };

/* All (L+1)^2 real SH values at direction (x, y, z), index l*l + l + m. Polar axis is +Y. */
const shBasis = (L, x, y, z, out) => {
  const ct = y, st = Math.sqrt(Math.max(0, 1 - y * y)), phi = Math.atan2(z, x);
  const P = []; for (let l = 0; l <= L; l++) P.push(new Float64Array(l + 1));
  P[0][0] = 1;
  for (let m = 1; m <= L; m++) P[m][m] = P[m - 1][m - 1] * (2 * m - 1) * st;
  for (let m = 0; m < L; m++) P[m + 1][m] = (2 * m + 1) * ct * P[m][m];
  for (let m = 0; m <= L; m++) for (let l = m + 2; l <= L; l++) P[l][m] = ((2 * l - 1) * ct * P[l - 1][m] - (l + m - 1) * P[l - 2][m]) / (l - m);
  for (let l = 0; l <= L; l++) for (let m = 0; m <= l; m++) {
    const K = Math.sqrt(((2 * l + 1) / (4 * PI)) * (fact(l - m) / fact(l + m)));
    if (m === 0) out[l * l + l] = K * P[l][0];
    else {
      out[l * l + l + m] = Math.SQRT2 * K * Math.cos(m * phi) * P[l][m];
      out[l * l + l - m] = Math.SQRT2 * K * Math.sin(m * phi) * P[l][m];
    }
  }
  return out;
};

/* Basis matrix: n x (L+1)^2, row-major. */
const basisMatrix = (L, dirs) => {
  const n = dirs.length / 3, c = (L + 1) * (L + 1), B = new Float64Array(n * c), row = new Float64Array(c);
  for (let i = 0; i < n; i++) { shBasis(L, dirs[3 * i], dirs[3 * i + 1], dirs[3 * i + 2], row); B.set(row, i * c); }
  return { B, n, c };
};

const project = (bm, vals, dOmega, L) => {
  const c = (L + 1) * (L + 1), co = new Float64Array(c);
  for (let i = 0; i < bm.n; i++) for (let k = 0; k < c; k++) co[k] += vals[i] * bm.B[i * bm.c + k] * dOmega;
  return co;
};

/* Evaluate sum_k w_l(k) co[k] Y_k at the rows of bm (w: per-band weight, e.g. Lambda_l). */
const evaluate = (bm, co, L, w) => {
  const out = new Float64Array(bm.n);
  for (let i = 0; i < bm.n; i++) {
    let s = 0;
    for (let l = 0; l <= L; l++) for (let k = l * l; k < (l + 1) * (l + 1); k++) s += (w ? w[l] : 1) * co[k] * bm.B[i * bm.c + k];
    out[i] = s;
  }
  return out;
};

/* Legendre P_l(mu) for l = 0..L. */
const legendre = (L, mu) => { const p = [1, mu]; for (let l = 2; l <= L; l++) p.push(((2 * l - 1) * mu * p[l - 1] - (l - 1) * p[l - 2]) / l); return p.slice(0, L + 1); };

/* Funk-Hecke band weights of kernel k(mu), by composite Simpson with 20000 intervals. */
const bandWeights = (k, L) => {
  const n = 20000, h = 2 / n, w = new Float64Array(L + 1);
  for (let i = 0; i <= n; i++) {
    const mu = -1 + i * h, s = i === 0 || i === n ? 1 : i % 2 ? 4 : 2, p = legendre(L, mu), kv = k(mu);
    for (let l = 0; l <= L; l++) w[l] += s * kv * p[l];
  }
  for (let l = 0; l <= L; l++) w[l] *= (2 * PI * h) / 3;
  return w;
};

/* Ramamoorthi and Hanrahan 2001, eq. 8 (cited from memory; checked here against bandWeights). */
const lambertClosed = (l) => {
  if (l === 0) return PI; if (l === 1) return (2 * PI) / 3; if (l % 2) return 0;
  return ((2 * PI * Math.pow(-1, l / 2 - 1)) / ((l + 2) * (l - 1))) * (fact(l) / (Math.pow(2, l) * fact(l / 2) ** 2));
};

const KERNELS = {
  lambert: (mu) => Math.max(mu, 0),
  phong8: (mu) => (mu > 0 ? ((8 + 1) / (2 * PI)) * Math.pow(mu, 8) : 0),
  phong32: (mu) => (mu > 0 ? ((32 + 1) / (2 * PI)) * Math.pow(mu, 32) : 0),
};

/* Brute-force convolution: out(n_j) = sum_i L_i k(n_j . w_i) dOmega. */
const convolve = (dirs, vals, dOmega, normals, k) => {
  const n = dirs.length / 3, m = normals.length / 3, out = new Float64Array(m);
  for (let j = 0; j < m; j++) {
    const nx = normals[3 * j], ny = normals[3 * j + 1], nz = normals[3 * j + 2];
    let s = 0;
    for (let i = 0; i < n; i++) { const mu = nx * dirs[3 * i] + ny * dirs[3 * i + 1] + nz * dirs[3 * i + 2]; if (mu > 0) s += vals[i] * k(mu); }
    out[j] = s * dOmega;
  }
  return out;
};

/* CIE standard clear sky (ISO 15469 type 12), the Perez form raw-native sky.cpp uses: relative to the zenith. */
const perez = (p, ct, g) => (1 + p[0] * Math.exp(p[1] / Math.max(ct, 0.01))) * (1 + p[2] * Math.exp(p[3] * g) + p[4] * Math.cos(g) ** 2);
const CIE12 = [-1.0, -0.32, 10.0, -3.0, 0.45];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const sunDir = (elevDeg, azDeg) => { const e = (elevDeg * PI) / 180, a = (azDeg * PI) / 180; return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)]; };

/* Environments on the sample directions. Ground below the horizon: albedo 0.25 x horizontal sky illuminance / pi.
   SUN_RATIO: direct normal illuminance of the sun over the sky's horizontal illuminance, 6 (from memory, moderate). */
const SUN_RATIO = 6;
const environment = (name, dirs, dOmega) => {
  const n = dirs.length / 3, v = new Float64Array(n);
  const sky = (i, s) => {
    const y = dirs[3 * i + 1];
    if (name === "overcast") return (1 + 2 * y) / 3;
    const g = Math.acos(Math.min(1, Math.max(-1, dirs[3 * i] * s[0] + y * s[1] + dirs[3 * i + 2] * s[2])));
    return perez(CIE12, y, g) / perez(CIE12, 1, Math.acos(s[1]));
  };
  if (name === "interior") {
    const w = unit([1, 0.15, 0.2]);
    for (let i = 0; i < n; i++) { const mu = dirs[3 * i] * w[0] + dirs[3 * i + 1] * w[1] + dirs[3 * i + 2] * w[2]; v[i] = mu > Math.cos(0.3) ? 20 : 0.05 + 0.03 * Math.max(0, dirs[3 * i + 1]); }
    return { v, light: w };
  }
  const s = name === "golden_hour" ? sunDir(4, 200) : sunDir(70, 30);
  let Eh = 0;
  for (let i = 0; i < n; i++) if (dirs[3 * i + 1] > 0) { v[i] = sky(i, s); Eh += v[i] * dirs[3 * i + 1] * dOmega; }
  for (let i = 0; i < n; i++) if (dirs[3 * i + 1] <= 0) v[i] = (0.25 * Eh) / PI;
  if (name === "clear_sun" || name === "golden_hour") {
    let best = 0, bi = 0;
    for (let i = 0; i < n; i++) { const mu = dirs[3 * i] * s[0] + dirs[3 * i + 1] * s[1] + dirs[3 * i + 2] * s[2]; if (mu > best) { best = mu; bi = i; } }
    v[bi] += (SUN_RATIO * Eh) / dOmega;   /* energy kept in one sample, shape not (as raw-native's bake does) */
  }
  return { v, light: s };
};

module.exports = { fibonacci, shBasis, basisMatrix, project, evaluate, legendre, bandWeights, lambertClosed, KERNELS, convolve, environment, sunDir, unit, PI };

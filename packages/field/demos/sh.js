// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Demo (study 2026-10-31-sdf-sh, H3 and H4): spherical-harmonic band-limiting graded by the field type.
   An environment's radiance on 16,384 equal-area directions is projected to SH bands 0..8. Three converters:
     sh.irradiance(L)  radiance -> Lambertian irradiance at 2,048 normals through bands <= L (Ramamoorthi and
                       Hanrahan 2001); graded against brute-force irradiance (reference) at 1 % of the mean
     sh.radiance(L)    radiance -> (L+1)^2 coefficients, inverse = the band-limited radiance; claims homomorphism,
                       keeps "Lambertian irradiance within 3 % of the mean"
     planted           the same radiance converter claiming isomorphism: the field type must refuse it
   Baselines at matched floats: ambient (1), ambient cube least squares (6), SH9 least squares to the truth (9).
   Controls: the clear sky with sun, its radiance shuffled over the directions; glossy Phong kernels (8, 32).
   node demos/sh.js OUT_DIR */
"use strict";
const fs = require("fs");
const path = require("path");
const F = require("../src/index.js");
const S = require("./sh_math.js");

const N = 16384, M = 2048, LMAX = 8, dO = (4 * Math.PI) / N;
const ENVS = ["overcast", "clear_sky", "clear_sun", "golden_hour", "interior", "clear_sun_shuffled", "clear_sky_shuffled"];
const dirs = S.fibonacci(N), normals = S.fibonacci(M, 0.37);
const bmD = S.basisMatrix(LMAX, dirs), bmN = S.basisMatrix(LMAX, normals);
const W = { lambert: S.bandWeights(S.KERNELS.lambert, LMAX), phong8: S.bandWeights(S.KERNELS.phong8, LMAX), phong32: S.bandWeights(S.KERNELS.phong32, LMAX) };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const rmsRel = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s / a.length) / mean(b); };
const maxRel = (a, b) => { let s = 0; const m = mean(b); for (let i = 0; i < a.length; i++) s = Math.max(s, Math.abs(a[i] - b[i]) / m); return s; };

const shuffle = (v, seed) => { let x = seed >>> 0; const o = Float64Array.from(v); for (let i = o.length - 1; i > 0; i--) { x = (1664525 * x + 1013904223) >>> 0; const j = x % (i + 1); [o[i], o[j]] = [o[j], o[i]]; } return o; };

/* Least squares fit of a small basis (columns from fn(n)) to target values at the normals. */
const lsFit = (fn, k, target) => {
  const A = new Float64Array(k * k), b = new Float64Array(k), rows = [];
  for (let j = 0; j < M; j++) { const r = fn(normals[3 * j], normals[3 * j + 1], normals[3 * j + 2]); rows.push(r); for (let p = 0; p < k; p++) { b[p] += r[p] * target[j]; for (let q = 0; q < k; q++) A[p * k + q] += r[p] * r[q]; } }
  for (let c = 0; c < k; c++) { let piv = c; for (let r = c + 1; r < k; r++) if (Math.abs(A[r * k + c]) > Math.abs(A[piv * k + c])) piv = r;
    for (let q = 0; q < k; q++) [A[c * k + q], A[piv * k + q]] = [A[piv * k + q], A[c * k + q]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < k; r++) if (r !== c) { const f = A[r * k + c] / A[c * k + c]; for (let q = 0; q < k; q++) A[r * k + q] -= f * A[c * k + q]; b[r] -= f * b[c]; } }
  const x = Array.from(b, (v, i) => v / A[i * k + i]);
  return Float64Array.from(rows, (r) => r.reduce((s, v, i) => s + v * x[i], 0));
};
const cube = (x, y, z) => [Math.max(x, 0) ** 2, Math.max(-x, 0) ** 2, Math.max(y, 0) ** 2, Math.max(-y, 0) ** 2, Math.max(z, 0) ** 2, Math.max(-z, 0) ** 2];
const sh9 = (x, y, z) => Array.from(S.shBasis(2, x, y, z, new Float64Array(9)));

const radianceField = (name, v) => F.make({ name, domain: { kind: "sequence", shape: [N], note: "Fibonacci sphere, 4 pi / N sr per value" },
  values: v, unit: "1", sigma: null, prov: { status: "defined", method: "analytic sky (CIE overcast, ISO 15469 type 12) or a planted window, sh_math.js" },
  rep: { kind: "digital", bits: 64, encoding: "float64 relative radiance" } });

const irradianceConv = (L, truth, tolRel) => F.converter({ id: "sh.irradiance.L" + L, claims: "isomorphism", tol: tolRel * mean(truth),
  forward: (f) => ({ values: S.evaluate(bmN, S.project(bmD, f.values, dO, LMAX), L, W.lambert), domain: { kind: "sequence", shape: [M] }, name: "E_L" + L }),
  reference: () => truth });

const radianceConv = (L, truth, claims) => F.converter({ id: "sh.radiance.L" + L + (claims === "isomorphism" ? ".planted" : ""), claims, tol: 0.01,
  forward: (f) => { const co = S.project(bmD, f.values, dO, LMAX).slice(0, (L + 1) ** 2); return { values: co, domain: { kind: "sequence", shape: [co.length] }, name: "SH" + L }; },
  inverse: (out) => { const co = new Float64Array(81); co.set(out.values); return S.evaluate(bmD, co, L); },
  keeps: { name: "Lambertian irradiance within 3 % of the mean", check: (src, out) => {
    const co = new Float64Array(81); co.set(out.values); const e = maxRel(S.evaluate(bmN, co, L, W.lambert), truth);
    return { ok: e <= 0.03, detail: "max irradiance error " + (100 * e).toFixed(2) + " % of the mean" }; } } });

const study = (name) => {
  const env = S.environment(name.replace("_shuffled", ""), dirs, dO), v = name.endsWith("_shuffled") ? shuffle(env.v, 20261031) : env.v;
  const co = S.project(bmD, v, dO, LMAX), truth = {};
  for (const k of Object.keys(S.KERNELS)) truth[k] = S.convolve(dirs, v, dO, normals, S.KERNELS[k]);
  const r = { bands: [], energy_radiance: [], energy_irradiance: [] };
  for (let l = 0; l <= LMAX; l++) {
    let e = 0; for (let k = l * l; k < (l + 1) ** 2; k++) e += co[k] ** 2;
    r.energy_radiance.push(e); r.energy_irradiance.push(W.lambert[l] ** 2 * e);
    const row = { L: l, floats: (l + 1) ** 2, radiance_rms_rel: rmsRel(S.evaluate(bmD, co, l), v) };
    for (const k of Object.keys(S.KERNELS)) { const est = S.evaluate(bmN, co, l, W[k]); row[k + "_rms_rel"] = rmsRel(est, truth[k]); row[k + "_max_rel"] = maxRel(est, truth[k]); if (k === "lambert") row.lambert_negative = est.filter((x) => x < 0).length / M; }
    const src = radianceField(name, v), ver = F.measure(irradianceConv(l, truth.lambert, 0.01), src).verdict;
    row.grade_irradiance_1pct = ver.measured; row.bits_lost_per_value_1pct = ver.bitsPerValue;
    r.bands.push(row);
  }
  const src = radianceField(name, v);
  r.grade_radiance_sh9 = F.measure(radianceConv(2, truth.lambert, "homomorphism"), src).verdict;
  try { F.apply(radianceConv(2, truth.lambert, "isomorphism"), src); r.planted_refused = false; } catch (e) { r.planted_refused = e.name === "ClaimError"; r.planted_message = e.message.slice(0, 160); }
  r.baselines = { ambient_1: { rms: rmsRel(new Float64Array(M).fill(mean(truth.lambert)), truth.lambert) },
    ambient_cube_ls_6: { rms: rmsRel(lsFit(cube, 6, truth.lambert), truth.lambert), max: maxRel(lsFit(cube, 6, truth.lambert), truth.lambert) },
    sh9_ls_9: { rms: rmsRel(lsFit(sh9, 9, truth.lambert), truth.lambert), max: maxRel(lsFit(sh9, 9, truth.lambert), truth.lambert) } };
  const d = S.unit([co[3], co[2], co[1]])  /* Y_11 ~ x, Y_10 ~ y (polar), Y_1-1 ~ z */, Ld = env.light, c = Math.min(1, d[0] * Ld[0] + d[1] * Ld[1] + d[2] * Ld[2]);
  r.l1_direction_vs_light_deg = (Math.acos(c) * 180) / Math.PI;
  r.mean_radiance = { from_L00: co[0] * Math.sqrt(1 / (4 * Math.PI)), true: mean(v) };
  r.coefficients = Array.from(co.slice(0, 9));
  return { r, v, co };
};

/* Equirectangular maps (32 x 64) for the figures: truth, SH-L radiance, true and SH9 irradiance. */
const maps = (name, v, co) => {
  const H = 32, Wd = 64, g = new Float64Array(3 * H * Wd);
  for (let i = 0; i < H; i++) for (let j = 0; j < Wd; j++) { const th = ((i + 0.5) / H) * Math.PI, ph = ((j + 0.5) / Wd) * 2 * Math.PI, k = 3 * (i * Wd + j);
    g[k] = Math.sin(th) * Math.cos(ph); g[k + 1] = Math.cos(th); g[k + 2] = Math.sin(th) * Math.sin(ph); }
  const bg = S.basisMatrix(LMAX, g), out = { H, W: Wd, truth_radiance: Array.from(S.environment(name, g, (4 * Math.PI) / (H * Wd)).v) };
  for (const L of [0, 1, 2, 4, 8]) out["radiance_L" + L] = Array.from(S.evaluate(bg, co, L));
  out.irradiance_true = Array.from(S.convolve(dirs, v, dO, g, S.KERNELS.lambert));
  out.irradiance_sh9 = Array.from(S.evaluate(bg, co, 2, W.lambert));
  return out;
};

const main = () => {
  const outDir = process.argv[2] || path.join(__dirname, "..", "out"), t0 = Date.now();
  const lam = Array.from({ length: LMAX + 1 }, (_, l) => S.lambertClosed(l));
  const res = { N, M, LMAX, known_answer: { lambert_band_weights_max_abs_err: Math.max(...lam.map((x, l) => Math.abs(x - W.lambert[l]))), band_weights: W },
    orthonormality_max_err: orthoCheck(), envs: {} };
  const figs = {};
  for (const e of ENVS) { const { r, v, co } = study(e); res.envs[e] = r; if (e === "clear_sun" || e === "interior") figs[e] = maps(e, v, co); }
  res.seconds = (Date.now() - t0) / 1000;
  fs.writeFileSync(path.join(outDir, "sh.json"), JSON.stringify(res, null, 1));
  fs.writeFileSync(path.join(outDir, "sh_maps.json"), JSON.stringify(figs));
  console.log(JSON.stringify(res, (k, x) => (k === "coefficients" || k === "band_weights" ? undefined : x), 1));
};

/* Known answer: on the quadrature, the Gram matrix of bands <= 8 is the identity to within quadrature error. */
const orthoCheck = () => { let worst = 0; const c = 81;
  for (let p = 0; p < c; p++) for (let q = p; q < c; q++) { let s = 0; for (let i = 0; i < N; i++) s += bmD.B[i * c + p] * bmD.B[i * c + q]; worst = Math.max(worst, Math.abs(s * dO - (p === q ? 1 : 0))); }
  return worst; };

if (require.main === module) main();
module.exports = { study };

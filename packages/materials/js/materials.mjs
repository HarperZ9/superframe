// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: AGPL-3.0-only
//
// materials.mjs: the JavaScript twin of the Python reference (materials/spectral.py, optics.py, drude.py).
// Same grid, same equations, same evaluation order, so the two agree to rounding. The Python stays the
// reference; tests/parity-vectors.json is written by the Python and checked here (tests/materials.test.mjs).
// Pure functions take arrays; load() reads the data files in Node. Standard library only.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const GRID = Array.from({ length: 81 }, (_, i) => 380 + 5 * i);
const DATA = fileURLToPath(new URL('../data/', import.meta.url));

// ---- data -------------------------------------------------------------------------------------------
let LIB = null;
const CSV = new Map();
export function library() { return (LIB ??= JSON.parse(readFileSync(DATA + 'materials.json', 'utf8'))); }
export const allMaterials = () => library().materials;
export function get(id) {
  const r = allMaterials().find(m => m.id === id);
  if (!r) throw new Error(`materials: unknown id "${id}"`);
  return r;
}
export const byClass = cls => allMaterials().filter(m => m.class === cls);

function readCsv(name) {
  if (!CSV.has(name)) {
    const rows = new Map();
    for (const line of readFileSync(DATA + 'cie/' + name, 'utf8').split(/\r?\n/)) {
      const cells = line.split(',');
      if (!cells[0]?.trim()) continue;
      rows.set(Math.trunc(Number(cells[0])), cells.slice(1).map(Number));
    }
    CSV.set(name, rows);
  }
  return CSV.get(name);
}

// ---- spectral ---------------------------------------------------------------------------------------
let CMF = null;
export function cmf() {
  if (!CMF) { const rows = readCsv('CIE_xyz_1931_2deg.csv'); CMF = GRID.map(w => rows.get(w)); }
  return CMF;
}

export function illuminant(name) {
  if (name === 'D65') { const rows = readCsv('CIE_std_illum_D65.csv'); return GRID.map(w => rows.get(w)[0]); }
  if (name === 'A') {
    const c = 1.435e7;                       // nm K, CIE 15:2018; T = 2848 K, 100 at 560 nm
    return GRID.map(w => 100 * (560 / w) ** 5 * (Math.exp(c / (2848 * 560)) - 1) / (Math.exp(c / (2848 * w)) - 1));
  }
  if (name === 'sodium') {                  // Na D2 588.995 nm and D1 589.592 nm, 2:1
    const spd = GRID.map(() => 0);
    for (const [line, weight] of [[588.995, 2.0], [589.592, 1.0]]) {
      const i = Math.floor((line - GRID[0]) / 5), t = (line - GRID[i]) / 5;
      spd[i] += weight * (1 - t) / 5;
      spd[i + 1] += weight * t / 5;
    }
    return spd;
  }
  if (name === 'E') return GRID.map(() => 1.0);
  throw new Error(`materials: unknown illuminant "${name}"`);
}

export function toXyz(spectrum, light) {
  const cm = cmf(), n = GRID.length;
  let norm = 0, x = 0, y = 0, z = 0;
  for (let i = 0; i < n; i++) norm += light[i] * cm[i][1];
  for (let i = 0; i < n; i++) x += spectrum[i] * light[i] * cm[i][0];
  for (let i = 0; i < n; i++) y += spectrum[i] * light[i] * cm[i][1];
  for (let i = 0; i < n; i++) z += spectrum[i] * light[i] * cm[i][2];
  return [x / norm, y / norm, z / norm];
}
export const whiteXyz = light => toXyz(GRID.map(() => 1.0), light);

export const xyzToLinearSrgb = ([x, y, z]) => [
  3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
  -0.9692660 * x + 1.8760108 * y + 0.0415560 * z,
  0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
];
export const encodeSrgb = lin => lin.map(c => { c = Math.min(Math.max(c, 0), 1); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; });

export function xyzToLab(xyz, white) {
  const f = t => (t > (6 / 29) ** 3 ? t ** (1 / 3) : t / (3 * (6 / 29) ** 2) + 4 / 29);
  const [fx, fy, fz] = [0, 1, 2].map(i => f(xyz[i] / white[i]));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function lch([L, a, b]) { const h = (Math.atan2(b, a) * 180) / Math.PI; return [L, Math.hypot(a, b), ((h % 360) + 360) % 360]; }
export const reflectanceToSrgb = (spectrum, lightName = 'D65') => encodeSrgb(xyzToLinearSrgb(toXyz(spectrum, illuminant(lightName))));

// ---- complex helpers (principal branch, as Python's cmath) -------------------------------------------
const C = (re, im = 0) => ({ re, im });
const add = (a, b) => C(a.re + b.re, a.im + b.im);
const sub = (a, b) => C(a.re - b.re, a.im - b.im);
const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const abs2 = a => { const h = Math.hypot(a.re, a.im); return h * h; };
export function csqrt(a) {
  if (a.re === 0 && a.im === 0) return C(0, a.im);
  const m = Math.hypot(a.re, a.im);
  if (a.re >= 0) { const t = Math.sqrt((m + a.re) / 2); return C(t, a.im / (2 * t)); }
  const t = Math.sqrt((m - a.re) / 2);
  return C(Math.abs(a.im) / (2 * t), a.im < 0 || Object.is(a.im, -0) ? -t : t);
}

// ---- optics -----------------------------------------------------------------------------------------
/** Unpolarised reflectance from real index nOut into complex N = n + ik at incidence cosine cosI. */
export function fresnel(n, k, cosI, nOut = 1.0) {
  cosI = Math.min(Math.max(cosI, 0), 1);
  const eta = div(C(n, k), C(nOut)), eta2 = mul(eta, eta);
  const s2 = 1.0 - cosI * cosI;
  const w = csqrt(sub(eta2, C(s2)));
  const ci = C(cosI);
  const rs = div(sub(ci, w), add(ci, w));
  const e2c = mul(eta2, ci);
  const rp = div(sub(e2c, w), add(e2c, w));
  return 0.5 * (abs2(rs) + abs2(rp));
}
export const normalReflectance = (n, k) => ((n - 1) ** 2 + k * k) / ((n + 1) ** 2 + k * k);
export function ggxD(cosH, alpha) { const a2 = alpha * alpha, d = cosH * cosH * (a2 - 1) + 1; return a2 / (Math.PI * d * d); }
export function smithG1(cosX, alpha) { const a2 = alpha * alpha; return (2 * cosX) / (cosX + Math.sqrt(a2 + (1 - a2) * cosX * cosX)); }

export function nk(material) {
  const opt = material.optics ?? {};
  const n = opt.n?.value ?? null, k = opt.k?.value ?? null;
  if (n == null) return [null, null];
  return [n, k ?? GRID.map(() => 0.0)];
}
export const absorptionCoefficient = k => k.map((kk, i) => (4 * Math.PI * kk) / (GRID[i] * 1e-9));

export function dipoleRd(muA, muSp, nRel) {
  if (muA + muSp <= 0) return 0.0;
  const a = muSp / (muA + muSp);
  const fdr = -1.440 / nRel ** 2 + 0.710 / nRel + 0.668 + 0.0636 * nRel;
  const A = (1 + fdr) / (1 - fdr), s = Math.sqrt(3 * (1 - a));
  return 0.5 * a * (1 + Math.exp((-4 / 3) * A * s)) * Math.exp(-s);
}

export function bodyAlbedo(material, thicknessM = null) {
  const opt = material.optics ?? {};
  const [n, k] = nk(material);
  if (n == null) return null;
  if (opt.conductor) return GRID.map(() => 0.0);
  const sc = opt.scattering;
  if (sc && sc.mu_a_per_mm && sc.mu_s_prime_per_mm) return sc.mu_a_per_mm.value.map((a, i) => dipoleRd(a, sc.mu_s_prime_per_mm.value[i], n[i]));
  const d = thicknessM ?? material.render?.layer_m ?? 0.01;
  return absorptionCoefficient(k).map(a => Math.exp(-2 * a * d));
}

/** Outgoing spectral radiance per unit irradiance for a directional light in the view plane (optics.shade). */
export function shade(material, light, thetaViewDeg, { roughness = 0.25, thetaLightDeg = null, thicknessM = null } = {}) {
  const [n, k] = nk(material);
  if (n == null) throw new Error(`${material.id}: no spectral n, cannot shade`);
  const tv = (thetaViewDeg * Math.PI) / 180, tl = ((thetaLightDeg ?? thetaViewDeg) * Math.PI) / 180;
  const cv = Math.max(Math.cos(tv), 1e-4), cl = Math.max(Math.cos(tl), 1e-4);
  const vx = Math.sin(tv), vz = Math.cos(tv), lx = -Math.sin(tl), lz = Math.cos(tl);
  const hx = vx + lx, hz = vz + lz, hn = Math.hypot(hx, hz);
  const cosH = hz / hn, cosD = (vx * hx + vz * hz) / hn;
  const alpha = Math.max(roughness * roughness, 1e-3);
  const specScalar = (ggxD(cosH, alpha) * smithG1(cv, alpha) * smithG1(cl, alpha)) / (4 * cv * cl);
  const body = bodyAlbedo(material, thicknessM);
  return GRID.map((_, i) => {
    const F = fresnel(n[i], k[i], cosD);
    let f = specScalar * F;
    if (body != null) f += ((1 - fresnel(n[i], k[i], cl)) * (1 - fresnel(n[i], k[i], cv)) * body[i]) / Math.PI;
    return light[i] * f * cl;
  });
}

// ---- Drude and Drude-Lorentz ------------------------------------------------------------------------
export const CONST = { E: 1.602176634e-19, ME: 9.1093837015e-31, EPS0: 8.8541878128e-12, NA: 6.02214076e23, C: 299792458.0, HC_EV_NM: 1239.841984 };
const { E, ME, EPS0, NA } = CONST;
export const electronDensity = (rho, molar, valence) => (valence * rho * NA) / molar;
export const plasmaFrequency = ne => Math.sqrt((ne * E * E) / (EPS0 * ME));
export const tauFromSigma = (sigma, ne) => (sigma * ME) / (ne * E * E);
export function drudePermittivity(wavelengthNm, sigma, ne) {
  const w = (2 * Math.PI * CONST.C) / (wavelengthNm * 1e-9), wp = plasmaFrequency(ne), tau = tauFromSigma(sigma, ne);
  return sub(C(1), div(C(wp * wp), C(w * w, w / tau)));
}
const toNk = N => (N.im < 0 ? [-N.re, -N.im] : [N.re, N.im]);
export const drudeNk = (wavelengthNm, sigma, ne) => toNk(csqrt(drudePermittivity(wavelengthNm, sigma, ne)));
export function hagenRubensK(wavelengthNm, sigma) { const w = (2 * Math.PI * CONST.C) / (wavelengthNm * 1e-9); return Math.sqrt(sigma / (2 * EPS0 * w)); }
export function lorentzDrudeEps(wavelengthNm, p) {
  const e = CONST.HC_EV_NM / wavelengthNm;
  let eps = sub(C(p.eps_inf), div(C(p.plasma_eV ** 2), C(e * e, p.gamma_eV * e)));
  for (const o of p.oscillators ?? []) eps = add(eps, div(C(o.strength_eV2), C(o.centre_eV ** 2 - e * e, -o.width_eV * e)));
  return eps;
}
export const lorentzDrudeNk = (wavelengthNm, p) => toNk(csqrt(lorentzDrudeEps(wavelengthNm, p)));

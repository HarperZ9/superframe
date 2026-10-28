// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// refraction.mjs: refraction and dispersion from measured material data.
//   MATERIALS                        Sellmeier coefficients (lambda in um) with their sources and reference medium
//   index(material, nm, rel = 'air') -> refractive index; water (measured against vacuum) is divided by air's index
//   snell(n1, n2, cosI)              -> cosT of the refracted ray, or null for total internal reflection
//   fresnel(n1, n2, cosI)            -> { rs, rp, ts, tp } power reflectance and transmittance
//   sphereRay(n, k, b)               -> { anti, w: { s, p } }: a ray with impact parameter b through a sphere with k
//                                       internal reflections (k = -1: reflected off the outside); anti is the angle from
//                                       the antisolar point in radians; w is the Fresnel power per polarisation
//   descartes(n, k)                  -> the geometric bow's angle from the antisolar point, radians
//   bowHistogram(n, { rays, ks, bin, fresnel }) -> per-degree light per unit solid angle, from rays sampled uniformly
//                                       over the drop's cross-section
//   lensFocus(nOf, { R, t, h })      -> effective focal length of a symmetric biconvex lens traced exactly
// Tests: tests/refraction.test.mjs; study: docs/prereg/REFRACTION-PREREG.md.

export const MATERIALS = {
  water: { B: [5.684027565e-1, 1.726177391e-1, 2.086189578e-2, 1.130748688e-1], C: [5.101829712e-3, 1.821153936e-2, 2.620722293e-2, 10.69792721], ref: 'vacuum', range: [0.182, 1.129], source: 'Daimon and Masumura 2007, 20 C' },
  'n-bk7': { B: [1.03961212, 0.231792344, 1.01046945], C: [0.00600069867, 0.0200179144, 103.560653], ref: 'air', range: [0.3, 2.5], source: 'Schott catalogue' },
  silica: { B: [0.6961663, 0.4079426, 0.8974794], C: [0.0684043 ** 2, 0.1162414 ** 2, 9.896161 ** 2], ref: 'air', range: [0.21, 3.71], source: 'Malitson 1965' },
};

// Ciddor 1996 dispersion of standard air: n - 1 = 0.05792105 / (238.0185 - s^2) + 0.00167917 / (57.362 - s^2), s in 1/um
export const airIndex = nm => { const s2 = (1000 / nm) ** 2; return 1 + 0.05792105 / (238.0185 - s2) + 0.00167917 / (57.362 - s2); };

export function index(material, nm, rel = 'air') {
  const m = MATERIALS[material];
  if (!m) throw new Error(`refraction: unknown material "${material}"`);
  const l2 = (nm / 1000) ** 2, n = Math.sqrt(1 + m.B.reduce((a, b, i) => a + b * l2 / (l2 - m.C[i]), 0));
  return m.ref === 'vacuum' && rel === 'air' ? n / airIndex(nm) : n;
}

export function snell(n1, n2, cosI) {
  const eta = n1 / n2, s2 = eta * eta * (1 - cosI * cosI);
  return s2 > 1 ? null : Math.sqrt(1 - s2);
}

export function fresnel(n1, n2, cosI) {
  const cosT = snell(n1, n2, cosI);
  if (cosT === null) return { rs: 1, rp: 1, ts: 0, tp: 0 };
  const rs = ((n1 * cosI - n2 * cosT) / (n1 * cosI + n2 * cosT)) ** 2, rp = ((n2 * cosI - n1 * cosT) / (n2 * cosI + n1 * cosT)) ** 2;
  return { rs, rp, ts: 1 - rs, tp: 1 - rp };
}

// fold a deviation (radians, any multiple of turns) to the angle from the antisolar point
const antisolar = D => { let t = D % (2 * Math.PI); if (t < 0) t += 2 * Math.PI; if (t > Math.PI) t = 2 * Math.PI - t; return Math.PI - t; };

export function sphereRay(n, k, b) {
  const i = Math.asin(b), cosI = Math.cos(i);
  if (k === -1) { const f = fresnel(1, n, cosI); return { anti: antisolar(Math.PI - 2 * i), w: { s: f.rs, p: f.rp } }; }
  const r = Math.asin(b / n), cosR = Math.cos(r), fin = fresnel(1, n, cosI), fint = fresnel(n, 1, cosR);
  const D = 2 * (i - r) + k * (Math.PI - 2 * r);
  return { anti: antisolar(D), w: { s: fin.ts * fint.rs ** k * fint.ts, p: fin.tp * fint.rp ** k * fint.tp } };
}

export function descartes(n, k) {
  const i = Math.acos(Math.sqrt((n * n - 1) / (k * (k + 2)))), r = Math.asin(Math.sin(i) / n);
  return antisolar(2 * (i - r) + k * (Math.PI - 2 * r));
}

// rays sampled uniformly over the drop's disk (b = sqrt(u) with stratified u); light per unit solid angle per bin
export function bowHistogram(n, { rays = 2e6, ks = [-1, 0, 1, 2, 3], bin = 0.02, fresnel: useFresnel = true, maxDeg = 180 } = {}) {
  const nb = Math.round(maxDeg / bin), h = new Float64Array(nb);
  for (let j = 0; j < rays; j++) {
    const b = Math.sqrt((j + 0.5) / rays);
    for (const k of ks) {
      const { anti, w } = sphereRay(n, k, b), deg = anti * 180 / Math.PI, at = Math.floor(deg / bin);
      if (at >= 0 && at < nb) h[at] += useFresnel ? 0.5 * (w.s + w.p) : 1;
    }
  }
  for (let a = 0; a < nb; a++) h[a] /= Math.max(1e-12, Math.sin(((a + 0.5) * bin) * Math.PI / 180));
  return { bin, h };
}

// a symmetric biconvex lens (radii R, -R, centre thickness t, all mm) traced exactly for a ray at height h parallel to
// the axis; returns the effective focal length h / tan(exit slope)
export function lensFocus(n, { R, t, h = 0.05 }) {
  // first surface: centre at z = R
  let y = h, z = R - Math.sqrt(R * R - h * h), dy = 0, dz = 1;
  const refract = (nx, ny, n1, n2) => {     // surface normal (nx, ny) points back toward the incoming ray
    const cosI = -(dz * nx + dy * ny), eta = n1 / n2, cosT = snell(n1, n2, cosI);
    const tz = eta * dz + (eta * cosI - cosT) * nx, ty = eta * dy + (eta * cosI - cosT) * ny, l = Math.hypot(tz, ty);
    dz = tz / l; dy = ty / l;
  };
  { const cz = R, nx = (z - cz) / R, ny = y / R; refract(nx, ny, 1, n); }
  // second surface: centre at z = t - R, sphere of radius R; intersect the ray with it
  const cz2 = t - R, oz = z - cz2, b = oz * dz + y * dy, c = oz * oz + y * y - R * R, s = -b + Math.sqrt(b * b - c);
  z += s * dz; y += s * dy;
  { const nx = -(z - cz2) / R, ny = -y / R; refract(nx, ny, n, 1); }
  return h / -(dy / dz);
}

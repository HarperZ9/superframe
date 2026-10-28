// caustic.mjs: light that a clear sphere bends onto the ground (paths L S S D in Heckbert's notation). Photons leave
// the key's centre toward each glass sphere's cross-section, refract in and out with exact Fresnel transmittance,
// and land on the ground, where they are counted into a grid. Irradiance per cell is flux over area. The direct key
// is blocked by glass in visibility(), so this map is where that light goes: flux is conserved, not invented.
import { sub, add, mul, dot, norm, cross, hitSphere, hitGround, fresnelDielectric, refract } from './scene.mjs';
import { rngFrom } from '../seed.mjs';

// one photon through a glass sphere: returns { o, d, w } leaving the sphere, or null (missed, or trapped by TIR)
function throughSphere(o, d, sp) {
  const t = hitSphere(o, d, sp.c, sp.r); if (t === Infinity) return null;
  const p = add(o, mul(d, t)), n = norm(sub(p, sp.c)), eta = 1 / sp.ior;
  const Fi = fresnelDielectric(-dot(d, n), eta), d1 = refract(d, n, eta); if (!d1) return null;
  const t2 = hitSphere(add(p, mul(d1, 1e-5)), d1, sp.c, sp.r), q = add(p, mul(d1, t2 + 1e-5)), m = mul(norm(sub(q, sp.c)), -1);
  const Fo = fresnelDielectric(-dot(d1, m), sp.ior), d2 = refract(d1, m, sp.ior); if (!d2) return null;
  return { o: q, d: d2, w: (1 - Fi) * (1 - Fo) };
}

export function causticMap(scene, { n = 200000, res = 256, seed = 'value/caustic' } = {}) {
  const glass = scene.spheres.filter(s => s.mat === 'glass'), L = scene.light;
  if (!glass.length || !(L.Le > 0)) return null;
  const ext = Math.max(...glass.map(s => Math.hypot(s.c[0], s.c[2]) + 4 * s.r)) + 1, cell = 2 * ext / res, E = new Float64Array(res * res), rng = rngFrom(seed);
  for (const sp of glass) {
    const toC = sub(sp.c, L.p), dist = Math.hypot(...toC), w = mul(toC, 1 / dist);
    const u = norm(cross(Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], w)), v = cross(w, u);
    const Eperp = Math.PI * L.Le * L.r * L.r / (dist * dist), phi = Eperp * Math.PI * sp.r * sp.r / n;
    for (let i = 0; i < n; i++) {
      const rr = sp.r * Math.sqrt(rng()), a = 2 * Math.PI * rng(), target = add(sp.c, add(mul(u, rr * Math.cos(a)), mul(v, rr * Math.sin(a))));
      const out = throughSphere(L.p, norm(sub(target, L.p)), sp); if (!out) continue;
      if (scene.spheres.some(s => s !== sp && hitSphere(out.o, out.d, s.c, s.r) < Infinity)) continue;  // lands on another object: not mapped
      const tg = hitGround(out.o, out.d); if (tg === Infinity) continue;
      const x = out.o[0] + out.d[0] * tg, z = out.o[2] + out.d[2] * tg, ix = Math.floor((x + ext) / cell), iz = Math.floor((z + ext) / cell);
      if (ix >= 0 && iz >= 0 && ix < res && iz < res) E[iz * res + ix] += phi * out.w;
    }
  }
  const S = blur3(E, res); for (let i = 0; i < S.length; i++) S[i] /= cell * cell;
  return { res, ext, cell, E: S, method: `photons from the key centre, ${n} per glass sphere, exact Fresnel in and out, 3 x 3 box filter on a ${res} grid` };
}
function blur3(E, res) {
  const O = new Float64Array(E.length);
  for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) {
    let s = 0, k = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = x + i, Z = z + j; if (X >= 0 && Z >= 0 && X < res && Z < res) { s += E[Z * res + X]; k++; } }
    O[z * res + x] = s / k;
  }
  return O;
}
// bilinear caustic irradiance at a ground point
export function causticAt(map, x, z) {
  if (!map) return 0;
  const fx = (x + map.ext) / map.cell - 0.5, fz = (z + map.ext) / map.cell - 0.5, ix = Math.floor(fx), iz = Math.floor(fz), a = fx - ix, b = fz - iz, R = map.res;
  const g = (i, j) => (i >= 0 && j >= 0 && i < R && j < R ? map.E[j * R + i] : 0);
  return (g(ix, iz) * (1 - a) + g(ix + 1, iz) * a) * (1 - b) + (g(ix, iz + 1) * (1 - a) + g(ix + 1, iz + 1) * a) * b;
}
// total flux in the map against the flux the glass intercepts times its mean transmittance (a conservation check)
export function causticFlux(map) { let s = 0; for (const v of map.E) s += v; return s * map.cell * map.cell; }

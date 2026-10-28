// trace.mjs: a small ray tracer that returns each pixel's radiance in two parts, split by the first interaction
// after the light. Diffuse-origin (L D S* E): the key or the surround lighting a matte surface, seen directly or
// through glass or in a coat reflection. Specular-origin (L S ... E): the key seen in a mirror or a glossy lobe, a
// caustic, or a source seen directly. The split is the planted answer the value-budget check is graded against.
// Materials: 'white' (Lambert under a dielectric coat, F0 from n = 1.5, GGX lobe) and 'glass' (smooth, n = sp.ior).
import { add, sub, mul, dot, norm, reflect, nearest, fresnelDielectric, refract, visibility, keyIrradiance, groundRadiance, cameraRay } from './scene.mjs';
import { causticAt } from './caustic.mjs';

const Z = () => ({ d: 0, s: 0 });
const MAXD = 6;

// GGX (Trowbridge-Reitz) specular from the key, evaluated toward the light's centre with the roughness widened by
// the light's angular radius (a = alpha + r / 2d, after Karis 2013). No extra normalisation: with the centre point,
// the widened lobe already spreads the light's energy, and as alpha goes to 0 the peak tends to the mirror value
// F x L_e (checked in tests/value.test.mjs). An earlier draft also multiplied by (alpha / a)^2, which belongs to
// Karis's closest-point variant; it cut the peak about 17 times and was removed on 2026-10-28 (see README).
export function ggxKey(scene, p, n, v, alpha, ior, E) {
  const L = scene.light, ld = sub(L.p, p), dist = Math.hypot(...ld), l = mul(ld, 1 / dist), h = norm(add(l, v));
  const nl = dot(n, l), nv = dot(n, v), nh = dot(n, h); if (nl <= 0 || nv <= 0) return 0;
  const a = Math.min(1, alpha + L.r / (2 * dist)), a2 = a * a;
  const D = a2 / (Math.PI * (nh * nh * (a2 - 1) + 1) ** 2);
  const G1 = c => 2 * c / (c + Math.sqrt(a2 + (1 - a2) * c * c)), F = fresnelDielectric(dot(v, h), 1 / ior);
  return D * G1(nl) * G1(nv) * F / (4 * nl * nv) * E;   // E already carries the cosine
}

// irradiance from the surround: sky above, ground radiance below (by the normal's tilt), occluded by spheres by
// their form factor (cos x (r / d)^2), the occluded part seeing half the surround radiance (an approximation)
function ambient(scene, p, n, self) {
  const Lg = groundRadiance(scene), up = n[1], open = self ? (1 + up) / 2 * scene.env + (1 - up) / 2 * Lg : scene.env;
  let occ = 0;
  for (const sp of scene.spheres) { if (sp === self) continue; const d = sub(sp.c, p), d2 = dot(d, d), c = dot(n, d) / Math.sqrt(d2); if (c > 0) occ += c * sp.r * sp.r / d2; }
  occ = Math.min(1, occ);
  return Math.PI * (open * (1 - occ) + 0.5 * scene.env * occ);
}

function shadeGround(scene, p, n) {
  const E = keyIrradiance(scene, p, n) * visibility(scene, p), rho = scene.ground.rho;
  return { d: rho / Math.PI * (E + ambient(scene, p, n, null)), s: rho / Math.PI * causticAt(scene.caustic, p[0], p[2]) };
}

function shadeWhite(scene, sp, p, n, v, depth) {
  const F = fresnelDielectric(Math.max(1e-4, dot(n, v)), 1 / sp.ior), E = keyIrradiance(scene, p, n) * visibility(scene, p);
  const out = { d: (1 - F) * sp.rho / Math.PI * (E + ambient(scene, p, n, sp)), s: ggxKey(scene, p, n, v, sp.alpha, sp.ior, E) };
  if (depth < MAXD) { const r = trace(scene, add(p, mul(n, 1e-5)), reflect(mul(v, -1), n), depth + 1, { light: false }); out.d += F * r.d; out.s += F * r.s; }
  return out;
}

function shadeGlass(scene, sp, p, d, depth) {
  let n = norm(sub(p, sp.c)), eta = 1 / sp.ior;
  if (dot(d, n) > 0) { n = mul(n, -1); eta = sp.ior; }                 // leaving the glass
  const F = fresnelDielectric(-dot(d, n), eta), out = Z();
  if (depth >= MAXD) return out;
  const r = trace(scene, add(p, mul(n, 1e-5)), reflect(d, n), depth + 1); out.d += F * r.d; out.s += F * r.s;
  const t = refract(d, n, eta);
  if (t && F < 1) { const q = trace(scene, add(p, mul(n, -1e-5)), t, depth + 1); out.d += (1 - F) * q.d; out.s += (1 - F) * q.s; }
  return out;
}

// radiance along a ray, as { d: diffuse-origin, s: specular-origin }; scalar (the white scene is neutral)
export function trace(scene, o, d, depth = 0, { light = true } = {}) {
  const h = nearest(scene, o, d, { light });
  if (h.kind === 'none') return { d: 0, s: scene.env };                  // a source seen directly
  if (h.kind === 'light') return { d: 0, s: scene.light.Le };
  const p = add(o, mul(d, h.t));
  if (h.kind === 'ground') return shadeGround(scene, p, [0, 1, 0]);
  const n = norm(sub(p, h.s.c));
  return h.s.mat === 'glass' ? shadeGlass(scene, h.s, p, d, depth) : shadeWhite(scene, h.s, p, n, mul(d, -1), depth);
}

// render: w x h pixels, ss x ss samples each. Returns grey radiance as RGB with the diffuse part alongside; an
// optional tint is normalised to luminance 1, so it colours the frame without moving any luminance.
export function render(scene, { w = 320, h = 200, ss = 2 } = {}) {
  const n = w * h, rgb = new Float64Array(3 * n), dif = new Float64Array(3 * n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let D = 0, S = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) { const ray = cameraRay(scene.camera, w, h, x + (i + 0.5) / ss, y + (j + 0.5) / ss), r = trace(scene, ray.o, ray.d); D += r.d; S += r.s; }
    D /= ss * ss; S /= ss * ss;
    const k = 3 * (y * w + x), t0 = scene.tint ?? [1, 1, 1], tl = 0.2126729 * t0[0] + 0.7151522 * t0[1] + 0.072175 * t0[2], tint = t0.map(v => v / tl);
    for (let c = 0; c < 3; c++) { rgb[k + c] = (D + S) * tint[c]; dif[k + c] = D * tint[c]; }
  }
  return { w, h, rgb, dif };
}


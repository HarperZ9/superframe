// scene.mjs: the geometry the value budget is rendered on. A ground plane (y = 0), spheres, one spherical key light,
// a uniform surrounding radiance, a pinhole camera. Ray-sphere and ray-plane hits, exact dielectric Fresnel, the
// light's irradiance (pi L_e sin^2 of its angular radius, times the cosine) and the diffuse ceiling the tone curve
// uses. Distances are in arbitrary units; radiance in arbitrary linear units, the same in every channel.

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = a => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const reflect = (d, n) => sub(d, mul(n, 2 * dot(d, n)));
const EPS = 1e-6;

// nearest positive hit of a ray with a sphere; t only
export function hitSphere(o, d, c, r) {
  const oc = sub(o, c), b = dot(oc, d), q = dot(oc, oc) - r * r, disc = b * b - q;
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc), t0 = -b - s, t1 = -b + s;
  return t0 > EPS ? t0 : t1 > EPS ? t1 : Infinity;
}
export const hitGround = (o, d) => (d[1] < -1e-12 && o[1] > 0 ? -o[1] / d[1] : Infinity);

// nearest object along a ray: { t, kind: 'ground' | 'sphere' | 'light' | 'none', s }
export function nearest(scene, o, d, { light = true } = {}) {
  let t = hitGround(o, d), kind = t < Infinity ? 'ground' : 'none', s = null;
  for (const sp of scene.spheres) { const u = hitSphere(o, d, sp.c, sp.r); if (u < t) { t = u; kind = 'sphere'; s = sp; } }
  if (light && scene.light.Le > 0) { const u = hitSphere(o, d, scene.light.p, scene.light.r); if (u < t) { t = u; kind = 'light'; s = null; } }
  return { t, kind, s };
}

// unpolarised Fresnel reflectance of a dielectric interface; cosi > 0, eta = n1 / n2; 1 on total internal reflection
export function fresnelDielectric(cosi, eta) {
  const sin2t = eta * eta * (1 - cosi * cosi);
  if (sin2t >= 1) return 1;
  const cost = Math.sqrt(1 - sin2t), rs = (eta * cosi - cost) / (eta * cosi + cost), rp = (cosi - eta * cost) / (cosi + eta * cost);
  return (rs * rs + rp * rp) / 2;
}
export function refract(d, n, eta) {
  const ci = -dot(d, n), s2 = eta * eta * (1 - ci * ci);
  if (s2 >= 1) return null;
  return norm(add(mul(d, eta), mul(n, eta * ci - Math.sqrt(1 - s2))));
}

// light sample points: k stratified points on the disc of the light that faces p (fixed pattern, no noise between runs)
const DISC = k => Array.from({ length: k }, (_, i) => { const r = Math.sqrt((i + 0.5) / k), a = i * 2.399963229728653; return [r * Math.cos(a), r * Math.sin(a)]; });
const DISCS = new Map();
export function lightPoints(scene, p) {
  const L = scene.light, k = scene.shadowSamples ?? 8, w = norm(sub(L.p, p)), u = norm(cross(Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], w)), v = cross(w, u);
  if (!DISCS.has(k)) DISCS.set(k, DISC(k));
  return DISCS.get(k).map(([a, b]) => add(L.p, add(mul(u, a * L.r), mul(v, b * L.r))));
}
// fraction of the light visible from p; every sphere blocks the direct path (light bent by glass is the caustic map)
export function visibility(scene, p) {
  const pts = lightPoints(scene, p); let seen = 0;
  for (const q of pts) {
    const d = sub(q, p), len = Math.hypot(...d), u = mul(d, 1 / len);
    if (!scene.spheres.some(sp => hitSphere(p, u, sp.c, sp.r) < len)) seen++;
  }
  return seen / pts.length;
}
// irradiance from the key at p with normal n, unshadowed: pi L_e (r / d)^2 cos (sphere light fully above the horizon)
export function keyIrradiance(scene, p, n) {
  const L = scene.light, d = sub(L.p, p), d2 = dot(d, d), c = dot(n, d) / Math.sqrt(d2);
  return c > 0 ? Math.PI * L.Le * Math.min(1, L.r * L.r / d2) * c : 0;
}
// largest key irradiance any diffuse surface can receive: at the matte point nearest the light (glass has no diffuse)
export function keyMax(scene) {
  const L = scene.light; let dmin = L.p[1];
  for (const s of scene.spheres) if (s.mat !== 'glass') dmin = Math.min(dmin, Math.hypot(...sub(L.p, s.c)) - s.r);
  return Math.PI * L.Le * Math.min(1, L.r * L.r / (dmin * dmin));
}
// mean radiance of the open ground (unshadowed key at the origin plus the surround), used for upward bounce
export const groundRadiance = scene => scene.ground.rho * (keyIrradiance(scene, [0, 0, 0], [0, 1, 0]) + Math.PI * scene.env) / Math.PI;
// diffuse ceiling: (largest key irradiance + pi x largest surrounding radiance) / pi; the caustic map is excluded
export const diffuseCeiling = scene => (keyMax(scene) + Math.PI * Math.max(scene.env, groundRadiance(scene))) / Math.PI;

export function cameraRay(cam, w, h, px, py) {
  const f = norm(sub(cam.at, cam.eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), t = Math.tan(cam.fov * Math.PI / 360);
  const x = (2 * px / w - 1) * t, y = (1 - 2 * py / h) * t * h / w;
  return { o: cam.eye, d: norm(add(f, add(mul(r, x), mul(u, y)))) };
}

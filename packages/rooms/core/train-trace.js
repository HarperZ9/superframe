// SPDX-License-Identifier: FSL-1.1-MIT
// Sequential ray trace of a prescription in double precision: the CPU reference for the shader's flat train loop.
// Surfaces use the fields of surf() in train.js. Light starts along +z. Mirrors reflect, ty 2 is a stop, ty 3 ends.
const conicHit = (s, p, d) => {
  if (!s.R) return Math.abs(d[2]) < 1e-14 ? null : -p[2] / d[2];
  const c = 1 / s.R,
    e = 1 + s.k;
  const A = c * (d[0] * d[0] + d[1] * d[1] + e * d[2] * d[2]);
  const B = c * (p[0] * d[0] + p[1] * d[1] + e * p[2] * d[2]) - d[2];
  const C = c * (p[0] * p[0] + p[1] * p[1] + e * p[2] * p[2]) - 2 * p[2];
  if (Math.abs(A) < 1e-14) return -C / (2 * B);
  const D = B * B - A * C;
  if (D < 0) return null;
  const q = Math.sqrt(D);
  // Two roots can land on two sheets of a hyperboloid. Take the nearest forward hit on the sheet with the vertex.
  const onSag = (t) => e * c * (p[2] + t * d[2]) < 1;
  const roots = [(-B - q) / A, (-B + q) / A].filter((t) => t > 1e-12 && onSag(t)).sort((u, v) => u - v);
  return roots.length ? roots[0] : null;
};
function toLocal(s, p, d) {
  const c = Math.cos(s.tilt),
    n = Math.sin(s.tilt),
    y = p[1] - s.y,
    z = p[2] - s.z;
  return {
    p: [p[0], c * y + n * z, -n * y + c * z],
    d: [d[0], c * d[1] + n * d[2], -n * d[1] + c * d[2]],
  };
}
function toWorld(s, p, d) {
  const c = Math.cos(s.tilt),
    n = Math.sin(s.tilt);
  return {
    p: [p[0], c * p[1] - n * p[2] + s.y, n * p[1] + c * p[2] + s.z],
    d: [d[0], c * d[1] - n * d[2], n * d[1] + c * d[2]],
  };
}
function bend(s, d, N, n) {
  const dn = d[0] * N[0] + d[1] * N[1] + d[2] * N[2];
  if (s.ty === 1) return { d: [d[0] - 2 * dn * N[0], d[1] - 2 * dn * N[1], d[2] - 2 * dn * N[2]], n };
  const f = dn > 0 ? -1 : 1,
    F = N.map((v) => v * f),
    eta = n / s.n,
    cs = Math.abs(dn),
    k = 1 - eta * eta * (1 - cs * cs);
  if (k < 0) return null;
  const a = eta * cs - Math.sqrt(k);
  return { d: [eta * d[0] + a * F[0], eta * d[1] + a * F[1], eta * d[2] + a * F[2]], n: s.n };
}
/** Trace one ray. noAperture ignores clear apertures, for paraxial readings. */
export function traceTrain(surfaces, ray, n0 = 1, noAperture = false) {
  let P = ray.p,
    D = ray.d,
    n = n0;
  for (const s of surfaces) {
    const l = toLocal(s, P, D);
    const t = conicHit(s, l.p, l.d);
    if (t === null) return { ok: false, p: P, d: D };
    const h = [l.p[0] + t * l.d[0], l.p[1] + t * l.d[1], l.p[2] + t * l.d[2]];
    const r = Math.hypot(h[0], h[1]);
    if (!noAperture && (r > s.ap || r < s.hole)) return { ok: false, p: P, d: D };
    if (s.ty === 3) {
      const w = toWorld(s, h, l.d);
      return { ok: true, p: w.p, d: w.d, local: h, n };
    }
    if (s.ty === 2) {
      const w = toWorld(s, h, l.d);
      P = w.p;
      continue;
    }
    const c = s.R ? 1 / s.R : 0,
      N0 = [c * h[0], c * h[1], (1 + s.k) * c * h[2] - 1],
      L = Math.hypot(...N0);
    const b = bend(
      s,
      l.d,
      N0.map((v) => v / L),
      n
    );
    if (!b) return { ok: false, p: P, d: D };
    n = b.n;
    const w = toWorld(s, h, b.d);
    P = w.p;
    D = w.d;
  }
  return { ok: true, p: P, d: D, n };
}
const pupilOf = (p) => p.pupil || p.s[0].ap;
const startZ = (s) => Math.min(...s.map((q) => q.z)) - 1;

/** Focal length from a nearly paraxial ray; a grazing design uses its marginal ray, as the page reads it. */
export function trainEFL(preset) {
  const p = preset.make();
  const marginal = !!preset.marginal;
  const h = (marginal ? 0.985 : 0.02) * pupilOf(p);
  const r = traceTrain(p.s, { p: [0, h, startZ(p.s)], d: [0, 0, 1] }, p.n0 || 1, !marginal);
  if (!r.ok) return NaN;
  const q = p.s[p.s.length - 1],
    c = Math.cos(q.tilt),
    n = Math.sin(q.tilt);
  return h / Math.hypot(r.d[0], c * r.d[1] + n * r.d[2]);
}
/** RMS spot on the image surface, on axis, over a pupil grid with the obstruction honoured. */
export function trainSpotRMS(p, N = 96) {
  const pu = pupilOf(p),
    z = startZ(p.s),
    pts = [];
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = ((i + 0.5) / N) * 2 - 1,
        y = ((j + 0.5) / N) * 2 - 1;
      if (x * x + y * y > 1) continue;
      const r = traceTrain(p.s, { p: [x * pu, y * pu, z], d: [0, 0, 1] }, p.n0 || 1);
      if (r.ok && r.local) pts.push(r.local);
    }
  if (!pts.length) return NaN;
  const mx = pts.reduce((a, q) => a + q[0], 0) / pts.length,
    my = pts.reduce((a, q) => a + q[1], 0) / pts.length;
  return Math.sqrt(pts.reduce((a, q) => a + (q[0] - mx) ** 2 + (q[1] - my) ** 2, 0) / pts.length);
}

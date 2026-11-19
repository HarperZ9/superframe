// Hero details that are not sculpted fields: the eyeballs (with the corneal bulge), the tear line,
// lashes, brows, the hair on the scalp as ribbon strands (a card a clump, tangent along the strand
// for the Marschner-style shader), buttons; and the lantern and rod as small fields.
// Every emitter writes through out(mat, positions, normals, uvs, colours, tangents, tris, bones).
import { EYE_R, eyeCentres, lidLines } from "./head.mjs";
import { cone, ell } from "./garments.mjs";
import { smin, noise } from "../forge/sdf.mjs";
import { J } from "./rig.mjs";
import { INDEX } from "../rig/skeleton.mjs";

const hyp = Math.hypot, nrm = (a) => { const l = hyp(...a) || 1; return a.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function rng(seed) { let x = seed >>> 0 || 1; return () => ((x ^= x << 13), (x ^= x >>> 17), (x ^= x << 5), (x >>> 0) / 4294967296); }

// the eyeballs: a lat-long sphere about the gaze, the cornea a 0.55 mm bulge over the iris; uv the
// eye-local x, y over the radius, colour.x the forward coordinate (the shader's iris and sclera)
export function eyes(face, origin, out, N = 64) {
  const s = face.s ?? 1;
  for (const c0 of eyeCentres({ s })) {
    const c = [origin[0] + c0[0], origin[1] + c0[1], origin[2] + c0[2]], P = [], Nn = [], U = [], C = [], T = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const th = (i / N) * Math.PI, ph = (j / N) * 2 * Math.PI, n = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
      const bulge = 0.00055 * s * Math.max(0, 1 - (Math.sin(th) / 0.5) ** 2) * (n[2] > 0 ? 1 : 0), r = EYE_R * s + bulge;
      P.push(c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r); Nn.push(...n); U.push(n[0], n[1]); C.push(n[2], 0, 0, 0); T.push(...nrm(cross([0, 1, 0], n)), 1);
    }
    const tri = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j; tri.push(a, a + 1, a + N + 1, a + 1, a + N + 2, a + N + 1); }
    out("eye", P, Nn, U, C, T, tri, ["head"]);
  }
}
// the tear line: a wet strip along each lower lid margin, where the lid meets the eye
export function tearLine(face, origin, out) {
  const s = face.s ?? 1, F = { age: 0.5, ...face };
  for (const c0 of eyeCentres({ s })) {
    const c = [origin[0] + c0[0], origin[1] + c0[1], origin[2] + c0[2]], sx = Math.sign(c0[0]), P = [], Nn = [], U = [], C = [], T = [], tri = [], M = 40;
    for (let i = 0; i <= M; i++) {
      const az = -0.85 + 1.7 * (i / M), { lo } = lidLines(F, az);
      for (const [k, a] of [[0, lo - 0.01], [1, lo + 0.07]]) {
        const r = EYE_R * s + 0.0004 * s, d = [Math.sin(az) * Math.cos(a) * sx, Math.sin(a), Math.cos(az) * Math.cos(a)];
        P.push(c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r); Nn.push(...d); U.push(i / M, k); C.push(0, 0, 1, 0); T.push(1, 0, 0, 1);
      }
      if (i < M) { const b = i * 2; tri.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    out("tear", P, Nn, U, C, T, tri, ["head"]);
  }
}

// ribbon strands: each a polyline with a width that tapers root to tip, lying with its face along
// `up` (the skin's normal); tangent along the strand, colour (t, the strand's random, 0, 0)
export function ribbons(strands, mat, out, bones) {
  const P = [], Nn = [], U = [], C = [], T = [], tri = [];
  for (const st of strands) {
    const n = st.pts.length, b0 = P.length / 3;
    for (let i = 0; i < n; i++) {
      const p = st.pts[i], t = i / (n - 1), dir = nrm(i < n - 1 ? st.pts[i + 1].map((v, k) => v - p[k]) : p.map((v, k) => v - st.pts[i - 1][k]));
      const side = nrm(cross(dir, st.up)), w = st.w * (1 - 0.8 * t) * 0.5, up = nrm(cross(side, dir));
      for (const sg of [-1, 1]) { P.push(p[0] + side[0] * w * sg, p[1] + side[1] * w * sg, p[2] + side[2] * w * sg); Nn.push(...up); U.push(t, st.r); C.push(t, st.r, 0, 0); T.push(...dir, 1); }
      if (i < n - 1) { const a = b0 + i * 2; tri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
  }
  if (tri.length) out(mat, P, Nn, U, C, T, tri, bones);
  return tri.length / 3;
}
// a point on the field's surface along a ray from `from` toward `dir` (sphere tracing); null if none
export function surfaceHit(F, from, dir, maxT = 0.3) {
  let t = 0;
  for (let i = 0; i < 160 && t < maxT; i++) { const p = from.map((v, k) => v + dir[k] * t), d = F(...p); if (Math.abs(d) < 2e-5) return p; t += Math.max(d * 0.8, 1e-5); }
  return null;
}
export const grad = (F, p, e = 0.0004) => nrm([F(p[0] + e, p[1], p[2]) - F(p[0] - e, p[1], p[2]), F(p[0], p[1] + e, p[2]) - F(p[0], p[1] - e, p[2]), F(p[0], p[1], p[2] + e) - F(p[0], p[1], p[2] - e)]);

// Grow strands over a head field (head-local): roots by golden-angle directions from the cranium's
// centre, kept where `root(p)` says hair grows; each strand combed along `comb(p)` across the
// scalp, lifted off it by its volume, with a little curl. Returns head-local polylines.
export function growHair(F, { count, root, comb, len, lift = 0.003, segs = 7, w = 0.0007, curl = 0.25, seed = 7 }) {
  const R = rng(seed), out = [], c = [0, 0.03, -0.02], ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count * 6 && out.length < count; i++) {
    const y = 1 - (i + 0.5) / (count * 6) * 2, r = Math.sqrt(1 - y * y), a = i * ga, dir = [Math.cos(a) * r, y, Math.sin(a) * r];
    const p0 = surfaceHit(F, c.map((v, k) => v + dir[k] * 0.2), dir.map((v) => -v));
    if (!p0 || !root(p0)) continue;
    const L = len(p0) * (0.7 + 0.6 * R()), pts = [p0], rr = R();
    let p = p0;
    for (let k = 1; k <= segs; k++) {
      const n = grad(F, p), cb = comb(p), tdir = nrm(cb.map((v, q) => v - n[q] * dot(cb, n) + (noise(p[0] * 90 + q * 7, p[1] * 90, p[2] * 90 + rr * 50) - 0.5) * curl));
      p = p.map((v, q) => v + tdir[q] * (L / segs));
      const want = lift * (0.3 + 0.7 * k / segs) * (0.6 + 0.8 * rr), dd = F(...p);
      if (dd < want) { const g = grad(F, p); p = p.map((v, q) => v + g[q] * (want - dd)); }
      pts.push(p);
    }
    out.push({ pts, up: grad(F, p0), w: w * (0.7 + 0.6 * R()), r: rr });
  }
  return out;
}

// brows: short hairs along an arc above each eye, medial ones rising, lateral ones swept out
export function growBrows(F, face, { count = 170, seed = 11, tone = 1 } = {}) {
  const R = rng(seed), out = [], s = face.s ?? 1;
  for (const sx of [1, -1]) for (let i = 0; i < count; i++) {
    const u = R(), x = sx * (0.011 + 0.042 * u) * s, y = (0.022 + 0.008 * Math.sin(Math.PI * Math.min(1, u * 1.2)) + (R() - 0.5) * 0.007 * (1 - 0.5 * u)) * s;
    const p0 = surfaceHit(F, [x, y, 0.16 * s], [0, 0, -1]);
    if (!p0) continue;
    const n = grad(F, p0), want = nrm([sx * (0.2 + 0.9 * u), 0.9 - 0.8 * u, 0.15]), L = (0.006 + 0.005 * R()) * s, pts = [p0];
    let p = p0;
    for (let k = 1; k <= 4; k++) { const td = nrm(want.map((v, q) => v - n[q] * dot(want, n))); p = p.map((v, q) => v + td[q] * L / 4); const dd = F(...p); if (dd < 0.0005) { const g = grad(F, p); p = p.map((v, q) => v + g[q] * (0.0005 - dd)); } pts.push(p); }
    out.push({ pts, up: n, w: 0.00018 * tone, r: R() });
  }
  return out;
}
// lashes: from each lid margin, curving out and up (lower ones down), longest mid-lid
export function growLashes(face, { upper = 70, lower = 32, seed = 5 } = {}) {
  const R = rng(seed), out = [], s = face.s ?? 1, F = { age: 0.5, ...face };
  for (const c of eyeCentres({ s })) {
    const sx = Math.sign(c[0]);
    for (const [n, isUp] of [[upper, true], [lower, false]]) for (let i = 0; i < n; i++) {
      const az = -0.8 + 1.62 * ((i + R() * 0.6) / n), L0 = lidLines(F, az), a = isUp ? L0.up + 0.03 : L0.lo - 0.03, r = EYE_R * s + 0.0034 * s;
      const rad = [Math.sin(az) * Math.cos(a) * sx, Math.sin(a), Math.cos(az) * Math.cos(a)], p0 = c.map((v, k) => v + rad[k] * r);
      const L = (isUp ? 0.0085 : 0.0045) * s * (1 - 0.55 * Math.abs(az) / 0.85) * (0.85 + 0.3 * R()), pts = [p0];
      let p = p0, dir = nrm([rad[0], rad[1] + (isUp ? 0.25 : -0.25), rad[2]]);
      for (let k = 1; k <= 5; k++) { p = p.map((v, q) => v + dir[q] * L / 5); dir = nrm([dir[0], dir[1] + (isUp ? 0.35 : -0.25), dir[2] - 0.08]); pts.push(p); }
      out.push({ pts, up: nrm(cross(cross(rad, [0, 1, 0]), dir)), w: 0.00014 * s, r: R() });
    }
  }
  return out;
}

// a flattened brass dome on the surface at p with normal n
export function dome(p, n, r, out, bones, mat = "brass") {
  const P = [], Nn = [], U = [], C = [], T = [], tri = [], N = 14, t1 = nrm(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), t2 = cross(n, t1);
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const th = (i / N) * Math.PI * 0.5, ph = (j / N) * 2 * Math.PI, l = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
    const q = [0, 1, 2].map((k) => p[k] + (t1[k] * l[0] + t2[k] * l[1]) * r + n[k] * (l[2] * r * 0.45 - r * 0.1));
    const nn = nrm([0, 1, 2].map((k) => t1[k] * l[0] + t2[k] * l[1] + n[k] * l[2] / 0.45));
    P.push(...q); Nn.push(...nn); U.push(l[0], l[1]); C.push(0, 0, 0, 1); T.push(...t1, 1);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j; tri.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2); }
  out(mat, P, Nn, U, C, T, tri, bones);
}

// The lantern hanging from a joint: brass cap and foot, four posts, two guard rings, the bail;
// a glass chimney; the flame. Returns field parts for hero/figure.mjs and the light's offset.
export function lantern(B, joint) {
  const h = J(B, joint), Y = (dy) => [h[0], h[1] + dy, h[2]];
  const brass = (x, y, z) => {
    const p = [x, y, z];
    let v = cone(p, Y(-0.02), Y(-0.055), 0.022, 0.054);
    v = Math.min(v, Math.max(Math.abs(hyp(x - h[0], z - h[2]) - 0.03) - 0.004, Math.abs(y - h[1] + 0.015) - 0.006));
    v = Math.min(v, cone(p, Y(-0.18), Y(-0.215), 0.056, 0.05), cone(p, Y(-0.215), Y(-0.224), 0.05, 0.036));
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, o = [Math.cos(a) * 0.055, 0, Math.sin(a) * 0.055]; v = Math.min(v, cone(p, [h[0] + o[0], h[1] - 0.06, h[2] + o[2]], [h[0] + o[0], h[1] - 0.18, h[2] + o[2]], 0.0035, 0.0035)); }
    for (const yy of [-0.1, -0.145]) v = Math.min(v, Math.max(Math.abs(hyp(x - h[0], z - h[2]) - 0.057) - 0.0022, Math.abs(y - h[1] - yy) - 0.0022));
    const bail = Math.hypot(hyp(x - h[0], y - h[1] + 0.02) - 0.045, z - h[2]) - 0.0022;
    v = Math.min(v, Math.max(bail, h[1] - 0.02 - y));
    return v;
  };
  const glass = (x, y, z) => Math.max(Math.abs(hyp(x - h[0], z - h[2]) - 0.046) - 0.0016, Math.abs(y - h[1] + 0.12) - 0.062);
  const flame = (x, y, z) => ell([x, y, z], Y(-0.128), [0.008, 0.02, 0.008]) - 0.002 * Math.max(0, y - h[1] + 0.128) / 0.02;
  const lo = [h[0] - 0.08, h[1] - 0.24, h[2] - 0.08], hi = [h[0] + 0.08, h[1] + 0.05, h[2] + 0.08];
  return { parts: [{ name: "lantern", d: brass, mat: () => "brass", lo, hi, cell: 0.0022 }, { name: "lanternGlass", d: glass, mat: () => "glass", lo, hi, cell: 0.0028 }, { name: "flame", d: flame, mat: () => "flame", lo, hi, cell: 0.0015 }], light: [0, -0.128, 0] };
}
// the measuring rod through the right fist (along the curled fingers' roll): ash, brass-shod at
// the tip ahead, a brass cap behind; a field in the bind pose, rigid to the hand
export function rod(B, side = "R", len = 1.25) {
  const s = side === "L" ? 1 : -1, h = J(B, "hand" + side), M = B[INDEX["hand" + side]].R, ap = (v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
  const c = ap([-0.008 * s, -0.087, 0]).map((v, k) => v + h[k]), dir = nrm(ap(nrm([0, -0.22, 1])));
  const a = c.map((v, k) => v - dir[k] * 0.28), b = c.map((v, k) => v + dir[k] * (len - 0.28));
  const along = (p) => dot(p.map((v, k) => v - a[k]), dir);
  const wood = (x, y, z) => { const p = [x, y, z], u = along(p); return Math.max(cone(p, a, b, 0.0125, 0.0115) - 0.0002 * Math.sin(u * 900) * 0, -u + 0.03, u - (len - 0.07)); };
  const brass = (x, y, z) => { const p = [x, y, z], u = along(p); return Math.min(Math.max(cone(p, a, b, 0.0136, 0.0128), u - 0.032, -u), Math.max(cone(p, a, b, 0.0134, 0.012), (len - 0.075) - u, u - len + 0.004) ); };
  const pts = [a, b], lo = [0, 1, 2].map((k) => Math.min(a[k], b[k]) - 0.03), hi = [0, 1, 2].map((k) => Math.max(a[k], b[k]) + 0.03);
  return [{ name: "rod", d: wood, mat: () => "wood", lo, hi, cell: 0.003, bones: ["hand" + side] }, { name: "rodBrass", d: brass, mat: () => "brass", lo, hi, cell: 0.0025, bones: ["hand" + side] }];
}

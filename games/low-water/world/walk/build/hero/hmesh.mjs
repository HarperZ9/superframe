// The hero mesh: triangles sorted by material, each vertex with a place, a normal, a uv in metres
// (or 0..1 where a part says so) and four numbers for the shader: wear, wetness, dirt and a
// variation seed (COLOR_0 in the glTF). glb.mjs writes it; the native frame reads it.
// Parts are drawn in a frame (kit.mjs frame/put/dir), so a house is described facing its own front.
import { put, dir } from "../kit.mjs";

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a, b, t) => a + (b - a) * t;

export class HeroMesh {
  constructor() { this.b = new Map(); this.tris = 0; this.wear = [0, 0, 0, 0.5]; }
  bucket(m) {
    let k = this.b.get(m);
    if (!k) this.b.set(m, k = { pos: [], nrm: [], uv: [], col: [], idx: [] });
    return k;
  }
  // one vertex; returns its index in the material's bucket
  v(m, p, n, u, w, c = this.wear) {
    const k = this.bucket(m), i = k.pos.length / 3;
    k.pos.push(p[0], p[1], p[2]); k.nrm.push(n[0], n[1], n[2]); k.uv.push(u, w); k.col.push(c[0], c[1], c[2], c[3]);
    return i;
  }
  // a triangle, wound so its face agrees with its vertices' normals (so no part needs to get its
  // winding right by hand); a triangle with no area is dropped
  tri(m, i, j, k) {
    const B = this.bucket(m), P = (q) => [B.pos[q * 3], B.pos[q * 3 + 1], B.pos[q * 3 + 2]], N = (q) => [B.nrm[q * 3], B.nrm[q * 3 + 1], B.nrm[q * 3 + 2]];
    const a = P(i), fn = cross(sub(P(j), a), sub(P(k), a));
    if (Math.hypot(...fn) < 1e-12) return;
    if (dot(fn, add(add(N(i), N(j)), N(k))) < 0) B.idx.push(i, k, j); else B.idx.push(i, j, k);
    this.tris++;
  }
  // a flat quad a b c d (counter-clockwise seen from the front) with uvs; normals from its plane
  quad(m, a, b, c, d, uv = null, c4 = this.wear) {
    const n = norm(cross(sub(b, a), sub(d, a))), q = uv || [[0, 0], [Math.hypot(...sub(b, a)), 0], [Math.hypot(...sub(b, a)), Math.hypot(...sub(d, a))], [0, Math.hypot(...sub(d, a))]];
    const i = [a, b, c, d].map((p, k) => this.v(m, p, n, q[k][0], q[k][1], c4));
    this.tri(m, i[0], i[1], i[2]); this.tri(m, i[0], i[2], i[3]);
  }
  // a surface P(s, t) over [0,1]^2 in nu x nv cells; uvOf(s, t) gives its uv; normals by differences
  // `out`, a point inside a closed surface: every normal is turned to face away from it
  grid(m, P, nu, nv, uvOf, colOf = null, out = null) {
    const idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const s = i / nu, t = j / nv, e = 1e-3, p = P(s, t);
      const du = sub(P(Math.min(1, s + e), t), P(Math.max(0, s - e), t)), dv = sub(P(s, Math.min(1, t + e)), P(s, Math.max(0, t - e)));
      const c = cross(du, dv); let n = Math.hypot(...c) > 1e-12 ? norm(c) : [0, 1, 0];
      if (out && dot(n, sub(p, out)) < 0) n = mul(n, -1);
      const uv = uvOf(s, t, p);
      idx.push(this.v(m, p, n, uv[0], uv[1], colOf ? colOf(s, t, p) : this.wear));
    }
    const at = (i, j) => idx[j * (nu + 1) + i];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { this.tri(m, at(i, j), at(i + 1, j), at(i + 1, j + 1)); this.tri(m, at(i, j), at(i + 1, j + 1), at(i, j + 1)); }
  }
  // A box from (x0,y0,z0) to (x1,y1,z1) in frame f with its edges chamfered by `bev` metres. Each
  // chamfer blends the normals of the two faces it joins, so every edge catches a line of light.
  // uv: box mapping in metres times `tex`, offset by `off` so neighbouring parts do not repeat.
  bbox(m, f, x0, y0, z0, x1, y1, z1, bev = 0.01, tex = 1, off = [0, 0], o = {}) {
    const lo = [x0, y0, z0], hi = [x1, y1, z1], b = Math.max(0, Math.min(bev, (x1 - x0) / 2.2, (y1 - y0) / 2.2, (z1 - z0) / 2.2));
    const ext = [x1 - x0, y1 - y0, z1 - z0], long = ext[0] >= ext[1] && ext[0] >= ext[2] ? 0 : ext[1] >= ext[2] ? 1 : 2;
    const faces = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];
    // a point of the box from a face normal and its two in-face coordinates, inset by the chamfer
    const corner = (ax, sg, ua, ub) => { const p = [0, 0, 0]; p[ax] = sg > 0 ? hi[ax] : lo[ax]; return { p, ax, sg, ua, ub }; };
    const P = (c) => put(f, c), N = (ax, sg) => { const n = [0, 0, 0]; n[ax] = sg; return dir(f, n); };
    for (const [ax, sg] of faces) {
      if ((o.top === false && ax === 1 && sg > 0) || (o.bottom === false && ax === 1 && sg < 0)) continue;
      const ua = (ax + 1) % 3, ub = (ax + 2) % 3, n = N(ax, sg);
      const pts = [[lo[ua] + b, lo[ub] + b], [hi[ua] - b, lo[ub] + b], [hi[ua] - b, hi[ub] - b], [lo[ua] + b, hi[ub] - b]].map(([a, c]) => { const p = corner(ax, sg, 0, 0).p; p[ua] = a; p[ub] = c; return p; });
      // v runs along the box's longest side wherever that side lies in the face, so grain follows a beam
      const uvOf = (p) => long === ua ? [p[ub] * tex + off[0], p[ua] * tex + off[1]] : [p[ua] * tex + off[0], p[ub] * tex + off[1]];
      const ids = pts.map((p) => this.v(m, P(p), n, ...uvOf(p), o.col || this.wear));
      if (sg > 0) { this.tri(m, ids[0], ids[1], ids[2]); this.tri(m, ids[0], ids[2], ids[3]); } else { this.tri(m, ids[0], ids[2], ids[1]); this.tri(m, ids[0], ids[3], ids[2]); }
    }
    if (b <= 0) return;
    // the twelve chamfer strips and eight corner triangles
    for (let ax = 0; ax < 3; ax++) for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      const a1 = (ax + 1) % 3, a2 = (ax + 2) % 3, n1 = N(a1, s1), n2 = N(a2, s2), e = (s, a) => s > 0 ? hi[a] : lo[a], ins = (s, a) => s > 0 ? hi[a] - b : lo[a] + b;
      const q = (t, side) => { const p = [0, 0, 0]; p[ax] = t; p[a1] = side ? e(s1, a1) : ins(s1, a1); p[a2] = side ? ins(s2, a2) : e(s2, a2); return p; };
      const t0 = lo[ax] + b, t1 = hi[ax] - b, c = [q(t0, 1), q(t1, 1), q(t1, 0), q(t0, 0)], nn = [n1, n1, n2, n2];
      const ids = c.map((p, k) => this.v(m, P(p), nn[k], (k < 2 ? 0 : b) * tex + off[0], p[ax] * tex + off[1], o.col || this.wear));
      const flip = (s1 * s2 > 0) !== (ax === 1);
      if (!flip) { this.tri(m, ids[0], ids[1], ids[2]); this.tri(m, ids[0], ids[2], ids[3]); } else { this.tri(m, ids[0], ids[2], ids[1]); this.tri(m, ids[0], ids[3], ids[2]); }
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const c = [sx > 0 ? hi[0] : lo[0], sy > 0 ? hi[1] : lo[1], sz > 0 ? hi[2] : lo[2]], s = [sx, sy, sz], pts = [];
      for (let a = 0; a < 3; a++) { const p = c.slice(); for (let k = 0; k < 3; k++) if (k !== a) p[k] -= s[k] * b; pts.push({ p, n: N(a, s[a]) }); }
      const ids = pts.map((q) => this.v(m, P(q.p), q.n, 0, 0, o.col || this.wear));
      if (sx * sy * sz > 0) this.tri(m, ids[0], ids[1], ids[2]); else this.tri(m, ids[0], ids[2], ids[1]);
    }
  }
  // a tube through world points with radius r (or a radius per point); uv round and along in metres
  tube(m, pts, r, sides = 8, cap = false) {
    const rings = []; let run = 0;
    for (let i = 0; i < pts.length; i++) {
      const t = norm(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)])), ref = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], x = norm(cross(ref, t)), y = cross(t, x), rr = Array.isArray(r) ? r[i] : r;
      if (i) run += Math.hypot(...sub(pts[i], pts[i - 1]));
      const ring = [];
      for (let k = 0; k <= sides; k++) { const a = k / sides * Math.PI * 2, n = add(mul(x, Math.cos(a)), mul(y, Math.sin(a))); ring.push(this.v(m, add(pts[i], mul(n, rr)), n, k / sides * rr * 6.283, run)); }
      rings.push(ring);
    }
    for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < sides; k++) { const a = rings[i][k], b = rings[i][k + 1], c = rings[i + 1][k + 1], d = rings[i + 1][k]; this.tri(m, a, c, b); this.tri(m, a, d, c); }
    if (cap) for (const [i, s] of [[0, -1], [pts.length - 1, 1]]) {
      const t = mul(norm(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)])), s), c = this.v(m, pts[i], t, 0, 0);
      for (let k = 0; k < sides; k++) { const ring = rings[i]; if (s > 0) this.tri(m, c, ring[k], ring[k + 1]); else this.tri(m, c, ring[k + 1], ring[k]); }
    }
  }
  // a shape turned about the vertical through `c`: profile [[radius, height], ...] from the bottom
  lathe(m, c, profile, sides = 16, tex = 1) {
    const rings = [];
    for (let i = 0; i < profile.length; i++) {
      const [r, h] = profile[i], [r0, h0] = profile[Math.max(0, i - 1)], [r1, h1] = profile[Math.min(profile.length - 1, i + 1)], sl = Math.atan2(r0 - r1, h1 - h0), ring = [];
      for (let k = 0; k <= sides; k++) { const a = k / sides * Math.PI * 2, n = [Math.cos(a) * Math.cos(sl), Math.sin(sl), Math.sin(a) * Math.cos(sl)]; ring.push(this.v(m, [c[0] + Math.cos(a) * r, c[1] + h, c[2] + Math.sin(a) * r], n, a * Math.max(r, 0.05) * tex, h * tex)); }
      rings.push(ring);
    }
    for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < sides; k++) { const a = rings[i][k], b = rings[i][k + 1], cc = rings[i + 1][k + 1], d = rings[i + 1][k]; this.tri(m, a, cc, b); this.tri(m, a, d, cc); }
  }
  // an icicle: a drooping cone from a root on an eave down `len` metres, slightly bent, with ripples
  icicle(m, root, len, r, R) {
    const n = 7, bend = [(R() - 0.5) * 0.04, 0, (R() - 0.5) * 0.04], pts = [], rr = [];
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([root[0] + bend[0] * t * t, root[1] - len * t, root[2] + bend[2] * t * t]); rr.push(Math.max(0.0015, r * Math.pow(1 - t, 1.6) * (1 + 0.18 * Math.sin(t * 23 + R() * 6)))); }
    this.tube(m, pts, rr, 6);
  }
  get triangles() { return this.tris; }
}

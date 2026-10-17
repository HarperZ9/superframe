// Bodies for the Low Water skeleton: every shape is a tube of rings (torso, limbs, coat skirt, hat,
// brim, bell jar, lantern), each ring carrying its skinning weights, so the whole figure is one
// linear-blend-skinned mesh. Built once per character in the bind pose; skinned per frame.
import { JOINTS, INDEX, apply, bind } from "./skeleton.mjs";

const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// A mesh under construction: flat arrays, up to 4 weights per vertex.
export class Mesh {
  constructor() { this.pos = []; this.nrm = []; this.mat = []; this.wj = []; this.ww = []; this.tri = []; this.loc = []; this.part = []; this.col = []; this.parts = ["body"]; this.cur = 0; this.paint = null; }
  // paint(pBind) -> [r, g, b] multiplier: set while building a forged region, so its vertices carry painted colour
  // Name the part the next vertices belong to (a prop the game can hide: a thrown lantern, a dropped tool).
  begin(name) { let i = this.parts.indexOf(name); if (i < 0) { i = this.parts.length; this.parts.push(name); } this.cur = i; return this; }
  end() { this.cur = 0; return this; }
  vert(p, n, mat, weights, loc) {
    const e = Object.entries(weights).filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4), s = e.reduce((a, [, w]) => a + w, 0) || 1;
    const j = [0, 0, 0, 0], w = [0, 0, 0, 0]; e.forEach(([k, v], i) => { j[i] = INDEX[k]; w[i] = v / s; });
    this.pos.push(...p); this.nrm.push(...n); this.mat.push(mat); this.wj.push(...j); this.ww.push(...w); this.loc.push(...(loc || p)); this.part.push(this.cur); this.col.push(...(this.paint ? this.paint(p) : [1, 1, 1]));
    return this.pos.length / 3 - 1;
  }
}

// A tube. rings: [{ c, rx, rz, w: {joint: weight}, mat? }], from first to last.
// opt: { mat, seg, capA, capB, rmod(theta, ringIndex, ringT) -> radius factor, wfn(theta, ring) -> weights,
//        square (superellipse exponent; 2 is an ellipse, 6 a rounded box), matfn(theta, ring, t) -> mat }
export function tube(M, rings, opt = {}) {
  const seg = opt.seg || 18, sq = opt.square || 2, first = [], arc = opt.arc, nk = arc ? seg + 1 : seg;
  const axisAt = (i) => norm(sub(rings[Math.min(rings.length - 1, i + 1)].c, rings[Math.max(0, i - 1)].c));
  let prev = null;
  rings.forEach((r, i) => {
    const a = axisAt(i), X = [1, 0, 0], Z = Math.abs(a[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
    let e1 = Math.abs(dot(a, X)) > 0.9 ? [0, 0, 1] : norm(sub(X, scl(a, dot(X, a))));
    let e2 = norm(sub(Z, add(scl(a, dot(Z, a)), scl(e1, dot(Z, e1)))));
    if (Math.abs(dot(a, X)) > 0.9) e2 = [0, 1, 0];
    const t = rings.length > 1 ? i / (rings.length - 1) : 0, ids = [];
    const rPrev = rings[Math.max(0, i - 1)], rNext = rings[Math.min(rings.length - 1, i + 1)];
    const len = Math.hypot(...sub(rNext.c, rPrev.c)) || 1, slope = ((rNext.rx + rNext.rz) - (rPrev.rx + rPrev.rz)) / 2 / len;
    for (let k = 0; k < nk; k++) {
      const th = arc ? arc[0] + (k / seg) * (arc[1] - arc[0]) : (k / seg) * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
      const ex = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / sq), ez = Math.sign(st) * Math.pow(Math.abs(st), 2 / sq);
      const m = opt.rmod ? opt.rmod(th, i, t) : 1, rx = r.rx * m, rz = r.rz * m;
      const p = add(r.c, add(scl(e1, ex * rx), scl(e2, ez * rz)));
      const nr = norm(add(scl(e1, ex / Math.max(1e-3, rx)), scl(e2, ez / Math.max(1e-3, rz))));
      const n = norm(sub(nr, scl(a, slope)));
      const w = opt.wfn ? opt.wfn(th, r, t) : r.w, mat = opt.matfn ? opt.matfn(th, r, t) : r.mat ?? opt.mat;
      ids.push(M.vert(p, n, mat, w, opt.loc ? opt.loc(p) : p));
    }
    if (prev) for (let k = 0; k < (arc ? seg : seg); k++) { const k2 = arc ? k + 1 : (k + 1) % seg; M.tri.push(prev[k], ids[k], ids[k2], prev[k], ids[k2], prev[k2]); }
    if (i === 0) first.push(...ids);
    prev = ids;
  });
  const cap = (ring, ids, dir) => {
    const a = norm(sub(rings[dir > 0 ? rings.length - 1 : 0].c, rings[dir > 0 ? rings.length - 2 : 1].c));
    const c = M.vert(ring.c, a, ring.mat ?? opt.mat, ring.w);
    for (let k = 0; k < seg; k++) M.tri.push(c, ids[k], ids[(k + 1) % seg]);
  };
  if (arc) return;
  if (opt.capA !== false && rings.length > 1) cap(rings[0], first, -1);
  if (opt.capB !== false && rings.length > 1) cap(rings[rings.length - 1], prev, 1);
}

// An ellipsoid on one joint: centre c (bind space), radii [x, y, z], n rings.
export function blob(M, c, r, w, mat, opt = {}) {
  const n = opt.rings || 10, rings = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI, y = Math.sin(a), k = Math.max(0.02, Math.cos(a));
    const up = opt.axis || [0, 1, 0];
    rings.push({ c: add(c, scl(up, y * r[1])), rx: r[0] * k, rz: r[2] * k, w, mat });
  }
  tube(M, rings, { ...opt, capA: true, capB: true });
}

// A limb between two joints, tapering r0 to r1, skinned to blend across the far joint.
export function limb(M, B, a, b, r0, r1, mat, opt = {}) {
  const pa = B[INDEX[a]].p, pb = B[INDEX[b]].p, n = opt.rings || 6, rings = [], over = opt.over ?? 0.08, flat = opt.flat || 1;
  for (let i = 0; i <= n; i++) {
    const t = -over + (i / n) * (1 + 2 * over), c = add(pa, scl(sub(pb, pa), t)), r = lerp(r0, r1, Math.min(1, Math.max(0, t)));
    const wb = smooth(0.72, 1.08, t) * 0.5 + (t > 1 ? 0.5 * smooth(1, 1 + over, t) : 0), wa = 1 - wb;
    const w = { [a]: wa, [b]: wb }; if (opt.parentBlend && t < 0.15) { w[opt.parentBlend] = 0.5 * (1 - smooth(-over, 0.15, t)); }
    const bulge = opt.bulge ? 1 + opt.bulge * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) : 1;
    rings.push({ c, rx: r * bulge, rz: r * bulge * flat, w });
  }
  tube(M, rings, { mat, seg: opt.seg || 12, ...opt });
}

// Skin the mesh to a solved pose. Bind frames have identity rotation, so M_j = R_j and
// t_j = p_j - R_j p_bind_j. Returns { pos, nrm } in character space.
export function skin(M, B, S) {
  const nv = M.pos.length / 3, pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3);
  const T = S.map((s, j) => { const pb = apply(s.R, B[j].p); return [s.p[0] - pb[0], s.p[1] - pb[1], s.p[2] - pb[2]]; });
  for (let v = 0; v < nv; v++) {
    const p = [M.pos[v * 3], M.pos[v * 3 + 1], M.pos[v * 3 + 2]], n = [M.nrm[v * 3], M.nrm[v * 3 + 1], M.nrm[v * 3 + 2]];
    let px = 0, py = 0, pz = 0, nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 4; k++) {
      const w = M.ww[v * 4 + k]; if (!w) continue;
      const j = M.wj[v * 4 + k], R = S[j].R, q = apply(R, p), m = apply(R, n);
      px += w * (q[0] + T[j][0]); py += w * (q[1] + T[j][1]); pz += w * (q[2] + T[j][2]);
      nx += w * m[0]; ny += w * m[1]; nz += w * m[2];
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    pos[v * 3] = px; pos[v * 3 + 1] = py; pos[v * 3 + 2] = pz; nrm[v * 3] = nx / l; nrm[v * 3 + 1] = ny / l; nrm[v * 3 + 2] = nz / l;
  }
  return { pos, nrm };
}

export { bind, JOINTS, INDEX, norm, sub, add, scl, dot, lerp };

// Ground contact: how far to lift (or drop) a skinned figure so its lowest body point meets y = 0.
// Props that may dip below the ground (a rod's tip) are left out. snap: also pull a floating body
// down (a figure lying or rolling); otherwise only lift what sinks.
export function groundShift(M, S, skipIds, snap = false) {
  let lo = 1e9; for (let v = 0; v < S.pos.length / 3; v++) if (!skipIds.has(M.mat[v])) lo = Math.min(lo, S.pos[v * 3 + 1]);
  if (lo === 1e9) return 0; return lo < 0 || snap ? -lo : 0;
}

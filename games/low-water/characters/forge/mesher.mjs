// The sculptor's field and mesher. A field is a list of shapes (forge/sdf.mjs records, plus
// { t: "fn", f, bc, br }) combined in order: "add" (smooth union, k), "sub" (smooth carve, k),
// "hard" (plain union: eyes). Each shape carries a bounding sphere, so a point far from it skips
// it. Ellipsoids marked exact use the true distance inside a band round the surface (where blends,
// normals and the baked maps read it) and the cheap bound outside, where only the sign matters.
// polygonise() samples a narrow band only: a coarse grid first, then the fine cells near the
// surface, then marching tetrahedra.
import { field, smin, smax } from "./sdf.mjs";
import { ellBound } from "./ellipsoid.mjs";

const CORN = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const TETS = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];

function bound(s) {
  if (s.t === "fn") return [s.bc, s.br];
  if (s.t === "ell") return [s.c, Math.max(...s.r)];
  if (s.t === "cap") { const r = Math.max(...[].concat(s.r)), m = s.a.map((v, i) => (v + s.b[i]) / 2); return [m, Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]) / 2 + r]; }
  if (s.t === "box") return [s.c, Math.hypot(...s.r)];
  if (s.t === "tor") return [s.c, s.R + s.r];
  if (s.t === "lid" || s.t === "scap") return [s.c, s.R + (s.th || 0)];
  if (s.t === "slit") return [s.c, s.w + 0.03];
  throw new Error(`mesher: no bound for ${s.t}`);
}
// prepare(shapes, { band, disp }) -> { d(x,y,z), mat(x,y,z), skin(x,y,z) }
export function prepare(shapes, { band = 0.01, disp = null, slack = 0.012 } = {}) {
  const L = shapes.map((s) => {
    const [bc, br] = bound(s), exact = s.t === "ell" && s.exact;
    const fe = field(s), fb = exact ? (() => { const q = { ...s, exact: false }; return field(q); })() : fe;
    return { s, op: s.op || "add", k: s.k ?? 0.012, bc, br: br + slack, fe, fb, exact, mat: s.mat, bias: s.bias || 0 };
  });
  const one = (p, x, y, z) => { const b = p.fb(x, y, z); return p.exact && Math.abs(b) < band ? p.fe(x, y, z) : b; };
  const raw = (x, y, z) => {
    let d = 1e9;
    for (const p of L) {
      const lb = Math.hypot(x - p.bc[0], y - p.bc[1], z - p.bc[2]) - p.br;
      if (p.op === "sub") { if (lb > -d + p.k) continue; d = smax(d, -one(p, x, y, z), p.k); }
      else if (p.op === "hard") { if (lb > d) continue; d = Math.min(d, one(p, x, y, z)); }
      else { if (lb > d + p.k) continue; d = smin(d, one(p, x, y, z), p.k); }
    }
    return d;
  };
  const d = disp ? (x, y, z) => { const v = raw(x, y, z); return Math.abs(v) < band ? v - disp(x, y, z) : v; } : raw;
  // the material: the drawn shape whose own surface is nearest (shells such as hair win over the skin under them)
  const mat = (x, y, z) => {
    let best = 1e9, m = null;
    for (const p of L) { if (p.op === "sub" || !p.mat) continue; if (Math.hypot(x - p.bc[0], y - p.bc[1], z - p.bc[2]) - p.br > best) continue; const e = Math.abs(one(p, x, y, z)) - p.bias; if (e < best) { best = e; m = p.mat; } }
    return m;
  };
  // the skin alone (adds of material skin), for growing beards off it
  const skinL = L.filter((p) => p.op === "add" && p.mat === "skin");
  const skin = (x, y, z) => { let v = 1e9; for (const p of skinL) { if (Math.hypot(x - p.bc[0], y - p.bc[1], z - p.bc[2]) - p.br > v + p.k) continue; v = smin(v, p.fb(x, y, z), p.k); } return v; };
  return { d, mat, skin, list: L };
}

// polygonise(F, { lo, hi, cell, vert(p, n, matName) -> index, tri: [] })
export function polygonise(F, { lo, hi, cell, vert, tri, coarse = 4 }) {
  const nx = Math.ceil((hi[0] - lo[0]) / cell), ny = Math.ceil((hi[1] - lo[1]) / cell), nz = Math.ceil((hi[2] - lo[2]) / cell);
  if ((nx + 1) * (ny + 1) * (nz + 1) > 2.5e7) throw new Error(`mesher: grid too fine (${nx}x${ny}x${nz})`);
  const at = (i, j, k) => (k * (ny + 1) + j) * (nx + 1) + i, V = new Float32Array((nx + 1) * (ny + 1) * (nz + 1)).fill(NaN);
  const X = (i) => lo[0] + i * cell, Y = (j) => lo[1] + j * cell, Z = (k) => lo[2] + k * cell, val = (i, j, k) => { const q = at(i, j, k); if (Number.isNaN(V[q])) V[q] = F.d(X(i), Y(j), Z(k)); return V[q]; };
  const C = coarse, reach = C * cell * Math.sqrt(3) * 1.05;
  for (let K = 0; K < nz; K += C) for (let J = 0; J < ny; J += C) for (let I = 0; I < nx; I += C) {
    const i1 = Math.min(nx, I + C), j1 = Math.min(ny, J + C), k1 = Math.min(nz, K + C);
    const ci = Math.min(nx, I + (C >> 1)), cj = Math.min(ny, J + (C >> 1)), ck = Math.min(nz, K + (C >> 1));
    if (Math.abs(val(ci, cj, ck)) > reach * 0.55 + 2 * cell) continue;   // no surface within this block
    for (let k = K; k <= k1; k++) for (let j = J; j <= j1; j++) for (let i = I; i <= i1; i++) val(i, j, k);
  }
  // normals: the field's gradient at the grid points (central differences one cell wide, so the
  // shading sees the surface at the cell's scale, which is what the alias limit in detail.mjs assumes),
  // interpolated along the edge; a point at the band's edge falls back to evaluating the field
  const cache = new Map(), e = cell;
  const gAt = (i, j, k) => {
    const q = [i > 0 && i < nx ? V[at(i + 1, j, k)] - V[at(i - 1, j, k)] : NaN, j > 0 && j < ny ? V[at(i, j + 1, k)] - V[at(i, j - 1, k)] : NaN, k > 0 && k < nz ? V[at(i, j, k + 1)] - V[at(i, j, k - 1)] : NaN];
    if (q.some(Number.isNaN)) { const x = X(i), y = Y(j), z = Z(k); return [F.d(x + e, y, z) - F.d(x - e, y, z), F.d(x, y + e, z) - F.d(x, y - e, z), F.d(x, y, z + e) - F.d(x, y, z - e)]; }
    return q;
  };
  const edge = (ia, ib, pa, pb, ga, gb) => {
    const key = ia < ib ? ia * 1e8 + ib : ib * 1e8 + ia; if (cache.has(key)) return cache.get(key);
    const da = V[ia], db = V[ib], t = da / (da - db), p = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t];
    const A = ga(), B = gb(), g = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t], l = Math.hypot(...g) || 1;
    const v = vert(p, [g[0] / l, g[1] / l, g[2] / l], F.mat(...p)); cache.set(key, v); return v;
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = CORN.map(([a, b, c]) => at(i + a, j + b, k + c)); let any = 0, ok = true;
    for (const q of idx) { const v = V[q]; if (Number.isNaN(v)) { ok = false; break; } any |= v < 0 ? 1 : 2; }
    if (!ok || any !== 3) continue;
    const pos = CORN.map(([a, b, c]) => [X(i + a), Y(j + b), Z(k + c)]), gr = CORN.map(([a, b, c]) => () => gAt(i + a, j + b, k + c));
    for (const T of TETS) {
      const ins = T.filter((c) => V[idx[c]] < 0), out = T.filter((c) => V[idx[c]] >= 0), E = (a, b) => edge(idx[a], idx[b], pos[a], pos[b], gr[a], gr[b]);
      if (ins.length === 1) tri.push(E(ins[0], out[0]), E(ins[0], out[1]), E(ins[0], out[2]));
      else if (ins.length === 3) tri.push(E(out[0], ins[0]), E(out[0], ins[1]), E(out[0], ins[2]));
      else if (ins.length === 2) { const a = E(ins[0], out[0]), b = E(ins[0], out[1]), c = E(ins[1], out[0]), d = E(ins[1], out[1]); tri.push(a, b, d, a, d, c); }
    }
  }
  return { nx, ny, nz, evaluated: V.reduce((n, v) => n + (Number.isNaN(v) ? 0 : 1), 0) };
}
export { ellBound };

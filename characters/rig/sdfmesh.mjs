// Sculpted parts from signed distance primitives: smooth-unioned and carved, then polygonised by
// marching tetrahedra into the skinned mesh. Used where a figure is seen up close (heads, hands),
// so features blend into one surface instead of meeting as separate lumps.
//   sdfPart(M, prims, { weights, cell })   prims: [{ t: 'ell'|'cap', c|a,b, r|r0,r1, mat, k, op: 'add'|'sub'|'hard' }]
const len = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);

function primDist(p, x, y, z) {
  if (p.t === "ell") {   // ellipsoid, the usual bound-corrected approximation
    const dx = (x - p.c[0]) / p.r[0], dy = (y - p.c[1]) / p.r[1], dz = (z - p.c[2]) / p.r[2], k0 = len(dx, dy, dz);
    const k1 = len(dx / p.r[0], dy / p.r[1], dz / p.r[2]); return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(...p.r);
  }
  // capsule with radius r0 at a and r1 at b
  const ax = x - p.a[0], ay = y - p.a[1], az = z - p.a[2], bx = p.b[0] - p.a[0], by = p.b[1] - p.a[1], bz = p.b[2] - p.a[2];
  const h = Math.min(1, Math.max(0, (ax * bx + ay * by + az * bz) / (bx * bx + by * by + bz * bz)));
  return len(ax - bx * h, ay - by * h, az - bz * h) - (p.r0 + (p.r1 - p.r0) * h);
}
// The field and the material at a point: the material is the primitive closest to its own surface.
function field(prims, x, y, z) {
  let d = 1e9, mat = prims[0].mat, best = 1e9;
  for (const p of prims) {
    const e = primDist(p, x, y, z);
    if (p.op === "sub") d = smax(d, -e, p.k || 0);
    else if (p.op === "hard") { if (e < d) d = e; }
    else d = smin(d, e, p.k ?? 0.02);
    const sc = e - (p.bias || 0); if (p.op !== "sub" && sc < best) { best = sc; mat = p.mat; }
  }
  return { d, mat };
}

// Six tetrahedra per cube, sharing the main diagonal 0-6.
const CORN = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const TETS = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];

export function sdfPart(M, prims, { weights, cell = 0.006, pad = 0.03 } = {}) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const p of prims) {
    if (p.op === "sub") continue;
    const pts = p.t === "ell" ? [[p.c[0] - p.r[0], p.c[1] - p.r[1], p.c[2] - p.r[2]], [p.c[0] + p.r[0], p.c[1] + p.r[1], p.c[2] + p.r[2]]] : [p.a.map((v) => v - p.r0), p.a.map((v) => v + p.r0), p.b.map((v) => v - p.r1), p.b.map((v) => v + p.r1)];
    for (const q of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k] - pad); hi[k] = Math.max(hi[k], q[k] + pad); }
  }
  const nx = Math.ceil((hi[0] - lo[0]) / cell), ny = Math.ceil((hi[1] - lo[1]) / cell), nz = Math.ceil((hi[2] - lo[2]) / cell);
  const D = new Float32Array((nx + 1) * (ny + 1) * (nz + 1)), at = (i, j, k) => (k * (ny + 1) + j) * (nx + 1) + i;
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) D[at(i, j, k)] = field(prims, lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell).d;
  const P = (i, j, k) => [lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell], cache = new Map();
  const grad = (x, y, z) => { const e = cell * 0.5, f = (a, b, c) => field(prims, a, b, c).d; const g = [f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)], l = len(...g) || 1; return [g[0] / l, g[1] / l, g[2] / l]; };
  const edgeVert = (ia, ib, ga, gb) => {
    const key = ia < ib ? ia * 1e8 + ib : ib * 1e8 + ia; if (cache.has(key)) return cache.get(key);
    const da = D[ia], db = D[ib], t = da / (da - db), p = [ga[0] + (gb[0] - ga[0]) * t, ga[1] + (gb[1] - ga[1]) * t, ga[2] + (gb[2] - ga[2]) * t];
    const v = M.vert(p, grad(...p), field(prims, ...p).mat, weights); cache.set(key, v); return v;
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = CORN.map(([a, b, c]) => at(i + a, j + b, k + c)), pos = CORN.map(([a, b, c]) => P(i + a, j + b, k + c));
    let any = 0; for (const q of idx) any |= D[q] < 0 ? 1 : 2; if (any !== 3) continue;
    for (const T of TETS) {
      const ins = T.filter((c) => D[idx[c]] < 0), out = T.filter((c) => D[idx[c]] >= 0);
      const E = (a, b) => edgeVert(idx[a], idx[b], pos[a], pos[b]);
      if (ins.length === 1) M.tri.push(E(ins[0], out[0]), E(ins[0], out[1]), E(ins[0], out[2]));
      else if (ins.length === 3) M.tri.push(E(out[0], ins[0]), E(out[0], ins[1]), E(out[0], ins[2]));
      else if (ins.length === 2) { const a = E(ins[0], out[0]), b = E(ins[0], out[1]), c = E(ins[1], out[0]), d = E(ins[1], out[1]); M.tri.push(a, b, d, a, d, c); }
    }
  }
}

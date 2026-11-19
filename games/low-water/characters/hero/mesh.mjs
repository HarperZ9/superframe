// Meshing for the hero pieces: forge/mesher.mjs polygonise (marching tetrahedra on a narrow band)
// over boxes split into chunks on whole cells, so a long piece (a rod, a coat skirt) stays under the
// mesher's grid cap; and the buckets (one a material) the .glb is written from.
import { polygonise } from "../forge/mesher.mjs";

// mesh field F = { d, mat } over [lo, hi] at `cell`; vert(p, n, mat) -> index, tri pushed into `tri`
export function meshBox(F, lo, hi, cell, vert, tri, cap = 1.6e7) {
  const n = [0, 1, 2].map((k) => Math.max(1, Math.ceil((hi[k] - lo[k]) / cell)));
  if ((n[0] + 1) * (n[1] + 1) * (n[2] + 1) <= cap) return polygonise(F, { lo, hi: lo.map((v, k) => v + n[k] * cell), cell, vert, tri });
  const k = n.indexOf(Math.max(...n)), half = Math.floor(n[k] / 2);
  const mid = lo[k] + half * cell, hiA = [...hi], loB = [...lo]; hiA[k] = mid; loB[k] = mid;
  meshBox(F, lo, hiA, cell, vert, tri, cap); meshBox(F, loB, hi, cell, vert, tri, cap);
}

export class Buckets {
  constructor() { this.map = new Map(); }
  get(mat) {
    if (!this.map.has(mat)) this.map.set(mat, { pos: [], nrm: [], uv: [], col: [], tan: [], jnt: [], wgt: [], idx: [], hasTan: true });
    return this.map.get(mat);
  }
  // a piece: per-vertex arrays and a material per vertex; a triangle takes its first vertex's
  // material and the vertices it needs are copied into that bucket
  addPiece(V, tri, keep = null) {
    const caches = new Map();
    for (let t = 0; t < tri.length; t += 3) {
      const a = tri[t], b = tri[t + 1], c = tri[t + 2];
      if (keep && !keep(a, b, c)) continue;
      const m = V.mat[a], K = this.get(m);
      if (!caches.has(m)) caches.set(m, new Map());
      const cache = caches.get(m);
      for (const v of [a, b, c]) {
        let i = cache.get(v);
        if (i === undefined) {
          i = K.pos.length / 3; cache.set(v, i);
          K.pos.push(V.pos[v * 3], V.pos[v * 3 + 1], V.pos[v * 3 + 2]); K.nrm.push(V.nrm[v * 3], V.nrm[v * 3 + 1], V.nrm[v * 3 + 2]);
          K.uv.push(V.uv[v * 2], V.uv[v * 2 + 1]); for (let q = 0; q < 4; q++) { K.col.push(V.col[v * 4 + q]); K.jnt.push(V.jnt[v * 4 + q]); K.wgt.push(V.wgt[v * 4 + q]); }
          if (V.tan) for (let q = 0; q < 4; q++) K.tan.push(V.tan[v * 4 + q]); else K.hasTan = false;
        }
        K.idx.push(i);
      }
    }
  }
  // the map for writeGlb: buckets whose vertices all brought tangents keep them
  out() { const o = new Map(); for (const [m, K] of this.map) o.set(m, { ...K, tan: K.hasTan && K.tan.length ? K.tan : null }); return o; }
  stats() { let tris = 0, verts = 0; const per = {}; for (const [m, K] of this.map) { tris += K.idx.length / 3; verts += K.pos.length / 3; per[m] = K.idx.length / 3; } return { triangles: tris, vertices: verts, perMaterial: per }; }
}

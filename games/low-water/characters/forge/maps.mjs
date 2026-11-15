// Maps baked beside a sculpted head (ART-DIRECTION 7.1; the painter and the wear layer read them),
// one value a vertex:
//   curvature  mean curvature (1/m): convex positive (brow, nose, cheekbone), concave negative
//   thickness  how far a ray straight in from the surface travels before it leaves (m, capped at
//              5 cm): thin at the ears, the nose and the lids, where light passes through skin
//   cavity     0 open .. 1 enclosed: how much the surface around the point closes over it
// Thickness and cavity read distance off the surface, which is where a bound field draws contour
// rings (section 8, the quay frames). So they read the exact distance to the baked mesh itself
// (closest point on its triangles, through a bucket grid), signed by the mesh's outward normals; the
// field is read only beyond the search reach. Sign agreement with the field: 99.65 percent of 2879
// samples within 3 cm of Penhallow's mid head (2026-10-21).
//   bakeMaps(mesh, sign) -> { curvature, thickness, cavity }   mesh: { pos, nrm, tri } flat arrays
//   exactDistance(mesh) -> (x, y, z) => unsigned distance to the nearest triangle (m)

function closestOnTri(p, a, b, c) {   // Ericson, Real-Time Collision Detection 5.1.5
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return a;
  const bp = [p[0] - b[0], p[1] - b[1], p[2] - b[2]], d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
  const cp = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}

export function exactDistance(mesh, { cell = 0.008, reach = 0.06, signed = false } = {}) {
  const { pos, tri } = mesh, P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i + k]); hi[k] = Math.max(hi[k], pos[i + k]); }
  const n = [0, 1, 2].map((k) => Math.max(1, Math.ceil((hi[k] - lo[k]) / cell))), buckets = new Map(), key = (i, j, k) => (k * n[1] + j) * n[0] + i;
  const ci = (v, k) => Math.max(0, Math.min(n[k] - 1, Math.floor((v - lo[k]) / cell)));
  for (let t = 0; t < tri.length; t += 3) {
    const a = P(tri[t]), b = P(tri[t + 1]), c = P(tri[t + 2]), l = [0, 1, 2].map((k) => ci(Math.min(a[k], b[k], c[k]), k)), h = [0, 1, 2].map((k) => ci(Math.max(a[k], b[k], c[k]), k));
    for (let k = l[2]; k <= h[2]; k++) for (let j = l[1]; j <= h[1]; j++) for (let i = l[0]; i <= h[0]; i++) { const q = key(i, j, k); if (!buckets.has(q)) buckets.set(q, []); buckets.get(q).push(t); }
  }
  const sph = new Float64Array(tri.length / 3 * 4);   // each triangle's bounding sphere: centroid and radius
  for (let t = 0, u = 0; t < tri.length; t += 3, u += 4) {
    const a = P(tri[t]), b = P(tri[t + 1]), c = P(tri[t + 2]), m = [0, 1, 2].map((k) => (a[k] + b[k] + c[k]) / 3);
    sph.set([...m, Math.max(...[a, b, c].map((v) => Math.hypot(v[0] - m[0], v[1] - m[1], v[2] - m[2])))], u);
  }
  const R = Math.ceil(reach / cell), rings = Array.from({ length: R + 1 }, () => []);   // cell offsets by ring (Chebyshev radius)
  for (let k = -R; k <= R; k++) for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) rings[Math.max(Math.abs(i), Math.abs(j), Math.abs(k))].push([i, j, k]);
  // hint: a lower bound on the distance (the field's own value is one), so the search starts outside it
  return (x, y, z, hint = 0) => {
    const c0 = [ci(x, 0), ci(y, 1), ci(z, 2)], p = [x, y, z]; let best = Infinity, bt = -1, bq = null;
    for (let r = Math.max(0, Math.floor(hint / cell) - 2); r <= R; r++) {
      if (best < (r - 1) * cell) break;   // everything further out is further than the best already found
      for (const [di, dj, dk] of rings[r]) {
        const i = c0[0] + di, j = c0[1] + dj, k = c0[2] + dk; if (i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2]) continue;
        const L = buckets.get(key(i, j, k)); if (!L) continue;
        for (const t of L) {
          const u = t / 3 * 4; if (Math.hypot(x - sph[u], y - sph[u + 1], z - sph[u + 2]) - sph[u + 3] >= best) continue;   // its bounding sphere is further than the best
          const q = closestOnTri(p, P(tri[t]), P(tri[t + 1]), P(tri[t + 2])), d = Math.hypot(q[0] - x, q[1] - y, q[2] - z); if (d < best) { best = d; bt = t; bq = q; }
        }
      }
    }
    if (!signed) return Math.min(best, reach);
    if (bt < 0) return null;   // nothing within reach: the caller decides
    // the sign from the outward vertex normals of the nearest triangle (the mesher's triangles are not
    // consistently wound, its normals are: they are the field's gradient)
    const N = mesh.nrm; let nx = 0, ny = 0, nz = 0;
    for (const v of [tri[bt], tri[bt + 1], tri[bt + 2]]) { nx += N[v * 3]; ny += N[v * 3 + 1]; nz += N[v * 3 + 2]; }
    const side = (x - bq[0]) * nx + (y - bq[1]) * ny + (z - bq[2]) * nz;
    return side < 0 ? -best : best;
  };
}

// maxThick: past 5 cm a head is simply thick (no light comes through), so the trace stops there.
export function bakeMaps(mesh, sign, { steps = [0.003, 0.006, 0.012, 0.024], maxThick = 0.05 } = {}) {
  const { pos, tri } = mesh; let el = 0; for (let t = 0; t < Math.min(tri.length, 3000); t += 3) el += Math.hypot(pos[tri[t] * 3] - pos[tri[t + 1] * 3], pos[tri[t] * 3 + 1] - pos[tri[t + 1] * 3 + 1], pos[tri[t] * 3 + 2] - pos[tri[t + 1] * 3 + 2]);
  el /= Math.min(tri.length, 3000) / 3;   // mean edge: the bucket grid is sized to it
  const { nrm } = mesh, nv = pos.length / 3, dist = exactDistance(mesh, { signed: true, cell: Math.max(0.003, el * 2.5), reach: 0.05 });
  // signed exact distance to the mesh; beyond the search reach, the field says which side
  const sd = (x, y, z) => { const d = dist(x, y, z); if (d != null) return d; return sign(x, y, z) < 0 ? -0.05 : 0.05; };
  // curvature: the mean over neighbours of how fast the normal turns along each edge
  const sum = new Float64Array(nv), cnt = new Uint32Array(nv);
  const edge = (i, j) => {
    const dx = pos[j * 3] - pos[i * 3], dy = pos[j * 3 + 1] - pos[i * 3 + 1], dz = pos[j * 3 + 2] - pos[i * 3 + 2], l2 = dx * dx + dy * dy + dz * dz; if (l2 <= 0) return;
    const k = ((nrm[j * 3] - nrm[i * 3]) * dx + (nrm[j * 3 + 1] - nrm[i * 3 + 1]) * dy + (nrm[j * 3 + 2] - nrm[i * 3 + 2]) * dz) / l2;
    sum[i] += k; cnt[i]++; sum[j] += k; cnt[j]++;
  };
  for (let t = 0; t < tri.length; t += 3) { edge(tri[t], tri[t + 1]); edge(tri[t + 1], tri[t + 2]); edge(tri[t + 2], tri[t]); }
  const curvature = new Float32Array(nv), thickness = new Float32Array(nv), cavity = new Float32Array(nv);
  for (let v = 0; v < nv; v++) {
    curvature[v] = cnt[v] ? sum[v] / cnt[v] : 0;
    const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]], n = [nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]];
    // cavity: open space above the point at growing heights, against the height itself
    let occ = 0, wsum = 0; steps.forEach((h, i) => { const w = 1 / (i + 1), d = sd(p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h); occ += w * Math.max(0, Math.min(1, (h - d) / h)); wsum += w; });
    cavity[v] = occ / wsum;
    // thickness: sphere-trace inward on the exact distance until the ray is outside again
    let t = 0.002, out = maxThick;
    for (let i = 0; i < 64 && t < maxThick; i++) { const q = [p[0] - n[0] * t, p[1] - n[1] * t, p[2] - n[2] * t], d = sd(...q); if (d >= 0) { out = t; break; } t += Math.max(-d, 0.0015); }
    thickness[v] = out;
  }
  return { curvature, thickness, cavity };
}

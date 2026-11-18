// Is a camera inside the world's geometry? Checked against the drawn triangles themselves, not the
// solids the camera steers by, so a wrong solid shows up as a failure here.
//   const G = makeTriangleGrid(); G.add(a, b, c) ... ; G.probe(eye, near) -> { clipped, enclosed, nearest }
// clipped: a triangle closer than `near` (the near plane would cut it open on screen).
// enclosed: inside a closed shape: along level rays the nearest faces are back faces (outward-wound
// meshes seen from inside); under an eave, between two walls or beside a window, it is not.
const CELL = 2;

export function makeTriangleGrid() {
  const tris = [], grid = new Map(), key = (i, j) => i * 100003 + j;
  function add(a, b, c) {
    const t = tris.length; tris.push([a, b, c]);
    const x0 = Math.floor(Math.min(a[0], b[0], c[0]) / CELL), x1 = Math.floor(Math.max(a[0], b[0], c[0]) / CELL), z0 = Math.floor(Math.min(a[2], b[2], c[2]) / CELL), z1 = Math.floor(Math.max(a[2], b[2], c[2]) / CELL);
    if ((x1 - x0) * (z1 - z0) > 400) return;   // a sheet hundreds of metres wide (a far card): not a wall
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = key(i, j); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(t); }
  }
  // the triangles whose cells a box of the map touches
  function around(x0, z0, x1, z1) {
    const out = new Set();
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) for (const t of grid.get(key(i, j)) || []) out.add(t);
    return out;
  }
  // the nearest triangle along a ray within reach: { h, back } (back: its face turns away from the ray's
  // origin, as every wall does seen from inside a closed shape), or null
  function ray(o, d, reach) {
    const seen = new Set(), steps = Math.ceil(reach / (CELL * 0.5));
    let best = reach, bt = -1;
    for (let s = 0; s <= steps; s++) {
      if (bt >= 0 && best < s * CELL * 0.5 - CELL) break;
      const p = [o[0] + d[0] * s * CELL * 0.5, o[2] + d[2] * s * CELL * 0.5];
      for (const t of grid.get(key(Math.floor(p[0] / CELL), Math.floor(p[1] / CELL))) || []) {
        if (seen.has(t)) continue; seen.add(t);
        const h = hit(o, d, tris[t]); if (h > 0 && h < best) { best = h; bt = t; }
      }
      if (d[0] === 0 && d[2] === 0) break;
    }
    if (bt < 0) return null;
    const [A, B, C] = tris[bt], e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    return { h: best, back: n[0] * d[0] + n[1] * d[1] + n[2] * d[2] > 0 };
  }
  function probe(eye, near = 0.2, reach = 24) {
    let nearest = 1e9;
    for (const t of around(eye[0] - near - 1, eye[2] - near - 1, eye[0] + near + 1, eye[2] + near + 1)) nearest = Math.min(nearest, pointTri(eye, tris[t]));
    // inside a closed shape: the nearest face along at least three of four level rays is a back face
    // (meshes are wound outward, walk/build/kit.mjs); a window or a sign on a wall does not fool it
    const dirs = [[1, 0, 0.013], [-1, 0, -0.011], [0.017, 0, 1], [-0.009, 0, -1]].map((d) => { const l = Math.hypot(...d); return d.map((v) => v / l); });
    const backs = dirs.map((d) => ray(eye, d, reach)).filter((r) => r && r.back).length;
    return { clipped: nearest < near, enclosed: backs >= 3, nearest, backs };
  }
  // unsigned distance from a point to the nearest triangle within `reach` (reach + 1 when none is)
  function distance(p, reach = 1.5) {
    let d = reach + 1;
    for (const t of around(p[0] - reach, p[2] - reach, p[0] + reach, p[2] + reach)) { const tr = tris[t]; if (Math.min(tr[0][1], tr[1][1], tr[2][1]) - p[1] > d || p[1] - Math.max(tr[0][1], tr[1][1], tr[2][1]) > d) continue; d = Math.min(d, pointTri(p, tr)); }
    return d;
  }
  // push an upright body (a circle of radius r from y0 to y1) out of every triangle it overlaps, on the
  // map: [x, z, touched]. People, crates and signs that the walls and roofs leave out stop the walker.
  function pushOut(x, z, r, y0, y1) {
    let touched = false;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const t of around(x - r, z - r, x + r, z + r)) {
        const tr = tris[t];
        if (Math.max(tr[0][1], tr[1][1], tr[2][1]) < y0 || Math.min(tr[0][1], tr[1][1], tr[2][1]) > y1) continue;
        const mid = [x, Math.min(y1, Math.max(y0, (tr[0][1] + tr[1][1] + tr[2][1]) / 3)), z], q = closestOnTri(mid, tr);
        if (q[1] < y0 || q[1] > y1) continue;
        const dx = x - q[0], dz = z - q[2], d = Math.hypot(dx, dz);
        if (d < r && d > 1e-5) { x += dx / d * (r - d + 1e-3); z += dz / d * (r - d + 1e-3); moved = touched = true; }
      }
      if (!moved) break;
    }
    return [x, z, touched];
  }
  return { add, probe, around, distance, pushOut, get count() { return tris.length; } };
}

// Moller-Trumbore: distance along d to the triangle, or -1
function hit(o, d, [a, b, c]) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-9) return -1;
  const inv = 1 / det, t = [o[0] - a[0], o[1] - a[1], o[2] - a[2]], u = (t[0] * p[0] + t[1] * p[1] + t[2] * p[2]) * inv;
  if (u < 0 || u > 1) return -1;
  const q = [t[1] * e1[2] - t[2] * e1[1], t[2] * e1[0] - t[0] * e1[2], t[0] * e1[1] - t[1] * e1[0]], v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv;
  if (v < 0 || u + v > 1) return -1;
  return (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
}
// distance from a point to a triangle (Ericson, Real-Time Collision Detection 5.1.5)
export function pointTri(p, t) { const q = closestOnTri(p, t); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }
// the nearest point of a triangle to p
export function closestOnTri(p, [a, b, c]) {
  const sub = (x, y) => [x[0] - y[0], x[1] - y[1], x[2] - y[2]], dot = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  const at = (q) => q, lin = (x, y, t) => [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
  if (d1 <= 0 && d2 <= 0) return at(a);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return at(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return at(lin(a, b, d1 / (d1 - d3)));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return at(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return at(lin(a, c, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return at(lin(b, c, (d4 - d3) / (d4 - d3 + (d5 - d6))));
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return at([a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]);
}

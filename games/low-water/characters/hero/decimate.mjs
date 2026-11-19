// Quadric edge-collapse simplification (Garland and Heckbert 1997) for the hero buckets: the
// marching-tetrahedra surfaces carry far more triangles than their shape needs, so each sculpted
// bucket is collapsed to a target count, the error kept where curvature is. A collapse goes to the
// endpoint or midpoint with the least quadric error; one that would flip a neighbouring face is
// refused; open edges carry a penalty plane so cuts and hems keep their outline.
//   decimate(K, target) -> a new bucket { pos, nrm, uv, col, jnt, wgt, idx, tan: null }
export function decimate(K, target) {
  const nv = K.pos.length / 3, nt0 = K.idx.length / 3;
  if (nt0 <= target) return K;
  const P = Float64Array.from(K.pos), Q = new Float64Array(nv * 10), T = Int32Array.from(K.idx), dead = new Uint8Array(nt0), alive = new Uint8Array(nv).fill(1), stamp = new Int32Array(nv);
  const vt = Array.from({ length: nv }, () => []);
  for (let t = 0; t < nt0; t++) for (let k = 0; k < 3; k++) vt[T[t * 3 + k]].push(t);
  const addQ = (v, a, b, c, d, w) => { const q = v * 10; Q[q] += w * a * a; Q[q + 1] += w * a * b; Q[q + 2] += w * a * c; Q[q + 3] += w * a * d; Q[q + 4] += w * b * b; Q[q + 5] += w * b * c; Q[q + 6] += w * b * d; Q[q + 7] += w * c * c; Q[q + 8] += w * c * d; Q[q + 9] += w * d * d; };
  const face = (t) => { const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3, e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]]; const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; return n; };
  const edgeCount = new Map(), ek = (a, b) => (a < b ? a * nv + b : b * nv + a);
  for (let t = 0; t < nt0; t++) {
    const n = face(t), l = Math.hypot(...n); if (l < 1e-20) continue;
    const a = T[t * 3] * 3, nx = n[0] / l, ny = n[1] / l, nz = n[2] / l, d = -(nx * P[a] + ny * P[a + 1] + nz * P[a + 2]);
    for (let k = 0; k < 3; k++) { addQ(T[t * 3 + k], nx, ny, nz, d, l * 0.5); const e = ek(T[t * 3 + k], T[t * 3 + (k + 1) % 3]); edgeCount.set(e, (edgeCount.get(e) || 0) + 1); }
  }
  // open edges: a plane through the edge, perpendicular to its face, heavily weighted
  for (let t = 0; t < nt0; t++) for (let k = 0; k < 3; k++) {
    const u = T[t * 3 + k], v = T[t * 3 + (k + 1) % 3]; if (edgeCount.get(ek(u, v)) !== 1) continue;
    const n = face(t), e = [P[v * 3] - P[u * 3], P[v * 3 + 1] - P[u * 3 + 1], P[v * 3 + 2] - P[u * 3 + 2]], m = [e[1] * n[2] - e[2] * n[1], e[2] * n[0] - e[0] * n[2], e[0] * n[1] - e[1] * n[0]], l = Math.hypot(...m); if (l < 1e-20) continue;
    const nx = m[0] / l, ny = m[1] / l, nz = m[2] / l, d = -(nx * P[u * 3] + ny * P[u * 3 + 1] + nz * P[u * 3 + 2]), w = Math.hypot(...e) * 40;
    addQ(u, nx, ny, nz, d, w * w); addQ(v, nx, ny, nz, d, w * w);
  }
  const err = (q, x, y, z) => Q[q] * x * x + 2 * Q[q + 1] * x * y + 2 * Q[q + 2] * x * z + 2 * Q[q + 3] * x + Q[q + 4] * y * y + 2 * Q[q + 5] * y * z + 2 * Q[q + 6] * y + Q[q + 7] * z * z + 2 * Q[q + 8] * z + Q[q + 9];
  const sumErr = (u, v, x, y, z) => err(u * 10, x, y, z) + err(v * 10, x, y, z);
  // the heap of candidate collapses, lazily invalidated by the endpoints' stamps
  let hc = new Float64Array(1 << 20), ha = new Int32Array(1 << 20), hb = new Int32Array(1 << 20), hs = new Int32Array(1 << 20), hp = new Uint8Array(1 << 20), heap = new Int32Array(1 << 20), hn = 0, en = 0;
  const grow = () => { const g = (A, C) => { const o = new C(A.length * 2); o.set(A); return o; }; hc = g(hc, Float64Array); ha = g(ha, Int32Array); hb = g(hb, Int32Array); hs = g(hs, Int32Array); hp = g(hp, Uint8Array); heap = g(heap, Int32Array); };
  const best = (u, v) => {
    const cands = [[P[u * 3], P[u * 3 + 1], P[u * 3 + 2], 0], [P[v * 3], P[v * 3 + 1], P[v * 3 + 2], 1], [(P[u * 3] + P[v * 3]) / 2, (P[u * 3 + 1] + P[v * 3 + 1]) / 2, (P[u * 3 + 2] + P[v * 3 + 2]) / 2, 2]];
    let b = null, be = Infinity; for (const c of cands) { const e = sumErr(u, v, c[0], c[1], c[2]); if (e < be) { be = e; b = c; } } return [be, b[3]];
  };
  const push = (u, v) => {
    if (en >= hc.length) grow();
    const [c, pick] = best(u, v), i = en++; hc[i] = c; ha[i] = u; hb[i] = v; hs[i] = stamp[u] * 65536 + (stamp[v] & 65535); hp[i] = pick;
    let j = hn++; heap[j] = i;
    while (j > 0) { const p = (j - 1) >> 1; if (hc[heap[p]] <= hc[i]) break; heap[j] = heap[p]; j = p; } heap[j] = i;
  };
  const pop = () => {
    const top = heap[0], last = heap[--hn]; let j = 0;
    while (true) { let c = 2 * j + 1; if (c >= hn) break; if (c + 1 < hn && hc[heap[c + 1]] < hc[heap[c]]) c++; if (hc[heap[c]] >= hc[last]) break; heap[j] = heap[c]; j = c; }
    heap[j] = last; return top;
  };
  for (const e of edgeCount.keys()) push(Math.floor(e / nv), e % nv);
  const at = (A, n) => (v) => Array.from({ length: n }, (_, k) => A[v * n + k]);
  const N = Float64Array.from(K.nrm), UV = Float64Array.from(K.uv), COL = Float64Array.from(K.col);
  let nt = nt0;
  const flips = (v, u, x, y, z) => {
    for (const t of vt[v]) {
      if (dead[t]) continue; const ids = [T[t * 3], T[t * 3 + 1], T[t * 3 + 2]]; if (ids.includes(u)) continue;
      const n0 = face(t), q = ids.map((w) => (w === v ? [x, y, z] : [P[w * 3], P[w * 3 + 1], P[w * 3 + 2]])), e1 = [0, 1, 2].map((k) => q[1][k] - q[0][k]), e2 = [0, 1, 2].map((k) => q[2][k] - q[0][k]);
      const n1 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] <= 1e-3 * Math.hypot(...n0) * Math.hypot(...n1)) return true;
    }
    return false;
  };
  while (nt > target && hn > 0) {
    const i = pop(), u = ha[i], v = hb[i];
    if (!alive[u] || !alive[v] || hs[i] !== stamp[u] * 65536 + (stamp[v] & 65535)) continue;
    const pick = hp[i], x = pick === 0 ? P[u * 3] : pick === 1 ? P[v * 3] : (P[u * 3] + P[v * 3]) / 2, y = pick === 0 ? P[u * 3 + 1] : pick === 1 ? P[v * 3 + 1] : (P[u * 3 + 1] + P[v * 3 + 1]) / 2, z = pick === 0 ? P[u * 3 + 2] : pick === 1 ? P[v * 3 + 2] : (P[u * 3 + 2] + P[v * 3 + 2]) / 2;
    if (flips(v, u, x, y, z) || flips(u, v, x, y, z)) continue;
    // keep u: its place, attributes from the picked end (the midpoint averages the smooth ones)
    if (pick === 1) { for (const [A, n] of [[N, 3], [UV, 2], [COL, 4]]) for (let k = 0; k < n; k++) A[u * n + k] = A[v * n + k]; for (let k = 0; k < 4; k++) { K.jnt[u * 4 + k] = K.jnt[v * 4 + k]; K.wgt[u * 4 + k] = K.wgt[v * 4 + k]; } }
    else if (pick === 2) for (const [A, n] of [[N, 3], [COL, 4]]) for (let k = 0; k < n; k++) A[u * n + k] = (A[u * n + k] + A[v * n + k]) / 2;
    P[u * 3] = x; P[u * 3 + 1] = y; P[u * 3 + 2] = z;
    for (let k = 0; k < 10; k++) Q[u * 10 + k] += Q[v * 10 + k];
    for (const t of vt[v]) {
      if (dead[t]) continue;
      if (T[t * 3] === u || T[t * 3 + 1] === u || T[t * 3 + 2] === u) { dead[t] = 1; nt--; continue; }
      for (let k = 0; k < 3; k++) if (T[t * 3 + k] === v) T[t * 3 + k] = u;
      vt[u].push(t);
    }
    alive[v] = 0; vt[v] = []; stamp[u]++;
    vt[u] = vt[u].filter((t) => !dead[t]);
    const nb = new Set(); for (const t of vt[u]) for (let k = 0; k < 3; k++) if (T[t * 3 + k] !== u) nb.add(T[t * 3 + k]);
    for (const w of nb) { stamp[w]++; }
    for (const w of nb) { push(u, w); for (const t2 of vt[w]) if (!dead[t2]) for (let k = 0; k < 3; k++) { const z2 = T[t2 * 3 + k]; if (z2 !== w && z2 !== u && z2 > w) push(w, z2); } }
  }
  // compact
  const map = new Int32Array(nv).fill(-1), o = { pos: [], nrm: [], uv: [], col: [], jnt: [], wgt: [], idx: [], tan: null };
  for (let t = 0; t < nt0; t++) {
    if (dead[t]) continue;
    for (let k = 0; k < 3; k++) {
      const v = T[t * 3 + k];
      if (map[v] < 0) { map[v] = o.pos.length / 3; o.pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); const n = at(N, 3)(v), l = Math.hypot(...n) || 1; o.nrm.push(n[0] / l, n[1] / l, n[2] / l); o.uv.push(...at(UV, 2)(v)); o.col.push(...at(COL, 4)(v)); for (let q = 0; q < 4; q++) { o.jnt.push(K.jnt[v * 4 + q]); o.wgt.push(K.wgt[v * 4 + q]); } }
      o.idx.push(map[v]);
    }
  }
  return o;
}

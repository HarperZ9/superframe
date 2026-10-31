// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim/coxeter: root systems, simple roots, Coxeter elements, Coxeter planes (Petrie projections),
   Coxeter-Dynkin diagrams and Wythoff orbits. Simple roots are found, not typed in: a positive root is
   simple exactly when its reflection permutes the other positive roots. */
(function (g) {
  "use strict";
  const N = (g.NDim = g.NDim || {});

  N.reflect = (v, r) => N.sub(v, N.scale(r, (2 * N.dot(v, r)) / N.dot(r, r)));
  N.reflectionMatrix = (r) => N.identity(r.length).map((e) => N.reflect(e, r));

  function typeA(n) {
    const v = N.polytope("simplex", n).verts, out = [];
    for (let i = 0; i < v.length; i++) for (let j = 0; j < v.length; j++) if (i !== j) out.push(N.sub(v[i], v[j]));
    return out;
  }
  function typeB(n) {
    const out = [];
    for (let i = 0; i < n; i++) for (const s of [1, -1]) { const e = N.zeros(n); e[i] = s; out.push(e); }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (const a of [1, -1]) for (const b of [1, -1]) {
      const e = N.zeros(n); e[i] = a; e[j] = b; out.push(e);
    }
    return out;
  }
  N.rootSystem = (name) => {
    const n = +name.slice(1), t = name[0];
    let R;
    if (t === "A") R = typeA(n);
    else if (t === "B") R = typeB(n);
    else if (name === "F4") R = N.signedPerms([1, 1, 0, 0]).concat(N.signedPerms([1, 0, 0, 0]).map((v) => N.scale(v, Math.SQRT2)), N.signedPerms([0.5, 0.5, 0.5, 0.5]).map((v) => N.scale(v, Math.SQRT2)));
    else if (name === "H4") R = N.polytope("600-cell").verts;
    else throw new Error("unknown root system " + name);
    return R.map(N.normalize);
  };
  const GENERIC = (n) => Array.from({ length: n }, (_, i) => Math.pow(0.6180339887, i) + 1e-3 * Math.sin(i + 1));
  N.simpleRoots = (roots) => {
    const f = GENERIC(roots[0].length);
    const pos = roots.filter((r) => N.dot(r, f) > 1e-9);
    return pos.filter((a) => pos.every((b) => b === a || N.dot(N.reflect(b, a), f) > 1e-9));
  };

  /* Order the simple roots along the diagram's path, the end with the larger label first. */
  N.dynkin = (simple) => {
    const k = simple.length, edges = [];
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
      const c = -N.dot(simple[i], simple[j]);
      if (c > 1e-6) edges.push({ a: i, b: j, m: Math.round(Math.PI / Math.acos(Math.min(1, c))) });
    }
    return { nodes: k, edges };
  };
  N.chainOrder = (d) => {
    const deg = new Array(d.nodes).fill(0);
    d.edges.forEach((e) => { deg[e.a]++; deg[e.b]++; });
    if (deg.some((x) => x > 2)) return null;
    const lab = (a, b) => (d.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)) || {}).m;
    const walk = (s) => { const o = [s]; while (o.length < d.nodes) { const l = o[o.length - 1]; const nx = d.edges.map((e) => (e.a === l ? e.b : e.b === l ? e.a : -1)).find((x) => x >= 0 && !o.includes(x)); if (nx === undefined) break; o.push(nx); } return o; };
    const ends = deg.map((x, i) => (x <= 1 ? i : -1)).filter((i) => i >= 0);
    let best = null;
    for (const s of ends) {
      const o = walk(s), labels = o.slice(1).map((x, i) => lab(o[i], x));
      if (!best || labels.join() > best.labels.join()) best = { order: o, labels };
    }
    return best;
  };
  N.chainLabels = (d) => { const c = N.chainOrder(d); return c ? c.labels : null; };

  N.matOrder = (M, max = 400) => {
    let P = M;
    for (let k = 1; k <= max; k++) {
      if (P.every((r, i) => r.every((x, j) => Math.abs(x - (i === j ? 1 : 0)) < 1e-9))) return k;
      P = N.matMul(P, M);
    }
    return Infinity;
  };
  N.coxeterElement = (simple) => simple.map(N.reflectionMatrix).reduce((A, B) => N.matMul(A, B));
  /* The plane where the Coxeter element turns by 2 pi / h: real and imaginary parts of its eigenvector. */
  N.coxeterPlane = (C, h) => {
    const n = C.length;
    let v = GENERIC(n).map((x, i) => x + 0.37 * i), a = N.zeros(n), b = N.zeros(n);
    for (let k = 0; k < h; k++) {
      a = N.add(a, N.scale(v, Math.cos((2 * Math.PI * k) / h)));
      b = N.add(b, N.scale(v, Math.sin((2 * Math.PI * k) / h)));
      v = N.matVec(C, v);
    }
    return N.gramSchmidt([a, b]);
  };
  /* Largest k up to max for which turning the planar set by 2 pi / k maps it onto itself. */
  N.rotationalOrder = (pts, max = 60, tol = 1e-6) => {
    const gsz = tol * 100, set = new Set(pts.map(([x, y]) => Math.round(x / gsz) + ":" + Math.round(y / gsz)));
    const has = (x, y) => { const i = Math.round(x / gsz), j = Math.round(y / gsz); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (set.has(i + a + ":" + (j + b))) return true; return false; };
    for (let k = max; k >= 1; k--) {
      const c = Math.cos((2 * Math.PI) / k), s = Math.sin((2 * Math.PI) / k);
      if (pts.every(([x, y]) => has(c * x - s * y, s * x + c * y))) return k;
    }
    return 1;
  };
  N.petrie = (P, group) => {
    const simple = N.simpleRoots(N.rootSystem(group));
    const C = N.coxeterElement(simple), h = N.matOrder(C);
    const [e1, e2] = N.coxeterPlane(C, h);
    const pts = P.verts.map((v) => [N.dot(v, e1), N.dot(v, e2)]);
    const r = Math.max(...pts.map((p) => Math.hypot(p[0], p[1])));
    const unit = pts.map((p) => [p[0] / r, p[1] / r]);
    return { h, plane: [e1, e2], pts: unit, symmetry: N.rotationalOrder(unit, 60, 1e-7) };
  };

  N.orbit = (seed, simple, cap = 20000) => {
    const key = (p) => p.map((x) => Math.round(x * 1e7)).join(",");
    const seen = new Map([[key(seed), seed]]), queue = [seed];
    while (queue.length && seen.size < cap) {
      const p = queue.pop();
      for (const r of simple) { const q = N.reflect(p, r), k = key(q); if (!seen.has(k)) { seen.set(k, q); queue.push(q); } }
    }
    return [...seen.values()];
  };
  function solve(A, b) {
    const n = A.length, M = A.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  /* Wythoff construction: ring[i] = 1 puts the seed off mirror i (in diagram order), 0 puts it on the mirror. */
  N.wythoff = (group, ring) => {
    const simple = N.simpleRoots(N.rootSystem(group));
    const order = N.chainOrder(N.dynkin(simple)).order.map((i) => simple[i]);
    const seed = N.normalize(solve(order, ring));
    return N.orbit(seed, order);
  };
  N.sameDirections = (A, B, tol = 1e-6) => {
    if (A.length !== B.length) return false;
    const a = A.map(N.normalize);
    return B.every((p) => { const q = N.normalize(p); return a.some((x) => N.dist(x, q) < tol); });
  };

  if (typeof module !== "undefined" && module.exports) module.exports = N;
})(typeof globalThis !== "undefined" ? globalThis : this);

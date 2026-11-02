// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim/polytopes: vertex and edge sets of the regular polytopes.
   Simplex, hypercube and cross-polytope in any n; the 24-cell, 120-cell and 600-cell from their standard
   coordinates (the 120-cell is built as the H4 Wythoff orbit in the 600-cell's frame; its published coordinates are kept
   as "120-cell-coords" and checked congruent). */
(function (g) {
  "use strict";
  const N = (g.NDim = g.NDim || {});
  const PHI = (1 + Math.sqrt(5)) / 2;

  function perms(a) {
    if (a.length <= 1) return [{ p: a.slice(), even: true }];
    const out = [];
    a.forEach((x, i) => {
      const rest = a.slice(0, i).concat(a.slice(i + 1));
      for (const q of perms(rest)) out.push({ p: [x].concat(q.p), even: (i % 2 === 0) === q.even });
    });
    return out;
  }
  /* Every sign choice on the non-zero entries, for the given permutations; duplicates removed. */
  function signedPerms(base, evenOnly) {
    const seen = new Map();
    for (const { p, even } of perms(base)) {
      if (evenOnly && !even) continue;
      const nz = p.map((x, i) => (x !== 0 ? i : -1)).filter((i) => i >= 0);
      for (let m = 0; m < 1 << nz.length; m++) {
        const v = p.slice();
        nz.forEach((i, b) => { if (m & (1 << b)) v[i] = -v[i]; });
        seen.set(v.map((x) => x.toFixed(9)).join(","), v);
      }
    }
    return [...seen.values()];
  }
  N.signedPerms = signedPerms;

  /* Edges as the pairs at the shortest distance: correct for regular polytopes, checked against the lattice. */
  N.edgesByMinDistance = (verts, rel = 1e-6) => {
    let dmin = Infinity;
    for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) dmin = Math.min(dmin, N.dist(verts[i], verts[j]));
    const e = [];
    for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) if (N.dist(verts[i], verts[j]) < dmin * (1 + rel)) e.push([i, j]);
    return e;
  };
  const allPairs = (m, skip) => { const e = []; for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) if (!skip || !skip(i, j)) e.push([i, j]); return e; };

  function simplex(n) {
    const a = (1 - Math.sqrt(n + 1)) / n;
    const v = Array.from({ length: n }, (_, i) => { const e = N.zeros(n); e[i] = 1; return e; });
    v.push(new Array(n).fill(a));
    const c = N.mean(v);
    return { verts: v.map((p) => N.normalize(N.sub(p, c))), edges: allPairs(n + 1) };
  }
  function cube(n, unit) {
    const v = [];
    for (let m = 0; m < 1 << n; m++) v.push(Array.from({ length: n }, (_, i) => (m & (1 << i) ? 1 : unit ? 0 : -1)));
    const one = (i, j) => { const x = i ^ j; return x && !(x & (x - 1)); };
    return { verts: v, edges: allPairs(v.length, (i, j) => !one(i, j)) };
  }
  function cross(n) {
    const v = [];
    for (let i = 0; i < n; i++) for (const s of [1, -1]) { const e = N.zeros(n); e[i] = s; v.push(e); }
    return { verts: v, edges: allPairs(v.length, (i, j) => (i >> 1) === (j >> 1)) };
  }
  function cornerSimplex(n) {
    const v = [N.zeros(n)].concat(Array.from({ length: n }, (_, i) => { const e = N.zeros(n); e[i] = 1; return e; }));
    return { verts: v, edges: allPairs(n + 1) };
  }
  function cell24() { const v = signedPerms([1, 1, 0, 0], false); return { verts: v, edges: N.edgesByMinDistance(v) }; }
  function cell600() {
    const v = signedPerms([0.5, 0.5, 0.5, 0.5], false).concat(signedPerms([1, 0, 0, 0], false), signedPerms([PHI / 2, 0.5, 1 / (2 * PHI), 0], true));
    return { verts: v, edges: N.edgesByMinDistance(v) };
  }
  function cell120() {
    const s5 = Math.sqrt(5), p = PHI, q = 1 / PHI, q2 = q * q, p2 = p * p;
    const v = [].concat(
      signedPerms([0, 0, 2, 2], false), signedPerms([1, 1, 1, s5], false), signedPerms([q2, p, p, p], false),
      signedPerms([q, q, q, p2], false), signedPerms([0, q2, 1, p2], true), signedPerms([0, q, p, s5], true),
      signedPerms([q, 1, p, 2], true));
    const r = N.norm(v[0]);
    const u = v.map((x) => N.scale(x, 1 / r));
    return { verts: u, edges: N.edgesByMinDistance(u) };
  }

  /* The 120-cell as the H4 Wythoff orbit, in the same frame as the 600-cell (its dual). */
  function wythoff120() { const v = N.wythoff("H4", [1, 0, 0, 0]); return { verts: v, edges: N.edgesByMinDistance(v) }; }
  /* Same sorted distances from a vertex to all others: a congruence check for vertex-transitive sets. */
  N.distanceSpectrum = (verts) => verts.map((v) => N.dist(v, verts[0])).sort((a, b) => a - b).map((x) => x.toFixed(6)).join(",");

  const MAKERS = {
    simplex: (n) => simplex(n), cube: (n) => cube(n, false), unitcube: (n) => cube(n, true), cross: (n) => cross(n),
    cornersimplex: (n) => cornerSimplex(n), "24-cell": () => cell24(), "600-cell": () => cell600(), "120-cell": () => wythoff120(),
    "120-cell-coords": () => cell120(),
  };
  const SCHLAFLI = { simplex: (n) => "{" + Array(n - 1).fill(3).join(",") + "}", cube: (n) => "{4" + (n > 2 ? "," + Array(n - 2).fill(3).join(",") : "") + "}",
    cross: (n) => "{" + (n > 2 ? Array(n - 2).fill(3).join(",") + "," : "") + "4}", "24-cell": () => "{3,4,3}", "600-cell": () => "{3,3,5}", "120-cell": () => "{5,3,3}" };
  const GROUP = { simplex: (n) => "A" + n, cube: (n) => "B" + n, cross: (n) => "B" + n, "24-cell": () => "F4", "600-cell": () => "H4", "120-cell": () => "H4" };
  N.polytopeNames = Object.keys(MAKERS);
  N.polytope = (name, n) => {
    const fixed = /cell/.test(name);
    const d = fixed ? 4 : n;
    const P = MAKERS[name](d);
    return Object.assign(P, { name, n: d, schlafli: SCHLAFLI[name.replace("-coords", "")] ? SCHLAFLI[name.replace("-coords", "")](d) : null, group: GROUP[name.replace("-coords", "")] ? GROUP[name.replace("-coords", "")](d) : null });
  };
  N.PHI = PHI;

  if (typeof module !== "undefined" && module.exports) module.exports = N;
})(typeof globalThis !== "undefined" ? globalThis : this);

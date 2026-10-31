// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim/lattice: the face lattice of a convex polytope from its vertices and edges.

   Facets: at each vertex, every (d-1)-subset of its neighbours spans a candidate hyperplane; it is a facet
   when every vertex lies on one side and the touching vertices span d-1 dimensions. Lower faces: every
   (k-1)-face is the intersection of two k-faces (the diamond property), so each level is the set of
   pairwise intersections of the level above that span exactly k-1 dimensions. Nothing is looked up. */
(function (g) {
  "use strict";
  const N = (g.NDim = g.NDim || {});

  function subsets(arr, k) {
    const out = [], cur = [];
    (function rec(s) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (let i = s; i <= arr.length - (k - cur.length); i++) { cur.push(arr[i]); rec(i + 1); cur.pop(); }
    })(0);
    return out;
  }
  function neighbours(m, edges) {
    const nb = Array.from({ length: m }, () => []);
    for (const [a, b] of edges) { nb[a].push(b); nb[b].push(a); }
    return nb;
  }
  function facetFrom(verts, v, S, d, eps) {
    const n = verts[0].length;
    const rows = S.map((u) => N.sub(verts[u], verts[v]));
    if (N.gramSchmidt(rows).length < d - 1) return null;
    const nrm = N.nullVector(rows, n);
    if (!nrm) return null;
    const c = N.dot(nrm, verts[v]);
    let pos = false, neg = false;
    const on = [];
    verts.forEach((w, i) => {
      const s = N.dot(nrm, w) - c;
      if (s > eps) pos = true; else if (s < -eps) neg = true; else on.push(i);
    });
    if (pos && neg) return null;
    return { ids: on, normal: pos ? N.scale(nrm, -1) : nrm, offset: pos ? -c : c };
  }
  N.facets = (verts, edges, eps = 1e-7) => {
    const d = N.affineRank(verts), nb = neighbours(verts.length, edges);
    const found = new Map();
    verts.forEach((_, v) => {
      for (const S of subsets(nb[v], d - 1)) {
        const f = facetFrom(verts, v, S, d, eps);
        if (!f) continue;
        const key = f.ids.join(",");
        if (!found.has(key) && N.affineRank(f.ids.map((i) => verts[i])) === d - 1) found.set(key, f);
      }
    });
    return [...found.values()];
  };

  function intersect(a, b) {
    const out = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) { if (a[i] === b[j]) { out.push(a[i]); i++; j++; } else if (a[i] < b[j]) i++; else j++; }
    return out;
  }
  function levelBelow(verts, faces, k) {
    const byVert = new Map();
    faces.forEach((f, fi) => f.forEach((v) => { if (!byVert.has(v)) byVert.set(v, []); byVert.get(v).push(fi); }));
    const seenPair = new Set(), out = new Map(), up = new Map();
    faces.forEach((F, fi) => {
      for (const v of F) for (const gi of byVert.get(v)) {
        if (gi <= fi || seenPair.has(fi * faces.length + gi)) continue;
        seenPair.add(fi * faces.length + gi);
        const I = intersect(F, faces[gi]);
        if (I.length < k) continue;
        const key = I.join(",");
        if (!out.has(key)) {
          if (N.affineRank(I.map((i) => verts[i])) !== k - 1) continue;
          out.set(key, I); up.set(key, new Set());
        }
        up.get(key).add(fi); up.get(key).add(gi);
      }
    });
    return { faces: [...out.values()], parents: [...out.keys()].map((key) => [...up.get(key)]) };
  }

  /* faces[k] lists the k-faces as sorted vertex-id arrays; parents[k][i] lists the (k+1)-faces holding face i. */
  N.faceLattice = (verts, edges) => {
    const d = N.affineRank(verts);
    const faces = new Array(d), parents = new Array(d);
    faces[0] = verts.map((_, i) => [i]);
    if (d === 1) return { d, faces, parents, fvector: [verts.length], facets: [] };
    const fac = N.facets(verts, edges);
    faces[d - 1] = fac.map((f) => f.ids);
    for (let k = d - 1; k >= 2; k--) {
      const L = levelBelow(verts, faces[k], k);
      faces[k - 1] = L.faces; parents[k - 1] = L.parents;
    }
    parents[0] = verts.map((_, v) => faces[1].map((e, i) => (e.includes(v) ? i : -1)).filter((i) => i >= 0));
    return { d, faces, parents, fvector: faces.map((f) => f.length), facets: fac };
  };
  /* Alternating sum of the f-vector; 1 - (-1)^d for the boundary of a convex d-polytope. */
  N.euler = (f) => f.reduce((s, x, k) => s + (k % 2 ? -x : x), 0);

  if (typeof module !== "undefined" && module.exports) module.exports = N;
})(typeof globalThis !== "undefined" ? globalThis : this);

// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim/slice: cut an n-polytope with a hyperplane (Flatland style) and measure the (n-1)-dimensional slice.
   The slice's vertices are where edges cross the plane; its edges are where 2-faces cross it; its volume is
   an exact convex-hull volume by pyramids over facets, recursing down one dimension at a time. */
(function (g) {
  "use strict";
  const N = (g.NDim = g.NDim || {});
  const EPS = 1e-10;

  function crossing(a, b, sa, sb) {
    if (Math.abs(sa) < EPS) return a;
    if (Math.abs(sb) < EPS) return b;
    if ((sa > 0) === (sb > 0)) return null;
    const t = sa / (sa - sb);
    return a.map((x, i) => x + t * (b[i] - x));
  }
  function dedupe(pts) {
    const seen = new Map();
    for (const p of pts) seen.set(p.map((x) => Math.round(x * 1e9)).join(","), p);
    return [...seen.values()];
  }
  /* Points of the slice: one per crossing edge (or touching vertex), in the polytope's coordinates. */
  N.crossingPoints = (verts, edges, normal, offset) => {
    const s = verts.map((v) => N.dot(normal, v) - offset), out = [];
    for (const [a, b] of edges) { const p = crossing(verts[a], verts[b], s[a], s[b]); if (p) out.push(p); }
    return dedupe(out);
  };
  /* Segments of the slice: each 2-face that crosses the plane contributes one segment. */
  N.sliceSegments = (verts, L, normal, offset) => {
    const s = verts.map((v) => N.dot(normal, v) - offset);
    const edgeIds = new Map(L.faces[1].map((e, i) => [e.join(","), i]));
    const segs = [];
    if (!L.faceEdges) {
      L.faceEdges = (L.faces[2] || []).map((F) => {
        const out = [];
        for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) if (edgeIds.has(F[i] + "," + F[j])) out.push([F[i], F[j]]);
        return out;
      });
    }
    for (const fe of L.faceEdges) {
      const pts = dedupe(fe.map(([a, b]) => crossing(verts[a], verts[b], s[a], s[b])).filter(Boolean));
      if (pts.length === 2) segs.push(pts);
    }
    return segs;
  };
  /* Coordinates inside the hyperplane, from an orthonormal basis of its complement. */
  N.toHyperplane = (pts, normal) => { const B = N.complementBasis(normal); return pts.map((p) => B.map((b) => N.dot(b, p))); };

  function hullFacets(pts, m) {
    const found = new Map(), n = pts.length;
    const idx = [];
    (function rec(s) {
      if (idx.length === m) {
        const rows = idx.slice(1).map((i) => N.sub(pts[i], pts[idx[0]]));
        if (N.gramSchmidt(rows).length < m - 1) return;
        const nrm = N.nullVector(rows, m), c = N.dot(nrm, pts[idx[0]]);
        let pos = false, neg = false; const on = [];
        pts.forEach((p, i) => { const d = N.dot(nrm, p) - c; if (d > 1e-9) pos = true; else if (d < -1e-9) neg = true; else on.push(i); });
        if (!(pos && neg)) found.set(on.join(","), { on, nrm, c });
        return;
      }
      for (let i = s; i <= n - (m - idx.length); i++) { idx.push(i); rec(i + 1); idx.pop(); }
    })(0);
    return [...found.values()];
  }
  /* Exact m-volume of the convex hull of points in R^m (0 when they do not span m dimensions). */
  N.hullVolume = (pts) => {
    pts = dedupe(pts);
    const m = pts[0].length;
    if (m === 1) { const xs = pts.map((p) => p[0]); return Math.max(...xs) - Math.min(...xs); }
    if (N.affineRank(pts, 1e-9) < m) return 0;
    const c = N.mean(pts);
    let vol = 0;
    for (const f of hullFacets(pts, m)) {
      const fp = f.on.map((i) => pts[i]);
      const h = Math.abs(N.dot(f.nrm, c) - f.c);
      vol += (h / m) * N.hullVolume(N.toHyperplane(fp, f.nrm));
    }
    return vol;
  };
  N.sliceVolume = (P, L, normal, offset) => {
    const pts = N.crossingPoints(P.verts, L ? L.faces[1] : P.edges, normal, offset);
    if (pts.length < P.n) return 0;
    return N.hullVolume(N.toHyperplane(pts, normal));
  };

  /* Faster exact volume: the slice's facets are the polytope's facets cut by the plane, so the volume is a
     sum of pyramids from the slice centroid over each cut facet. Agrees with sliceVolume (tested). */
  N.sliceVolumeFast = (P, L, u, s) => {
    const pts = N.crossingPoints(P.verts, L.faces[1], u, s);
    if (pts.length < P.n) return { volume: 0, vertices: pts.length };
    const B = N.complementBasis(u), inH = (p) => B.map((b) => N.dot(b, p));
    const c = N.mean(pts), m = P.n - 1;
    if (!L.facetEdges) L.facetEdges = L.facets.map((f) => { const ids = new Set(f.ids); return L.faces[1].filter(([a, b]) => ids.has(a) && ids.has(b)); });
    let vol = 0;
    L.facets.forEach((f, i) => {
      const fp = N.crossingPoints(P.verts, L.facetEdges[i], u, s);
      if (fp.length < m) return;
      const mv = N.sub(f.normal, N.scale(u, N.dot(f.normal, u))), mn = N.norm(mv);
      if (mn < 1e-12) return;
      const h = Math.abs(N.dot(f.normal, c) - f.offset) / mn;
      const mh = N.normalize(inH(mv));
      const local = N.toHyperplane(fp.map(inH), mh);
      vol += (h / m) * (m === 1 ? 1 : N.hullVolume(local));
    });
    return { volume: vol, vertices: pts.length };
  };

  const fact = (k) => (k <= 1 ? 1 : k * fact(k - 1));
  const binom = (n, k) => fact(n) / (fact(k) * fact(n - k));
  /* (n-1)-volume of {x in [0,1]^n : sum x = t}: sqrt(n) times the Irwin-Hall density. */
  N.cubeSliceAnalytic = (n, t) => {
    let s = 0;
    for (let k = 0; k <= Math.floor(t) && k <= n; k++) s += (k % 2 ? -1 : 1) * binom(n, k) * Math.pow(t - k, n - 1);
    return (Math.sqrt(n) * s) / fact(n - 1);
  };
  /* (n-1)-volume of the corner simplex {x >= 0, sum x <= 1} cut at x1 = t. */
  N.simplexSliceAnalytic = (n, t) => Math.pow(1 - t, n - 1) / fact(n - 1);

  if (typeof module !== "undefined" && module.exports) module.exports = N;
})(typeof globalThis !== "undefined" ? globalThis : this);

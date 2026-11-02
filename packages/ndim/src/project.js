// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim/project: orthographic, repeated perspective, stereographic and Schlegel projections.
   Every view states its lens (what it keeps, what it loses) and one distortion number. */
(function (g) {
  "use strict";
  const N = (g.NDim = g.NDim || {});

  /* Keep the first k coordinates. */
  N.orthographic = (p, k) => p.slice(0, k);
  /* Divide by depth along the last axis, one axis at a time, from n down to k. Camera at distance d. */
  N.perspective = (p, k, d = 3) => {
    let q = p.slice();
    while (q.length > k) {
      const w = q[q.length - 1], f = d / Math.max(1e-3, d - w);
      q = q.slice(0, -1).map((x) => x * f);
    }
    return q;
  };
  /* From the unit sphere S^(n-1) minus its north pole (last axis) onto R^(n-1). */
  N.stereographic = (p) => { const s = 1 / Math.max(1e-9, 1 - p[p.length - 1]); return p.slice(0, -1).map((x) => x * s); };

  N.LENSES = {
    orthographic: { keeps: ["parallel lines", "ratios along a line", "the kept coordinates exactly"], loses: ["the dropped axes: points that differ only there land on top of each other"] },
    perspective: { keeps: ["straight lines", "which edges meet"], loses: ["lengths", "parallel lines", "the far side shrinks, the near side swells"] },
    stereographic: { keeps: ["angles where curves cross (conformal)", "circles stay circles or lines"], loses: ["lengths and areas, which blow up near the pole", "straight edges, which bend into arcs"] },
    schlegel: { keeps: ["which faces touch: no edge crosses another", "one cell becomes the frame around the rest"], loses: ["lengths and angles", "the far cells shrink toward the centre"] },
    petrie: { keeps: ["the h-fold turn of the Coxeter element, as a rotation of the plane"], loses: ["every other direction: many vertices overlap"] },
    slice: { keeps: ["exact lengths, angles and volume inside the cutting hyperplane"], loses: ["everything off the hyperplane"] },
  };
  N.DISTORTION_NAME = "edge spread: (longest - shortest) / longest of projected over true edge length; 0 means every edge scales alike";

  function project(p, name, k, opt) {
    if (name === "orthographic") return N.orthographic(p, k);
    if (name === "perspective") return N.perspective(p, k, opt.d);
    if (name === "stereographic") { let q = N.normalize(p); while (q.length > k) q = N.stereographic(N.normalize(q)); return q; }
    throw new Error("unknown projection " + name);
  }
  /* Project a polytope's vertices; report the lens and the edge spread. */
  N.view = (P, name, k, opt = {}) => {
    const verts = name === "stereographic" ? P.verts.map(N.normalize) : P.verts;
    const pts = verts.map((p) => project(opt.R ? N.matVec(opt.R, p) : p, name, k, opt));
    const ratios = P.edges.map(([a, b]) => N.dist(pts[a], pts[b]) / N.dist(verts[a], verts[b]));
    const hi = Math.max(...ratios), lo = Math.min(...ratios);
    return { pts, lens: Object.assign({ name }, N.LENSES[name]), distortion: { name: N.DISTORTION_NAME, value: hi > 0 ? (hi - lo) / hi : 0, lo, hi } };
  };

  /* Image of the angle between tangent vectors u and v at p on the sphere, by central differences. */
  N.imageAngle = (f, p, u, v, h = 1e-5) => {
    const on = (x) => N.normalize(x);
    const D = (w) => N.scale(N.sub(f(on(N.add(p, N.scale(w, h)))), f(on(N.sub(p, N.scale(w, h))))), 1 / (2 * h));
    return N.angle(D(u), D(v));
  };
  N.tangentPair = (p, rng) => {
    const t = () => { const r = Array.from({ length: p.length }, () => rng() * 2 - 1); return N.sub(r, N.scale(p, N.dot(r, p))); };
    return [t(), t()];
  };

  /* Schlegel diagram: look through facet fi from just outside it; returns (n-1)-D points in that facet. */
  /* Schlegel diagram: look through facet fi from just outside it; returns (n-1)-D points in that facet.
     The eye sits along the facet's normal, at 90% of the way to the nearest neighbouring facet's
     hyperplane (and at most 2 radii out), so it is outside this facet only and nothing overlaps. */
  N.schlegel = (P, L, fi = 0, eps) => {
    const f = L.facets[fi], nrm = f.normal;
    const centre = N.mean(f.ids.map((i) => P.verts[i])), rc = N.norm(centre);
    if (eps === undefined) {
      let lim = 2;
      L.facets.forEach((g, j) => { const a = N.dot(g.normal, nrm); if (j !== fi && a > 1e-9) lim = Math.min(lim, (g.offset - N.dot(g.normal, centre)) / (a * rc)); });
      eps = 0.9 * lim;
    }
    const E = N.add(centre, N.scale(nrm, eps * rc));
    const nE = N.dot(nrm, E);
    const pts = P.verts.map((v) => { const t = (f.offset - nE) / (N.dot(nrm, v) - nE); return N.add(E, N.scale(N.sub(v, E), t)); });
    return { pts: N.toHyperplane(pts.map((p) => N.sub(p, centre)), nrm), lens: Object.assign({ name: "schlegel" }, N.LENSES.schlegel), facet: f.ids, eye: eps };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = N;
})(typeof globalThis !== "undefined" ? globalThis : this);

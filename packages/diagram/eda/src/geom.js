// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/geom: copper shapes as rounded convex sets, a point list (1 point = disc, 2 = capsule, 3+ = convex
   polygon) grown by a radius r. Exact distance between two shapes, containment, and a rasteriser that decides each
   pixel by the same distance function, so the board view and the DRC read one geometry. Millimetres, y up. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});

  const segPt = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    let t = L > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const segsCross = (a, b, c, d) => {
    const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  const segSeg = (a, b, c, d) => (segsCross(a, b, c, d) ? 0 : Math.min(segPt(a, c, d), segPt(b, c, d), segPt(c, a, b), segPt(d, a, b)));
  /* p inside convex polygon P (either winding) */
  const inPoly = (p, P) => {
    if (P.length < 3) return false;
    let s = 0;
    for (let i = 0; i < P.length; i++) { const c = cross(P[i], P[(i + 1) % P.length], p); if (c !== 0) { if (s === 0) s = Math.sign(c); else if (Math.sign(c) !== s) return false; } }
    return true;
  };
  const edges = (P) => (P.length === 1 ? [[P[0], P[0]]] : P.length === 2 ? [[P[0], P[1]]] : P.map((p, i) => [p, P[(i + 1) % P.length]]));
  E.segPt = segPt;

  /* distance between the cores (point sets), 0 if they overlap */
  E.coreDist = (A, B) => {
    if (A.length >= 3 && B.some((p) => inPoly(p, A))) return 0;
    if (B.length >= 3 && A.some((p) => inPoly(p, B))) return 0;
    let d = Infinity;
    for (const [a, b] of edges(A)) for (const [c, e] of edges(B)) { d = Math.min(d, segSeg(a, b, c, e)); if (d === 0) return 0; }
    return d;
  };
  /* edge-to-edge distance between two rounded shapes; negative means they overlap */
  E.dist = (s, t) => E.coreDist(s.pts, t.pts) - s.r - t.r;
  E.ptDist = (p, s) => (s.pts.length >= 3 && inPoly(p, s.pts) ? 0 : Math.min(...edges(s.pts).map(([a, b]) => segPt(p, a, b)))) - s.r;
  E.bbox = (s) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of s.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    return [x0 - s.r, y0 - s.r, x1 + s.r, y1 + s.r];
  };

  /* pad shapes: rect (w, h) at a centre, rotated by a multiple of 90 degrees; circle; oval (stadium along its long side) */
  E.padShape = (pad, at, rot = 0) => {
    const q = ((Math.round(rot / 90) % 4) + 4) % 4, sw = q % 2 ? pad.h : pad.w, sh = q % 2 ? pad.w : pad.h;
    if (pad.shape === "circle") return { pts: [at], r: pad.w / 2 };
    if (pad.shape === "oval") { const r = Math.min(sw, sh) / 2, L = Math.max(sw, sh) / 2 - r; return sw >= sh ? { pts: [[at[0] - L, at[1]], [at[0] + L, at[1]]], r } : { pts: [[at[0], at[1] - L], [at[0], at[1] + L]], r }; }
    const x0 = at[0] - sw / 2, x1 = at[0] + sw / 2, y0 = at[1] - sh / 2, y1 = at[1] + sh / 2;
    return { pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], r: 0 };
  };
  E.rotPt = (p, rot) => { const q = ((Math.round(rot / 90) % 4) + 4) % 4; return q === 0 ? p : q === 1 ? [-p[1], p[0]] : q === 2 ? [-p[0], -p[1]] : [p[1], -p[0]]; };

  /* rasterise shapes: a pixel is copper when its centre lies within the shape. ppm pixels per millimetre,
     window [x0, y0, x1, y1] in mm; row 0 is the top (largest y). */
  E.rasterShapes = (shapes, win, ppm) => {
    const W = Math.round((win[2] - win[0]) * ppm), H = Math.round((win[3] - win[1]) * ppm), m = new Uint8Array(W * H);
    for (const s of shapes) {
      const b = E.bbox(s), i0 = Math.max(0, Math.floor((b[0] - win[0]) * ppm)), i1 = Math.min(W - 1, Math.ceil((b[2] - win[0]) * ppm));
      const j0 = Math.max(0, Math.floor((win[3] - b[3]) * ppm)), j1 = Math.min(H - 1, Math.ceil((win[3] - b[1]) * ppm));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (m[j * W + i]) continue;
        const p = [win[0] + (i + 0.5) / ppm, win[3] - (j + 0.5) / ppm];
        if (E.ptDist(p, s) <= 0) m[j * W + i] = 1;
      }
    }
    return { W, H, m, win, ppm };
  };

  /* compare two masks: XOR count, and "thick" XOR pixels whose 3 x 3 neighbourhood is all XOR (not an edge effect) */
  E.compareMasks = (A, B) => {
    const { W, H } = A, x = new Uint8Array(W * H);
    let nx = 0, na = 0, thick = 0;
    for (let k = 0; k < W * H; k++) { x[k] = A.m[k] !== B.m[k] ? 1 : 0; nx += x[k]; na += A.m[k]; }
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      let all = 1;
      for (let dj = -1; dj <= 1 && all; dj++) for (let di = -1; di <= 1; di++) if (!x[(j + dj) * W + i + di]) { all = 0; break; }
      thick += all;
    }
    return { xor: nx, copper: na, frac: nx / Math.max(1, na), thick, mask: x };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);

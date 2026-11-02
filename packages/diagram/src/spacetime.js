// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/spacetime: time as a fourth axis. A diagram supplies 4D points (x, y, z, t) and edges; world-line
   edges are flagged timelike. ndim turns the object in any of its six planes (xy xz xt yz yt zt), projects it
   to 3D through a lens that states what it keeps and loses, and slices it with the hyperplane t = t0: the
   slice is the instant, the same state the time view shows at that moment. Needs window.NDim (ndim/src). */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const N = () => g.NDim;

  /* Normalise each axis to [-1, 1] about its centre; keep the scale so t0 maps back to data time. */
  D.spacetimeFit = (st) => {
    const lo = [0, 1, 2, 3].map((k) => Math.min(...st.verts.map((p) => p[k]))), hi = [0, 1, 2, 3].map((k) => Math.max(...st.verts.map((p) => p[k])));
    const mid = lo.map((x, k) => (x + hi[k]) / 2), half = lo.map((x, k) => Math.max(1e-9, (hi[k] - x) / 2));
    const verts = st.verts.map((p) => p.map((x, k) => (x - mid[k]) / half[k]));
    return Object.assign({}, st, { verts, lo, hi, mid, half, tTo: (t) => (t - mid[3]) / half[3] });
  };

  /* Project every vertex: 4D turn R, lens to 3D, then a fixed 3D camera to pixels. */
  D.spacetimeProject = (F, angles, lens, w, h) => {
    const n = N(), R = n.rotationFromAngles(4, angles);
    const cam = D.camera({ yaw: 0.5, pitch: 0.35, dist: 5.2, target: [0, 0, 0], fov: 0.62 }, w, h);
    const to3 = (q) => (lens === "orthographic" ? n.orthographic(q, 3) : n.perspective(q, 3, 3.2));
    const pts = F.verts.map((p) => cam.toScreen(to3(n.matVec(R, p))));
    return { R, cam, to3, pts, screen: (p) => cam.toScreen(to3(n.matVec(R, p))) };
  };

  /* The instant t0 (data units): crossings of the timelike edges with t = t0, in normalised 4D. */
  D.spacetimeSlice = (F, t0) => {
    const n = N(), parts = [], pts = [], tn = F.tTo(t0);
    F.edges.forEach((e, i) => {
      if (!F.timelike[i]) return;
      for (const p of n.crossingPoints([F.verts[e[0]], F.verts[e[1]]], [[0, 1]], [0, 0, 0, 1], tn)) { pts.push(p); parts.push(F.edgePart ? F.edgePart[i] : -1); }
    });
    return { pts, parts };
  };

  /* H(X | Y): 4D vertices coded on a 16-step grid per axis, against the pixel (on a 4 px grid) they land on. */
  D.spacetimeBits = (F, P) => {
    const H = g.Perceive && g.Perceive.entropy;
    if (!H) return null;
    const xs = F.verts.map((p) => p.map((x) => Math.floor((x + 1) * 8)).join(","));
    const ys = P.pts.map((s) => Math.floor(s[0] / 4) + "," + Math.floor(s[1] / 4));
    const hy = H(ys), hxy = H(xs.map((x, i) => x + "#" + ys[i]));
    return { source: H(xs), lost: Math.max(0, hxy - hy) };
  };

  D.spacetimeLens = (lens) => {
    const L = (N() && N().LENSES[lens]) || { keeps: [], loses: [] }, S = N() && N().LENSES.slice;
    return { keeps: L.keeps.concat(S ? ["the slice: " + S.keeps[0]] : []), drops: L.loses.concat(S ? ["the slice: " + S.loses[0]] : []) };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);

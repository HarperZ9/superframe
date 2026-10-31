// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/section: cut a closed mesh with a plane n . x = d. The part on the side n . x > d is removed. The cut
   leaves loops on the plane; each loop is wound counter-clockwise seen from +n when it bounds material and
   clockwise when it bounds a cavity, so the signed shoelace sum is the cut area (tested against analytic
   areas). The engineering drawing hatches these faces. Also: clip a triangle to the kept side. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const v = D.v3;

  /* An orthonormal pair (u, w) in the plane with u x w = n. */
  D.planeBasis = (n) => {
    const a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = v.norm(v.cross(a, n)), w = v.cross(n, u);
    return [u, w];
  };

  function crossing(a, b, sa, sb) {
    /* compute from the lexicographically smaller end, so both triangles sharing the edge get the same bits */
    const swap = a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])));
    if (swap) { [a, b] = [b, a]; [sa, sb] = [sb, sa]; }
    const t = sa / (sa - sb);
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
  }
  const key = (p) => p.map((x) => Math.round(x * 1e7)).join(",");

  /* Oriented segments where the plane crosses the triangles. */
  D.cutSegments = (pos, n, d) => {
    const segs = [];
    for (let i = 0; i < pos.length; i += 9) {
      const P = [[pos[i], pos[i + 1], pos[i + 2]], [pos[i + 3], pos[i + 4], pos[i + 5]], [pos[i + 6], pos[i + 7], pos[i + 8]]];
      const s = P.map((p) => v.dot(n, p) - d), out = s.map((x) => x > 0);
      if (out[0] === out[1] && out[1] === out[2]) continue;
      const pts = [];
      for (let k = 0; k < 3; k++) { const j = (k + 1) % 3; if (out[k] !== out[j]) pts.push(crossing(P[k], P[j], s[k], s[j])); }
      if (pts.length !== 2 || key(pts[0]) === key(pts[1])) continue;
      const tn = v.cross(v.sub(P[1], P[0]), v.sub(P[2], P[0])), dir = v.cross(n, tn);
      segs.push(v.dot(v.sub(pts[1], pts[0]), dir) >= 0 ? pts : [pts[1], pts[0]]);
    }
    return segs;
  };

  /* Chain segments head to tail into closed loops. */
  D.chain = (segs) => {
    const from = new Map();
    segs.forEach((s, i) => { const k = key(s[0]); if (!from.has(k)) from.set(k, []); from.get(k).push(i); });
    const used = new Uint8Array(segs.length), loops = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      const loop = [segs[i][0]];
      let cur = i, guard = 0;
      while (!used[cur] && guard++ < 100000) {
        used[cur] = 1;
        const end = segs[cur][1];
        const next = (from.get(key(end)) || []).find((j) => !used[j]);
        if (next === undefined) break;
        loop.push(end); cur = next;
      }
      if (loop.length >= 3) loops.push(loop);
    }
    return loops;
  };

  /* Loops in plane coordinates and the signed area. */
  D.section = (pos, n, d) => {
    n = v.norm(n);
    const loops = D.chain(D.cutSegments(pos, n, d)), [u, w] = D.planeBasis(n);
    let area = 0;
    const flat = loops.map((L) => L.map((p) => [v.dot(p, u), v.dot(p, w)]));
    for (const f of flat) area += D.polyArea(f);
    return { loops, flat, area };
  };

  /* Clip one triangle to the kept side (n . x <= d); returns 0, 1 or 2 triangles as point triples. */
  D.clipTri = (a, b, c, n, d) => {
    const P = [a, b, c], s = P.map((p) => v.dot(n, p) - d);
    if (s[0] <= 0 && s[1] <= 0 && s[2] <= 0) return [P];
    if (s[0] > 0 && s[1] > 0 && s[2] > 0) return [];
    const poly = [];
    for (let k = 0; k < 3; k++) {
      const j = (k + 1) % 3;
      if (s[k] <= 0) poly.push(P[k]);
      if ((s[k] > 0) !== (s[j] > 0)) poly.push(crossing(P[k], P[j], s[k], s[j]));
    }
    const out = [];
    for (let k = 1; k + 1 < poly.length; k++) out.push([poly[0], poly[k], poly[k + 1]]);
    return out;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);

// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/mesh: closed triangle meshes for the primitives a part is built from. Every mesh winds counter-
   clockwise seen from outside, so the signed volume is positive (tested) and the cutting plane can orient its
   loops. A cavity is a second closed mesh wound inward, so a shell is "outer box plus inverted inner box".
   Primitives: box, cyl, tube, cone, sphere, extrude (any simple polygon), revolve (any profile), shell, group. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});

  function Mesh() { return { pos: [], nrm: [] }; }   /* flat lists: 9 numbers per triangle */
  function tri(m, a, b, c, na, nb, nc) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-14) return;
    const f = [n[0] / l, n[1] / l, n[2] / l];
    m.pos.push(...a, ...b, ...c);
    m.nrm.push(...(na || f), ...(nb || f), ...(nc || f));
  }

  /* Surface of revolution about y. The profile is a list of [r, y] with the solid on its left (counter-
     clockwise in the r-y plane). Open profiles must start and end on the axis; closed ones (closed: true) wrap. */
  D.revolve = (profile, seg = 32, closed = false) => {
    const m = Mesh(), P = closed ? profile.concat([profile[0]]) : profile;
    for (let k = 0; k + 1 < P.length; k++) {
      const [r0, y0] = P[k], [r1, y1] = P[k + 1], dr = r1 - r0, dy = y1 - y0, l = Math.hypot(dr, dy) || 1;
      const nr = dy / l, ny = -dr / l;
      for (let i = 0; i < seg; i++) {
        const a0 = (2 * Math.PI * i) / seg, a1 = (2 * Math.PI * (i + 1)) / seg;
        const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const A = [r0 * c0, y0, r0 * s0], B = [r1 * c0, y1, r1 * s0], C = [r1 * c1, y1, r1 * s1], E = [r0 * c1, y0, r0 * s1];
        const n0 = [nr * c0, ny, nr * s0], n1 = [nr * c1, ny, nr * s1];
        tri(m, A, B, C, n0, n0, n1);
        tri(m, A, C, E, n0, n1, n1);
      }
    }
    return m;
  };

  D.polyArea = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

  /* Ear clipping for a simple polygon given counter-clockwise; returns index triples. */
  D.earClip = (p) => {
    const idx = p.map((_, i) => i), out = [];
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const inside = (q, a, b, c) => cross(a, b, q) >= 0 && cross(b, c, q) >= 0 && cross(c, a, q) >= 0;
    let guard = 0;
    while (idx.length > 3 && guard++ < 10000) {
      let cut = false;
      for (let i = 0; i < idx.length; i++) {
        const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
        const a = p[ia], b = p[ib], c = p[ic];
        if (cross(a, b, c) <= 1e-12) continue;
        if (idx.some((j) => j !== ia && j !== ib && j !== ic && inside(p[j], a, b, c))) continue;
        out.push([ia, ib, ic]); idx.splice(i, 1); cut = true; break;
      }
      if (!cut) break;
    }
    if (idx.length === 3) out.push(idx.slice());
    return out;
  };

  /* A simple polygon in x-y, extruded along z from -depth/2 to +depth/2. */
  D.extrude = (poly, depth) => {
    let p = poly.map((q) => q.slice());
    if (D.polyArea(p) < 0) p.reverse();
    const m = Mesh(), h = depth / 2;
    for (let k = 0; k < p.length; k++) {
      const a = p[k], b = p[(k + 1) % p.length];
      tri(m, [a[0], a[1], -h], [b[0], b[1], -h], [b[0], b[1], h]);
      tri(m, [a[0], a[1], -h], [b[0], b[1], h], [a[0], a[1], h]);
    }
    for (const [i, j, k] of D.earClip(p)) {
      tri(m, [p[i][0], p[i][1], h], [p[j][0], p[j][1], h], [p[k][0], p[k][1], h]);
      tri(m, [p[i][0], p[i][1], -h], [p[k][0], p[k][1], -h], [p[j][0], p[j][1], -h]);
    }
    return m;
  };

  function transform(m, R, t) {
    const o = Mesh();
    for (let i = 0; i < m.pos.length; i += 3) {
      const p = D.m3v(R, [m.pos[i], m.pos[i + 1], m.pos[i + 2]]), n = D.m3v(R, [m.nrm[i], m.nrm[i + 1], m.nrm[i + 2]]);
      o.pos.push(p[0] + t[0], p[1] + t[1], p[2] + t[2]); o.nrm.push(n[0], n[1], n[2]);
    }
    return o;
  }
  function invert(m) {
    const o = Mesh();
    for (let i = 0; i < m.pos.length; i += 9) {
      o.pos.push(...m.pos.slice(i, i + 3), ...m.pos.slice(i + 6, i + 9), ...m.pos.slice(i + 3, i + 6));
      const n = m.nrm.slice(i, i + 9).map((x) => -x);
      o.nrm.push(...n.slice(0, 3), ...n.slice(6, 9), ...n.slice(3, 6));
    }
    return o;
  }
  function merge(ms) { const o = Mesh(); for (const m of ms) { o.pos.push(...m.pos); o.nrm.push(...m.nrm); } return o; }
  const AXIS = { y: [0, 0, 0], x: [0, 0, -90], z: [90, 0, 0] };
  const rect = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];

  /* One geometry record to a mesh in the part's own frame. */
  D.build = (gm) => {
    const seg = gm.seg || 32, ax = D.euler(AXIS[gm.axis || "y"]);
    let m;
    switch (gm.t) {
      case "box": m = D.extrude(rect(gm.size[0], gm.size[1]), gm.size[2]); break;
      case "cyl": m = transform(D.revolve([[0, -gm.h / 2], [gm.r, -gm.h / 2], [gm.r, gm.h / 2], [0, gm.h / 2]], seg), ax, [0, 0, 0]); break;
      case "tube": m = transform(D.revolve([[gm.r0, -gm.h / 2], [gm.r, -gm.h / 2], [gm.r, gm.h / 2], [gm.r0, gm.h / 2]], seg, true), ax, [0, 0, 0]); break;
      case "cone": m = transform(D.revolve([[0, -gm.h / 2], [gm.r, -gm.h / 2], [gm.r2 || 0, gm.h / 2], [0, gm.h / 2]].filter((q, i) => i !== 2 || q[0] > 0), seg), ax, [0, 0, 0]); break;
      case "sphere": {
        const n = gm.rings || 16, prof = [];
        for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (Math.PI * i) / n; prof.push([Math.max(0, gm.r * Math.cos(a)) * (i === 0 || i === n ? 0 : 1), gm.r * Math.sin(a)]); }
        m = D.revolve(prof, seg); break;
      }
      case "revolve": m = transform(D.revolve(gm.profile, seg, !!gm.closed), ax, [0, 0, 0]); break;
      case "extrude": m = D.extrude(gm.profile, gm.depth); break;
      case "shell": {
        const w = gm.wall, s = gm.size;
        m = merge([D.extrude(rect(s[0], s[1]), s[2]), invert(D.extrude(rect(s[0] - 2 * w, s[1] - 2 * w), s[2] - 2 * w))]); break;
      }
      case "tray": m = D.tray(gm.size, gm.wall); break;
      case "group": m = merge(gm.items.map((it) => transform(D.build(it), D.euler(it.rot), it.pos || [0, 0, 0]))); break;
      default: throw new Error("unknown primitive " + gm.t);
    }
    return m;
  };
  D.transformMesh = transform;

  /* An open-top box (a cast enclosure body, a cup): one closed manifold, outer skin, rim, inner skin and floor,
     so it cuts and hatches as one solid with no seams. size [w, h, d], wall t; the open side faces +y. */
  D.tray = (s, t) => {
    const m = Mesh(), [w, h, d] = s.map((x) => x / 2), xi = w - t, zi = d - t, yf = -h + t;
    const quad = (a, b, c, e, want) => {
      const n = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
      if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { tri(m, a, e, c); tri(m, a, c, b); } else { tri(m, a, b, c); tri(m, a, c, e); }
    };
    quad([-w, -h, -d], [w, -h, -d], [w, -h, d], [-w, -h, d], [0, -1, 0]);
    quad([w, -h, -d], [w, h, -d], [w, h, d], [w, -h, d], [1, 0, 0]);
    quad([-w, -h, -d], [-w, -h, d], [-w, h, d], [-w, h, -d], [-1, 0, 0]);
    quad([-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d], [0, 0, 1]);
    quad([-w, -h, -d], [-w, h, -d], [w, h, -d], [w, -h, -d], [0, 0, -1]);
    quad([-w, h, d], [w, h, d], [xi, h, zi], [-xi, h, zi], [0, 1, 0]);
    quad([-w, h, -d], [-xi, h, -zi], [xi, h, -zi], [w, h, -d], [0, 1, 0]);
    quad([w, h, -d], [xi, h, -zi], [xi, h, zi], [w, h, d], [0, 1, 0]);
    quad([-w, h, -d], [-w, h, d], [-xi, h, zi], [-xi, h, -zi], [0, 1, 0]);
    quad([xi, yf, -zi], [xi, h, -zi], [xi, h, zi], [xi, yf, zi], [-1, 0, 0]);
    quad([-xi, yf, -zi], [-xi, yf, zi], [-xi, h, zi], [-xi, h, -zi], [1, 0, 0]);
    quad([-xi, yf, zi], [xi, yf, zi], [xi, h, zi], [-xi, h, zi], [0, 0, -1]);
    quad([-xi, yf, -zi], [-xi, h, -zi], [xi, h, -zi], [xi, yf, -zi], [0, 0, 1]);
    quad([-xi, yf, -zi], [xi, yf, -zi], [xi, yf, zi], [-xi, yf, zi], [0, 1, 0]);
    return m;
  };

  /* Signed volume by the divergence theorem: sum of a . (b x c) / 6 over triangles. */
  D.meshVolume = (pos) => {
    let s = 0;
    for (let i = 0; i < pos.length; i += 9) {
      const ax = pos[i], ay = pos[i + 1], az = pos[i + 2], bx = pos[i + 3], by = pos[i + 4], bz = pos[i + 5], cx = pos[i + 6], cy = pos[i + 7], cz = pos[i + 8];
      s += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
    }
    return s / 6;
  };
  D.meshBox = (pos) => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i + k]); hi[k] = Math.max(hi[k], pos[i + k]); }
    return { lo, hi, mid: [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);

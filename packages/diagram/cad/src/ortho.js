// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/cad/ortho: orthographic views of the resolved model, as line work. For each view the part meshes are
   mapped to (u, v, depth), rasterised once by the engine's software z-buffer (raster.js) for visibility, and
   every feature edge (a sharp crease, an open boundary, or a silhouette in this view) is sampled against that
   buffer and split into visible and hidden runs. Third-angle placement (ASME Y14.3): top above front, right
   side to the right. Units stay model millimetres; the sheet applies the scale. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const C = (D.CAD = D.CAD || {});
  const S2 = Math.SQRT2, S3 = Math.sqrt(3), S6 = Math.sqrt(6);

  /* map: model point to [u (sheet right), v (sheet up), depth (larger is farther)]; dir: line of sight. */
  C.VIEWS = {
    front: { label: "FRONT", map: (p) => [p[0], p[1], -p[2]], dir: [0, 0, -1] },
    top: { label: "TOP", map: (p) => [p[0], -p[2], -p[1]], dir: [0, -1, 0] },
    right: { label: "RIGHT SIDE", map: (p) => [-p[2], p[1], -p[0]], dir: [-1, 0, 0] },
    iso: { label: "ISOMETRIC", map: (p) => [(p[0] - p[2]) / S2, (-p[0] + 2 * p[1] - p[2]) / S6, -(p[0] + p[1] + p[2]) / S3], dir: [-1 / S3, -1 / S3, -1 / S3] },
  };
  const CREASE = Math.cos((24 * Math.PI) / 180);
  const key = (a) => Math.round(a[0] * 1e5) + "," + Math.round(a[1] * 1e5) + "," + Math.round(a[2] * 1e5);

  /* Feature edges of one triangle soup for a line of sight. */
  C.featureEdges = (pos, dir) => {
    const E = new Map();
    for (let i = 0; i < pos.length; i += 9) {
      const P = [[pos[i], pos[i + 1], pos[i + 2]], [pos[i + 3], pos[i + 4], pos[i + 5]], [pos[i + 6], pos[i + 7], pos[i + 8]]];
      const n = D.v3.norm(D.v3.cross(D.v3.sub(P[1], P[0]), D.v3.sub(P[2], P[0])));
      if (!D.v3.len(n)) continue;
      for (let k = 0; k < 3; k++) {
        const a = P[k], b = P[(k + 1) % 3], ka = key(a), kb = key(b);
        if (ka === kb) continue;
        const kk = ka < kb ? ka + "|" + kb : kb + "|" + ka;
        let e = E.get(kk);
        if (!e) E.set(kk, (e = { a, b, n: [] }));
        e.n.push(n);
      }
    }
    const out = [];
    for (const e of E.values()) {
      if (e.n.length !== 2) { out.push([e.a, e.b]); continue; }
      const [n1, n2] = e.n, c = D.v3.dot(n1, n2);
      if (c < CREASE) { out.push([e.a, e.b]); continue; }
      const s1 = D.v3.dot(n1, dir), s2 = D.v3.dot(n2, dir);
      if ((s1 < 0) !== (s2 < 0) && Math.abs(s1 - s2) > 1e-9) out.push([e.a, e.b]);
    }
    return out;
  };

  /* Join 2D segments that share ends into polylines. */
  C.chain2 = (segs) => {
    const k2 = (p) => Math.round(p[0] * 1e4) + "," + Math.round(p[1] * 1e4), ends = new Map(), used = new Uint8Array(segs.length), out = [];
    segs.forEach((s, i) => { for (const e of [0, 1]) { const k = k2(s[e]); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
    const next = (p) => (ends.get(k2(p)) || []).find((j) => !used[j]);
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      const line = [segs[i][0], segs[i][1]];
      for (const back of [false, true]) {
        for (let guard = 0; guard < 100000; guard++) {
          const end = back ? line[0] : line[line.length - 1], j = next(end);
          if (j === undefined) break;
          used[j] = 1;
          const s = segs[j], far = k2(s[0]) === k2(end) ? s[1] : s[0];
          if (back) line.unshift(far); else line.push(far);
        }
      }
      out.push(line);
    }
    return out;
  };

  /* One view. opt: { cut: { n, d } keeps n . x <= d, hidden: true | [part ids], res: pixels on the long side }.
     Returns per part: visible and hidden polylines in (u, v), the part's (u, v) box, and the id buffer. */
  C.view = (R, name, opt = {}) => {
    const V = C.VIEWS[name], parts = R.B.parts.filter((p) => !(opt.skip || []).includes(p.id));
    const mapped = parts.map((p) => {
      let pos = R.mesh(p.id).pos;
      if (opt.cut) {
        const out = [], n = opt.cut.n, d = opt.cut.d;
        for (let i = 0; i < pos.length; i += 9) for (const t of D.clipTri([pos[i], pos[i + 1], pos[i + 2]], [pos[i + 3], pos[i + 4], pos[i + 5]], [pos[i + 6], pos[i + 7], pos[i + 8]], n, d)) out.push(...t[0], ...t[1], ...t[2]);
        pos = Float64Array.from(out);
      }
      const uvw = new Float64Array(pos.length);
      for (let i = 0; i < pos.length; i += 3) { const q = V.map([pos[i], pos[i + 1], pos[i + 2]]); uvw[i] = q[0]; uvw[i + 1] = q[1]; uvw[i + 2] = q[2]; }
      return { p, pos, uvw };
    }).filter((m) => m.pos.length);
    const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    const boxes = new Map();
    for (const m of mapped) {
      const b = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] };
      for (let i = 0; i < m.uvw.length; i += 3) for (let k = 0; k < 3; k++) { b.lo[k] = Math.min(b.lo[k], m.uvw[i + k]); b.hi[k] = Math.max(b.hi[k], m.uvw[i + k]); }
      boxes.set(m.p.id, b);
      for (let k = 0; k < 2; k++) { lo[k] = Math.min(lo[k], b.lo[k]); hi[k] = Math.max(hi[k], b.hi[k]); }
    }
    /* visibility buffer through the engine's own software raster, with an orthographic camera */
    const N = opt.res || 720, span = Math.max(hi[0] - lo[0], hi[1] - lo[1]) || 1, px = span / N;
    const W = Math.ceil((hi[0] - lo[0]) / px) + 3, H = Math.ceil((hi[1] - lo[1]) / px) + 3;
    const toPix = (q) => [(q[0] - lo[0]) / px + 1, H - 1 - ((q[1] - lo[1]) / px + 1)];
    const tris = [], triPart = [];
    mapped.forEach((m, i) => { for (let k = 0; k < m.uvw.length; k++) tris.push(m.uvw[k]); for (let k = 0; k < m.uvw.length / 9; k++) triPart.push(i); });
    const cam = { w: W, h: H, eye: [0, 0, -1e9], toScreen: (q) => { const s = toPix(q); return [s[0], s[1], q[2], 1]; } };
    const style = mapped.map(() => ({ rgb: [0, 0, 0], alpha: 1, emit: 0 }));
    const Rz = D.raster({ tris: Float64Array.from(tris), triPart: Int32Array.from(triPart), style, caps: [], lines: [], points: [] }, cam, { bg: [1, 1, 1] });
    const zmax = (x, y) => {
      let m = -Infinity;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const X = x + i, Y = y + j; if (X < 0 || Y < 0 || X >= W || Y >= H) return Infinity; m = Math.max(m, Rz.depth[Y * W + X]); }
      return m;
    };
    const res = new Map();
    for (const m of mapped) {
      const wantHidden = opt.hidden === true || (Array.isArray(opt.hidden) && opt.hidden.includes(m.p.id));
      const vis = [], hid = [];
      for (const [a, b] of C.featureEdges(m.pos, V.dir)) {
        const A = V.map(a), Bq = V.map(b), len = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]);
        if (len < 1e-9) continue;
        const n = Math.max(2, Math.ceil(len / px) + 1);
        let state = null, start = null;
        for (let i = 0; i <= n; i++) {
          const t = i / n, q = [A[0] + (Bq[0] - A[0]) * t, A[1] + (Bq[1] - A[1]) * t, A[2] + (Bq[2] - A[2]) * t], s = toPix(q);
          const ok = q[2] <= zmax(Math.floor(s[0]), Math.floor(s[1])) + 1.5 * px;
          if (state === null) { state = ok; start = [q[0], q[1]]; continue; }
          if (ok !== state || i === n) {
            const end = [q[0], q[1]];
            (state ? vis : hid).push([start, end]);
            state = ok; start = end;
          }
        }
      }
      const uniq = new Map();
      for (let i = 0; i < m.uvw.length; i += 3) uniq.set(Math.round(m.uvw[i] * 1e6) + "," + Math.round(m.uvw[i + 1] * 1e6), [m.uvw[i], m.uvw[i + 1]]);
      res.set(m.p.id, { vis: C.chain2(vis), hid: wantHidden ? C.chain2(hid) : [], box: boxes.get(m.p.id), pts: [...uniq.values()] });
    }
    return { name, label: V.label, parts: res, lo, hi, raster: { W, H, px, lo, id: Rz.id, partIds: mapped.map((m) => m.p.id), toPix } };
  };

  /* Where a part shows in a view: the median of its visible pixels, in (u, v), or null. */
  C.visiblePoint = (VW, pid) => {
    const r = VW.raster, k = r.partIds.indexOf(pid);
    if (k < 0) return null;
    const xs = [], ys = [];
    for (let i = 0; i < r.id.length; i++) if (r.id[i] === k) { xs.push(i % r.W); ys.push((i / r.W) | 0); }
    if (xs.length < 3) return null;
    const pick = Math.floor(xs.length / 2), x = xs[pick], y = ys[pick];
    return { uv: [r.lo[0] + (x - 1 + 0.5) * r.px, r.lo[1] + (r.H - 1 - y - 1 + 0.5) * r.px], count: xs.length };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = C;
})(typeof globalThis !== "undefined" ? globalThis : this);

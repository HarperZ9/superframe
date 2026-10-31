// SPDX-License-Identifier: FSL-1.1-MIT
import { segD } from "./plane.js";
// ======================================================================= Copper primitives and distance
export function prims(d, l) {
  const out = [];
  d.tracks.forEach((t, i) => {
    if (t.l === l)
      out.push({
        k: "c",
        x1: t.x1,
        y1: t.y1,
        x2: t.x2,
        y2: t.y2,
        r: t.w / 2,
        net: t.net,
        id: "t" + i,
        what: "track",
      });
  });
  d.vias.forEach((v, i) =>
    out.push({
      k: "c",
      x1: v.x,
      y1: v.y,
      x2: v.x,
      y2: v.y,
      r: v.pad / 2,
      net: v.net,
      id: "v" + i,
      what: "via",
    })
  );
  for (const p of d.parts)
    for (const q of p.pads) {
      if (l !== 0 && !q.th) continue;
      if (q.round)
        out.push({
          k: "c",
          x1: q.x,
          y1: q.y,
          x2: q.x,
          y2: q.y,
          r: q.w / 2,
          net: q.net,
          id: p.ref + "." + q.pin,
          what: "pad",
        });
      else
        out.push({
          k: "r",
          x: q.x,
          y: q.y,
          hw: q.w / 2,
          hh: q.h / 2,
          net: q.net,
          id: p.ref + "." + q.pin,
          what: "pad",
        });
    }
  return out;
}
export function bbox(p) {
  return p.k === "c"
    ? [
        Math.min(p.x1, p.x2) - p.r,
        Math.min(p.y1, p.y2) - p.r,
        Math.max(p.x1, p.x2) + p.r,
        Math.max(p.y1, p.y2) + p.r,
      ]
    : [p.x - p.hw, p.y - p.hh, p.x + p.hw, p.y + p.hh];
}
export function ssD(a, b, c, e, f, g, h, i) {
  const o = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax),
    d1 = o(a, b, c, e, f, g),
    d2 = o(a, b, c, e, h, i),
    d3 = o(f, g, h, i, a, b),
    d4 = o(f, g, h, i, c, e);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(
    segD(a, b, f, g, h, i),
    segD(c, e, f, g, h, i),
    segD(f, g, a, b, c, e),
    segD(h, i, a, b, c, e)
  );
}
export function primDist(a, b) {
  if (a.k === "r" && b.k === "r") {
    const dx = Math.abs(a.x - b.x) - a.hw - b.hw,
      dy = Math.abs(a.y - b.y) - a.hh - b.hh;
    return dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
  }
  if (a.k === "c" && b.k === "c")
    return ssD(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1, b.x2, b.y2) - a.r - b.r;
  const c = a.k === "c" ? a : b,
    r = a.k === "c" ? b : a,
    l = r.x - r.hw,
    R = r.x + r.hw,
    B = r.y - r.hh,
    T = r.y + r.hh;
  if (
    (c.x1 >= l && c.x1 <= R && c.y1 >= B && c.y1 <= T) ||
    (c.x2 >= l && c.x2 <= R && c.y2 >= B && c.y2 <= T)
  )
    return -c.r;
  return (
    Math.min(
      ssD(c.x1, c.y1, c.x2, c.y2, l, B, R, B),
      ssD(c.x1, c.y1, c.x2, c.y2, R, B, R, T),
      ssD(c.x1, c.y1, c.x2, c.y2, R, T, l, T),
      ssD(c.x1, c.y1, c.x2, c.y2, l, T, l, B)
    ) - c.r
  );
}
export function sweep(P, gap, fn) {
  const S = P.map((p) => ({ p, b: bbox(p) })).sort((u, v) => u.b[0] - v.b[0]);
  for (let i = 0; i < S.length; i++) {
    const A = S[i];
    for (let j = i + 1; j < S.length; j++) {
      const B = S[j];
      if (B.b[0] > A.b[2] + gap) break;
      if (B.b[1] > A.b[3] + gap || B.b[3] < A.b[1] - gap) continue;
      fn(A.p, B.p);
    }
  }
}

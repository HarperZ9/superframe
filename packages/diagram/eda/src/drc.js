// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/drc: design-rule check on vector geometry, independent of the router's grid.
   Copper objects (pads, traces, vias, pour rectangles, net-tie bridges) are rounded convex shapes. Checks:
   clearance between different nets on a shared layer (a negative gap is a short), track width against the net
   class, annular ring and drill size, hole-to-hole gap, copper-to-edge, and connectivity: every net's pads must be
   one connected piece of copper (unrouted otherwise). A net tie may join its two nets only at its own footprint. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});

  E.copper = (B) => {
    const O = [], L = (side) => (side === "both" ? [0, 1] : [0]);
    for (const q of E.pads(B)) O.push({ kind: "pad", ref: q.P.ref, pin: q.pad.num, net: q.net, layers: L(q.pad.side), pts: q.shape.pts, r: q.shape.r, drill: q.pad.drill, dia: Math.min(q.pad.w, q.pad.h), at: q.at, tie: !!q.P.fp.tie });
    for (const s of B.traces) O.push({ kind: "trace", net: s.net, layers: [s.layer], pts: [s.a, s.b], r: s.w / 2, w: s.w });
    for (const v of B.vias) O.push({ kind: "via", net: v.net, layers: [0, 1], pts: [v.at], r: v.dia / 2, drill: v.drill, dia: v.dia, at: v.at });
    for (const pr of B.pourRects) { const [x0, y0, x1, y1] = pr.rect; O.push({ kind: "pour", net: pr.net, layers: [pr.layer], pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], r: 0 }); }
    for (const P of B.parts) if (P.bridge) O.push({ kind: "bridge", ref: P.ref, net: "TIE:" + P.ref, tieNets: Object.values(P.comp.pins), layers: [0], pts: [P.bridge.a, P.bridge.b], r: P.bridge.w / 2, tie: true });
    O.forEach((o, i) => { o.i = i; o.bb = E.bbox(o); });
    return O;
  };

  /* candidate pairs from a uniform bucket grid */
  const pairs = (O, cell = 2) => {
    const H = new Map(), out = [];
    for (const o of O) for (let i = Math.floor(o.bb[0] / cell); i <= Math.floor(o.bb[2] / cell); i++) for (let j = Math.floor(o.bb[1] / cell); j <= Math.floor(o.bb[3] / cell); j++) { const k = i + "," + j; (H.get(k) || H.set(k, []).get(k)).push(o); }
    const seen = new Set();
    for (const list of H.values()) for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const x = list[a], y = list[b], k = x.i < y.i ? x.i * 1e6 + y.i : y.i * 1e6 + x.i;
      if (seen.has(k)) continue; seen.add(k);
      if (x.bb[0] > y.bb[2] + 1 || y.bb[0] > x.bb[2] + 1 || x.bb[1] > y.bb[3] + 1 || y.bb[1] > x.bb[3] + 1) continue;
      out.push([x, y]);
    }
    return out;
  };

  const tieOk = (x, y) => {
    const t = x.kind === "bridge" ? x : y.kind === "bridge" ? y : null;
    if (t) { const o = t === x ? y : x; return t.tieNets.includes(o.net); }
    const tp = x.kind === "pad" && x.tie ? x : y.kind === "pad" && y.tie ? y : null;
    if (tp) { const o = tp === x ? y : x, tied = B_TIE.get(tp.ref) || []; return tied.includes(o.net); }
    return false;
  };

  let B_TIE = new Map();
  E.drc = (B) => {
    B_TIE = new Map(B.parts.filter((P) => P.fp.tie).map((P) => [P.ref, Object.values(P.comp.pins)]));
    const O = E.copper(B), R = B.rules, errors = [], cls = (n) => B.classes[(B.nets[n] || { cls: "default" }).cls] || B.classes.default;
    const PR = pairs(O), parent = O.map((_, i) => i), find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i]))), join = (a, b) => { parent[find(a)] = find(b); };
    for (const [x, y] of PR) {
      if (!x.layers.some((l) => y.layers.includes(l))) continue;
      const d = E.dist(x, y);
      if (x.net === y.net) { if (d <= 1e-6) join(x.i, y.i); continue; }
      if (tieOk(x, y)) { if (d <= 1e-6) join(x.i, y.i); continue; }
      const need = x.kind === "pour" || y.kind === "pour" ? Math.max(R.pourClearance, cls(x.net).clearance, cls(y.net).clearance) : Math.max(cls(x.net).clearance, cls(y.net).clearance);
      if (d < need - 1e-6) errors.push({ rule: d <= 0 ? "short" : "clearance", nets: [x.net, y.net], kinds: [x.kind, y.kind], gap: +d.toFixed(4), need, at: x.pts[0] });
    }
    for (const o of O) {
      if (o.kind === "trace" && o.w < Math.max(R.minWidth, cls(o.net).width) - 1e-9) errors.push({ rule: "width", net: o.net, w: o.w, need: Math.max(R.minWidth, cls(o.net).width), at: o.pts[0] });
      if (o.drill) {
        const ring = (o.dia - o.drill) / 2;
        if (ring < R.minRing - 1e-9) errors.push({ rule: "annular ring", net: o.net, kind: o.kind, ring: +ring.toFixed(4), need: R.minRing, at: o.at });
        if (o.drill < R.minDrill - 1e-9) errors.push({ rule: "drill", net: o.net, drill: o.drill, need: R.minDrill, at: o.at });
      }
      const e = Math.min(o.bb[0], o.bb[1], B.w - o.bb[2], B.h - o.bb[3]);
      if (e < R.edge - 1e-6 && o.kind !== "pour") errors.push({ rule: "edge", net: o.net, kind: o.kind, gap: +e.toFixed(4), need: R.edge, at: o.pts[0] });
      if (o.kind === "pour" && e < R.edge - 1e-6) errors.push({ rule: "edge", net: o.net, kind: "pour", gap: +e.toFixed(4), need: R.edge, at: o.pts[0] });
    }
    const holes = O.filter((o) => o.drill);
    for (let a = 0; a < holes.length; a++) for (let b = a + 1; b < holes.length; b++) {
      const gap = Math.hypot(holes[a].at[0] - holes[b].at[0], holes[a].at[1] - holes[b].at[1]) - holes[a].drill / 2 - holes[b].drill / 2;
      if (gap < R.holeGap - 1e-9 && !(holes[a].kind === "pad" && holes[b].kind === "pad" && holes[a].ref === holes[b].ref && gap > 0)) errors.push({ rule: "hole gap", nets: [holes[a].net, holes[b].net], gap: +gap.toFixed(4), need: R.holeGap, at: holes[a].at });
    }
    /* connectivity, per net, over pads */
    const unrouted = [];
    for (const n of Object.keys(B.nets)) {
      const ps = O.filter((o) => o.kind === "pad" && o.net === n);
      if (ps.length < 2) continue;
      const roots = new Set(ps.map((o) => find(o.i)));
      if (roots.size > 1) { unrouted.push({ net: n, pieces: roots.size }); errors.push({ rule: "unrouted", net: n, pieces: roots.size, at: ps[0].at }); }
    }
    return { errors, unrouted, objects: O.length, pairs: PR.length, counts: errors.reduce((m, e) => ((m[e.rule] = (m[e.rule] || 0) + 1), m), {}) };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);

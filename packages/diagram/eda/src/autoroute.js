// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/autoroute: drives the grid router over a placed board. Pads are painted first; signal and power
   nets are routed shortest-span first; then each ground pour is filled on the bottom layer inside its island,
   clear of foreign copper; then every ground pad is joined to its own pour (a stub and a via); then pour copper
   that no pad reaches is removed. Every trace and via is recorded as vector geometry for the DRC and the fab files. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});

  E.padLayers = (pad) => (pad.side === "both" ? [0, 1] : [0]);
  E.pads = (B) => B.parts.flatMap((P) => P.fp.pads.map((pad) => ({ P, pad, at: E.padAt(P, pad), net: P.comp.pins[pad.num], shape: E.padShape(pad, E.padAt(P, pad), P.rot) })));

  const cellOf = (G, p) => [Math.min(G.nx - 1, Math.max(0, Math.floor(p[0] / G.p))), Math.min(G.ny - 1, Math.max(0, Math.floor(p[1] / G.p)))];
  const centre = (G, i, j) => [(i + 0.5) * G.p, (j + 0.5) * G.p];

  /* path cells to segments (collinear runs merged) and vias at layer changes; the first point is the pad centre */
  const lay = (G, B, net, path, w, start) => {
    const segs = [], vias = [];
    let run = [start || centre(G, path[0][1], path[0][2])], L = path[0][0];
    const flush = () => { for (let k = 0; k + 1 < run.length; k++) segs.push({ net, layer: L, a: run[k], b: run[k + 1], w }); };
    for (let k = 1; k < path.length; k++) {
      const [L2, i, j] = path[k], c = centre(G, i, j);
      if (L2 !== L) { flush(); vias.push({ net, at: c, dia: B.rules.via.dia, drill: B.rules.via.drill }); run = [c]; L = L2; continue; }
      if (run.length >= 2) {
        const a = run[run.length - 2], b = run[run.length - 1];
        if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-9 && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) > 0) run[run.length - 1] = c; else run.push(c);
      } else run.push(c);
    }
    flush();
    return { segs: segs.filter((s) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 1e-9), vias };
  };

  const commit = (G, B, net, r) => {
    for (const s of r.segs) { B.traces.push(s); E.paint(G, [s.layer], { pts: [s.a, s.b], r: s.w / 2 }, net); }
    for (const v of r.vias) { B.vias.push(v); E.paint(G, [0, 1], { pts: [v.at], r: v.dia / 2 }, net); }
  };

  const markTree = (G, tree, layers, shape) => {
    const b = E.bbox(shape), NC = G.nx * G.ny;
    for (const L of layers) for (let j = Math.max(0, Math.floor(b[1] / G.p)); j <= Math.min(G.ny - 1, Math.ceil(b[3] / G.p)); j++) for (let i = Math.max(0, Math.floor(b[0] / G.p)); i <= Math.min(G.nx - 1, Math.ceil(b[2] / G.p)); i++)
      if (E.ptDist(centre(G, i, j), shape) <= 1e-9) tree[L * NC + j * G.nx + i] = 1;
  };
  const markPath = (G, tree, path) => { const NC = G.nx * G.ny; for (const [L, i, j] of path) tree[L * NC + j * G.nx + i] = 1; };

  /* join each pin of net to the tree; returns the pins that failed */
  const routeNet = (G, B, S, net, pads, tree, pinOrder) => {
    const w = B.classes[B.nets[net].cls].width, failed = [];
    S.ok = new Int8Array(3 * G.nx * G.ny);
    for (const q of pinOrder) {
      const [i, j] = cellOf(G, q.at), src = E.padLayers(q.pad).map((L) => [L, j * G.nx + i]);
      if (E.padLayers(q.pad).some((L) => tree[L * G.nx * G.ny + j * G.nx + i])) { markTree(G, tree, E.padLayers(q.pad), q.shape); continue; }
      const aim = q.aim ? cellOf(G, q.aim) : [i, j];
      const path = E.astar(G, S, net, w / 2, src, tree, aim);
      if (!path) { failed.push(q); continue; }
      const r = lay(G, B, net, path, w, q.at);
      commit(G, B, net, r); markPath(G, tree, path); markTree(G, tree, E.padLayers(q.pad), q.shape);
    }
    return failed;
  };

  E.autoroute = (B, opt = {}) => {
    const G = E.grid(B, opt.pitch || 0.2), S = {}, pads = E.pads(B), NC = G.nx * G.ny, log = [];
    B.grid = { p: G.p, nx: G.nx, ny: G.ny };
    for (const q of pads) E.paint(G, E.padLayers(q.pad), q.shape, q.P.fp.tie ? E.TIE : q.net);
    for (const P of B.parts) if (P.fp.bridge) { const [a, b, w] = P.fp.bridge; P.bridge = { a: E.padAt(P, { at: a }), b: E.padAt(P, { at: b }), w }; }
    const sig = Object.values(B.nets).filter((n) => n.cls !== "gnd" && n.pins.length > 1);
    const span = (n) => { const ps = pads.filter((q) => q.net === n.name).map((q) => q.at); return Math.max(...ps.map((p) => p[0])) - Math.min(...ps.map((p) => p[0])) + Math.max(...ps.map((p) => p[1])) - Math.min(...ps.map((p) => p[1])); };
    let order = sig.slice().sort((a, b) => span(a) - span(b)), unrouted = [];
    for (let pass = 0; pass < (opt.passes || 3); pass++) {
      const snap = { occ: G.occ.map((o) => o.slice()), traces: B.traces.length, vias: B.vias.length };
      unrouted = [];
      for (const n of order) {
        const mine = pads.filter((q) => q.net === n.name), tree = new Uint8Array(2 * NC), first = mine[0], rest = [];
        markTree(G, tree, E.padLayers(first.pad), first.shape);
        const done = [first], left = mine.slice(1);
        while (left.length) { left.sort((a, b) => Math.min(...done.map((d) => Math.hypot(d.at[0] - a.at[0], d.at[1] - a.at[1]))) - Math.min(...done.map((d) => Math.hypot(d.at[0] - b.at[0], d.at[1] - b.at[1])))); const q = left.shift(); q.aim = done.slice().sort((a, b) => Math.hypot(a.at[0] - q.at[0], a.at[1] - q.at[1]) - Math.hypot(b.at[0] - q.at[0], b.at[1] - q.at[1]))[0].at; rest.push(q); done.push(q); }
        const f = routeNet(G, B, S, n.name, pads, tree, rest);
        if (f.length) unrouted.push(n);
      }
      log.push({ pass, unrouted: unrouted.map((n) => n.name) });
      if (!unrouted.length) break;
      G.occ = snap.occ; B.traces.length = snap.traces; B.vias.length = snap.vias;
      order = unrouted.concat(order.filter((n) => !unrouted.includes(n)));
      if (pass === (opt.passes || 3) - 1) for (const n of order) { const mine = pads.filter((q) => q.net === n.name), tree = new Uint8Array(2 * NC); markTree(G, tree, E.padLayers(mine[0].pad), mine[0].shape); routeNet(G, B, S, n.name, pads, tree, mine.slice(1)); }
    }
    E.pourAndStitch(G, B, S, pads, log);
    B.routeLog = log;
    B._G = G;
    return B;
  };

  E._lay = lay; E._commit = commit; E._markTree = markTree; E._markPath = markPath; E._routeNet = routeNet; E._centre = centre;

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);

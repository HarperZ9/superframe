// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/board: the board record built from an instrument's netlist, and a constructive placer.
   The board's outline comes from the instrument's own "pcb" part, so the box, the drawing and the board agree.
   Placement: anchored parts first, then the rest in order of how many connections they share with what is already
   down, each at the grid position and quarter turn that minimises half-perimeter wirelength without its courtyard
   touching another or leaving its zone. Ground nets are left out of the wirelength because the pours carry them. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});

  E.CLASSES = {
    default: { width: 0.25, clearance: 0.2 },
    input: { width: 0.3, clearance: 0.4, note: "high-impedance input: wider gap against leakage" },
    power: { width: 0.5, clearance: 0.25 },
    gnd: { width: 0.5, clearance: 0.25 },
  };
  E.RULES = { minWidth: 0.2, minClearance: 0.2, minRing: 0.13, minDrill: 0.3, edge: 0.4, holeGap: 0.25, via: { dia: 0.6, drill: 0.3 }, pourClearance: 0.3, maskExpand: 0.05, silkWidth: 0.15 };

  /* wirelength weight per class: the high-impedance input is kept short first, the supplies may run long */
  E.PLACE_WEIGHT = { input: 10, default: 1, power: 0.3 };
  E.classOf = (net, map) => (map && map[net]) || (/^GND/.test(net) ? "gnd" : /^V[AB][+-]$/.test(net) ? "power" : "default");

  E.makeBoard = (R, opt = {}) => {
    const pcb = R.B.parts.find((p) => p.id === "pcb"), W = pcb.geom.size[0], H = pcb.geom.size[2], parts = [], nets = {};
    for (const c of R.B.netlist.components) {
      if (c.offBoard) continue;
      const fp = E.footprintFor(c);
      if (!fp) throw new Error("eda: no footprint for " + c.ref);
      for (const pad of fp.pads) if (!(pad.num in c.pins)) throw new Error(`eda: ${c.ref} pad ${pad.num} has no netlist pin`);
      parts.push({ ref: c.ref, value: c.value, fp, comp: c, at: null, rot: 0, side: "F", pn: c.pn || "", pnStatus: c.pnStatus || "" });
    }
    for (const P of parts) for (const pad of P.fp.pads) { const n = P.comp.pins[pad.num]; if (!n || n === "NC") continue; (nets[n] = nets[n] || { name: n, pins: [] }).pins.push({ ref: P.ref, num: pad.num }); }
    for (const n of Object.values(nets)) n.cls = E.classOf(n.name, opt.classMap);
    return { id: R.inst.id, hash: R.hash, w: W, h: H, parts, nets, classes: E.CLASSES, rules: E.RULES, pours: opt.pours || [], traces: [], vias: [], pourRects: [] };
  };

  E.padAt = (P, pad) => { const r = E.rotPt(pad.at, P.rot); return [P.at[0] + r[0], P.at[1] + r[1]]; };
  E.courtyard = (fp, at, rot, m = 0.5) => {
    let x0 = -fp.body[0] / 2, x1 = fp.body[0] / 2, y0 = -fp.body[1] / 2, y1 = fp.body[1] / 2;
    for (const p of fp.pads) { x0 = Math.min(x0, p.at[0] - p.w / 2); x1 = Math.max(x1, p.at[0] + p.w / 2); y0 = Math.min(y0, p.at[1] - p.h / 2); y1 = Math.max(y1, p.at[1] + p.h / 2); }
    const c = [E.rotPt([x0, y0], rot), E.rotPt([x1, y1], rot)];
    return [at[0] + Math.min(c[0][0], c[1][0]) - m, at[1] + Math.min(c[0][1], c[1][1]) - m, at[0] + Math.max(c[0][0], c[1][0]) + m, at[1] + Math.max(c[0][1], c[1][1]) + m];
  };
  const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const inside = (a, z) => a[0] >= z[0] && a[1] >= z[1] && a[2] <= z[2] && a[3] <= z[3];

  const hpwl = (B, P, nets) => {
    let s = 0;
    for (const n of nets) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, k = 0;
      for (const q of B.nets[n].pins) {
        const Q = B.byRef[q.ref];
        if (!Q.at) continue;
        const p = E.padAt(Q, Q.fp.pads.find((d) => d.num === q.num));
        x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); k++;
      }
      if (k > 1) s += ((x1 - x0) + (y1 - y0)) * (E.PLACE_WEIGHT[B.nets[n].cls] || 1);
    }
    return s;
  };

  /* zones: { name: [x0, y0, x1, y1] }; zoneOf(part) gives a zone name; anchors: { ref: [x, y, rot] } */
  E.place = (B, { zones, zoneOf, anchors = {}, pitch = 1.27, rots = [0, 90, 180, 270] }) => {
    B.byRef = Object.fromEntries(B.parts.map((P) => [P.ref, P]));
    const placed = [], cy = [];
    for (const [ref, a] of Object.entries(anchors)) { const P = B.byRef[ref]; P.at = [a[0], a[1]]; P.rot = a[2] || 0; placed.push(P); cy.push(E.courtyard(P.fp, P.at, P.rot)); }
    const netsOf = (P) => [...new Set(Object.values(P.comp.pins))].filter((n) => B.nets[n] && B.nets[n].cls !== "gnd");
    const share = (P) => netsOf(P).reduce((s, n) => s + B.nets[n].pins.filter((q) => B.byRef[q.ref].at).length, 0);
    let todo = B.parts.filter((P) => !P.at);
    while (todo.length) {
      todo.sort((a, b) => share(b) - share(a) || b.fp.pads.length - a.fp.pads.length || a.ref.localeCompare(b.ref));
      const P = todo.shift(), z = zones[zoneOf(P)], nets = netsOf(P);
      let best = null;
      for (let x = z[0]; x <= z[2]; x += pitch) for (let y = z[1]; y <= z[3]; y += pitch) for (const rot of rots) {
        const c = E.courtyard(P.fp, [x, y], rot);
        if (!inside(c, z) || cy.some((q) => overlap(q, c))) continue;
        P.at = [x, y]; P.rot = rot;
        const cost = hpwl(B, P, nets) + 1e-3 * (Math.abs(x - (z[0] + z[2]) / 2) + Math.abs(y - (z[1] + z[3]) / 2));
        if (!best || cost < best[0]) best = [cost, x, y, rot];
      }
      if (!best) throw new Error("eda: no room for " + P.ref + " in zone " + zoneOf(P));
      P.at = [best[1], best[2]]; P.rot = best[3]; placed.push(P); cy.push(E.courtyard(P.fp, P.at, P.rot));
    }
    return B;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);

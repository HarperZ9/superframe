// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/cad/schem: the netlist drawn as a schematic. Symbols sit where the instrument places them (sheet mm,
   y down, the KiCad schematic convention); nets are routed as orthogonal wires when a one- or two-bend path
   touches nothing it should not, and fall back to net labels when it cannot. Power nets end in power symbols.
   Because a wire end landing on another pin would join two nets, every candidate path is checked against
   every symbol body, every foreign pin and every foreign wire; the KiCad round trip then re-derives the
   connectivity from the written file and compares it with the netlist, so a bad route cannot pass silently. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const C = (D.CAD = D.CAD || {});
  const STUB = 2.54, EPS = 1e-6;
  const eq = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
  const add = (p, d, k) => [C.g(p[0] + d[0] * k), C.g(p[1] + d[1] * k)];

  /* p on the closed axis-aligned segment ab */
  C.onSeg = (p, a, b) => {
    if (Math.abs(a[0] - b[0]) < EPS) return Math.abs(p[0] - a[0]) < EPS && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;
    if (Math.abs(a[1] - b[1]) < EPS) return Math.abs(p[1] - a[1]) < EPS && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS;
    return false;
  };
  const overlap = (a, b, c, d) => {
    const H1 = Math.abs(a[1] - b[1]) < EPS, H2 = Math.abs(c[1] - d[1]) < EPS;
    if (H1 && H2 && Math.abs(a[1] - c[1]) < EPS) return Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) - Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) > EPS;
    const V1 = Math.abs(a[0] - b[0]) < EPS, V2 = Math.abs(c[0] - d[0]) < EPS;
    if (V1 && V2 && Math.abs(a[0] - c[0]) < EPS) return Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) - Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) > EPS;
    return false;
  };
  const hitsRect = (a, b, r) => {
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    return x1 > r[0] && x0 < r[2] && y1 > r[1] && y0 < r[3];
  };

  C.schematic = (R) => {
    const N = R.B.netlist, P = R.B.sch, problems = [], syms = [];
    const netKind = new Map(N.nets.map((n) => [n.name, n]));
    for (const c of N.components) {
      const S = C.SYM[c.sym];
      S.units.forEach((U, ui) => {
        const key = S.units.length > 1 ? `${c.ref}:${ui + 1}` : c.ref, pl = P.place[key];
        if (!pl) { problems.push(`schematic: no place for ${key}`); return; }
        const at = [C.g(pl[0]), C.g(pl[1])], rot = pl[2] || 0;
        const pins = U.pins.map((q) => {
          const p = C.libToSheet(at, rot, q.at), d = C.rotLib([Math.cos((q.ang * Math.PI) / 180), Math.sin((q.ang * Math.PI) / 180)], rot);
          return { num: q.num, name: q.name, type: q.type, net: c.pins[q.num], p, out: [-Math.round(d[0]), Math.round(d[1])] };
        });
        const bx = C.unitBox(U), c1 = C.libToSheet(at, rot, [bx[0], bx[1]]), c2 = C.libToSheet(at, rot, [bx[2], bx[3]]);
        const box = [Math.min(c1[0], c2[0]) + 0.3, Math.min(c1[1], c2[1]) + 0.3, Math.max(c1[0], c2[0]) - 0.3, Math.max(c1[1], c2[1]) - 0.3];
        syms.push({ key, ref: c.ref, unit: ui + 1, nUnits: S.units.length, sym: c.sym, value: c.value, comp: c, at, rot, pins, box, part: c.part });
      });
    }
    const allPins = syms.flatMap((s) => s.pins.map((p) => Object.assign({ sym: s }, p)));
    const wires = [], labels = [], power = [], noconn = [];
    const fits = (path, net) => {
      for (let i = 0; i + 1 < path.length; i++) {
        const a = path[i], b = path[i + 1];
        if (eq(a, b)) continue;
        for (const s of syms) if (hitsRect(a, b, s.box)) return false;
        for (const q of allPins) if (q.net !== net && C.onSeg(q.p, a, b)) return false;
        for (const w of wires) {
          if (w.net === net) continue;
          if (overlap(a, b, w.a, w.b) || C.onSeg(a, w.a, w.b) || C.onSeg(b, w.a, w.b) || C.onSeg(w.a, a, b) || C.onSeg(w.b, a, b)) return false;
        }
        for (const L of labels.concat(power)) if (L.net !== net && C.onSeg(L.at, a, b)) return false;
      }
      return true;
    };
    const simplify = (pts) => {
      const o = [];
      for (const p of pts) { if (o.length && eq(o[o.length - 1], p)) continue; if (o.length >= 2) { const a = o[o.length - 2], b = o[o.length - 1]; if ((Math.abs(a[0] - b[0]) < EPS && Math.abs(b[0] - p[0]) < EPS) || (Math.abs(a[1] - b[1]) < EPS && Math.abs(b[1] - p[1]) < EPS)) o.pop(); } o.push(p); }
      return o;
    };
    const lay = (path, net) => { const s = simplify(path); for (let i = 0; i + 1 < s.length; i++) wires.push({ a: s[i], b: s[i + 1], net }); };
    const cost = (s) => { let L = 0; for (let i = 0; i + 1 < s.length; i++) L += Math.abs(s[i + 1][0] - s[i][0]) + Math.abs(s[i + 1][1] - s[i][1]); return L + 3 * (s.length - 2); };
    const route = (A, B, net) => {
      const a1 = add(A.p, A.out, STUB), b1 = add(B.p, B.out, STUB), cand = [];
      cand.push([A.p, [B.p[0], A.p[1]], B.p], [A.p, [A.p[0], B.p[1]], B.p]);
      cand.push([A.p, a1, [b1[0], a1[1]], b1, B.p], [A.p, a1, [a1[0], b1[1]], b1, B.p]);
      for (let k = -8; k <= 8; k++) {
        const mx = C.g(Math.round(((a1[0] + b1[0]) / 2) / 1.27 + k) * 1.27), my = C.g(Math.round(((a1[1] + b1[1]) / 2) / 1.27 + k) * 1.27);
        cand.push([A.p, a1, [mx, a1[1]], [mx, b1[1]], b1, B.p], [A.p, a1, [a1[0], my], [b1[0], my], b1, B.p]);
      }
      const ok = cand.map(simplify).sort((x, y) => cost(x) - cost(y)).find((s) => fits(s, net));
      if (ok) { lay(ok, net); return true; }
      return false;
    };
    const stubTo = (q, kind) => {
      for (const k of [STUB, 2 * STUB, 3 * STUB, 4 * STUB]) {
        const e = add(q.p, q.out, k);
        if (!fits([q.p, e], q.net) || allPins.some((o) => o.net !== q.net && eq(o.p, e))) continue;
        lay([q.p, e], q.net);
        const ang = q.out[0] > 0 ? 0 : q.out[0] < 0 ? 180 : q.out[1] < 0 ? 90 : 270;
        if (kind === "label") labels.push({ net: q.net, at: e, ang });
        else {
          const sym = C.powerSym(q.net), dir = q.out, up = sym === "PWR";
          const rot = up ? (dir[1] < 0 ? 0 : dir[1] > 0 ? 180 : dir[0] > 0 ? 270 : 90) : (dir[1] > 0 ? 0 : dir[1] < 0 ? 180 : dir[0] > 0 ? 90 : 270);
          power.push({ net: q.net, sym, at: e, rot });
        }
        return true;
      }
      problems.push(`schematic: no room for a ${kind} on ${q.sym.ref} pin ${q.num}`);
      return false;
    };
    /* power first (their stubs become obstacles), then signal nets shortest first, then labels for what failed */
    for (const q of allPins) if (q.net === "NC") noconn.push({ at: q.p, ref: q.sym.ref, pin: q.num });
    const isPower = (n) => (netKind.get(n) || {}).power;
    for (const q of allPins) if (q.net && q.net !== "NC" && isPower(q.net)) stubTo(q, "power");
    const nets = N.nets.filter((n) => !n.power).map((n) => ({ n, pins: allPins.filter((q) => q.net === n.name) }));
    const failed = [];
    const spans = nets.map(({ n, pins }) => {
      const edges = [], inT = [0];   /* Prim's tree over the pins, Manhattan distance */
      while (inT.length < pins.length) {
        let best = null;
        for (const i of inT) for (let j = 0; j < pins.length; j++) if (!inT.includes(j)) { const d = Math.abs(pins[i].p[0] - pins[j].p[0]) + Math.abs(pins[i].p[1] - pins[j].p[1]); if (!best || d < best[2]) best = [i, j, d]; }
        edges.push(best); inT.push(best[1]);
      }
      return { n, pins, edges };
    });
    const allEdges = spans.flatMap((s) => s.edges.map((e) => ({ s, e }))).sort((a, b) => a.e[2] - b.e[2]);
    for (const { s, e } of allEdges) if (!route(s.pins[e[0]], s.pins[e[1]], s.n.name)) failed.push({ s, e });
    const labelled = new Set();
    for (const { s, e } of failed) for (const k of [e[0], e[1]]) { const q = s.pins[k], id = q.sym.key + "." + q.num; if (!labelled.has(id)) { labelled.add(id); stubTo(q, "label"); } }
    /* name every routed net once, on its longest horizontal run, so KiCad keeps our names */
    for (const { n } of nets) {
      if (labels.some((L) => L.net === n.name)) continue;
      const ws = wires.filter((w) => w.net === n.name);
      if (!ws.length) continue;
      const hz = ws.filter((w) => Math.abs(w.a[1] - w.b[1]) < EPS), pool = hz.length ? hz : ws, w = pool.sort((x, y) => Math.hypot(y.b[0] - y.a[0], y.b[1] - y.a[1]) - Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]))[0];
      const at = (fr) => [C.g(Math.round((w.a[0] + (w.b[0] - w.a[0]) * fr) / 1.27) * 1.27), C.g(Math.round((w.a[1] + (w.b[1] - w.a[1]) * fr) / 1.27) * 1.27)];
      const clear = (q) => C.onSeg(q, w.a, w.b) && !eq(q, w.a) && !eq(q, w.b) && !labels.some((L) => Math.abs(L.at[1] - q[1]) < 3.5 && Math.abs(L.at[0] - q[0]) < 14);
      const m = [0.5, 0.3, 0.7, 0.2, 0.8].map(at).find(clear) || at(0.5);
      if (!C.onSeg(m, w.a, w.b) || eq(m, w.a) || eq(m, w.b)) continue;
      const i = wires.indexOf(w);
      wires.splice(i, 1, { a: w.a, b: m, net: w.net }, { a: m, b: w.b, net: w.net });
      labels.push({ net: n.name, at: m, ang: 0, name: true });
    }
    /* junctions: three or more ends at a point, or an end on the middle of a wire of the same net */
    const junctions = [], pts = new Map();
    const bump = (p, net) => { const k = p[0] + "," + p[1] + "," + net; pts.set(k, { p, net, n: ((pts.get(k) || {}).n || 0) + 1 }); };
    for (const w of wires) { bump(w.a, w.net); bump(w.b, w.net); }
    for (const q of allPins) if (pts.has(q.p[0] + "," + q.p[1] + "," + q.net)) bump(q.p, q.net);
    for (const v of pts.values()) {
      const mid = wires.some((w) => w.net === v.net && C.onSeg(v.p, w.a, w.b) && !eq(v.p, w.a) && !eq(v.p, w.b));
      if (v.n >= 3 || mid) junctions.push({ at: v.p, net: v.net });
    }
    return { w: 420, h: 297, syms, wires, labels, power, noconn, junctions, problems, failed: failed.length, title: P.title || R.inst.title, number: P.number || R.inst.id.toUpperCase() + "-SCH-001" };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = C;
})(typeof globalThis !== "undefined" ? globalThis : this);

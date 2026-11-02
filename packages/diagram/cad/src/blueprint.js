// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/cad/blueprint: the assembly drawing, generated from the resolved model. Front, top and right side in
   third-angle projection at one standard scale (ISO 5455), an isometric view with balloons, a section view
   with hatching, dimensions measured from the geometry itself (so a test can compare them with the model's
   parameters), datums and a feature control frame, general notes, the parts list balloon-numbered to the
   drawing (ASME Y14.34 order: item 1 nearest the title block), and the ISO 7200 title block. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const C = (D.CAD = D.CAD || {});
  const SCALES = [10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005];
  C.scaleText = (s) => (s >= 1 ? C.dec(s, 2) + ":1" : "1:" + C.dec(1 / s, 2));
  const fit = (need, have) => SCALES.find((s) => need[0] * s <= have[0] && need[1] * s <= have[1]) || SCALES[SCALES.length - 1];

  /* Measure a dimension from the view's geometry. Returns { value, a, b, dir } in model (u, v). */
  C.measure = (VW, dm) => {
    const box = (pid) => { const P = VW.parts.get(pid); if (!P) throw new Error(`dimension ${dm.id}: part ${pid} not in view ${VW.name}`); return P.box; };
    const side = (b, s, k) => (s === "lo" ? b.lo[k] : s === "hi" ? b.hi[k] : (b.lo[k] + b.hi[k]) / 2);
    if (dm.kind === "x" || dm.kind === "y") {
      const b = box(dm.part), k = dm.kind === "x" ? 0 : 1, o = 1 - k, at = dm.at === "hi" ? b.hi[o] : b.lo[o];
      const a = k === 0 ? [b.lo[0], at] : [at, b.lo[1]], bb = k === 0 ? [b.hi[0], at] : [at, b.hi[1]];
      return { value: b.hi[k] - b.lo[k], a, b: bb, dir: k === 0 ? "h" : "v" };
    }
    if (dm.kind === "gap") {
      const k = dm.axis === "v" ? 1 : 0, o = 1 - k, A = box(dm.a.part), B = box(dm.b.part);
      const ua = side(A, dm.a.side, k), ub = side(B, dm.b.side, k), ref = dm.at === "hi" ? Math.max(A.hi[o], B.hi[o]) : Math.min(A.lo[o], B.lo[o]);
      const pa = k === 0 ? [ua, side(A, "lo", 1)] : [side(A, "lo", 0), ua], pb = k === 0 ? [ub, side(B, "lo", 1)] : [side(B, "lo", 0), ub];
      if (dm.at === "hi") { if (k === 0) { pa[1] = A.hi[1]; pb[1] = B.hi[1]; } else { pa[0] = A.hi[0]; pb[0] = B.hi[0]; } }
      return { value: Math.abs(ub - ua), a: pa, b: pb, dir: k === 0 ? "h" : "v", ref };
    }
    if (dm.kind === "angle") {   /* principal axis of the part's projected outline, from the view's vertical */
      const P = VW.parts.get(dm.part), pts = P.pts;
      const m = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
      let sxx = 0, syy = 0, sxy = 0;
      for (const p of pts) { const x = p[0] - m[0], y = p[1] - m[1]; sxx += x * x; syy += y * y; sxy += x * y; }
      let ang = (0.5 * Math.atan2(2 * sxy, sxx - syy) * 180) / Math.PI;   /* from +u */
      let fromV = 90 - ang;
      if (fromV > 90) fromV -= 180;
      return { value: Math.abs(fromV), c: m, a0: 90, a1: 90 - fromV, dir: "a", sign: Math.sign(fromV) };
    }
    throw new Error(`dimension ${dm.id}: kind ${dm.kind}`);
  };

  const SHEETS = [[420, 297, "A3"], [594, 420, "A2"]];
  const ext = (VW) => [VW.hi[0] - VW.lo[0], VW.hi[1] - VW.lo[1]];

  /* Where each view goes on a sheet of W x H: front, top and right at one scale on the left; the parts list,
     notes and title block in the right column; the isometric and the section above them, each at its own scale. */
  const layout = (V, nItems, nNotes, W, H) => {
    const M = 34, colX0 = W - 190, L = [20, 10, colX0 - 4, H - 10], ef = ext(V.front), et = ext(V.top), er = ext(V.right);
    const s = fit([ef[0] + er[0], ef[1] + et[1]], [L[2] - L[0] - 3 * M, L[3] - L[1] - 3 * M]);
    const fx = L[0] + M + (L[2] - L[0] - 3 * M - s * (ef[0] + er[0])) / 2, fy = L[1] + M + (L[3] - L[1] - 3 * M - s * (ef[1] + et[1])) / 2;
    const T = {}, mk = (ox, oy, lo, sc) => ({ s: sc, f: (q) => [ox + sc * (q[0] - lo[0]), oy + sc * (q[1] - lo[1])] });
    T.front = mk(fx, fy, V.front.lo, s);
    T.top = mk(fx, fy + s * ef[1] + M, [V.front.lo[0], V.top.lo[1]], s);
    T.right = mk(fx + s * ef[0] + M, fy, [V.right.lo[0], V.front.lo[1]], s);
    const bomTop = 60 + 6 * (nItems + 1), notesTop = bomTop + 9 + nNotes * 4.2, A = [colX0, notesTop + 4, W - 10, H - 12];
    const stack = A[3] - A[1] >= 170, cells = !V.section ? [A] : stack ? [[A[0], (A[1] + A[3]) / 2, A[2], A[3]], [A[0], A[1], A[2], (A[1] + A[3]) / 2]] : [[A[0], A[1], (A[0] + A[2]) / 2, A[3]], [(A[0] + A[2]) / 2, A[1], A[2], A[3]]];
    const cellFit = (VW, c) => { const e = ext(VW), sc = fit(e, [c[2] - c[0] - 30, c[3] - c[1] - 36]); return mk((c[0] + c[2]) / 2 - (sc * e[0]) / 2, (c[1] + c[3]) / 2 + 4 - (sc * e[1]) / 2, VW.lo, sc); };
    T.iso = cellFit(V.iso, cells[0]);
    if (V.section) T.section = cellFit(V.section, cells[1]);
    return { s, T, bomTop, notesTop, W, H };
  };

  const drawViews = (S, V, T, Dw, below) => {
    for (const [n, VW] of Object.entries(V)) {
      const f = T[n].f;
      for (const [pid, P] of VW.parts) {
        for (const L of P.vis) S.poly(L.map(f), "OUTLINE", { part: pid, view: n });
        for (const L of P.hid) S.poly(L.map(f), "HIDDEN", { part: pid, view: n });
      }
      const b0 = f(VW.lo), b1 = f(VW.hi), own = n === "iso" || n === "section";
      const lab = (n === "section" ? `SECTION ${Dw.views.section.label}-${Dw.views.section.label}` : VW.label + " VIEW") + (own ? `  SCALE ${C.scaleText(T[n].s)}` : "");
      const drop = own ? 19 : below[n] ? 16 + 12 * below[n] + 4 : 10;
      S.text([(b0[0] + b1[0]) / 2, b0[1] - drop], lab, 3.5, "TEXT", { align: "center", viewLabel: n });
      T[n].box = [b0, b1];
    }
  };

  /* Cut faces hatched per material (ISO 128-50), and the cutting plane drawn on the view it is taken from. */
  const drawSection = (S, R, V, T, sc) => {
    const f = T.section.f;
    for (const p of R.B.parts) {
      if ((sc.skip || []).includes(p.id)) continue;
      const sec = D.section(R.mesh(p.id).pos, sc.cut.n, sc.cut.d);
      if (!sec.loops.length) continue;
      const loops = sec.loops.map((L) => L.map((q) => f(C.VIEWS.front.map(q)))), h = (D.MATERIALS[p.material] || {}).hatch || { angle: 45, gap: 6 };
      for (const L of loops) S.poly(L, "OUTLINE", { part: p.id, view: "section", closed: true });
      for (const [a, b] of C.hatch(loops, h.angle, Math.max(1.2, h.gap * 0.35))) S.line(a, b, "HATCH", { part: p.id, view: "section" });
    }
    const ft = T[sc.from], VW = V[sc.from], y = ft.f([0, -sc.cut.d])[1], x0 = ft.f(VW.lo)[0] - 8, x1 = ft.f(VW.hi)[0] + 8;
    S.line([x0, y], [x1, y], "CUT"); S.poly([[x0, y], [x0 + 7, y]], "CUTEND"); S.poly([[x1 - 7, y], [x1, y]], "CUTEND");
    for (const x of [x0 + 2, x1 - 2]) { S.line([x, y], [x, y + 7], "CUTEND"); C.arrow(S, [x, y + 10], [0, 1], "CUTEND"); S.text([x + (x < x1 - 3 ? -4.5 : 4.5), y + 5], sc.label, 5, "TEXT", { align: "center" }); }
  };

  /* Dimensions, measured from the views; the offset clears datum symbols and the text's half width. */
  const drawDims = (S, V, T, Dw) => {
    const dims = [];
    for (const dm of Dw.dims) {
      const VW = V[dm.view], t = T[dm.view], m = C.measure(VW, dm);
      const text = m.dir === "a" ? `${C.dec(m.value, 2)}° ±${C.dec(dm.tol.pm, 2)}°` : C.tolText(m.value, dm.tol, dm.prefix || "");
      let ent;
      if (m.dir === "a") ent = C.angDim(S, t.f(m.c), Math.min(m.a0, m.a1), Math.max(m.a0, m.a1), 18, text, dm);
      else {
        const a = t.f(m.a), b = t.f(m.b), bx = t.box, tier = dm.tier || 1, tw = C.textW(text, 3.5);
        const lowY = Math.min(bx[0][1], bx[1][1]), hiY = Math.max(bx[0][1], bx[1][1]), lowX = Math.min(bx[0][0], bx[1][0]), hiX = Math.max(bx[0][0], bx[1][0]);
        const dist = 16 + 12 * (tier - 1) + (m.dir === "v" ? tw / 2 : 0);
        const off = m.dir === "h" ? (dm.at === "hi" ? hiY + dist - a[1] : lowY - dist - a[1]) : (dm.at === "hi" ? hiX + dist - a[0] : lowX - dist - a[0]);
        ent = C.linDim(S, a, b, m.dir, off, text, dm);
      }
      dims.push({ id: dm.id, view: dm.view, value: m.value, expect: dm.expect, text, at: ent.at.slice(), param: dm.param });
    }
    for (const dt of Dw.datums || []) {
      const b = V[dt.view].parts.get(dt.part).box, f = T[dt.view].f;
      const p = dt.side === "bottom" ? f([b.lo[0] * 0.15 + b.hi[0] * 0.85, b.lo[1]]) : f([b.lo[0], b.lo[1] * 0.2 + b.hi[1] * 0.8]);
      C.datum(S, p, dt.side === "bottom" ? [0, -1] : [-1, 0], dt.letter);
    }
    for (const fc of Dw.fcfs || []) {   /* the frame sits over the view, its leader on the feature */
      const b = V[fc.view].parts.get(fc.part).box, f = T[fc.view].f, p = f([(b.lo[0] + b.hi[0]) / 2, b.hi[1]]), top = T[fc.view].box[1][1];
      const at = [p[0] + 6, top + 12], [fw] = C.fcf(S, at, fc.tol, fc.datums, { part: fc.part });
      S.line([at[0], at[1] + 3], [p[0], at[1] + 3], "DIM"); S.line([p[0], at[1] + 3], [p[0], p[1] + 3], "DIM"); C.arrow(S, p, [0, -1], "DIM");
      dims.push({ id: "fcf-" + fc.part, fcf: true, width: fw });
    }
    return dims;
  };

  /* One balloon per parts-list item, on the first view where the item shows, spaced round that view. */
  const drawBalloons = (S, V, T, items) => {
    const balloons = [], byView = new Map(), order = ["iso", "section", "front", "right", "top"];
    for (const it of items) {
      let hit = null;
      for (const n of order) { if (!V[n]) continue; for (const pid of it.parts) { const q = C.visiblePoint(V[n], pid); if (q && q.count > 6) { hit = { n, pid, uv: q.uv }; break; } } if (hit) break; }
      if (!hit) { balloons.push({ item: it.item, view: null }); continue; }
      if (!byView.has(hit.n)) byView.set(hit.n, []);
      byView.get(hit.n).push(Object.assign({ item: it.item }, hit));
    }
    for (const [n, list] of byView) {
      const t = T[n], [b0, b1] = t.box, c = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2], rx = Math.abs(b1[0] - b0[0]) / 2 + 11, ry = Math.abs(b1[1] - b0[1]) / 2 + 9;
      const tg = list.map((q) => Object.assign(q, { p: t.f(q.uv) })).map((q) => Object.assign(q, { ang: Math.atan2(q.p[1] - c[1], q.p[0] - c[0]) })).sort((a, b) => a.ang - b.ang);
      const N = tg.length, step = (2 * Math.PI) / Math.max(N, 1);
      let best = 0, bestCost = Infinity;
      for (let k = 0; k < 72; k++) { const o = (k / 72) * step; let cost = 0; tg.forEach((q, i) => { let d = Math.abs(q.ang - (o + i * step - Math.PI)); d = Math.min(d, 2 * Math.PI - d); cost += d * d; }); if (cost < bestCost) { bestCost = cost; best = o; } }
      tg.forEach((q, i) => {
        const a = best + i * step - Math.PI, at = [D.clamp(c[0] + rx * Math.cos(a), 26, S.w - 16), D.clamp(c[1] + ry * Math.sin(a), 14, S.h - 16)];
        C.balloon(S, at, q.p, q.item, { part: q.pid });
        balloons.push({ item: q.item, view: n, part: q.pid, at });
      });
    }
    return balloons;
  };

  /* Parts list over the title block, header at the bottom and item 1 next to it (ASME Y14.34), notes above. */
  const drawBOM = (S, items, notes, L) => {
    const X = S.w - 190, colsX = [X, X + 12, X + 22, X + 70, X + 142, X + 180], heads = ["ITEM", "QTY", "PART NUMBER", "DESCRIPTION", "MATERIAL"], rowH = 6;
    notes.forEach((nt, i) => S.text([X + 3, L.notesTop - 5 - i * 4.2], `${i + 1}. ${nt}`, 2.5, "TEXT", { note: i + 1 }));
    S.text([X + 3, L.notesTop - 0.5], "NOTES", 3.5, "TEXT");
    const clip = (s, w) => { const n = Math.floor(w / 1.55) - 1; return s.length > n ? s.slice(0, n - 1) + "~" : s; };
    for (let r = 0; r <= items.length; r++) {
      const y = 60 + r * rowH, it = items[r - 1];
      S.line([X, y + rowH], [X + 180, y + rowH], "TITLE");
      const row = r === 0 ? heads : [String(it.item), String(it.parts.length * (it.qtyEach || 1)), it.pn ? it.pn + (it.pnStatus === "unverified, from memory" ? " *" : "") : "-", it.desc, it.material || "-"];
      row.forEach((txt, k) => S.text([colsX[k] + 1.2, y + 1.8], clip(C.ascii(txt), colsX[k + 1] - colsX[k]), 2.5, "TEXT", r ? { item: it.item, bomCol: k } : { bomHead: k }));
    }
    for (const x of colsX) S.line([x, 60], [x, L.bomTop], "TITLE");
  };

  C.blueprint = (R) => {
    const Dw = R.B.drawing, I = R.inst, V = {};
    for (const n of ["front", "top", "right", "iso"]) V[n] = C.view(R, n, { hidden: (Dw.views[n] && Dw.views[n].hidden) || false, skip: (Dw.views[n] && Dw.views[n].skip) || [] });
    if (Dw.views.section) { const sc = Dw.views.section; V.section = C.view(R, "front", { cut: sc.cut, skip: sc.skip || [] }); V.section.name = "section"; }
    const items = R.B.items, notes = Dw.notes || [];
    const Ls = SHEETS.map(([w, h]) => layout(V, items.length, notes.length, w, h)), L = Ls[1].s > Ls[0].s * 1.01 ? Ls[1] : Ls[0];
    const S = C.Sheet(L.W, L.H), T = L.T, below = {};
    for (const dm of Dw.dims) if (dm.kind !== "angle" && dm.at !== "hi" && (dm.kind === "x" || (dm.kind === "gap" && dm.axis !== "v"))) below[dm.view] = Math.max(below[dm.view] || 0, dm.tier || 1);
    C.frame(S, { owner: I.owner || "Zain Dana Harper", type: "ASSEMBLY DRAWING", title: Dw.title, number: Dw.number, rev: Dw.rev || "A", date: Dw.date || "2026-10-31", scale: C.scaleText(L.s), status: "PAPER DESIGN, NOT RELEASED", hash: R.hash });
    drawViews(S, V, T, Dw, below);
    if (V.section) drawSection(S, R, V, T, Dw.views.section);
    const dims = drawDims(S, V, T, Dw), balloons = drawBalloons(S, V, T, items);
    drawBOM(S, items, notes, L);
    return { sheet: S, scale: L.s, size: L.W === 594 ? "A2" : "A3", views: V, T, dims: dims.filter((d) => !d.fcf), fcfs: dims.filter((d) => d.fcf), balloons };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = C;
})(typeof globalThis !== "undefined" ? globalThis : this);

// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/gerber: fabrication layers as primitives, RS-274X (Gerber X2 attributes) written and read here,
   and a rasteriser for the primitives. Units mm, format 4.6 (1 nm steps), absolute, linear interpolation only.
   Primitives: { type: "flash", ap: { kind: "C" | "R" | "O", w, h }, at }, { type: "stroke", ap: { kind: "C", w }, a, b },
   { type: "region", pts }. The reader accepts what this writer emits plus comments; arcs (G02/G03), step-and-repeat
   and aperture macros are refused by name, not ignored. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});

  const padAp = (pad, rot, grow = 0) => {
    const q = ((Math.round(rot / 90) % 4) + 4) % 4, w = (q % 2 ? pad.h : pad.w) + 2 * grow, h = (q % 2 ? pad.w : pad.h) + 2 * grow;
    return pad.shape === "circle" ? { kind: "C", w: pad.w + 2 * grow, h: pad.w + 2 * grow } : pad.shape === "oval" ? { kind: "O", w, h } : { kind: "R", w, h };
  };

  E.fabLayers = (B) => {
    const L = { F_Cu: [], B_Cu: [], F_Mask: [], B_Mask: [], F_Paste: [], F_Silk: [], Edge_Cuts: [] }, e = B.rules.maskExpand;
    for (const q of E.pads(B)) {
      const fl = (layer, grow) => L[layer].push({ type: "flash", ap: padAp(q.pad, q.P.rot, grow), at: q.at, net: q.net });
      fl("F_Cu", 0); fl("F_Mask", e);
      if (q.pad.side === "both") { fl("B_Cu", 0); fl("B_Mask", e); } else fl("F_Paste", 0);
    }
    for (const s of B.traces) L[s.layer ? "B_Cu" : "F_Cu"].push({ type: "stroke", ap: { kind: "C", w: s.w, h: s.w }, a: s.a, b: s.b, net: s.net });
    for (const v of B.vias) for (const l of ["F_Cu", "B_Cu"]) L[l].push({ type: "flash", ap: { kind: "C", w: v.dia, h: v.dia }, at: v.at, net: v.net });
    for (const P of B.parts) if (P.bridge) L.F_Cu.push({ type: "stroke", ap: { kind: "C", w: P.bridge.w, h: P.bridge.w }, a: P.bridge.a, b: P.bridge.b, net: "tie" });
    for (const pr of B.pourRects) { const [x0, y0, x1, y1] = pr.rect; L[pr.layer ? "B_Cu" : "F_Cu"].push({ type: "region", pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], net: pr.net }); }
    const sw = B.rules.silkWidth, ap = { kind: "C", w: sw, h: sw };
    for (const P of B.parts) {
      const c = E.courtyard(P.fp, P.at, P.rot, 0.15), box = [[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]];
      box.forEach((p, i) => L.F_Silk.push({ type: "stroke", ap, a: p, b: box[(i + 1) % 4] }));
      const h = 0.8, tw = E.textWidth(P.ref, h), at = [Math.min(Math.max((c[0] + c[2]) / 2 - tw / 2, 0.5), B.w - tw - 0.5), c[3] + 0.3 + h > B.h - 0.5 ? c[1] - 0.3 - h : c[3] + 0.3];
      for (const pl of E.textStrokes(P.ref, at, h)) for (let k = 0; k + 1 < pl.length; k++) L.F_Silk.push({ type: "stroke", ap, a: pl[k], b: pl[k + 1] });
      if (P.fp.pin1) { const p = E.padAt(P, { at: [P.fp.pin1[0] - 1.6, P.fp.pin1[1]] }); L.F_Silk.push({ type: "flash", ap: { kind: "C", w: 0.4, h: 0.4 }, at: p }); }
    }
    const o = [[0, 0], [B.w, 0], [B.w, B.h], [0, B.h]];
    o.forEach((p, i) => L.Edge_Cuts.push({ type: "stroke", ap: { kind: "C", w: 0.1, h: 0.1 }, a: p, b: o[(i + 1) % 4] }));
    return L;
  };
  E.FILEFN = { F_Cu: "Copper,L1,Top", B_Cu: "Copper,L2,Bot", F_Mask: "Soldermask,Top", B_Mask: "Soldermask,Bot", F_Paste: "Paste,Top", F_Silk: "Legend,Top", Edge_Cuts: "Profile,NP" };

  const fx = (v) => String(Math.round(v * 1e6));
  const apKey = (a) => `${a.kind},${a.w.toFixed(6)}${a.kind === "C" ? "" : "X" + a.h.toFixed(6)}`;

  E.toGerber = (name, prims, meta = {}) => {
    const aps = new Map(), o = [];
    for (const p of prims) if (p.type !== "region" && !aps.has(apKey(p.ap))) aps.set(apKey(p.ap), 10 + aps.size);
    o.push("G04 diagram-eda, " + name + (meta.hash ? ", model " + meta.hash : "") + "*", "%TF.GenerationSoftware,HarperZ9,diagram-eda,0.1*%", `%TF.FileFunction,${E.FILEFN[name] || "Other,unknown"}*%`, "%TF.FilePolarity,Positive*%", "%FSLAX46Y46*%", "%MOMM*%", "%LPD*%");
    for (const [k, d] of aps) o.push(`%ADD${d}${k}*%`);
    o.push("G01*");
    let cur = -1;
    const sel = (p) => { const d = aps.get(apKey(p.ap)); if (d !== cur) { o.push("D" + d + "*"); cur = d; } };
    for (const p of prims) {
      if (p.type === "flash") { sel(p); o.push(`X${fx(p.at[0])}Y${fx(p.at[1])}D03*`); }
      else if (p.type === "stroke") { sel(p); o.push(`X${fx(p.a[0])}Y${fx(p.a[1])}D02*`, `X${fx(p.b[0])}Y${fx(p.b[1])}D01*`); }
      else { o.push("G36*", `X${fx(p.pts[0][0])}Y${fx(p.pts[0][1])}D02*`); for (const q of p.pts.slice(1).concat([p.pts[0]])) o.push(`X${fx(q[0])}Y${fx(q[1])}D01*`); o.push("G37*"); }
    }
    o.push("M02*");
    return o.join("\n") + "\n";
  };

  E.parseGerber = (txt) => {
    const prims = [], aps = {}, attrs = {};
    let fmt = null, unit = null, cur = null, pt = [0, 0], region = null;
    const blocks = txt.replace(/\r/g, "").split(/(%[^%]*%)/).filter((s) => s.trim());
    const coord = (s, k, prev) => { const m = new RegExp(k + "([-+]?\\d+)").exec(s); return m ? parseInt(m[1], 10) / Math.pow(10, fmt[1]) : prev; };
    for (const b of blocks) {
      if (b.startsWith("%")) {
        const body = b.slice(1, -1).replace(/\*$/, "");
        if (body.startsWith("FS")) { const m = /FSLAX(\d)(\d)Y(\d)(\d)/.exec(body); if (!m) throw new Error("gerber: only FSLA (absolute, leading zeros omitted) is read"); fmt = [+m[1], +m[2]]; }
        else if (body.startsWith("MO")) unit = body.slice(2);
        else if (body.startsWith("AD")) {
          const m = /^ADD(\d+)([CRO]),([\d.]+)(?:X([\d.]+))?/.exec(body);
          if (!m) throw new Error("gerber: aperture not read: " + body);
          aps[m[1]] = { kind: m[2], w: +m[3], h: m[4] ? +m[4] : +m[3] };
        } else if (body.startsWith("TF")) { const [k, ...v] = body.slice(3).split(","); attrs[k] = v.join(","); }
        else if (body.startsWith("AM") || body.startsWith("SR")) throw new Error("gerber: " + body.slice(0, 2) + " is not read here");
        else if (body.startsWith("LP")) { if (body !== "LPD") throw new Error("gerber: clear polarity is not read here"); }
        continue;
      }
      for (let w of b.split("*")) {
        w = w.trim();
        if (!w || w.startsWith("G04")) continue;
        if (w === "G01") continue;
        if (w === "G02" || w === "G03") throw new Error("gerber: arcs are not read here");
        if (w === "G36") { region = []; continue; }
        if (w === "G37") { if (region.length > 1 && Math.abs(region[0][0] - region[region.length - 1][0]) < 1e-9 && Math.abs(region[0][1] - region[region.length - 1][1]) < 1e-9) region.pop(); prims.push({ type: "region", pts: region }); region = null; continue; }
        if (w === "M02") break;
        const dm = /D(\d+)$/.exec(w);
        if (!dm) throw new Error("gerber: word not read: " + w);
        const d = +dm[1], np = [coord(w, "X", pt[0]), coord(w, "Y", pt[1])];
        if (d >= 10) { cur = aps[d]; if (!cur) throw new Error("gerber: undefined aperture D" + d); continue; }
        if (region) { if (d === 2) region = [np]; else region.push(np); pt = np; continue; }
        if (d === 3) prims.push({ type: "flash", ap: cur, at: np });
        else if (d === 1) prims.push({ type: "stroke", ap: cur, a: pt, b: np });
        pt = np;
      }
    }
    if (unit !== "MM") throw new Error("gerber: units must be MM");
    return { prims, apertures: aps, attrs, format: fmt };
  };

  /* rasterise primitives on the same pixel grid as E.rasterShapes (row 0 at the top) */
  E.rasterPrims = (prims, win, ppm) => {
    const W = Math.round((win[2] - win[0]) * ppm), H = Math.round((win[3] - win[1]) * ppm), m = new Uint8Array(W * H);
    const X = (i) => win[0] + (i + 0.5) / ppm, Y = (j) => win[3] - (j + 0.5) / ppm;
    const box = (x0, y0, x1, y1, f) => {
      for (let j = Math.max(0, Math.floor((win[3] - y1) * ppm)); j <= Math.min(H - 1, Math.ceil((win[3] - y0) * ppm)); j++)
        for (let i = Math.max(0, Math.floor((x0 - win[0]) * ppm)); i <= Math.min(W - 1, Math.ceil((x1 - win[0]) * ppm)); i++) if (f(X(i), Y(j))) m[j * W + i] = 1;
    };
    const cap = (a, b, r) => (x, y) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((x - a[0]) * dx + (y - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); const ex = x - a[0] - t * dx, ey = y - a[1] - t * dy; return ex * ex + ey * ey <= r * r; };
    for (const p of prims) {
      if (p.type === "flash") {
        const { kind, w, h } = p.ap, [cx, cy] = p.at;
        if (kind === "C") box(cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2, cap(p.at, p.at, w / 2));
        else if (kind === "R") box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, (x, y) => Math.abs(x - cx) <= w / 2 && Math.abs(y - cy) <= h / 2);
        else { const r = Math.min(w, h) / 2, L = Math.max(w, h) / 2 - r, a = w >= h ? [cx - L, cy] : [cx, cy - L], b = w >= h ? [cx + L, cy] : [cx, cy + L]; box(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, cap(a, b, r)); }
      } else if (p.type === "stroke") {
        const r = p.ap.w / 2; box(Math.min(p.a[0], p.b[0]) - r, Math.min(p.a[1], p.b[1]) - r, Math.max(p.a[0], p.b[0]) + r, Math.max(p.a[1], p.b[1]) + r, cap(p.a, p.b, r));
      } else {
        const P = p.pts, xs = P.map((q) => q[0]), ys = P.map((q) => q[1]);
        box(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; });
      }
    }
    return { W, H, m, win, ppm };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);

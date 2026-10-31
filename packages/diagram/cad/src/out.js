// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/cad/out: the sheet's entities written as SVG and as DXF, and a DXF reader for the round trip.
   DXF is release 12 ASCII (AC1009), the oldest form every CAD reader still opens: HEADER, TABLES (LTYPE,
   LAYER), ENTITIES (LINE, POLYLINE with VERTEX and SEQEND, CIRCLE, ARC, SOLID, TEXT), EOF. Written here,
   no library. Text uses the R12 control codes %%p (plus-minus), %%c (diameter) and %%d (degree). */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const C = (D.CAD = D.CAD || {});

  /* layer: [DXF colour, linetype, SVG stroke width mm, dash] after ISO 128-20 line widths for a 0.5 group */
  C.LAYERS = {
    OUTLINE: [7, "CONTINUOUS", 0.5], HIDDEN: [1, "DASHED", 0.35, "3 1.5"], CENTER: [3, "CENTER", 0.25, "9 1.5 1.5 1.5"],
    DIM: [2, "CONTINUOUS", 0.25], TEXT: [7, "CONTINUOUS", 0.25], HATCH: [8, "CONTINUOUS", 0.18], BORDER: [7, "CONTINUOUS", 0.7],
    TITLE: [7, "CONTINUOUS", 0.35], BALLOON: [5, "CONTINUOUS", 0.25], CUT: [6, "CENTER", 0.25, "9 1.5 1.5 1.5"], CUTEND: [6, "CONTINUOUS", 0.7],
  };
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const n4 = (x) => (Math.round(x * 1e4) / 1e4).toString();

  /* SVG, y flipped to the screen. opt.inline drops the size so the page can scale it; opt.paper/ink colours. */
  C.toSVG = (S, opt = {}) => {
    const H = S.h, Y = (y) => n4(H - y), X = n4, out = [];
    const at = (e) => (e.part ? ` data-part="${esc(e.part)}"` : "") + (e.item ? ` data-item="${e.item}"` : "") + (e.dim ? ` data-dim="${esc(e.dim)}"` : "");
    for (const e of S.E) {
      const c = ` class="L-${e.layer}${e.fill ? " fill" : ""}"` + at(e);
      if (e.t === "line") out.push(`<line${c} x1="${X(e.a[0])}" y1="${Y(e.a[1])}" x2="${X(e.b[0])}" y2="${Y(e.b[1])}"/>`);
      else if (e.t === "poly") out.push(`<${e.closed ? "polygon" : "polyline"}${c} points="${e.pts.map((p) => X(p[0]) + "," + Y(p[1])).join(" ")}"/>`);
      else if (e.t === "circle") out.push(`<circle${c} cx="${X(e.c[0])}" cy="${Y(e.c[1])}" r="${n4(e.r)}"/>`);
      else if (e.t === "arc") {
        const r = (a) => (a * Math.PI) / 180, p0 = [e.c[0] + e.r * Math.cos(r(e.a0)), e.c[1] + e.r * Math.sin(r(e.a0))], p1 = [e.c[0] + e.r * Math.cos(r(e.a1)), e.c[1] + e.r * Math.sin(r(e.a1))];
        out.push(`<path${c} d="M${X(p0[0])} ${Y(p0[1])}A${n4(e.r)} ${n4(e.r)} 0 ${e.a1 - e.a0 > 180 ? 1 : 0} 0 ${X(p1[0])} ${Y(p1[1])}"/>`);
      } else if (e.t === "solid") out.push(`<polygon class="L-${e.layer} fill"${at(e)} points="${e.pts.map((p) => X(p[0]) + "," + Y(p[1])).join(" ")}"/>`);
      else if (e.t === "text") {
        const anchor = e.align === "center" ? "middle" : e.align === "right" ? "end" : "start", rot = e.rot ? ` transform="rotate(${-e.rot} ${X(e.at[0])} ${Y(e.at[1])})"` : "";
        out.push(`<text class="T-${e.layer}"${at(e)} x="${X(e.at[0])}" y="${Y(e.at[1])}" font-size="${n4(e.h)}" text-anchor="${anchor}"${rot}>${esc(e.s)}</text>`);
      }
    }
    const css = Object.entries(C.LAYERS).map(([k, v]) => `.L-${k}{stroke-width:${v[2]}px;${v[3] ? `stroke-dasharray:${v[3]};` : ""}}`).join("");
    const size = opt.inline ? "" : ` width="${S.w}mm" height="${S.h}mm"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S.w} ${S.h}"${size} class="cad-sheet" role="img" aria-label="${esc(opt.label || "drawing")}">` +
      `<style>.cad-sheet{background:var(--dw-paper,#fff)}.cad-sheet line,.cad-sheet polyline,.cad-sheet polygon,.cad-sheet circle,.cad-sheet path{fill:none;stroke:var(--dw-ink,#111);stroke-linecap:round;stroke-linejoin:round}` +
      `.cad-sheet .fill{fill:var(--dw-ink,#111)}.cad-sheet text{fill:var(--dw-ink,#111);stroke:none;font-family:var(--dw-face,"Hanken Grotesk",Arial,sans-serif)}` +
      `.cad-sheet .L-HATCH{stroke:var(--dw-soft,#555)}.cad-sheet .L-HIDDEN{stroke:var(--dw-soft,#444)}.cad-sheet .sel{stroke:var(--dw-sel,#c8322b)!important}.cad-sheet .fill.sel{fill:var(--dw-sel,#c8322b)!important}.cad-sheet text.sel{fill:var(--dw-sel,#c8322b)!important;stroke:none!important}${css}</style>` +
      `<rect x="0" y="0" width="${S.w}" height="${S.h}" style="fill:var(--dw-paper,#fff);stroke:none"/>${out.join("")}</svg>`;
  };

  const dxfText = (s) => C.ascii(s).replace(/±/g, "%%p").replace(/Ø/g, "%%c").replace(/°/g, "%%d");
  const undxfText = (s) => s.replace(/%%p/gi, "±").replace(/%%c/gi, "Ø").replace(/%%d/gi, "°");

  C.toDXF = (S) => {
    const o = [], p = (code, v) => o.push(String(code), String(v));
    const f = (x) => (Math.round(x * 1e6) / 1e6).toFixed(6).replace(/\.?0+$/, "") || "0";
    p(0, "SECTION"); p(2, "HEADER"); p(9, "$ACADVER"); p(1, "AC1009"); p(9, "$EXTMIN"); p(10, 0); p(20, 0); p(9, "$EXTMAX"); p(10, S.w); p(20, S.h); p(0, "ENDSEC");
    p(0, "SECTION"); p(2, "TABLES");
    const LT = { CONTINUOUS: ["Solid line", []], DASHED: ["Dashed __ __ __", [3, -1.5]], CENTER: ["Center ____ _ ____", [9, -1.5, 1.5, -1.5]] };
    p(0, "TABLE"); p(2, "LTYPE"); p(70, Object.keys(LT).length);
    for (const [name, [desc, pat]] of Object.entries(LT)) { p(0, "LTYPE"); p(2, name); p(70, 0); p(3, desc); p(72, 65); p(73, pat.length); p(40, f(pat.reduce((s, x) => s + Math.abs(x), 0))); for (const x of pat) p(49, f(x)); }
    p(0, "ENDTAB");
    p(0, "TABLE"); p(2, "LAYER"); p(70, Object.keys(C.LAYERS).length);
    for (const [name, v] of Object.entries(C.LAYERS)) { p(0, "LAYER"); p(2, name); p(70, 0); p(62, v[0]); p(6, v[1]); }
    p(0, "ENDTAB"); p(0, "ENDSEC");
    p(0, "SECTION"); p(2, "ENTITIES");
    for (const e of S.E) {
      if (e.t === "line") { p(0, "LINE"); p(8, e.layer); p(10, f(e.a[0])); p(20, f(e.a[1])); p(30, 0); p(11, f(e.b[0])); p(21, f(e.b[1])); p(31, 0); }
      else if (e.t === "poly") { p(0, "POLYLINE"); p(8, e.layer); p(66, 1); p(70, e.closed ? 1 : 0); p(10, 0); p(20, 0); p(30, 0); for (const q of e.pts) { p(0, "VERTEX"); p(8, e.layer); p(10, f(q[0])); p(20, f(q[1])); p(30, 0); } p(0, "SEQEND"); p(8, e.layer); }
      else if (e.t === "circle") { p(0, "CIRCLE"); p(8, e.layer); p(10, f(e.c[0])); p(20, f(e.c[1])); p(30, 0); p(40, f(e.r)); }
      else if (e.t === "arc") { p(0, "ARC"); p(8, e.layer); p(10, f(e.c[0])); p(20, f(e.c[1])); p(30, 0); p(40, f(e.r)); p(50, f(e.a0)); p(51, f(e.a1)); }
      else if (e.t === "solid") { const q = e.pts.concat([e.pts[e.pts.length - 1]]).slice(0, 4); p(0, "SOLID"); p(8, e.layer); q.forEach((pt, i) => { p(10 + i, f(pt[0])); p(20 + i, f(pt[1])); p(30 + i, 0); }); }
      else if (e.t === "text") {
        const hj = e.align === "center" ? 1 : e.align === "right" ? 2 : 0;
        p(0, "TEXT"); p(8, e.layer); p(10, f(e.at[0])); p(20, f(e.at[1])); p(30, 0); p(40, f(e.h)); p(1, dxfText(e.s)); if (e.rot) p(50, f(e.rot));
        if (hj) { p(72, hj); p(11, f(e.at[0])); p(21, f(e.at[1])); p(31, 0); }
      }
    }
    p(0, "ENDSEC"); p(0, "EOF");
    return o.join("\r\n") + "\r\n";
  };

  /* Read R12 ASCII DXF back to entities in the same shape the sheet holds. */
  C.parseDXF = (txt) => {
    const L = txt.split(/\r?\n/), pairs = [];
    for (let i = 0; i + 1 < L.length; i += 2) pairs.push([parseInt(L[i].trim(), 10), L[i + 1].replace(/\s+$/, "")]);
    const out = { header: {}, layers: [], ltypes: [], entities: [] };
    let i = 0, section = null;
    const take = () => { const rec = { type: pairs[i][1], g: [] }; i++; while (i < pairs.length && pairs[i][0] !== 0) { rec.g.push(pairs[i]); i++; } return rec; };
    const val = (r, c) => { const q = r.g.find((x) => x[0] === c); return q ? q[1] : undefined; };
    const num = (r, c) => { const v = val(r, c); return v === undefined ? undefined : parseFloat(v); };
    while (i < pairs.length) {
      const [code, v] = pairs[i];
      if (code !== 0) { i++; continue; }
      if (v === "SECTION") { section = pairs[i + 1][1]; i += 2; continue; }
      if (v === "ENDSEC") { section = null; i++; continue; }
      if (v === "EOF") break;
      const r = take();
      if (section === "HEADER") continue;
      if (section === "TABLES") { if (r.type === "LAYER") out.layers.push({ name: val(r, 2), color: +val(r, 62), ltype: val(r, 6) }); if (r.type === "LTYPE") out.ltypes.push(val(r, 2)); continue; }
      if (section !== "ENTITIES") continue;
      const layer = val(r, 8);
      if (r.type === "LINE") out.entities.push({ t: "line", layer, a: [num(r, 10), num(r, 20)], b: [num(r, 11), num(r, 21)] });
      else if (r.type === "CIRCLE") out.entities.push({ t: "circle", layer, c: [num(r, 10), num(r, 20)], r: num(r, 40) });
      else if (r.type === "ARC") out.entities.push({ t: "arc", layer, c: [num(r, 10), num(r, 20)], r: num(r, 40), a0: num(r, 50), a1: num(r, 51) });
      else if (r.type === "SOLID") { const pts = [0, 1, 2, 3].map((k) => [num(r, 10 + k), num(r, 20 + k)]); if (pts[3][0] === pts[2][0] && pts[3][1] === pts[2][1]) pts.pop(); out.entities.push({ t: "solid", layer, pts }); }
      else if (r.type === "TEXT") { const hj = +(val(r, 72) || 0); out.entities.push({ t: "text", layer, at: hj ? [num(r, 11), num(r, 21)] : [num(r, 10), num(r, 20)], h: num(r, 40), s: undefxt(val(r, 1)), rot: num(r, 50) || 0, align: ["left", "center", "right"][hj] }); }
      else if (r.type === "POLYLINE") {
        const e = { t: "poly", layer, closed: (+(val(r, 70) || 0) & 1) === 1, pts: [] };
        while (i < pairs.length && pairs[i][1] === "VERTEX" && pairs[i][0] === 0) { const vx = take(); e.pts.push([num(vx, 10), num(vx, 20)]); }
        if (i < pairs.length && pairs[i][1] === "SEQEND") take();
        out.entities.push(e);
      }
    }
    return out;
  };
  const undefxt = (s) => undxfText(s || "");

  if (typeof module !== "undefined" && module.exports) module.exports = C;
})(typeof globalThis !== "undefined" ? globalThis : this);

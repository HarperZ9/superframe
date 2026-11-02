// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/cad/schsvg: the routed schematic drawn as SVG on an A3 sheet: symbols from the library, pins, reference
   designators and values, wires, junction dots, net labels, power symbols, no-connect marks, a frame and a
   small title block. Each symbol is a group with data-ref and data-part, so selection reaches it. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const C = (D.CAD = D.CAD || {});
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const f = (x) => (Math.round(x * 1000) / 1000).toString();

  const drawBody = (U, at, rot) => U.body.map((b) => {
    const T = (p) => C.libToSheet(at, rot, p);
    if (b.rect) { const a = T([b.rect[0], b.rect[1]]), c = T([b.rect[2], b.rect[3]]); return `<rect class="s-b${b.fill ? " fill" : ""}" x="${f(Math.min(a[0], c[0]))}" y="${f(Math.min(a[1], c[1]))}" width="${f(Math.abs(c[0] - a[0]))}" height="${f(Math.abs(c[1] - a[1]))}"/>`; }
    if (b.poly) return `<polyline class="s-b" points="${b.poly.map((p) => T(p).map(f).join(",")).join(" ")}"/>`;
    if (b.circle) { const c = T([b.circle[0], b.circle[1]]); return `<circle class="s-b" cx="${f(c[0])}" cy="${f(c[1])}" r="${f(b.circle[2])}"/>`; }
    if (b.text) { const c = T([b.text[0], b.text[1]]); return `<text class="s-t" x="${f(c[0])}" y="${f(c[1] + 0.6)}" font-size="2" text-anchor="middle">${esc(b.text[2])}</text>`; }
    return "";
  }).join("");

  C.schematicSVG = (SC, opt = {}) => {
    const o = [], lib = C.SYM;
    for (const s of SC.syms) {
      const S = lib[s.sym], U = S.units[s.unit - 1], vert = s.rot === 90 || s.rot === 270;
      const ref = s.nUnits > 1 ? s.ref + String.fromCharCode(64 + s.unit) : s.ref;
      let body = drawBody(U, s.at, s.rot);
      for (const q of s.pins) {
        const lp = U.pins.find((x) => x.num === q.num), e = C.libToSheet(s.at, s.rot, [lp.at[0] + Math.cos((lp.ang * Math.PI) / 180) * lp.len, lp.at[1] + Math.sin((lp.ang * Math.PI) / 180) * lp.len]);
        body += `<line class="s-p" x1="${f(q.p[0])}" y1="${f(q.p[1])}" x2="${f(e[0])}" y2="${f(e[1])}"/>`;
        if (S.names || (s.sym === "OPA2" && /V/.test(q.name)) || s.sym === "BAT3" || s.sym === "SW2") {
          const m = [(q.p[0] + e[0]) / 2, (q.p[1] + e[1]) / 2], horiz = Math.abs(q.p[1] - e[1]) < 1e-6;
          const lab = S.names ? q.name : q.num;
          body += `<text class="s-n" x="${f(m[0] + (horiz ? 0 : 0.8))}" y="${f(m[1] + (horiz ? -0.6 : 0.6))}" font-size="1.4" text-anchor="${horiz ? "middle" : "start"}">${esc(lab)}</text>`;
        }
      }
      const rp = vert ? [s.at[0], s.at[1] - 2.3] : C.libToSheet(s.at, 0, S.refAt || [2.5, 1]), vp = vert ? [s.at[0], s.at[1] + 4.1] : C.libToSheet(s.at, 0, S.valAt || [2.5, -1.4]);
      const anchor = vert ? "middle" : S.refJust === "right" ? "end" : (S.refAt && S.refAt[0] === 0) || s.sym === "OPA2" ? "middle" : "start";
      const showVal = !(s.nUnits > 1 && s.unit > 1);
      body += `<text class="s-ref" x="${f(rp[0])}" y="${f(rp[1])}" font-size="1.8" text-anchor="${anchor}">${esc(ref)}</text>`;
      if (showVal) body += `<text class="s-val" x="${f(vp[0])}" y="${f(vp[1])}" font-size="1.6" text-anchor="${anchor}">${esc(s.value)}</text>`;
      o.push(`<g class="s-sym" data-ref="${esc(s.ref)}" data-part="${esc(s.part || "")}" tabindex="0" role="button" aria-label="${esc(ref + " " + s.value + ", " + S.desc)}"><rect class="s-hit" x="${f(s.box[0] - 1)}" y="${f(s.box[1] - 1)}" width="${f(s.box[2] - s.box[0] + 2)}" height="${f(s.box[3] - s.box[1] + 2)}"/>${body}</g>`);
    }
    for (const w of SC.wires) o.push(`<line class="s-w" data-net="${esc(w.net)}" x1="${f(w.a[0])}" y1="${f(w.a[1])}" x2="${f(w.b[0])}" y2="${f(w.b[1])}"/>`);
    for (const j of SC.junctions) o.push(`<circle class="s-j" cx="${f(j.at[0])}" cy="${f(j.at[1])}" r="0.5"/>`);
    for (const n of SC.noconn) o.push(`<path class="s-w" d="M${f(n.at[0] - 0.8)} ${f(n.at[1] - 0.8)}l1.6 1.6M${f(n.at[0] - 0.8)} ${f(n.at[1] + 0.8)}l1.6 -1.6"/>`);
    for (const L of SC.labels) {
      const anc = L.ang === 180 ? "end" : "start", dx = L.ang === 180 ? -0.6 : L.ang === 0 ? 0.6 : 0.4, dy = L.ang === 90 ? -0.8 : L.ang === 270 ? 1.8 : -0.5;
      o.push(`<text class="s-lab" data-net="${esc(L.net)}" x="${f(L.at[0] + dx)}" y="${f(L.at[1] + dy)}" font-size="1.6" text-anchor="${L.ang === 90 || L.ang === 270 ? "middle" : anc}">${esc(L.net)}</text>`);
    }
    for (const p of SC.power) {
      const U = C.SYM[p.sym].units[0], up = p.sym === "PWR", lv = C.libToSheet(p.at, p.rot, C.SYM[p.sym].valAt), side = p.rot === 90 || p.rot === 270;
      o.push(`<g class="s-pwr" data-net="${esc(p.net)}">${drawBody(U, p.at, p.rot)}<text class="s-lab" x="${f(side ? lv[0] : p.at[0])}" y="${f(side ? p.at[1] + 0.6 : lv[1] + (up ? 0 : 0.8))}" font-size="1.5" text-anchor="${side ? (p.rot === 90 ? "start" : "end") : "middle"}">${esc(p.net)}</text></g>`);
    }
    /* frame and title block */
    const W = SC.w, H = SC.h, x0 = W - 150, y0 = H - 30;
    o.push(`<rect class="s-f" x="10" y="10" width="${W - 20}" height="${H - 20}"/><rect class="s-f" x="${x0}" y="${y0}" width="140" height="20"/>`);
    o.push(`<line class="s-f" x1="${x0}" y1="${y0 + 10}" x2="${x0 + 140}" y2="${y0 + 10}"/><line class="s-f" x1="${x0 + 90}" y1="${y0 + 10}" x2="${x0 + 90}" y2="${y0 + 20}"/>`);
    o.push(`<text class="s-tb" x="${x0 + 2}" y="${y0 + 7}" font-size="4">${esc(SC.title)}</text><text class="s-tb" x="${x0 + 2}" y="${y0 + 16.5}" font-size="2.6">${esc(SC.number)}  REV A  ${esc(opt.date || "2026-10-31")}</text><text class="s-tb" x="${x0 + 92}" y="${y0 + 16.5}" font-size="2.2">model ${esc(opt.hash || "")}</text>`);
    const css = `.cad-sch{background:var(--dw-paper,#fff)}.cad-sch *{vector-effect:non-scaling-stroke}.cad-sch .s-b,.cad-sch .s-p,.cad-sch .s-w,.cad-sch .s-f{fill:none;stroke:var(--dw-ink,#111);stroke-width:1.3px;stroke-linecap:round}` +
      `.cad-sch .s-w{stroke:var(--dw-wire,#1d2562)}.cad-sch .s-f{stroke-width:1.6px}.cad-sch .fill{fill:var(--dw-ink,#111)}.cad-sch .s-j{fill:var(--dw-wire,#1d2562)}.cad-sch text{font-family:var(--dw-face,"Hanken Grotesk",Arial,sans-serif);fill:var(--dw-ink,#111)}` +
      `.cad-sch .s-n,.cad-sch .s-val{fill:var(--dw-soft,#444)}.cad-sch .s-lab{fill:var(--dw-wire,#1d2562);font-weight:700}.cad-sch .s-ref{font-weight:700}.cad-sch .s-hit{fill:transparent;stroke:none}.cad-sch .s-sym{cursor:pointer}` +
      `.cad-sch .s-sym.sel .s-b,.cad-sch .s-sym.sel .s-p{stroke:var(--dw-sel,#c8322b);stroke-width:2.4px}.cad-sch .s-sym.sel text{fill:var(--dw-sel,#c8322b)}.cad-sch .s-sym:focus-visible .s-hit{stroke:var(--dw-sel,#c8322b);stroke-width:1px}`;
    let vb = `0 0 ${W} ${H}`;
    if (opt.crop) {   /* the page shows the drawn part of the sheet; exports keep the whole sheet */
      const xs = [], ys = [];
      for (const s of SC.syms) { xs.push(s.box[0] - 4, s.box[2] + 4); ys.push(s.box[1] - 5, s.box[3] + 5); }
      for (const w of SC.wires) { xs.push(w.a[0], w.b[0]); ys.push(w.a[1], w.b[1]); }
      for (const p of SC.labels.concat(SC.power)) { xs.push(p.at[0] - 12, p.at[0] + 12); ys.push(p.at[1] - 5, p.at[1] + 5); }
      const x0 = Math.min(...xs) - 6, y0 = Math.min(...ys) - 6, x1 = Math.max(...xs) + 6, y1 = Math.max(...ys) + 6;
      vb = `${f(x0)} ${f(y0)} ${f(x1 - x0)} ${f(y1 - y0)}`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${opt.inline ? "" : ` width="${W}mm" height="${H}mm"`} class="cad-sch" role="img" aria-label="${esc(opt.label || "schematic")}"><style>${css}</style><rect x="0" y="0" width="${W}" height="${H}" style="fill:var(--dw-paper,#fff)"/>${o.join("")}</svg>`;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = C;
})(typeof globalThis !== "undefined" ? globalThis : this);

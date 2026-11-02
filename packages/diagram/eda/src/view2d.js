// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/view2d: the board seen from above, as SVG from the vector geometry (for the page) and as an RGBA
   composite from the shape rasteriser (for the comparison images). Layers are drawn back to front: bottom copper,
   top copper, pads, vias, silkscreen, outline. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});
  const n3 = (x) => Math.round(x * 1000) / 1000;

  E.boardSVG = (B, opt = {}) => {
    const H = B.h, Y = (y) => n3(H - y), o = [], path = (s) => { const P = E.shapePoly(s); return "M" + P.map((p) => n3(p[0]) + " " + Y(p[1])).join("L") + "Z"; };
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${n3(B.w + 2)} ${n3(B.h + 2)}" class="eda-board" role="img" aria-label="${opt.label || "board, top view"}">`);
    o.push(`<rect x="0" y="0" width="${B.w}" height="${B.h}" class="b-fr4"/>`);
    if (opt.bottom !== false) {
      o.push(`<g class="b-bcu">` + B.pourRects.map((r) => `<rect x="${n3(r.rect[0])}" y="${Y(r.rect[3])}" width="${n3(r.rect[2] - r.rect[0])}" height="${n3(r.rect[3] - r.rect[1])}"/>`).join("") + "</g>");
      o.push(`<g class="b-bcu b-tr">` + B.traces.filter((s) => s.layer === 1).map((s) => `<line x1="${n3(s.a[0])}" y1="${Y(s.a[1])}" x2="${n3(s.b[0])}" y2="${Y(s.b[1])}" stroke-width="${s.w}"/>`).join("") + "</g>");
    }
    o.push(`<g class="b-fcu b-tr">` + B.traces.filter((s) => s.layer === 0).map((s) => `<line data-net="${s.net}" x1="${n3(s.a[0])}" y1="${Y(s.a[1])}" x2="${n3(s.b[0])}" y2="${Y(s.b[1])}" stroke-width="${s.w}"/>`).join("") + "</g>");
    o.push(`<g class="b-pad">` + E.pads(B).map((q) => `<path data-ref="${q.P.ref}" data-net="${q.net}" d="${path(q.shape)}"/>`).join("") + B.parts.filter((P) => P.bridge).map((P) => `<line x1="${n3(P.bridge.a[0])}" y1="${Y(P.bridge.a[1])}" x2="${n3(P.bridge.b[0])}" y2="${Y(P.bridge.b[1])}" stroke-width="${P.bridge.w}"/>`).join("") + "</g>");
    o.push(`<g class="b-hole">` + E.pads(B).filter((q) => q.pad.drill).map((q) => `<circle cx="${n3(q.at[0])}" cy="${Y(q.at[1])}" r="${q.pad.drill / 2}"/>`).join("") + "</g>");
    o.push(`<g class="b-via">` + B.vias.map((v) => `<circle data-net="${v.net}" cx="${n3(v.at[0])}" cy="${Y(v.at[1])}" r="${v.dia / 2}"/><circle class="b-drill" cx="${n3(v.at[0])}" cy="${Y(v.at[1])}" r="${v.drill / 2}"/>`).join("") + "</g>");
    if (B.fab) o.push(`<g class="b-silk">` + B.fab.F_Silk.map((p) => (p.type === "stroke" ? `<line x1="${n3(p.a[0])}" y1="${Y(p.a[1])}" x2="${n3(p.b[0])}" y2="${Y(p.b[1])}" stroke-width="${p.ap.w}"/>` : `<circle cx="${n3(p.at[0])}" cy="${Y(p.at[1])}" r="${p.ap.w / 2}"/>`)).join("") + "</g>");
    for (const e of opt.marks || []) o.push(`<circle class="b-err" cx="${n3(e.at[0])}" cy="${Y(e.at[1])}" r="1.2"/>`);
    o.push(`<rect x="0" y="0" width="${B.w}" height="${B.h}" class="b-edge"/></svg>`);
    return o.join("");
  };
  E.BOARD_SVG_CSS = ".eda-board .b-fr4{fill:#dcd3ad}.eda-board .b-bcu rect{fill:#8f6136;opacity:.32}.eda-board .b-bcu.b-tr line{stroke:#5a3a1c;opacity:.7}.eda-board .b-tr line{stroke-linecap:round}.eda-board .b-fcu line{stroke:#c8322b}.eda-board .b-pad path{fill:#d79e35}.eda-board .b-pad line{stroke:#d79e35}.eda-board .b-hole circle,.eda-board .b-drill{fill:#151314}.eda-board .b-via circle{fill:#d79e35}.eda-board .b-silk line{stroke:#f4f1ea;stroke-linecap:round}.eda-board .b-silk circle{fill:#f4f1ea}.eda-board .b-edge{fill:none;stroke:#151314;stroke-width:.15}.eda-board .b-err{fill:none;stroke:#1d2562;stroke-width:.35}";

  /* composite RGBA from layer masks (rows top-down), colours 0..255 */
  E.composite = (layers) => {
    const { W, H } = layers[0].mask, rgba = new Uint8ClampedArray(W * H * 4);
    for (let k = 0; k < W * H; k++) { rgba[k * 4 + 3] = 255; }
    for (const { mask, rgb, alpha = 1 } of layers) for (let k = 0; k < W * H; k++) if (mask.m[k]) for (let c = 0; c < 3; c++) rgba[k * 4 + c] = rgba[k * 4 + c] * (1 - alpha) + rgb[c] * alpha;
    return { W, H, rgba };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);

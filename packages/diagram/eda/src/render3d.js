// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/render3d: the routed board as an engine draw list, so the engine's software raster (and its WebGL2
   path in a page) draws it with the same shading as every instrument body. Layers stacked in millimetres: bottom
   copper, FR-4 core 1.6 mm, top copper 35 um, solder mask over the copper (translucent), ENIG pads and silkscreen
   above the mask. Colours come from eda/data/board-materials.json (copper, gold, titanium white read through the
   materials library; FR-4 and mask are assumed, the file says so). World: x across, y up, z toward the front panel. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});
  const T = { cu: 0.035, mask: 0.022, finish: 0.012, silk: 0.012, core: 1.6 };

  const circ = (c, r, n = 16) => Array.from({ length: n }, (_, k) => [c[0] + r * Math.cos((2 * Math.PI * k) / n), c[1] + r * Math.sin((2 * Math.PI * k) / n)]);
  const capsule = (a, b, r, n = 8) => {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), pts = [];
    for (let k = 0; k <= n; k++) { const t = ang + Math.PI / 2 + (Math.PI * k) / n; pts.push([a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)]); }
    for (let k = 0; k <= n; k++) { const t = ang - Math.PI / 2 + (Math.PI * k) / n; pts.push([b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)]); }
    return pts;
  };
  E.shapePoly = (s) => (s.pts.length === 1 ? circ(s.pts[0], s.r) : s.pts.length === 2 ? capsule(s.pts[0], s.pts[1], s.r) : s.pts);

  E.boardDrawList = (B, mat, opt = {}) => {
    const tris = [], triPart = [], style = [], X = (p) => p[0] - B.w / 2, Z = (p) => B.h / 2 - p[1];
    const st = (rgb, alpha = 1) => { style.push({ rgb, alpha, emit: 0 }); return style.length - 1; };
    const S = { fr4: st(mat.fr4.srgb), cu: st(mat.copper.srgb), enig: st(mat.enig.srgb), mask: st(mat.mask.srgb, opt.maskAlpha || mat.mask.alpha), silk: st(mat.silk.srgb), hole: st([0.05, 0.05, 0.05]), body: st(mat.epoxy_black.srgb), cer: st(mat.ceramic.srgb), maskB: st(mat.mask.srgb, opt.maskAlpha || mat.mask.alpha) };
    const tri = (a, b, c, s) => { tris.push(...a, ...b, ...c); triPart.push(s); };
    const prism = (poly, y0, y1, s) => {
      const P = poly.map((p) => [X(p), Z(p)]);
      for (let k = 1; k + 1 < P.length; k++) { tri([P[0][0], y1, P[0][1]], [P[k][0], y1, P[k][1]], [P[k + 1][0], y1, P[k + 1][1]], s); tri([P[0][0], y0, P[0][1]], [P[k + 1][0], y0, P[k + 1][1]], [P[k][0], y0, P[k][1]], s); }
      for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length]; tri([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], s); tri([a[0], y0, a[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], s); }
    };
    const top = T.core;
    prism([[0, 0], [B.w, 0], [B.w, B.h], [0, B.h]], 0, top, S.fr4);
    for (const s of B.traces) { const pl = capsule(s.a, s.b, s.w / 2, 6); s.layer ? prism(pl, -T.cu, 0, S.cu) : prism(pl, top, top + T.cu, S.cu); }
    for (const pr of B.pourRects) { const [x0, y0, x1, y1] = pr.rect; prism([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], -T.cu, 0, S.cu); }
    for (const v of B.vias) { prism(circ(v.at, v.dia / 2, 12), top, top + T.cu, S.cu); prism(circ(v.at, v.dia / 2, 12), -T.cu, 0, S.cu); }
    if (opt.mask !== false) { prism([[0, 0], [B.w, 0], [B.w, B.h], [0, B.h]], top + T.cu, top + T.cu + T.mask, S.mask); prism([[0, 0], [B.w, 0], [B.w, B.h], [0, B.h]], -T.cu - T.mask, -T.cu, S.maskB); }
    const yF = top + T.cu + T.mask;
    for (const q of E.pads(B)) {
      const poly = E.shapePoly(q.shape);
      prism(poly, top, yF + T.finish, S.enig);
      if (q.pad.side === "both") { prism(poly, -T.cu - T.mask - T.finish, 0, S.enig); prism(circ(q.at, q.pad.drill / 2, 16), yF + T.finish + 0.004, yF + T.finish + 0.012, S.hole); prism(circ(q.at, q.pad.drill / 2, 16), -T.cu - T.mask - T.finish - 0.012, -T.cu - T.mask - T.finish - 0.004, S.hole); }
    }
    for (const P of B.parts) if (P.bridge) prism(capsule(P.bridge.a, P.bridge.b, P.bridge.w / 2, 6), top, yF + T.finish, S.enig);
    if (opt.silk !== false && B.fab) for (const p of B.fab.F_Silk) {
      if (p.type === "stroke") prism(capsule(p.a, p.b, p.ap.w / 2, 4), yF, yF + T.silk, S.silk);
      else if (p.type === "flash") prism(circ(p.at, p.ap.w / 2, 10), yF, yF + T.silk, S.silk);
    }
    if (opt.bodies !== false) for (const P of B.parts) {
      if (!P.fp.smd || P.fp.tie) continue;
      const bw = P.rot % 180 ? P.fp.body[1] : P.fp.body[0], bh = P.rot % 180 ? P.fp.body[0] : P.fp.body[1], [cx, cy] = P.at;
      const r = [[cx - bw / 2, cy - bh / 2], [cx + bw / 2, cy - bh / 2], [cx + bw / 2, cy + bh / 2], [cx - bw / 2, cy + bh / 2]];
      if (/^C_/.test(P.fp.name)) { prism(r, yF, yF + P.fp.height, S.cer); continue; }
      if (/^R_/.test(P.fp.name)) { const inner = [[cx - bw * 0.32, cy - bh / 2], [cx + bw * 0.32, cy - bh / 2], [cx + bw * 0.32, cy + bh / 2], [cx - bw * 0.32, cy + bh / 2]]; prism(r, yF, yF + P.fp.height * 0.8, S.cer); prism(P.rot % 180 ? inner.map(([x, y]) => [cx + (y - cy), cy + (x - cx)]) : inner, yF + P.fp.height * 0.8, yF + P.fp.height, S.body); continue; }
      prism(r, yF + 0.1, yF + P.fp.height, S.body);
    }
    return { tris: Float64Array.from(tris), triPart: Int32Array.from(triPart), style, caps: [], lines: [], points: [], labels: [], nParts: style.length };
  };

  /* a camera that frames the board; yaw and pitch in radians */
  E.boardCamera = (B, c = {}) => ({ yaw: c.yaw === undefined ? 0.5 : c.yaw, pitch: c.pitch === undefined ? 0.75 : c.pitch, dist: (c.zoom || 1.35) * Math.hypot(B.w, B.h), target: [0, 0.8, 0], fov: 0.7 });

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);

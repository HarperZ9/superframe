// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/layout: the 2D schematic, drawn as SVG from the same model. Parts placed by hand (part.sch.x, .y in
   grid cells) keep their place; the rest are laid out in layers from the links (longest path from the sources,
   then barycentre ordering). After HP's own drawings (HP-JOURNAL-DIAGRAM-NOTES.md): every arrow carries the
   value and unit it transports, front-panel controls sit as small circles where they act, and a variant redraws
   the same base schematic with one current path heavy and a verdict beside it. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const CW = 150, CH = 92, BW = 104, BH = 46;

  D.autoLayout = (def) => {
    const ids = def.parts.filter((p) => !p.noSchematic).map((p) => p.id), set = new Set(ids);
    const out = new Map(ids.map((i) => [i, []])), inn = new Map(ids.map((i) => [i, []]));
    for (const l of def.links || []) if (set.has(l.from) && set.has(l.to) && !l.back) { out.get(l.from).push(l.to); inn.get(l.to).push(l.from); }
    const layer = new Map(), state = new Map();
    const visit = (u) => {   /* longest path, ignoring edges that close a cycle */
      if (state.get(u) === 2) return layer.get(u);
      if (state.get(u) === 1) return -1;
      state.set(u, 1);
      let L = 0;
      for (const p of inn.get(u)) { const lp = visit(p); if (lp >= 0) L = Math.max(L, lp + 1); }
      state.set(u, 2); layer.set(u, L);
      return L;
    };
    ids.forEach(visit);
    const cols = [];
    for (const i of ids) { const L = layer.get(i); (cols[L] = cols[L] || []).push(i); }
    const rank = new Map();
    cols.forEach((c) => c.forEach((i, k) => rank.set(i, k)));
    for (let pass = 0; pass < 3; pass++) for (let L = 1; L < cols.length; L++) {
      if (!cols[L]) continue;
      const bc = (i) => { const p = inn.get(i).filter((q) => layer.get(q) < L); return p.length ? p.reduce((s, q) => s + rank.get(q), 0) / p.length : rank.get(i); };
      cols[L].sort((a, b) => bc(a) - bc(b));
      cols[L].forEach((i, k) => rank.set(i, k));
    }
    const pos = new Map(), tall = Math.max(...cols.filter(Boolean).map((c) => c.length));
    cols.forEach((c, L) => c && c.forEach((i, k) => pos.set(i, [L, k + (tall - c.length) / 2])));
    return pos;
  };

  D.placement = (def) => {
    const auto = def.parts.some((p) => !p.sch || p.sch.x === undefined) ? D.autoLayout(def) : new Map();
    const pos = new Map();
    for (const p of def.parts) {
      if (p.noSchematic) continue;
      pos.set(p.id, p.sch && p.sch.x !== undefined ? [p.sch.x, p.sch.y] : auto.get(p.id));
    }
    return pos;
  };

  const px = (c) => [40 + c[0] * CW + BW / 2, 34 + c[1] * CH + BH / 2];
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /* Symbols, drawn about the centre, in the part's stroke. */
  const SYM = {
    res: (w) => `<path d="M${-w / 2} 0H-25l5-9 10 18 10-18 10 18 10-18 5 9H${w / 2}" />`,
    cap: (w) => `<path d="M${-w / 2} 0H-5M-5 -14V14M5 -14V14M5 0H${w / 2}" />`,
    lamp: (w) => `<path d="M${-w / 2} 0H-14M14 0H${w / 2}" /><circle r="14" /><path d="M-10 -10L10 10M-10 10L10 -10" />`,
    amp: (w) => `<path d="M-24 -22L26 0L-24 22Z" /><path d="M-36 -10H-24M-36 10H-24M26 0H${w / 2}" /><text x="-19" y="-6" class="sy">+</text><text x="-19" y="15" class="sy">-</text>`,
    gnd: () => `<path d="M0 -14V0M-14 0H14M-9 6H9M-4 12H4" />`,
    diode: (w) => `<path d="M${-w / 2} 0H-10M10 0H${w / 2}M-10 -10V10L10 0Z M10 -10V10" />`,
    coil: (w) => `<path d="M${-w / 2} 0H-24c0-12 12-12 12 0c0-12 12-12 12 0c0-12 12-12 12 0c0-12 12-12 12 0H${w / 2}" />`,
  };

  function elbow(a, b, back) {
    if (back) { const y = Math.max(a[1], b[1]) + CH * 0.62; return [[a[0], a[1]], [a[0] + 18, a[1]], [a[0] + 18, y], [b[0] - 18, y], [b[0] - 18, b[1]], [b[0], b[1]]]; }
    if (Math.abs(a[1] - b[1]) < 1) return [a, b];
    const m = (a[0] + b[0]) / 2;
    return [a, [m, a[1]], [m, b[1]], b];
  }
  D.linkPath = (pos, l, def) => {
    const A = px(pos.get(l.from)), B = px(pos.get(l.to)), back = l.back || B[0] < A[0] - 1;
    const kA = (def.parts.find((p) => p.id === l.from).sch || {}).kind, kB = (def.parts.find((p) => p.id === l.to).sch || {}).kind;
    const ha = kA === "gnd" ? 0 : BW / 2, hb = kB === "gnd" ? 0 : BW / 2;
    if (Math.abs(A[0] - B[0]) < 1) return [[A[0], A[1] + (B[1] > A[1] ? 1 : -1) * BH / 2], [B[0], B[1] - (B[1] > A[1] ? 1 : -1) * (kB === "gnd" ? 14 : BH / 2)]];
    return elbow([A[0] + (back ? ha : ha), A[1]], [B[0] - (back ? hb : hb), B[1]], back);
  };
  const d = (pts) => "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L");

  /* The SVG. opt.variant = { path: [part ids], verdict, kind: "pass" | "fail" | "open", title } draws one AN 123 panel. */
  D.schematicSVG = (def, opt = {}) => {
    const pos = D.placement(def), xs = [...pos.values()];
    const W = 40 * 2 + (Math.max(...xs.map((c) => c[0])) + 1) * CW - (CW - BW), H = 34 + (Math.max(...xs.map((c) => c[1])) + 1) * CH + 46;
    const o = [`<svg class="dg-sch" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="group" aria-label="${esc(opt.aria || def.title + ": schematic")}">`,
      `<defs><marker id="ar-${opt.uid || "m"}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="dg-ah"/></marker></defs>`];
    if (opt.variant) o.push(`<rect class="dg-tint" x="0" y="0" width="${W}" height="${H}"/>`);
    (def.links || []).forEach((l, i) => {
      if (!pos.has(l.from) || !pos.has(l.to)) return;
      const pts = D.linkPath(pos, l, def), mid = pts[Math.floor((pts.length - 1) / 2)], nx = pts[Math.floor((pts.length - 1) / 2) + 1] || mid;
      o.push(`<path class="dg-link${l.kind ? " k-" + l.kind : ""}" data-link="${i}" d="${d(pts)}" marker-end="url(#ar-${opt.uid || "m"})"/>`);
      if (l.label) o.push(`<text class="dg-lab" x="${((mid[0] + nx[0]) / 2).toFixed(1)}" y="${((mid[1] + nx[1]) / 2 - 6).toFixed(1)}" text-anchor="middle">${esc(l.label)}</text>`);
    });
    if (opt.variant && opt.variant.path) {
      const seq = opt.variant.path, pts = [];
      for (let k = 0; k + 1 < seq.length; k++) {
        const l = (def.links || []).find((q) => (q.from === seq[k] && q.to === seq[k + 1]) || (q.to === seq[k] && q.from === seq[k + 1]));
        let p = l ? D.linkPath(pos, l, def) : [px(pos.get(seq[k])), px(pos.get(seq[k + 1]))];
        if (l && l.from !== seq[k]) p = p.slice().reverse();
        pts.push(...p);
      }
      o.push(`<path class="dg-path k-${opt.variant.kind || "fail"}" d="${d(pts)}" marker-end="url(#ar-${opt.uid || "m"})"/>`);
    }
    for (const p of def.parts) {
      if (!pos.has(p.id)) continue;
      const [cx, cy] = px(pos.get(p.id)), kind = (p.sch && p.sch.kind) || "block", sym = SYM[kind];
      o.push(`<g class="dg-part" data-part="${esc(p.id)}" transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})" tabindex="0" role="button" aria-label="${esc(p.label + ": " + p.alt)}">`);
      o.push(sym ? `<rect class="dg-hit" x="${-BW / 2}" y="${-BH / 2}" width="${BW}" height="${BH}"/><g class="dg-sym">${sym(BW)}</g>` : `<rect class="dg-box" x="${-BW / 2}" y="${-BH / 2}" width="${BW}" height="${BH}"/>`);
      const lab = p.short || p.label;
      o.push(sym ? `<text class="dg-name" y="${kind === "gnd" ? 30 : BH / 2 + 14}" text-anchor="middle">${esc(lab)}</text>` : `<text class="dg-name in" y="5" text-anchor="middle">${esc(lab)}</text>`);
      o.push(`</g>`);
    }
    for (const c of def.controls || []) {
      const at = pos.get(c.at);
      if (!at) continue;
      const [cx, cy] = px(at), x = cx + (c.dx || 0) * BW / 2, y = cy - BH / 2 - 16 + (c.dy || 0);
      o.push(`<g class="dg-ctl" data-control="${esc(c.bind)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" tabindex="0" role="button" aria-label="Panel control ${esc(c.label)}: go to its live control"><circle r="7"/><text x="10" y="4">${esc(c.label)}</text></g>`);
    }
    o.push(`<g class="dg-flow" aria-hidden="true"></g></svg>`);
    return { svg: o.join(""), pos, W, H };
  };

  /* Points along a link's polyline at fraction s, for the moving current dots. */
  D.alongPath = (pts, s) => {
    const seg = [];
    let total = 0;
    for (let i = 0; i + 1 < pts.length; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); total += l; }
    let r = ((s % 1) + 1) % 1 * total;
    for (let i = 0; i < seg.length; i++) { if (r <= seg[i] || i === seg.length - 1) { const t = seg[i] ? r / seg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; } r -= seg[i]; }
    return pts[0];
  };
  D.SCH = { CW, CH, BW, BH, px };

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);

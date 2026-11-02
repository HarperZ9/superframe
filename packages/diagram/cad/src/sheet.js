// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/cad/sheet: drawing entities on a sheet in millimetres, y up (the DXF convention), and the drafting
   marks built from them: dimensions with their tolerances (ASME Y14.5-2018 unidirectional text, filled 3:1
   arrowheads, a 1 mm gap and 2 mm overshoot on extension lines), datum feature symbols and feature control
   frames, balloons, hatching clipped to a section loop (even-odd), and the ISO 7200 title block. Every
   writer (SVG, DXF) and every test reads the same entity list. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const C = (D.CAD = D.CAD || {});

  C.Sheet = (w, h) => {
    const E = [], S = { w, h, E };
    const add = (e) => { E.push(e); return e; };
    S.line = (a, b, layer, x) => add(Object.assign({ t: "line", a, b, layer }, x));
    S.poly = (pts, layer, x) => add(Object.assign({ t: "poly", pts, layer }, x));
    S.rect = (x0, y0, x1, y1, layer, x) => S.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], layer, Object.assign({ closed: true }, x));
    S.circle = (c, r, layer, x) => add(Object.assign({ t: "circle", c, r, layer }, x));
    S.arc = (c, r, a0, a1, layer, x) => add(Object.assign({ t: "arc", c, r, a0, a1, layer }, x));
    S.solid = (pts, layer, x) => add(Object.assign({ t: "solid", pts, layer }, x));
    S.text = (at, s, hgt, layer, x) => add(Object.assign({ t: "text", at, s: C.ascii(s), h: hgt, layer, align: "left", rot: 0 }, x));
    return S;
  };
  C.textW = (s, h) => String(s).length * h * 0.62;

  /* Filled arrowhead with its tip at p, pointing along unit vector d. */
  C.arrow = (S, p, d, layer = "DIM", x) => {
    const L = 3, w = 0.5, b = [p[0] - d[0] * L, p[1] - d[1] * L];
    S.solid([p, [b[0] - d[1] * w, b[1] + d[0] * w], [b[0] + d[1] * w, b[1] - d[0] * w]], layer, x);
  };

  /* The dimension's words: value and tolerance in ASME mm form (no trailing zeros, leading zero below 1). */
  C.tolText = (val, tol, prefix = "") => {
    const v = prefix + C.dec(val, 3);
    if (!tol) return v;
    if (tol.basic) return v;
    if (tol.ref) return "(" + v + ")";
    if (tol.limits) return C.dec(val + tol.limits[0], 3) + "/" + C.dec(val + tol.limits[1], 3);
    if (tol.pm !== undefined) return v + " ±" + C.dec(tol.pm, 3);
    const p = tol.plus === 0 ? "0" : "+" + C.dec(tol.plus, 3), m = tol.minus === 0 ? "0" : "-" + C.dec(Math.abs(tol.minus), 3);
    return v + " " + p + "/" + m;
  };

  /* Linear dimension between sheet points a and b, measured along x ("h") or y ("v"), with the dimension line
     `off` mm from a (signed: positive is up for "h", right for "v"). Returns the text entity. */
  C.linDim = (S, a, b, dir, off, text, meta) => {
    const x = Object.assign({ dim: meta && meta.id, part: meta && meta.part }, {}), h = 3.5, tw = C.textW(text, h);
    const H = dir === "h", base = H ? a[1] + off : a[0] + off, sgn = Math.sign(off) || 1;
    const p1 = H ? [a[0], base] : [base, a[1]], p2 = H ? [b[0], base] : [base, b[1]];
    for (const [q, pq] of [[a, p1], [b, p2]]) {   /* extension lines: 1 mm gap at the object, 2 mm past the dimension line */
      const from = H ? [q[0], q[1] + sgn * 1] : [q[0] + sgn * 1, q[1]], to = H ? [pq[0], pq[1] + sgn * 2] : [pq[0] + sgn * 2, pq[1]];
      if (Math.abs(H ? to[1] - from[1] : to[0] - from[0]) > 0.2 && Math.sign(H ? to[1] - from[1] : to[0] - from[0]) === sgn) S.line(from, to, "DIM", x);
    }
    const lo = H ? Math.min(p1[0], p2[0]) : Math.min(p1[1], p2[1]), hi = H ? Math.max(p1[0], p2[0]) : Math.max(p1[1], p2[1]);
    const mid = (lo + hi) / 2, room = hi - lo, need = (H ? tw : h) + 8;
    const P = (s) => (H ? [s, base] : [base, s]), u = H ? [1, 0] : [0, 1];
    let at;
    if (room >= need) {   /* arrows inside, the line broken for the words */
      const gap = (H ? tw : h * 1.4) / 2 + 1;
      S.line(P(lo), P(mid - gap), "DIM", x); S.line(P(mid + gap), P(hi), "DIM", x);
      C.arrow(S, P(lo), [-u[0], -u[1]], "DIM", x); C.arrow(S, P(hi), u, "DIM", x);
      at = H ? [mid, base - h / 2] : [base, mid - h / 2];
    } else {              /* arrows outside pointing in, the words beyond the high end */
      S.line(P(lo - 6), P(hi + 6 + (H ? tw + 1 : 0)), "DIM", x);
      C.arrow(S, P(lo), u, "DIM", x); C.arrow(S, P(hi), [-u[0], -u[1]], "DIM", x);
      at = H ? [hi + 7 + tw / 2, base + 0.8] : [base + (sgn > 0 ? tw / 2 + 1.5 : -tw / 2 - 1.5), hi + 3];
    }
    const t = S.text(at, text, h, "DIM", Object.assign({ align: "center", dimtext: true }, x));
    if (meta && meta.tol && meta.tol.basic) { const bw = tw + 1.6; S.rect(t.at[0] - bw / 2, t.at[1] - 1, t.at[0] + bw / 2, t.at[1] + h + 1, "DIM", x); }
    return t;
  };

  /* Angular dimension at vertex c from direction a0 to a1 (degrees, counter-clockwise), radius r. */
  C.angDim = (S, c, a0, a1, r, text, meta) => {
    const x = { dim: meta && meta.id, part: meta && meta.part }, rad = (a) => (a * Math.PI) / 180;
    const pt = (a, rr) => [c[0] + rr * Math.cos(rad(a)), c[1] + rr * Math.sin(rad(a))];
    S.line(c, pt(a0, r + 2), "DIM", x); S.line(c, pt(a1, r + 2), "DIM", x);
    S.arc(c, r, Math.min(a0, a1), Math.max(a0, a1), "DIM", x);
    const t0 = [-Math.sin(rad(a0)), Math.cos(rad(a0))], t1 = [Math.sin(rad(a1)), -Math.cos(rad(a1))];
    C.arrow(S, pt(a0, r), a1 > a0 ? [-t0[0], -t0[1]] : t0, "DIM", x); C.arrow(S, pt(a1, r), a1 > a0 ? [-t1[0], -t1[1]] : t1, "DIM", x);
    const m = pt((a0 + a1) / 2, r + 3);
    return S.text([m[0] + C.textW(text, 3.5) / 2 + 1, m[1]], text, 3.5, "DIM", Object.assign({ align: "center", dimtext: true }, x));
  };

  /* Datum feature symbol: a framed letter on a filled triangle sitting on the feature at p, leader along d. */
  C.datum = (S, p, d, letter) => {
    const q = [p[0] + d[0] * 7, p[1] + d[1] * 7];
    S.solid([p, [p[0] - d[1] * 1.5 + d[0] * 2.2, p[1] + d[0] * 1.5 + d[1] * 2.2], [p[0] + d[1] * 1.5 + d[0] * 2.2, p[1] - d[0] * 1.5 + d[1] * 2.2]], "DIM");
    S.line([p[0] + d[0] * 2.2, p[1] + d[1] * 2.2], q, "DIM");
    const c = [q[0] + d[0] * 3, q[1] + d[1] * 3];
    S.rect(c[0] - 3, c[1] - 3, c[0] + 3, c[1] + 3, "DIM");
    S.text([c[0], c[1] - 1.75], letter, 3.5, "DIM", { align: "center" });
  };

  /* Feature control frame: position, diameter zone, datums. Left-bottom corner at p. */
  C.fcf = (S, p, tol, datums, meta) => {
    const h = 6, cells = [6, C.textW(tol, 3.5) + 3, ...datums.map(() => 6)], x = { part: meta && meta.part };
    let cx = p[0];
    cells.forEach((w, i) => {
      S.rect(cx, p[1], cx + w, p[1] + h, "DIM", x);
      if (i === 0) { const c = [cx + 3, p[1] + 3]; S.circle(c, 1.6, "DIM", x); S.line([c[0] - 2.4, c[1]], [c[0] + 2.4, c[1]], "DIM", x); S.line([c[0], c[1] - 2.4], [c[0], c[1] + 2.4], "DIM", x); }
      else if (i === 1) S.text([cx + w / 2, p[1] + 1.25], tol, 3.5, "DIM", Object.assign({ align: "center", fcf: true }, x));
      else S.text([cx + w / 2, p[1] + 1.25], datums[i - 2], 3.5, "DIM", { align: "center" });
      cx += w;
    });
    return [cx - p[0], h];
  };

  /* Balloon: item number in a circle, leader to a dot on the part. */
  C.balloon = (S, at, target, n, meta) => {
    const r = 4, d = [target[0] - at[0], target[1] - at[1]], l = Math.hypot(d[0], d[1]) || 1, x = { item: n, part: meta && meta.part };
    S.circle(at, r, "BALLOON", x);
    S.text([at[0], at[1] - 1.75], String(n), 3.5, "BALLOON", Object.assign({ align: "center" }, x));
    S.line([at[0] + (d[0] / l) * r, at[1] + (d[1] / l) * r], target, "BALLOON", x);
    S.circle(target, 0.6, "BALLOON", Object.assign({ fill: true }, x));
  };

  /* Hatch lines at angle (deg) and spacing gap inside 2D loops (even-odd), as segments. */
  C.hatch = (loops, angle, gap) => {
    const a = (angle * Math.PI) / 180, d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]], out = [];
    let lo = Infinity, hi = -Infinity;
    for (const L of loops) for (const p of L) { const s = p[0] * n[0] + p[1] * n[1]; lo = Math.min(lo, s); hi = Math.max(hi, s); }
    for (let s = Math.ceil(lo / gap) * gap; s <= hi; s += gap) {
      const ts = [];
      for (const L of loops) for (let i = 0; i < L.length; i++) {
        const p = L[i], q = L[(i + 1) % L.length], sp = p[0] * n[0] + p[1] * n[1] - s, sq = q[0] * n[0] + q[1] * n[1] - s;
        if ((sp < 0) !== (sq < 0)) { const t = sp / (sp - sq), x = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; ts.push(x[0] * d[0] + x[1] * d[1]); }
      }
      ts.sort((x, y) => x - y);
      for (let k = 0; k + 1 < ts.length; k += 2) out.push([[n[0] * s + d[0] * ts[k], n[1] * s + d[1] * ts[k]], [n[0] * s + d[0] * ts[k + 1], n[1] * s + d[1] * ts[k + 1]]]);
    }
    return out;
  };

  /* ISO 5457 border with a 20 mm filing margin, grid zones, and the ISO 7200 title block (180 mm wide). */
  C.frame = (S, tb) => {
    const W = S.w, H = S.h;
    S.rect(20, 10, W - 10, H - 10, "BORDER");
    const cols = Math.round((W - 30) / 50), rows = Math.round((H - 20) / 50);
    for (let i = 0; i < cols; i++) { const x = 20 + ((i + 0.5) * (W - 30)) / cols; S.text([x, H - 8.6], String(i + 1), 2.5, "BORDER", { align: "center" }); S.text([x, 4.4], String(i + 1), 2.5, "BORDER", { align: "center" }); }
    for (let j = 0; j < rows; j++) { const y = 10 + ((j + 0.5) * (H - 20)) / rows, L = String.fromCharCode(65 + rows - 1 - j); S.text([15, y - 1.2], L, 2.5, "BORDER", { align: "center" }); S.text([W - 5, y - 1.2], L, 2.5, "BORDER", { align: "center" }); }
    const x0 = W - 190, y0 = 10, x1 = W - 10, rowsTB = [[0, 9], [9, 18], [18, 27], [27, 41], [41, 50]];
    S.rect(x0, y0, x1, y0 + 50, "TITLE");
    for (const r of rowsTB) S.line([x0, y0 + r[1]], [x1, y0 + r[1]], "TITLE");
    const cell = (cx0, cx1, r, label, value, vh = 3.5) => {
      if (cx0 > x0) S.line([cx0, y0 + rowsTB[r][0]], [cx0, y0 + rowsTB[r][1]], "TITLE");
      S.text([cx0 + 1.2, y0 + rowsTB[r][1] - 2.4], label, 1.8, "TITLE", { tb: "label" });
      S.text([cx0 + 1.2, y0 + rowsTB[r][0] + 1.3], value, vh, "TITLE", { tb: label });
    };
    cell(x0, x0 + 60, 4, "OWNER", tb.owner, 2.8); cell(x0 + 60, x1, 4, "DOCUMENT TYPE", tb.type, 2.8);
    cell(x0, x1, 3, "TITLE", tb.title, 5);
    cell(x0, x0 + 70, 2, "DRAWING NUMBER", tb.number); cell(x0 + 70, x0 + 95, 2, "REV", tb.rev); cell(x0 + 95, x0 + 125, 2, "DATE OF ISSUE", tb.date, 2.8); cell(x0 + 125, x1, 2, "SHEET", tb.sheet || "1/1");
    cell(x0, x0 + 45, 1, "SCALE", tb.scale); cell(x0 + 45, x0 + 85, 1, "UNITS", "mm"); cell(x0 + 85, x0 + 125, 1, "PROJECTION", ""); cell(x0 + 125, x1, 1, "STATUS", tb.status, 2.5);
    cell(x0, x0 + 85, 0, "MODEL HASH", tb.hash, 2.8); cell(x0 + 85, x1, 0, "INTERPRET PER", "ASME Y14.5-2018", 2.8);
    C.thirdAngle(S, [x0 + 105, y0 + 13.2]);
    return { x0, y0, x1, y1: y0 + 50 };
  };

  /* Third-angle projection symbol (ISO 5456-2): the cone's narrow end faces the circles. */
  C.thirdAngle = (S, c) => {
    S.poly([[c[0] - 9, c[1] - 3], [c[0] - 1, c[1] - 1.6], [c[0] - 1, c[1] + 1.6], [c[0] - 9, c[1] + 3]], "TITLE", { closed: true });
    S.circle([c[0] + 5, c[1]], 3, "TITLE"); S.circle([c[0] + 5, c[1]], 1.6, "TITLE");
    S.line([c[0] - 10.5, c[1]], [c[0] + 9, c[1]], "CENTER");
  };

  if (typeof module !== "undefined" && module.exports) module.exports = C;
})(typeof globalThis !== "undefined" ? globalThis : this);

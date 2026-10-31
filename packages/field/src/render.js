// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* field/render: the render hook into tools/diagram. Any field becomes
     panel  a trace in the shape diagram's charts.js drawPanels() reads (title, x, y, series), for a page
     svg    a drawing through diagram's own SVG writer (cad/src/out.js toSVG), for files and tests
   A 1D field draws its values against its axis. A complex field draws its magnitude. A 2D grid draws a
   radial average (for spectra) or its middle row. The title states the unit, the provenance status and
   the last grade in the ledger, so nothing is drawn without its instrument and its error. */
(function (g) {
  "use strict";
  const F = (g.Field = g.Field || {});
  const CAD = () => { if (g.Diagram && g.Diagram.CAD && g.Diagram.CAD.toSVG) return g.Diagram.CAD; require("../../diagram/cad/src/out.js"); return g.Diagram.CAD; };

  const mags = (f) => (f.components === 2 ? Float64Array.from({ length: f.values.length / 2 }, (_, i) => Math.hypot(f.values[2 * i], f.values[2 * i + 1])) : Float64Array.from(f.values));

  const radial = (v, h, w) => {
    const R = Math.floor(Math.min(h, w) / 2), sum = new Float64Array(R), cnt = new Float64Array(R);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fy = y < h / 2 ? y : y - h, fx = x < w / 2 ? x : x - w, r = Math.round(Math.hypot(fx * (R / (w / 2)), fy * (R / (h / 2))));
      if (r < R) { sum[r] += v[y * w + x]; cnt[r]++; }
    }
    return Float64Array.from(sum, (s, i) => (cnt[i] ? s / cnt[i] : 0));
  };

  /* The 1D trace a field draws as: { x, y, xlabel }. */
  F.trace = (f, opt = {}) => {
    const v = mags(f), dom = f.domain;
    let y = v, step = 1, unit = "index";
    if (dom.kind === "grid" && dom.shape.length === 2) {
      const [h, w] = dom.shape;
      y = opt.view === "row" ? v.slice(Math.floor(h / 2) * w, Math.floor(h / 2) * w + w) : radial(v, h, w);
    }
    if (dom.spacing && dom.spacing[0]) { step = dom.spacing[0].step; unit = dom.spacing[0].unit; }
    if (opt.half && dom.kind === "sequence") y = y.slice(0, Math.floor(y.length / 2));
    const x = Float64Array.from(y, (_, i) => i * step);
    if (opt.log) y = Float64Array.from(y, (a) => Math.log10(Math.max(1e-300, a)));
    return { x, y, xlabel: (dom.axis || "position") + " (" + unit + ")" };
  };

  const range = (y) => { let lo = Infinity, hi = -Infinity; for (const a of y) { if (a < lo) lo = a; if (a > hi) hi = a; } return [lo, hi]; };
  const lastGrade = (f) => { const e = f.ledger[f.ledger.length - 1]; return e ? `${e.converter}: ${e.measured}` : "no conversion"; };
  F.caption = (f) => `${f.name} [${f.unit.name}] ${f.prov.status}; ${lastGrade(f)}`;

  F.panel = (f, opt = {}) => {
    const t = F.trace(f, opt), [lo, hi] = range(t.y), step = Math.max(1, Math.ceil(t.y.length / (opt.maxPoints || 2000)));
    const pick = (a) => Array.from(a).filter((_, i) => i % step === 0);
    return { title: F.caption(f), x: { min: t.x[0], max: t.x[t.x.length - 1] || 1, label: t.xlabel },
      y: { min: lo, max: hi > lo ? hi : lo + 1, label: (opt.log ? "log10 " : "") + f.unit.name },
      series: [{ name: f.name, x: pick(t.x), y: pick(t.y), tok: opt.tok || "ink" }], decimated: step };
  };

  /* SVG through diagram's writer: a sheet in mm with the trace as a polyline, a frame and the caption. */
  const clip = (s, n) => (s.length > n ? "…" + s.slice(s.length - n + 1) : s);
  F.svg = (f, opt = {}) => {
    const t = F.trace(f, opt), W = opt.w || 180, H = opt.h || 70, L = 12, B = 10, T = H - 12, Rt = W - 4;
    const [lo, hi] = range(t.y), span = hi > lo ? hi - lo : 1, n = t.y.length;
    const step = Math.max(1, Math.floor(n / 1500)), pts = [];
    for (let i = 0; i < n; i += step) pts.push([L + ((Rt - L) * i) / Math.max(1, n - 1), B + ((T - B) * (t.y[i] - lo)) / span]);
    const E = [
      { t: "poly", layer: "BORDER", closed: true, pts: [[L, B], [Rt, B], [Rt, T], [L, T]] },
      { t: "poly", layer: "OUTLINE", closed: false, pts },
      { t: "text", layer: "TEXT", at: [L, H - 5], h: 3, s: clip(F.caption(f), Math.floor((W - L) / 1.6)) },
      { t: "text", layer: "TEXT", at: [L, 3], h: 2.5, s: t.xlabel + (opt.log ? ", log10 values" : "") },
    ];
    return CAD().toSVG({ w: W, h: H, E }, { label: F.caption(f) });
  };

  if (typeof module !== "undefined" && module.exports) module.exports = F;
})(typeof globalThis !== "undefined" ? globalThis : this);

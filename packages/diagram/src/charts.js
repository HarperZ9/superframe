// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/charts: the time view's traces. Stacked panels share one x-axis where they share time (AN 123's
   stackplot); a panel may be lines, steps or log-scale bars; a playhead marks the current time. A scale bar
   replaces the axis where the shape is the point (HP Journal 1960). */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});

  D.fitCanvas = (cv, h) => {
    const w = Math.max(200, cv.clientWidth || 600), r = Math.min(2, (g.devicePixelRatio || 1));
    if (cv.width !== Math.round(w * r) || cv.height !== Math.round(h * r)) { cv.width = Math.round(w * r); cv.height = Math.round(h * r); }
    cv.style.height = h + "px";
    const ctx = cv.getContext("2d");
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h, r };
  };

  /* panels: [{ title, x: {min, max, label}, y: {min, max, label, log}, series: [{ name, x, y, tok, dash, width, step }],
     bars: [{ name, value, tok }], cursor, verdict }] */
  D.drawPanels = (cv, panels, tk, opt = {}) => {
    const ph = opt.panelH || 128, gap = 14, H = panels.length * (ph + gap) + 6;
    const { ctx, w } = D.fitCanvas(cv, H);
    const col = (t) => tk[t] || tk.ink;
    ctx.font = `12px ${tk.mono || "monospace"}`;
    panels.forEach((P, k) => {
      const top = k * (ph + gap) + 4, L = 54, R = w - 12, T = top + 18, B = top + ph - 18;
      ctx.fillStyle = tk.soft; ctx.textAlign = "left"; ctx.fillText(P.title, L, top + 11);
      ctx.strokeStyle = tk.line; ctx.lineWidth = 1; ctx.strokeRect(L + 0.5, T + 0.5, R - L, B - T);
      if (P.bars) {
        const lo = Math.log10(P.y.min), hi = Math.log10(P.y.max), bw = (R - L) / P.bars.length;
        P.bars.forEach((b, i) => {
          const y = B - ((Math.log10(Math.max(P.y.min, b.value)) - lo) / (hi - lo)) * (B - T);
          ctx.fillStyle = col(b.tok); ctx.fillRect(L + i * bw + bw * 0.2, y, bw * 0.6, B - y);
          ctx.fillStyle = tk.ink; ctx.textAlign = "center"; ctx.fillText(b.name, L + (i + 0.5) * bw, B + 13);
          ctx.fillText(b.text || D.fmt(b.value, P.y.unit || ""), L + (i + 0.5) * bw, Math.max(T + 11, y - 4));
        });
        ctx.textAlign = "right"; ctx.fillStyle = tk.soft; ctx.fillText(P.y.label + " (log)", R, top + 11);
        return;
      }
      const X = (x) => L + ((x - P.x.min) / (P.x.max - P.x.min)) * (R - L);
      const Y = (y) => { const v = P.y.log ? Math.log10(Math.max(1e-30, y)) : y, a = P.y.log ? Math.log10(P.y.min) : P.y.min, b = P.y.log ? Math.log10(P.y.max) : P.y.max; return B - ((v - a) / (b - a)) * (B - T); };
      if (!P.y.log && P.y.min < 0 && P.y.max > 0) { ctx.strokeStyle = tk.line; ctx.beginPath(); ctx.moveTo(L, Y(0) + 0.5); ctx.lineTo(R, Y(0) + 0.5); ctx.stroke(); }
      ctx.save(); ctx.beginPath(); ctx.rect(L, T, R - L, B - T); ctx.clip();
      for (const s of P.series) {
        ctx.strokeStyle = col(s.tok); ctx.lineWidth = s.width || 1.5; ctx.setLineDash(s.dash ? [5, 4] : []);
        ctx.beginPath();
        let last = null;
        for (let i = 0; i < s.x.length; i++) {
          const x = X(s.x[i]), y = Y(s.y[i]);
          if (i === 0) ctx.moveTo(x, y); else if (s.step) { ctx.lineTo(x, last); ctx.lineTo(x, y); } else ctx.lineTo(x, y);
          last = y;
        }
        ctx.stroke();
        if (s.dots) { ctx.fillStyle = col(s.tok); for (let i = 0; i < s.x.length; i++) { ctx.beginPath(); ctx.arc(X(s.x[i]), Y(s.y[i]), 2.6, 0, 7); ctx.fill(); } }
      }
      ctx.setLineDash([]);
      if (P.cursor !== undefined) { ctx.strokeStyle = tk.red; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(P.cursor), T); ctx.lineTo(X(P.cursor), B); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = tk.soft; ctx.textAlign = "right";
      ctx.fillText(P.y.label, L - 6, T + 10);
      ctx.fillText(String(+P.y.max.toPrecision(3)), L - 6, T + 24); ctx.fillText(String(+P.y.min.toPrecision(3)), L - 6, B);
      ctx.textAlign = "left"; ctx.fillText(String(+P.x.min.toPrecision(3)), L, B + 13);
      ctx.textAlign = "right"; ctx.fillText(String(+P.x.max.toPrecision(3)) + " " + P.x.label, R, B + 13);
      let lx = L + 8;
      ctx.textAlign = "left";
      for (const s of P.series) {
        if (!s.name) continue;
        ctx.strokeStyle = col(s.tok); ctx.lineWidth = s.width || 1.5; ctx.setLineDash(s.dash ? [5, 4] : []);
        ctx.beginPath(); ctx.moveTo(lx, T + 10); ctx.lineTo(lx + 16, T + 10); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = tk.ink; ctx.fillText(s.name, lx + 20, T + 14);
        lx += 28 + ctx.measureText(s.name).width;
      }
    });
    return H;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);

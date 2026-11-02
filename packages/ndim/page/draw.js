// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim page: shared drawing. Colours come from the site-kit tokens, so light and dark follow the kit. */
(function () {
  "use strict";
  const N = window.NDim;
  const D = (window.NDraw = {});

  D.tokens = () => {
    const cs = getComputedStyle(document.documentElement), v = (k) => cs.getPropertyValue(k).trim();
    return { ink: v("--ink"), soft: v("--soft"), line: v("--line"), wall: v("--wall"), mat: v("--mat"), red: v("--red"),
      tide: v("--tide-2"), s: [v("--s1"), v("--s2"), v("--s3"), v("--s4"), v("--s5")] };
  };
  /* Size the backing store to the element and the device pixel ratio; returns a context in CSS pixels. */
  D.fit = (cv, aspect = 1) => {
    const w = Math.max(120, cv.clientWidth), h = Math.round(w * aspect), r = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * r) || cv.height !== Math.round(h * r)) { cv.width = Math.round(w * r); cv.height = Math.round(h * r); }
    cv.style.height = h + "px";
    const ctx = cv.getContext("2d");
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  };

  /* Project an n-point to 3D through the chosen lens (after rotation), then the 3D camera to the canvas. */
  D.toThree = (p, lens, d = 3) => {
    if (p.length <= 3) return p.concat([0, 0, 0]).slice(0, 3);
    if (lens === "orthographic") return N.orthographic(p, 3);
    if (lens === "stereographic") { let q = N.normalize(p); while (q.length > 3) q = N.stereographic(N.normalize(q)); return q.map((x) => Math.max(-6, Math.min(6, x))); }
    return N.perspective(p, 3, d);
  };
  D.camera = (yaw = 0.55, pitch = 0.32, dist = 6) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return (q) => {
      const x = cy * q[0] + sy * q[2], z0 = -sy * q[0] + cy * q[2];
      const y = cp * q[1] - sp * z0, z = sp * q[1] + cp * z0;
      const f = dist / (dist - z);
      return [x * f, y * f, z];
    };
  };
  D.screen = (w, h, scale) => (q) => [w / 2 + q[0] * scale, h / 2 - q[1] * scale, q[2]];

  /* Edges drawn back to front, nearer edges heavier: depth read from line weight, not colour. */
  D.edges = (ctx, P2, edges, colour, width = 1.4, alpha = 1) => {
    const order = edges.map((e, i) => [i, (P2[e[0]][2] + P2[e[1]][2]) / 2]).sort((a, b) => a[1] - b[1]);
    const zs = order.map((o) => o[1]), z0 = Math.min(...zs), z1 = Math.max(...zs) + 1e-9;
    ctx.strokeStyle = colour; ctx.lineCap = "round";
    for (const [i, z] of order) {
      const [a, b] = edges[i], t = (z - z0) / (z1 - z0);
      ctx.globalAlpha = alpha * (0.35 + 0.65 * t);
      ctx.lineWidth = width * (0.6 + 0.8 * t);
      ctx.beginPath(); ctx.moveTo(P2[a][0], P2[a][1]); ctx.lineTo(P2[b][0], P2[b][1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  D.dots = (ctx, P2, colour, r = 2.2) => {
    ctx.fillStyle = colour;
    for (const p of P2) { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill(); }
  };
  /* Polyline through 3D points already on screen. */
  D.path = (ctx, pts, colour, width = 1.2, alpha = 1) => {
    ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.globalAlpha = alpha; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke(); ctx.globalAlpha = 1;
  };
  /* Fit a set of screen points into the canvas with a margin. */
  D.autoscale = (pts3, w, h, margin = 0.86) => {
    const r = Math.max(1e-6, ...pts3.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]))));
    return (Math.min(w, h) / 2) * margin / r;
  };
  D.label = (ctx, text, x, y, colour, size = 12, align = "left") => {
    ctx.fillStyle = colour; ctx.font = `600 ${size}px "Hanken Grotesk", system-ui, sans-serif`; ctx.textAlign = align; ctx.fillText(text, x, y);
  };
  D.fmt = (x, k = 3) => (Math.abs(x) < 1e-12 ? "0" : Number(x.toPrecision(k)).toString());
})();

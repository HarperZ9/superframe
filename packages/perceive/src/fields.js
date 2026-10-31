// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive/fields: electric potential of point charges, magnetic field of wires (closed form in 2D and a
   numeric Biot-Savart sum in 3D), and heat diffusion. SI units throughout: metres, coulombs, amperes, tesla. */
(function (g) {
  "use strict";
  const P = (g.Perceive = g.Perceive || {});

  /* V = sum k q / r for point charges at (x, y) in the plane z = 0. */
  P.potential = (charges, x, y) => {
    let v = 0;
    for (const c of charges) v += (P.C.ke * c.q) / Math.max(1e-9, Math.hypot(x - c.x, y - c.y));
    return v;
  };
  /* E = -grad V, in V/m. */
  P.efield = (charges, x, y) => {
    let ex = 0, ey = 0;
    for (const c of charges) {
      const dx = x - c.x, dy = y - c.y, r2 = Math.max(1e-18, dx * dx + dy * dy), s = (P.C.ke * c.q) / (r2 * Math.sqrt(r2));
      ex += s * dx; ey += s * dy;
    }
    return [ex, ey];
  };

  /* Infinite straight wires along z through (x, y), current I in amperes (positive out of the screen).
     B = mu0 I / (2 pi r), circling the wire by the right-hand rule. */
  P.wireB = (wires, x, y) => {
    let bx = 0, by = 0;
    for (const w of wires) {
      const dx = x - w.x, dy = y - w.y, r2 = Math.max(1e-12, dx * dx + dy * dy), s = (P.C.mu0 * w.I) / (2 * Math.PI * r2);
      bx += -s * dy; by += s * dx;
    }
    return [bx, by];
  };
  /* Biot-Savart by the midpoint rule: a straight segment from a to b carrying I, field at p, n pieces. */
  P.biotSavart = (I, a, b, p, n = 10000) => {
    const B = [0, 0, 0], dl = [0, 1, 2].map((k) => (b[k] - a[k]) / n), k0 = (P.C.mu0 * I) / (4 * Math.PI);
    for (let i = 0; i < n; i++) {
      const m = [0, 1, 2].map((k) => a[k] + (i + 0.5) * dl[k]), r = [0, 1, 2].map((k) => p[k] - m[k]);
      const r3 = Math.hypot(...r) ** 3;
      B[0] += k0 * (dl[1] * r[2] - dl[2] * r[1]) / r3;
      B[1] += k0 * (dl[2] * r[0] - dl[0] * r[2]) / r3;
      B[2] += k0 * (dl[0] * r[1] - dl[1] * r[0]) / r3;
    }
    return B;
  };
  /* A streamline through a 2D vector field, by midpoint (RK2) steps of fixed length along the unit direction. */
  P.streamline = (field, x0, y0, step, n, bounds) => {
    const out = [[x0, y0]];
    let x = x0, y = y0;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = field(x, y), la = Math.hypot(ax, ay);
      if (la < 1e-30) break;
      const mx = x + 0.5 * step * ax / la, my = y + 0.5 * step * ay / la, [bx, by] = field(mx, my), lb = Math.hypot(bx, by);
      if (lb < 1e-30) break;
      x += step * bx / lb; y += step * by / lb;
      if (x < bounds[0] || x > bounds[1] || y < bounds[2] || y > bounds[3]) break;
      out.push([x, y]);
    }
    return out;
  };

  /* Heat: explicit finite differences for u_t = D u_xx with zero ends. Stable when D dt / dx^2 <= 1/2. */
  P.diffuse1D = (u, D, dx, dt, steps) => {
    const r = (D * dt) / (dx * dx);
    if (r > 0.5) throw new Error("unstable: D dt / dx^2 = " + r);
    let a = Float64Array.from(u), b = new Float64Array(u.length);
    for (let s = 0; s < steps; s++) {
      for (let i = 1; i < a.length - 1; i++) b[i] = a[i] + r * (a[i - 1] - 2 * a[i] + a[i + 1]);
      b[0] = 0; b[a.length - 1] = 0;
      [a, b] = [b, a];
    }
    return a;
  };
  /* One 2D step on a w x h grid with r = D dt / dx^2 <= 1/4; fixed cells (sources) are held. Edges insulate. */
  P.heatStep2D = (T, w, h, r, fixed) => {
    const o = new Float64Array(T.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (fixed && fixed[i]) { o[i] = T[i]; continue; }
      const l = T[y * w + Math.max(0, x - 1)], rr = T[y * w + Math.min(w - 1, x + 1)], u = T[Math.max(0, y - 1) * w + x], d = T[Math.min(h - 1, y + 1) * w + x];
      o[i] = T[i] + r * (l + rr + u + d - 4 * T[i]);
    }
    return o;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = P;
})(typeof globalThis !== "undefined" ? globalThis : this);

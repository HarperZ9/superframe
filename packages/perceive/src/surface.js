// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive/surface: parametric surfaces and their Gaussian and mean curvature, from the first and second
   fundamental forms by central differences. K = (LN - M^2) / (EG - F^2). Gauss's Theorema Egregium (1827):
   K depends on lengths measured inside the surface alone. */
(function (g) {
  "use strict";
  const P = (g.Perceive = g.Perceive || {});
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sc = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  P.surfaces = {
    sphere: (R) => (u, v) => [R * Math.sin(v) * Math.cos(u), R * Math.sin(v) * Math.sin(u), R * Math.cos(v)],
    torus: (R, r) => (u, v) => [(R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)],
    saddle: (a) => (u, v) => [u, v, a * (u * u - v * v)],
    bump: (a) => (u, v) => [u, v, a * Math.exp(-(u * u + v * v))],
  };
  /* Parameter ranges for drawing each surface. */
  P.SURFACE_RANGES = { sphere: [0, 2 * Math.PI, 0.05, Math.PI - 0.05], torus: [0, 2 * Math.PI, 0, 2 * Math.PI], saddle: [-1, 1, -1, 1], bump: [-2, 2, -2, 2] };

  P.curvature = (f, u, v, h = 1e-4) => {
    const p = f(u, v), pu = f(u + h, v), pm = f(u - h, v), pv = f(u, v + h), pn = f(u, v - h);
    const fu = sc(sub(pu, pm), 1 / (2 * h)), fv = sc(sub(pv, pn), 1 / (2 * h));
    const fuu = sc(sub(add(pu, pm), sc(p, 2)), 1 / (h * h)), fvv = sc(sub(add(pv, pn), sc(p, 2)), 1 / (h * h));
    const fuv = sc(sub(sub(f(u + h, v + h), f(u + h, v - h)), sub(f(u - h, v + h), f(u - h, v - h))), 1 / (4 * h * h));
    const nn = cross(fu, fv), nl = Math.hypot(...nn), n = sc(nn, 1 / nl);
    const E = dot(fu, fu), F = dot(fu, fv), G = dot(fv, fv), L = dot(fuu, n), M = dot(fuv, n), Nn = dot(fvv, n);
    const den = E * G - F * F;
    return { K: (L * Nn - M * M) / den, H: (E * Nn - 2 * F * M + G * L) / (2 * den), point: p, normal: n };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = P;
})(typeof globalThis !== "undefined" ? globalThis : this);

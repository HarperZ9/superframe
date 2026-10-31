// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim/fields: the Clifford torus, Hopf fibres, n-dimensional signed distance functions sliced to 3D and
   ray-marched, and the quaternion Julia set. A 3D slice of an nD distance bound is still a distance
   bound, so sphere tracing inside the slice never steps through a surface. */
(function (g) {
  "use strict";
  const N = (g.NDim = g.NDim || {});

  N.cliffordTorus = (nu, nv) => {
    const out = [], s = Math.SQRT1_2;
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const u = (2 * Math.PI * i) / nu, v = (2 * Math.PI * j) / nv;
      out.push([s * Math.cos(u), s * Math.sin(u), s * Math.cos(v), s * Math.sin(v)]);
    }
    return out;
  };
  /* Hopf map S^3 -> S^2 with z1 = x1 + i x2, z2 = x3 + i x4: (2 z1 conj z2, |z1|^2 - |z2|^2). */
  N.hopfMap = ([a, b, c, d]) => [2 * (a * c + b * d), 2 * (b * c - a * d), a * a + b * b - c * c - d * d];
  N.hopfFiber = ([x, y, z], m) => {
    let z1 = Math.sqrt(Math.max(0, (1 + z) / 2)), r2 = [0, 0];
    if (z1 > 1e-12) r2 = [x / (2 * z1), -y / (2 * z1)];
    else r2 = [1, 0];
    const out = [];
    for (let k = 0; k < m; k++) {
      const t = (2 * Math.PI * k) / m, c = Math.cos(t), s = Math.sin(t);
      out.push([z1 * c, z1 * s, r2[0] * c - r2[1] * s, r2[0] * s + r2[1] * c]);
    }
    return out;
  };

  const len2 = (a, b) => Math.hypot(a, b);
  N.sdf = {
    hypersphere: (r) => (p) => N.norm(p) - r,
    hyperbox: (b) => (p) => {
      const q = p.map((x) => Math.abs(x) - b);
      return N.norm(q.map((x) => Math.max(x, 0))) + Math.min(Math.max(...q), 0);
    },
    duocylinder: (r) => (p) => Math.max(len2(p[0], p[1]) - r, len2(p[2], p[3] || 0) - r),
    tiger: (R, r) => (p) => len2(len2(p[0], p[1]) - R, len2(p[2], p[3] || 0) - R) - r,
  };
  /* The 3D slice frame: q in R^3 maps to R (q0, q1, q2, w, 0, ...) in R^n. */
  N.sliceFrame = (n, w, R) => (q) => {
    const p = N.zeros(n); p[0] = q[0]; p[1] = q[1]; p[2] = q[2]; if (n > 3) p[3] = w;
    return R ? N.matVec(R, p) : p;
  };
  N.marchRay = (sdf, ro, rd, frame, tmax = 20, steps = 256, eps = 1e-7) => {
    let t = 0;
    for (let i = 0; i < steps; i++) {
      const q = [ro[0] + t * rd[0], ro[1] + t * rd[1], ro[2] + t * rd[2]];
      const d = sdf(frame(q));
      if (d < eps) return { t, q, steps: i };
      t += d;
      if (t > tmax) return null;
    }
    return null;
  };
  /* Radius of the slice along +x, by bisection on the sign of the distance. */
  N.sdfSliceRadius = (sdf, n, w) => {
    const fr = N.sliceFrame(n, w);
    let lo = 0, hi = 10;
    if (sdf(fr([0, 0, 0])) > 0) return 0;
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (sdf(fr([m, 0, 0])) < 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };

  /* Quaternion Julia: q <- q^2 + c. The distance estimate 0.5 |q| log |q| / |dq| bounds the distance. */
  const qsq = ([a, b, c, d]) => [a * a - b * b - c * c - d * d, 2 * a * b, 2 * a * c, 2 * a * d];
  N.juliaInside = (q, c, iters) => {
    for (let i = 0; i < iters; i++) { q = N.add(qsq(q), c); if (N.dot(q, q) > 16) return false; }
    return true;
  };
  N.juliaDE = (c, iters = 12) => (p) => {
    let q = p.slice(0, 4), dq = 1, r = N.norm(q);
    for (let i = 0; i < iters && r < 4; i++) { dq *= 2 * r; q = N.add(qsq(q), c); r = N.norm(q); }
    return r < 4 ? 0 : (0.5 * r * Math.log(r)) / dq;
  };

  /* Shade a w x h image of a 3D slice: Lambert light plus depth fog, as gray levels 0..255. */
  N.renderSlice = (sdf, frame, w, h, cam = {}) => {
    const img = new Uint8ClampedArray(w * h), yaw = cam.yaw || 0.6, pitch = cam.pitch || 0.35, dist = cam.dist || 3.2;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const fwd = [-sy * cp, -sp, -cy * cp], right = [cy, 0, -sy], up = [-sy * sp, cp, -cy * sp];
    const ro = fwd.map((x) => -x * dist), L = N.normalize([0.6, 0.8, 0.4]), e = cam.normalStep || 1e-3;
    const f = (q) => sdf(frame(q));
    let hits = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const u = (2 * i + 1 - w) / h, v = (h - 2 * j - 1) / h;
      const rd = N.normalize([0, 1, 2].map((k) => fwd[k] * 1.6 + right[k] * u + up[k] * v));
      const hit = N.marchRay(sdf, ro, rd, frame, 8, cam.steps || 160, cam.eps || 1e-4);
      if (!hit) continue;
      hits++;
      const q = hit.q, nrm = N.normalize([0, 1, 2].map((k) => { const a = q.slice(), b = q.slice(); a[k] += e; b[k] -= e; return f(a) - f(b); }));
      img[j * w + i] = Math.round(40 + 200 * Math.max(0, N.dot(nrm, L)) * Math.exp(-0.08 * hit.t));
    }
    return { img, hits };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = N;
})(typeof globalThis !== "undefined" ? globalThis : this);

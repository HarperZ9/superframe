// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/core: vectors, 4x4 matrices, the orbit camera, exact snapping, a seeded generator and a byte hash.
   No dependencies. Loads as a classic script (window.Diagram) or with require (module.exports is the same object). */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});

  const v = (D.v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  });

  /* Poses live on a grid of 2^-16 model units. Sums and differences of grid values below 2^36 are exact in
     binary floating point, so an exploded pose minus its offset is the assembled pose bit for bit. */
  D.SNAP = 1 / 65536;
  D.snap = (x) => Math.round(x / D.SNAP) * D.SNAP;
  D.snap3 = (p) => [D.snap(p[0]), D.snap(p[1]), D.snap(p[2])];

  /* 3x3 rotation from Euler angles in degrees, applied x then y then z. */
  D.euler = (r) => {
    const [a, b, c] = (r || [0, 0, 0]).map((d) => (d * Math.PI) / 180);
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
    const X = [[1, 0, 0], [0, ca, -sa], [0, sa, ca]], Y = [[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]], Z = [[cc, -sc, 0], [sc, cc, 0], [0, 0, 1]];
    const mul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
    return mul(Z, mul(Y, X));
  };
  D.m3v = (M, p) => [M[0][0] * p[0] + M[0][1] * p[1] + M[0][2] * p[2], M[1][0] * p[0] + M[1][1] * p[1] + M[1][2] * p[2], M[2][0] * p[0] + M[2][1] * p[1] + M[2][2] * p[2]];

  /* Column-major 4x4, the WebGL layout. */
  const m4 = (D.m4 = {
    mul: (a, b) => {
      const o = new Float64Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
      return o;
    },
    persp: (fovy, aspect, near, far) => {
      const f = 1 / Math.tan(fovy / 2), o = new Float64Array(16);
      o[0] = f / aspect; o[5] = f; o[10] = (far + near) / (near - far); o[11] = -1; o[14] = (2 * far * near) / (near - far);
      return o;
    },
    lookAt: (eye, at, up) => {
      const z = v.norm(v.sub(eye, at)), x = v.norm(v.cross(up, z)), y = v.cross(z, x), o = new Float64Array(16);
      o[0] = x[0]; o[4] = x[1]; o[8] = x[2]; o[12] = -v.dot(x, eye);
      o[1] = y[0]; o[5] = y[1]; o[9] = y[2]; o[13] = -v.dot(y, eye);
      o[2] = z[0]; o[6] = z[1]; o[10] = z[2]; o[14] = -v.dot(z, eye);
      o[15] = 1;
      return o;
    },
    apply: (m, p) => [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14], m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]],
  });

  /* Orbit camera: yaw and pitch in radians about a target, at a distance. Returns the matrices and a projector
     from world space to pixels (x right, y down, depth in [0, 1], near is small). */
  D.camera = (c, w, h) => {
    const t = c.target || [0, 0, 0], cp = Math.cos(c.pitch), eye = [t[0] + c.dist * cp * Math.sin(c.yaw), t[1] + c.dist * Math.sin(c.pitch), t[2] + c.dist * cp * Math.cos(c.yaw)];
    const view = m4.lookAt(eye, t, [0, 1, 0]), proj = m4.persp(c.fov || 0.7, w / h, 0.1, 200), vp = m4.mul(proj, view);
    const toScreen = (p) => { const q = m4.apply(vp, p), iw = 1 / q[3]; return [(q[0] * iw + 1) * 0.5 * w, (1 - q[1] * iw) * 0.5 * h, (q[2] * iw + 1) * 0.5, q[3]]; };
    return { eye, view, proj, vp, toScreen, w, h };
  };

  /* mulberry32, the same generator ndim uses, so figures repeat exactly. */
  D.rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /* FNV-1a over bytes, two lanes with different offsets, as 16 hex digits. */
  D.hash = (bytes) => {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
    for (let i = 0; i < u.length; i++) { a = Math.imul(a ^ u[i], 0x01000193); b = Math.imul(b ^ u[i] ^ (i & 255), 0x01000193); }
    return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
  };

  /* "#rrggbb" or "rgb(r, g, b)" to [r, g, b] in 0..1. */
  D.rgb = (s) => {
    s = String(s || "").trim();
    if (s[0] === "#") { const h = s.length === 4 ? s.slice(1).split("").map((c) => c + c).join("") : s.slice(1, 7); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); }
    const m = s.match(/[\d.]+/g);
    return m ? m.slice(0, 3).map((x) => +x / 255) : [0.5, 0.5, 0.5];
  };
  D.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  D.clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);

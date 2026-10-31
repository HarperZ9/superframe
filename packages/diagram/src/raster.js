// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/raster: a software z-buffer. It is the Canvas2D fallback renderer, the picking buffer, the source of
   the lens samples, and the frame whose bytes the determinism test hashes. Same draw list as the GPU path.
   Draw list: tris (9 numbers each, world space), per triangle rgb (0..1), alpha and part; caps (cut faces:
   3D loops, rgb, ink, hatch); lines; points. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const v = D.v3;
  D.LIGHT = v.norm([0.35, 0.85, 0.45]);

  D.shade = (rgb, n, toEye, emit, glow) => {
    if (v.dot(n, toEye) < 0) n = v.scale(n, -1);
    const l = 0.42 + 0.58 * Math.max(0, v.dot(n, D.LIGHT)), c = [rgb[0] * l, rgb[1] * l, rgb[2] * l];
    return emit ? D.mix(c, glow || [1, 0.55, 0.2], D.clamp(emit, 0, 1)) : c;
  };

  D.raster = (list, cam, opt = {}) => {
    const W = cam.w | 0, H = cam.h | 0, N = W * H;
    const rgba = new Uint8ClampedArray(N * 4), depth = new Float32Array(N).fill(Infinity), id = new Int32Array(N).fill(-1);
    const bg = opt.bg || [0.95, 0.94, 0.9];
    for (let i = 0; i < N; i++) { rgba[i * 4] = bg[0] * 255; rgba[i * 4 + 1] = bg[1] * 255; rgba[i * 4 + 2] = bg[2] * 255; rgba[i * 4 + 3] = 255; }
    const T = list.tris, nT = T.length / 9, S = new Float64Array(nT * 9), col = new Float32Array(nT * 3), order = [];
    for (let t = 0; t < nT; t++) {
      let ok = true;
      for (let k = 0; k < 3; k++) {
        const s = cam.toScreen([T[t * 9 + k * 3], T[t * 9 + k * 3 + 1], T[t * 9 + k * 3 + 2]]);
        if (s[3] <= 0.05) ok = false;
        S[t * 9 + k * 3] = s[0]; S[t * 9 + k * 3 + 1] = s[1]; S[t * 9 + k * 3 + 2] = s[2];
      }
      if (!ok) continue;
      const a = [T[t * 9], T[t * 9 + 1], T[t * 9 + 2]], b = [T[t * 9 + 3], T[t * 9 + 4], T[t * 9 + 5]], c = [T[t * 9 + 6], T[t * 9 + 7], T[t * 9 + 8]];
      const n = v.norm(v.cross(v.sub(b, a), v.sub(c, a))), toEye = v.sub(cam.eye, a);
      const p = list.triPart[t], st = list.style[p];
      const sh = D.shade(st.rgb, n, toEye, st.emit, st.glow);
      col[t * 3] = sh[0]; col[t * 3 + 1] = sh[1]; col[t * 3 + 2] = sh[2];
      order.push(t);
    }
    const put = (x, y, z, c, a, pid, write) => {
      const i = y * W + x;
      if (z >= depth[i]) return;
      const o = i * 4;
      if (a >= 1) { rgba[o] = c[0] * 255; rgba[o + 1] = c[1] * 255; rgba[o + 2] = c[2] * 255; }
      else { rgba[o] = rgba[o] * (1 - a) + c[0] * 255 * a; rgba[o + 1] = rgba[o + 1] * (1 - a) + c[1] * 255 * a; rgba[o + 2] = rgba[o + 2] * (1 - a) + c[2] * 255 * a; }
      if (write) { depth[i] = z; id[i] = pid; }
    };
    function fill(t, write) {
      const o = t * 9, x0 = S[o], y0 = S[o + 1], z0 = S[o + 2], x1 = S[o + 3], y1 = S[o + 4], z1 = S[o + 5], x2 = S[o + 6], y2 = S[o + 7], z2 = S[o + 8];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) return;
      const minx = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxx = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
      const miny = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxy = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
      const p = list.triPart[t], a = list.style[p].alpha, c = [col[t * 3], col[t * 3 + 1], col[t * 3 + 2]];
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        put(x, y, w0 * z0 + w1 * z1 + w2 * z2, c, a, p, write);
      }
    }
    const opaque = order.filter((t) => list.style[list.triPart[t]].alpha >= 1), glass = order.filter((t) => list.style[list.triPart[t]].alpha < 1);
    for (const t of opaque) fill(t, true);
    for (const cap of list.caps || []) capFill(cap, cam, W, H, put);
    for (const ln of list.lines || []) line(ln, cam, W, H, put);
    for (const pt of list.points || []) dot(pt, cam, W, H, put);
    const md = (t) => S[t * 9 + 2] + S[t * 9 + 5] + S[t * 9 + 8];
    glass.sort((a, b) => md(b) - md(a));
    for (const t of glass) fill(t, false);
    return { w: W, h: H, rgba, depth, id };
  };

  /* Even-odd scanline fill of a cut face, hatched at 45 degrees (or the material's angle), depth from its plane. */
  function capFill(cap, cam, W, H, put) {
    const loops = cap.loops.map((L) => L.map((p) => cam.toScreen(p)));
    const all = loops.flat();
    if (all.length < 3 || all.some((s) => s[3] <= 0.05)) return;
    let A = null, best = 1;
    const p = all[0], step = Math.max(1, (all.length / 48) | 0);
    for (let j = 1; j < all.length; j += step) for (let k = j + 1; k < all.length; k += step) {
      const q = all[j], r = all[k], det = (q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]);
      if (Math.abs(det) > best) {
        best = Math.abs(det);
        const a = ((q[2] - p[2]) * (r[1] - p[1]) - (r[2] - p[2]) * (q[1] - p[1])) / det, b = ((r[2] - p[2]) * (q[0] - p[0]) - (q[2] - p[2]) * (r[0] - p[0])) / det;
        A = [a, b, p[2] - a * p[0] - b * p[1]];
      }
    }
    if (!A) return;
    const ang = ((cap.hatch && cap.hatch.angle) || 45) * Math.PI / 180, gap = (cap.hatch && cap.hatch.gap) || 7, ca = Math.cos(ang), sa = Math.sin(ang);
    const miny = Math.max(0, Math.floor(Math.min(...all.map((s) => s[1])))), maxy = Math.min(H - 1, Math.ceil(Math.max(...all.map((s) => s[1]))));
    for (let y = miny; y <= maxy; y++) {
      const py = y + 0.5, xs = [];
      for (const L of loops) for (let i = 0; i < L.length; i++) {
        const a = L[i], b = L[(i + 1) % L.length];
        if ((a[1] <= py) !== (b[1] <= py)) xs.push(a[0] + ((py - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.max(0, Math.ceil(xs[k] - 0.5)), x1 = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = x0; x <= x1; x++) {
          const h = (((x * ca + y * sa) % gap) + gap) % gap, z = A[0] * (x + 0.5) + A[1] * py + A[2] - 1e-6;
          put(x, y, z, h < 1.3 ? cap.ink : cap.rgb, 1, cap.part, true);
        }
      }
    }
  }
  function line(ln, cam, W, H, put) {
    for (let i = 0; i + 1 < ln.pts.length; i++) {
      const a = cam.toScreen(ln.pts[i]), b = cam.toScreen(ln.pts[i + 1]);
      if (a[3] <= 0.05 || b[3] <= 0.05) continue;
      const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))) + 1, wd = ln.width || 1;
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t - 2e-4;
        for (let dy = 0; dy < wd; dy++) for (let dx = 0; dx < wd; dx++) {
          const X = Math.floor(x + dx - wd / 2 + 0.5), Y = Math.floor(y + dy - wd / 2 + 0.5);
          if (X >= 0 && Y >= 0 && X < W && Y < H) put(X, Y, z, ln.rgb, ln.alpha || 1, ln.part === undefined ? -1 : ln.part, false);
        }
      }
    }
  }
  function dot(pt, cam, W, H, put) {
    const s = cam.toScreen(pt.p);
    if (s[3] <= 0.05) return;
    const r = pt.r || 3, r2 = r * r;
    for (let y = Math.floor(s[1] - r); y <= Math.ceil(s[1] + r); y++) for (let x = Math.floor(s[0] - r); x <= Math.ceil(s[0] + r); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const dx = x + 0.5 - s[0], dy = y + 0.5 - s[1];
      if (dx * dx + dy * dy <= r2) put(x, y, s[2] - 3e-4, pt.rgb, 1, pt.part === undefined ? -1 : pt.part, false);
    }
  }

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);

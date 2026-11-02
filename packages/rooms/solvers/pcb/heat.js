// SPDX-License-Identifier: FSL-1.1-MIT
import { K_CU, K_FR4 } from "./constants.js";
import { bodyBox } from "./netlist.js";
import { planeRaster } from "./plane.js";
import { prims } from "./copper.js";
import { pcg } from "./cg.js";
import { rasterPrim } from "./dc.js";
// ======================================================================= Heat: fin equation on the board
export function thermalSolve(d, o) {
  o = o || {};
  const h = o.h || 10,
    res = o.res || Math.max(0.25, Math.max(d.W, d.H) / 160),
    nx = Math.ceil(d.W / res),
    ny = Math.ceil(d.H / res),
    n = nx * ny,
    zz = d.stack;
  let tDiel = 0;
  for (const t of zz.diel) tDiel += t;
  const K = new Float64Array(n).fill(K_FR4 * tDiel * 1e-3);
  if (d.tracks) {
    const cover = new Float32Array(n * d.layers),
      sub = res / 4,
      mark = (l, p) =>
        rasterPrim(p, sub, (i, j) => {
          const a = Math.floor(j / 4),
            b = Math.floor(i / 4);
          if (a >= 0 && b >= 0 && a < ny && b < nx) cover[l * n + a * nx + b] += 1 / 16;
        });
    for (let l = 0; l < d.layers; l++) {
      if (!(d.layers === 4 && (l === 1 || l === 2))) for (const p of prims(d, l)) mark(l, p);
      const pl = (d.planes || []).find((q) => q.l === l);
      if (pl) {
        const m = planeRaster(d, pl, res);
        for (let a = 0; a < n && a < m.mask.length; a++) if (m.mask[a]) cover[l * n + a] = 1;
      }
    }
    for (let a = 0; a < n; a++)
      for (let l = 0; l < d.layers; l++)
        K[a] += K_CU * zz.cu[l] * 1e-3 * Math.min(1, cover[l * n + a]);
  }
  const q = new Float64Array(n);
  let Q = 0;
  const addQ = (x0, y0, x1, y1, P) => {
    const a = [];
    for (
      let j = Math.max(0, Math.floor(y0 / res));
      j <= Math.min(ny - 1, Math.floor(y1 / res));
      j++
    )
      for (
        let i = Math.max(0, Math.floor(x0 / res));
        i <= Math.min(nx - 1, Math.floor(x1 / res));
        i++
      )
        a.push(j * nx + i);
    if (!a.length) return;
    for (const c of a) q[c] += P / a.length;
    Q += P;
  };
  for (const p of d.parts || [])
    if (p.P > 0) {
      const b = bodyBox(p);
      addQ(p.x - b.w / 2, p.y - b.h / 2, p.x + b.w / 2, p.y + b.h / 2, p.P);
    }
  for (const s of o.sources || []) addQ(s[0], s[1], s[2], s[3], s[4]);
  const ea = new Int32Array(2 * n),
    eb = new Int32Array(2 * n),
    eg = new Float64Array(2 * n);
  let m = 0;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * nx + i;
      if (i < nx - 1) {
        ea[m] = a;
        eb[m] = a + 1;
        eg[m++] = (2 * K[a] * K[a + 1]) / (K[a] + K[a + 1]);
      }
      if (j < ny - 1) {
        ea[m] = a;
        eb[m] = a + nx;
        eg[m++] = (2 * K[a] * K[a + nx]) / (K[a] + K[a + nx]);
      }
    }
  const A = res * res * 1e-6,
    diag = new Float64Array(n).fill(2 * h * A),
    s = pcg(n, ea.slice(0, m), eb.slice(0, m), eg.slice(0, m), diag, q, 1e-8, 4000);
  let mx = 0,
    sum = 0;
  for (let c = 0; c < n; c++) {
    if (s.x[c] > mx) mx = s.x[c];
    sum += s.x[c];
  }
  return { T: s.x, nx, ny, res, max: mx, mean: sum / n, Q, balance: 2 * h * A * sum, it: s.it, K };
}

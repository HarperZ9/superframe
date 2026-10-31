// SPDX-License-Identifier: FSL-1.1-MIT
import { layerZ } from "./constants.js";
import { planeRaster } from "./plane.js";
import { bbox, prims } from "./copper.js";
import { laplace } from "./field-solve.js";
// ======================================================================= Field across a real cut through the board
export function fieldSection(d, netId, yCut) {
  const lz = layerZ(d.layers),
    T = lz.total / 2,
    ivals = [];
  let xc = d.W / 2,
    found = false;
  const list = d.layers === 4 ? [0, 3] : [0, 1];
  for (const l of list)
    for (const p of prims(d, l)) {
      const b = bbox(p);
      if (b[1] > yCut || b[3] < yCut) continue;
      let a0 = b[0],
        a1 = b[2];
      if (p.k === "c" && p.y1 !== p.y2) {
        const u = (yCut - p.y1) / (p.y2 - p.y1);
        if (u < -0.2 || u > 1.2) {
        }
        const cx = p.x1 + (p.x2 - p.x1) * Math.max(0, Math.min(1, u)),
          dd = p.r / Math.max(0.3, Math.abs((p.y2 - p.y1) / Math.hypot(p.x2 - p.x1, p.y2 - p.y1)));
        a0 = cx - dd;
        a1 = cx + dd;
      }
      ivals.push({ l, a: a0, b: a1, net: p.net });
      if (p.net === netId && !found) {
        xc = (a0 + a1) / 2;
        found = true;
      }
    }
  const hw = Math.max(1.6, lz.total * 1.4),
    x0 = Math.max(0, xc - hw),
    x1 = Math.min(d.W, xc + hw),
    z0 = -T - 0.8,
    z1 = T + 0.8,
    nX = 220,
    nZ = 110,
    xs = [],
    zs = [];
  for (let i = 0; i < nX; i++) xs.push(x0 + ((x1 - x0) * i) / (nX - 1));
  for (let k = 0; k < nZ; k++) zs.push(z0 + ((z1 - z0) * k) / (nZ - 1));
  const lm = lz.z.map((q) => ({ top: Math.max(q.top, q.bot + 1e-3), bot: q.bot })),
    dz = zs[1] - zs[0],
    planeMask = {};
  for (const pl of d.planes || []) planeMask[pl.l] = planeRaster(d, pl, 0.1);
  const fixed = (x, z) => {
    for (let l = 0; l < d.layers; l++) {
      const q = lm[l];
      if (z < q.bot - dz / 2 || z > q.top + dz / 2) continue;
      for (const v of ivals) if (v.l === l && x >= v.a && x <= v.b) return v.net === netId ? 1 : 0;
      const m = planeMask[l];
      if (m && m.mask[m.at(x, yCut)]) {
        const pnet = (d.planes.find((p) => p.l === l) || {}).net;
        return pnet === netId ? 1 : 0;
      }
    }
    return null;
  };
  const eps = (x, z) => (Math.abs(z) < T ? d.stack.er : 1),
    r = laplace(xs, zs, eps, fixed, 700, true);
  return { ...r, x0, x1, z0, z1, T, ivals, lm, found, xc };
}

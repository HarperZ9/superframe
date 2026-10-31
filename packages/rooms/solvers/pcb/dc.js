// SPDX-License-Identifier: FSL-1.1-MIT
import { RHO_CU, layerZ } from "./constants.js";
import { planeRaster, segD } from "./plane.js";
import { bbox, prims } from "./copper.js";
import { pcg } from "./cg.js";
// ======================================================================= DC copper solver: sheet conduction on each layer, vias as lumped barrels
export function viaR(d, la, lb, dia) {
  const zz = layerZ(d.layers).z,
    L = Math.abs(zz[la].top - zz[lb].top),
    t = d.stack.plating,
    A = Math.PI * (dia * t - t * t);
  return (RHO_CU * L) / A;
}
export function rasterPrim(p, res, fn) {
  const b = bbox(p),
    a0 = Math.floor(b[0] / res),
    a1 = Math.ceil(b[2] / res),
    c0 = Math.floor(b[1] / res),
    c1 = Math.ceil(b[3] / res);
  for (let j = c0; j <= c1; j++)
    for (let i = a0; i <= a1; i++) {
      const x = (i + 0.5) * res,
        y = (j + 0.5) * res;
      const inn =
        p.k === "c"
          ? segD(x, y, p.x1, p.y1, p.x2, p.y2) <= p.r
          : Math.abs(x - p.x) <= p.hw && Math.abs(y - p.y) <= p.hh;
      if (inn) fn(i, j);
    }
}
export function dcSolve(d, net, I, fromKey, toKey, res0) {
  const cells = [],
    idx = new Map(),
    layerRes = {},
    fineRes = res0 || 0.05;
  const key = (l, i, j) => l * 1e8 + j * 1e4 + i,
    planeOf = (l) => (d.planes || []).find((p) => p.l === l && p.net === net);
  const add = (l, i, j) => {
    const k = key(l, i, j);
    if (!idx.has(k)) {
      idx.set(k, cells.length);
      cells.push({ l, i, j });
    }
    return idx.get(k);
  };
  for (let l = 0; l < d.layers; l++) {
    const pl = planeOf(l),
      res = pl ? 0.2 : fineRes;
    layerRes[l] = res;
    if (pl) {
      const m = planeRaster(d, pl, res);
      for (let j = 0; j < m.ny; j++)
        for (let i = 0; i < m.nx; i++) if (m.mask[j * m.nx + i]) add(l, i, j);
    }
    if (d.layers === 4 && (l === 1 || l === 2)) continue;
    for (const p of prims(d, l))
      if (p.net === net && (p.what !== "via" || true)) rasterPrim(p, res, (i, j) => add(l, i, j));
  }
  const n = cells.length;
  if (!n) return null;
  const ea = [],
    eb = [],
    eg = [];
  const links = [];
  const connLayers = [];
  for (let l = 0; l < d.layers; l++) if (cells.some((c) => c.l === l)) connLayers.push(l);
  const at = (l, x, y) => {
    const r = layerRes[l],
      q = idx.get(key(l, Math.floor(x / r), Math.floor(y / r)));
    return q === undefined ? -1 : q;
  };
  const barrel = (x, y, dia) => {
    for (let u = 0; u + 1 < connLayers.length; u++) {
      const a = at(connLayers[u], x, y),
        b = at(connLayers[u + 1], x, y);
      if (a >= 0 && b >= 0) links.push([a, b, 1 / viaR(d, connLayers[u], connLayers[u + 1], dia)]);
    }
  };
  for (const v of d.vias) if (v.net === net) barrel(v.x, v.y, v.d);
  for (const p of d.parts)
    for (const q of p.pads) if (q.th && q.net === net) barrel(q.x, q.y, q.drill);
  const fx = new Int8Array(n),
    pa = d.padMap[fromKey],
    pb = d.padMap[toKey];
  const padCells = (q, cb) => {
    const pp = q.round
      ? { k: "c", x1: q.x, y1: q.y, x2: q.x, y2: q.y, r: q.w / 2 }
      : { k: "r", x: q.x, y: q.y, hw: q.w / 2, hh: q.h / 2 };
    const r = layerRes[0];
    rasterPrim(pp, r, (i, j) => {
      const c = idx.get(key(0, i, j));
      if (c !== undefined) cb(c);
    });
  };
  const src = [],
    snk = [];
  padCells(pa, (c) => src.push(c));
  padCells(pb, (c) => snk.push(c));
  if (!src.length || !snk.length) return null;
  for (const c of snk) fx[c] = 1;
  const rhs = new Float64Array(n);
  for (const c of src) rhs[c] = I / src.length;
  const G = (c) => d.stack.cu[c.l] / RHO_CU,
    nb = new Int32Array(n * 4).fill(-1);
  cells.forEach((c, a) => {
    const g = G(c);
    for (const [di, dj, s] of [
      [1, 0, 0],
      [0, 1, 2],
    ]) {
      const b = idx.get(key(c.l, c.i + di, c.j + dj));
      if (b !== undefined) {
        nb[a * 4 + s] = b;
        nb[b * 4 + s + 1] = a;
        ea.push(a);
        eb.push(b);
        eg.push(g);
      }
    }
  });
  for (const [a, b, g] of links) {
    ea.push(a);
    eb.push(b);
    eg.push(g);
  }
  const diag = new Float64Array(n),
    keepA = [],
    keepB = [],
    keepG = [];
  for (let e = 0; e < ea.length; e++) {
    const a = ea[e],
      b = eb[e];
    if (fx[a] && fx[b]) continue;
    if (fx[a]) {
      diag[b] += eg[e];
      continue;
    }
    if (fx[b]) {
      diag[a] += eg[e];
      continue;
    }
    keepA.push(a);
    keepB.push(b);
    keepG.push(eg[e]);
  }
  for (let c = 0; c < n; c++) if (fx[c]) diag[c] = 1;
  const sol = pcg(
    n,
    Int32Array.from(keepA),
    Int32Array.from(keepB),
    Float64Array.from(keepG),
    diag,
    rhs,
    1e-9,
    6000
  );
  const V = sol.x;
  for (let c = 0; c < n; c++) if (fx[c]) V[c] = 0;
  let P = 0;
  for (let e = 0; e < ea.length; e++) {
    const q = V[ea[e]] - V[eb[e]];
    P += eg[e] * q * q;
  }
  const J = new Float32Array(n);
  let Jm = 0,
    Vm = 0;
  for (let c = 0; c < n; c++) {
    const r = layerRes[cells[c].l],
      L = nb[c * 4 + 1],
      Rr = nb[c * 4],
      B = nb[c * 4 + 3],
      T = nb[c * 4 + 2];
    const ex =
        Rr >= 0 && L >= 0
          ? (V[Rr] - V[L]) / (2 * r)
          : Rr >= 0
            ? (V[Rr] - V[c]) / r
            : L >= 0
              ? (V[c] - V[L]) / r
              : 0,
      ey =
        T >= 0 && B >= 0
          ? (V[T] - V[B]) / (2 * r)
          : T >= 0
            ? (V[T] - V[c]) / r
            : B >= 0
              ? (V[c] - V[B]) / r
              : 0;
    J[c] = Math.hypot(ex, ey) / RHO_CU;
    if (J[c] > Jm) Jm = J[c];
    if (V[c] > Vm) Vm = V[c];
  }
  let Vs = 0;
  for (const c of src) Vs += V[c];
  Vs /= src.length;
  return {
    cells,
    V,
    J,
    layerRes,
    R: Vs / I,
    Vdrop: Vs,
    Jmax: Jm,
    Vmax: Vm,
    P,
    I,
    it: sol.it,
    res: sol.res,
    n,
    idx,
    key,
  };
}

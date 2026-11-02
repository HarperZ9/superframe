// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/route: a two-layer grid autorouter. Each layer is a grid of cells that records which net's copper
   covers it (every cell the copper touches). A trace centre may sit on a cell only if no foreign copper lies inside
   width / 2 + clearance + one cell diagonal, so the grid answer is conservative and the vector DRC is the judge.
   Search: A* over (layer, cell, heading) with eight headings, a turn penalty, a via cost and an octile heuristic.
   A net is a tree: each further pin is joined to whatever copper of that net already exists. Failed nets go
   first on the next pass (rip-up and retry). */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});
  E.TIE = "__tie__";
  const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1], SQ2 = Math.SQRT2;

  E.grid = (B, p = 0.2) => {
    const nx = Math.round(B.w / p), ny = Math.round(B.h / p), occ = [new Int32Array(nx * ny).fill(-1), new Int32Array(nx * ny).fill(-1)];
    const ids = Object.keys(B.nets), id = Object.fromEntries(ids.map((n, i) => [n, i]));
    const cl = ids.map((n) => B.classes[B.nets[n].cls].clearance);
    /* net-tie pads get a pseudo-net that only the tied nets may touch */
    const tieNets = new Set(B.parts.filter((P) => P.fp.tie).flatMap((P) => Object.values(P.comp.pins)).map((n) => id[n]));
    id[E.TIE] = ids.length; cl.push(B.rules.minClearance);
    return { p, nx, ny, occ, ids, id, cl, B, tieId: ids.length, tieNets, slack: 0.71 * p + 0.05 };
  };
  const cc = (G, i, j) => [(i + 0.5) * G.p, (j + 0.5) * G.p];

  /* mark every cell that the shape touches (centre within one half-diagonal of it) */
  E.paint = (G, layers, shape, net, grow = 0.71) => {
    const b = E.bbox(shape), p = G.p, k = net === null ? -1 : G.id[net];
    const i0 = Math.max(0, Math.floor(b[0] / p) - 1), i1 = Math.min(G.nx - 1, Math.ceil(b[2] / p) + 1), j0 = Math.max(0, Math.floor(b[1] / p) - 1), j1 = Math.min(G.ny - 1, Math.ceil(b[3] / p) + 1);
    for (const L of layers) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (E.ptDist(cc(G, i, j), shape) <= grow * p) G.occ[L][j * G.nx + i] = k;
  };

  /* may a centre of net n, radius hw, sit at cell (i, j) on layer L? */
  const clear = (G, L, i, j, n, hw) => {
    const p = G.p, c = cc(G, i, j), e = G.B.rules.edge + hw;
    if (c[0] < e || c[1] < e || c[0] > G.B.w - e || c[1] > G.B.h - e) return false;
    const rmax = Math.ceil((hw + 0.4 + G.slack) / p), O = G.occ[L], cn = G.cl[n];
    for (let dj = -rmax; dj <= rmax; dj++) {
      const jj = j + dj; if (jj < 0 || jj >= G.ny) continue;
      for (let di = -rmax; di <= rmax; di++) {
        const ii = i + di; if (ii < 0 || ii >= G.nx) continue;
        const m = O[jj * G.nx + ii];
        if (m < 0 || m === n || (m === G.tieId && G.tieNets.has(n))) continue;
        if (Math.hypot(di, dj) * p < hw + Math.max(cn, G.cl[m]) + G.slack) return false;
      }
    }
    return true;
  };
  E.clearCell = clear;

  /* a minimal binary heap of (key, value) */
  const heap = () => {
    let k = new Float64Array(1 << 16), v = new Int32Array(1 << 16), n = 0;
    return {
      get size() { return n; },
      push(key, val) {
        if (n === k.length) { const k2 = new Float64Array(n * 2), v2 = new Int32Array(n * 2); k2.set(k); v2.set(v); k = k2; v = v2; }
        let i = n++; while (i > 0) { const pr = (i - 1) >> 1; if (k[pr] <= key) break; k[i] = k[pr]; v[i] = v[pr]; i = pr; } k[i] = key; v[i] = val;
      },
      pop() {
        const top = v[0], lk = k[--n], lv = v[n]; let i = 0;
        for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
        k[i] = lk; v[i] = lv; return top;
      },
    };
  };

  /* A* from the source cells to any cell marked in tree; returns [[L, i, j], ...] from source to tree, or null */
  E.astar = (G, S, net, hw, src, tree, aim, opt = {}) => {
    const { nx, ny } = G, NC = nx * ny, NS = 2 * NC * 9, n = G.id[net], viaR = G.B.rules.via.dia / 2;
    if (!S.g || S.g.length !== NS) { S.g = new Float32Array(NS); S.par = new Int32Array(NS); S.stamp = new Int32Array(NS); S.id = 0; }
    const id = ++S.id, gg = S.g, par = S.par, st = S.stamp, H = heap(), ok = S.ok;
    const legal = (L, c) => { const q = L * NC + c; if (!ok[q]) ok[q] = clear(G, L, c % nx, (c / nx) | 0, n, hw) ? 1 : 2; return ok[q] === 1; };
    const viaOk = (c) => { const q = 2 * NC + c; if (!ok[q]) ok[q] = clear(G, 0, c % nx, (c / nx) | 0, n, viaR) && clear(G, 1, c % nx, (c / nx) | 0, n, viaR) ? 1 : 2; return ok[q] === 1; };
    const h = (c) => { const dx = Math.abs((c % nx) - aim[0]), dy = Math.abs(((c / nx) | 0) - aim[1]); return Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy); };
    for (const [L, c] of src) { const s = (L * NC + c) * 9 + 8; st[s] = id; gg[s] = 0; par[s] = -1; H.push(h(c), s); }
    let pops = 0;
    while (H.size) {
      const s = H.pop(), d = s % 9, lc = (s / 9) | 0, L = (lc / NC) | 0, c = lc % NC, g0 = gg[s];
      if (++pops > (opt.limit || 3e6)) return null;
      if (tree[L * NC + c] && par[s] !== -1) {
        const path = []; let t = s;
        while (t !== -1) { const q = (t / 9) | 0; path.push([(q / NC) | 0, (q % NC) % nx, ((q % NC) / nx) | 0]); t = par[t]; }
        return path.reverse();
      }
      const i = c % nx, j = (c / nx) | 0;
      for (let k = 0; k < 8; k++) {
        const ii = i + DX[k], jj = j + DY[k];
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const c2 = jj * nx + ii;
        if (!legal(L, c2)) continue;
        if (k % 2 && (!legal(L, j * nx + ii) || !legal(L, jj * nx + i))) continue;   /* no diagonal squeeze */
        const turn = d === 8 ? 0 : Math.min((k - d + 8) % 8, (d - k + 8) % 8), tc = turn === 0 ? 0 : turn === 1 ? 0.3 : turn === 2 ? 1.0 : 6;
        const s2 = (L * NC + c2) * 9 + k, g2 = g0 + (k % 2 ? SQ2 : 1) + tc;
        if (st[s2] === id && gg[s2] <= g2) continue;
        st[s2] = id; gg[s2] = g2; par[s2] = s; H.push(g2 + h(c2), s2);
      }
      if (viaOk(c)) {
        const s2 = ((1 - L) * NC + c) * 9 + 8, g2 = g0 + (opt.viaCost || 12);
        if (!(st[s2] === id && gg[s2] <= g2)) { st[s2] = id; gg[s2] = g2; par[s2] = s; H.push(g2 + h(c), s2); }
      }
    }
    return null;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);

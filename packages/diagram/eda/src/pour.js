// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/pour: copper pours on the bottom layer. A pour cell is a whole grid square inside its island whose
   every point clears foreign copper by the pour clearance; ground pads then reach their pour by the router (a stub
   and a via), pour fragments that no pad reaches are removed, and the survivors are merged into rectangles, which
   are what the Gerber region and the DRC see. Solid connection to pads, no thermal spokes (a stated limit). */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});

  const pourCellOk = (G, L, i, j, n, pcl) => {
    const p = G.p, e = G.B.rules.edge;
    if (i * p < e || j * p < e || (i + 1) * p > G.B.w - e || (j + 1) * p > G.B.h - e) return false;
    const need = (m) => Math.max(pcl, G.cl[m]) + 1.42 * p + 0.05, rmax = Math.ceil((0.4 + 1.42 * p + 0.05) / p), O = G.occ[L];
    for (let dj = -rmax; dj <= rmax; dj++) for (let di = -rmax; di <= rmax; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= G.nx || jj >= G.ny) continue;
      const m = O[jj * G.nx + ii]; if (m < 0 || m === n) continue;
      if (Math.hypot(di, dj) * p < need(m)) return false;
    }
    return true;
  };

  /* merge a cell mask into rectangles: runs per row, then identical runs stacked */
  E.rects = (mask, nx, ny, p) => {
    const open = new Map(), out = [];
    for (let j = 0; j <= ny; j++) {
      const runs = [];
      if (j < ny) for (let i = 0; i < nx; ) { if (!mask[j * nx + i]) { i++; continue; } let k = i; while (k < nx && mask[j * nx + k]) k++; runs.push(i + "," + k); i = k; }
      const now = new Set(runs);
      for (const [key, j0] of [...open]) if (!now.has(key)) { const [a, b] = key.split(",").map(Number); out.push([a * p, j0 * p, b * p, j * p]); open.delete(key); }
      for (const key of runs) if (!open.has(key)) open.set(key, j);
    }
    return out;
  };

  const flood = (mask, seeds, nx, ny) => {
    const keep = new Uint8Array(mask.length), st = [];
    for (const s of seeds) if (mask[s] && !keep[s]) { keep[s] = 1; st.push(s); }
    while (st.length) {
      const c = st.pop(), i = c % nx, j = (c / nx) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; const q = jj * nx + ii; if (mask[q] && !keep[q]) { keep[q] = 1; st.push(q); } }
    }
    return keep;
  };

  E.pourAndStitch = (G, B, S, pads, log) => {
    const NC = G.nx * G.ny, p = G.p;
    for (const P of B.pours) {
      const n = G.id[P.net], L = P.layer === "F" ? 0 : 1, mask = new Uint8Array(NC), r = P.rect;
      for (let j = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++) {
        const c = [(i + 0.5) * p, (j + 0.5) * p];
        if (c[0] < r[0] || c[0] > r[2] || c[1] < r[1] || c[1] > r[3]) continue;
        if (pourCellOk(G, L, i, j, n, B.rules.pourClearance)) mask[j * G.nx + i] = 1;
      }
      for (let k = 0; k < NC; k++) if (mask[k]) G.occ[L][k] = n;
      /* stitch: each pad of this net joins the pour or the copper already joined to it */
      const tree = new Uint8Array(2 * NC);
      for (let k = 0; k < NC; k++) if (mask[k]) tree[L * NC + k] = 1;
      const mine = pads.filter((q) => q.net === P.net).sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1]);
      for (const q of mine) q.aim = null;
      const failed = E._routeNet(G, B, S, P.net, pads, tree, mine);
      /* remove pour copper that nothing of this net reaches */
      const seeds = [];
      for (let j = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++) {
        const k = j * G.nx + i; if (!mask[k]) continue;
        const c = [(i + 0.5) * p, (j + 0.5) * p];
        const hit = B.vias.some((v) => v.net === P.net && Math.hypot(v.at[0] - c[0], v.at[1] - c[1]) <= v.dia / 2 + 0.71 * p) ||
          mine.some((q) => q.pad.side === "both" && E.ptDist(c, q.shape) <= 0.71 * p) ||
          B.traces.some((s) => s.net === P.net && s.layer === L && E.ptDist(c, { pts: [s.a, s.b], r: s.w / 2 }) <= 0.71 * p);
        if (hit) seeds.push(k);
      }
      const keep = flood(mask, seeds, G.nx, G.ny);
      let dead = 0;
      for (let k = 0; k < NC; k++) if (mask[k] && !keep[k]) { G.occ[L][k] = -1; dead++; }
      const rects = E.rects(keep, G.nx, G.ny, p);
      for (const q of rects) B.pourRects.push({ net: P.net, layer: L, rect: q });
      log.push({ pour: P.net, cells: keep.reduce((s, v) => s + v, 0), deadCells: dead, rects: rects.length, stitchFailed: failed.map((q) => q.P.ref + "." + q.pad.num) });
    }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);

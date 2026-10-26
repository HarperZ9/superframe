// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// align.mjs: align before blend (BLEED section 20). Two elements of one kind (two palettes, stroke sets, stems) are
// matched part to part before any blend, the way Git Re-Basin (Ainsworth, Hayase and Srinivasa 2022) permutes one
// network's units to match another's before merging. The matching is an assignment problem solved exactly by the
// Hungarian method (Kuhn 1955; Munkres 1957) on a cost matrix of part descriptors (OKLab distance for colours).
//   hungarian(cost) -> { assign: [j for each i], total }
//   alignPalettes(A, B) -> { perm, cost, pairs } where A and B are [{ lin, w }] and perm[i] is B's index matched to i
//   blendPalettes(A, B, t, { align, mix }) -> { palette, alignment, meanChroma }: alignment recorded for reinspection
//   symmetries(fn, parts) -> permutations of parts that leave fn's output unchanged (the meso case: not differences)
import { okDist, oklch } from '../ir/ir.mjs';
import { specOf, spectrumRGB, mixKM } from './spectral.mjs';

export function hungarian(cost) {
  const n = cost.length, m = cost[0].length, N = Math.max(n, m), INF = 1e18;
  const a = Array.from({ length: N + 1 }, (_, i) => Array.from({ length: N + 1 }, (_, j) => (i && j && i <= n && j <= m ? cost[i - 1][j - 1] : 0)));
  const u = new Float64Array(N + 1), v = new Float64Array(N + 1), p = new Int32Array(N + 1), way = new Int32Array(N + 1);
  for (let i = 1; i <= N; i++) {
    p[0] = i; let j0 = 0; const minv = new Float64Array(N + 1).fill(INF), used = new Uint8Array(N + 1);
    do {
      used[j0] = 1; const i0 = p[j0]; let delta = INF, j1 = 0;
      for (let j = 1; j <= N; j++) if (!used[j]) { const cur = a[i0][j] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0; } if (minv[j] < delta) { delta = minv[j]; j1 = j; } }
      for (let j = 0; j <= N; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const assign = new Array(n).fill(-1); for (let j = 1; j <= N; j++) if (p[j] && p[j] <= n && j <= m) assign[p[j] - 1] = j - 1;
  let total = 0; for (let i = 0; i < n; i++) if (assign[i] >= 0) total += cost[i][assign[i]];
  return { assign, total };
}

export function alignPalettes(A, B) {
  const cost = A.map(a => B.map(b => okDist(a.lin, b.lin))), { assign, total } = hungarian(cost);
  return { perm: assign, cost: total, pairs: assign.map((j, i) => ({ a: i, b: j, dist: +cost[i][j].toFixed(4) })) };
}

// blend two palettes part by part at t (0 = A, 1 = B). mix 'pigment' = Kubelka-Munk on the parts' spectra (the
// pigments' own law), 'light' = linear in rgb. Weights blend linearly. With align false, parts pair by list order.
export function blendPalettes(A, B, t = 0.5, { align = true, mix = 'pigment' } = {}) {
  const al = align ? alignPalettes(A, B) : { perm: A.map((_, i) => i % B.length), cost: null, pairs: A.map((_, i) => ({ a: i, b: i % B.length, dist: +okDist(A[i].lin, B[i % B.length].lin).toFixed(4) })) };
  const palette = A.map((a, i) => {
    const b = B[al.perm[i]], lin = mix === 'pigment' ? spectrumRGB(mixKM([{ R: specOf(a.lin), c: 1 - t }, { R: specOf(b.lin), c: t }])) : a.lin.map((v, c) => v * (1 - t) + b.lin[c] * t);
    return { lin, w: a.w * (1 - t) + b.w * t };
  });
  const tw = palette.reduce((s, p) => s + p.w, 0), meanChroma = palette.reduce((s, p) => s + oklch(p.lin)[1] * p.w, 0) / tw;
  return { palette, alignment: { method: align ? 'Hungarian on OKLab distance' : 'list order (unaligned)', ...al }, meanChroma };
}

// permutations among parts that leave fn(parts) unchanged within eps: symmetries, so the isomer test can skip them
export function symmetries(fn, parts, perms, eps = 1e-6) {
  const base = fn(parts), out = [];
  for (const p of perms) { const r = fn(p.map(i => parts[i])); let d = 0; for (let k = 0; k < base.length; k++) d = Math.max(d, Math.abs(base[k] - r[k])); if (d < eps) out.push(p); }
  return out;
}

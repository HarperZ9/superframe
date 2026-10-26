// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// mosaic: tesserae laid with andamento, the flow of courses a mosaicist lays along a form (BLEED section 3; the
// reference library's rule "andamento follows form"). From first principles:
//   partition  the distance from the guide's edge (a chamfer 3-4 transform) is cut into courses of one tile's width,
//              so every row of tiles runs parallel to the form; along each course, tile centres are picked by a
//              Poisson-disk walk at spacing `size`; each cell joins the nearest centre in its own course (a Voronoi
//              partition constrained to the course, which is what keeps the rows unbroken)
//   grout      a cell is grout where its nearest and second-nearest centre are within `grout` cells of a tie
//   fill       a tile's colour comes from a context source layer sampled at its centre (a picture, a field, a word)
//              or from the palette by a seeded hash, with a small per-tile value jitter (hand-cut glass varies)
//   clock      tiles are laid in course order outward from the form, one by one, as forward motion: at progress p
//              the first p * N tiles are down, each settling in over `settle` of the run (the laying is the motion)
// amount = tile cover (0 in grout and in unlaid tiles), rgb = tile colour. Fills the partition gap recorded in
// SYNTHESIS-MAP section 1 (no Voronoi or cell partition existed).
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, rngFrom, hexLin, textMask, smooth } from '../core/layer.mjs';

export const MOSAIC_PALETTE = ['#a93b29', '#ddd286', '#416f66', '#263760', '#465791', '#eb8f4a', '#d25c22', '#ded8cb'];

export const mosaic = defineGen({
  id: 'mosaic',
  law: { shape: 'tiles', params: { cover: 'opaque glass over what is below, grout shows the bed' } },
  weights: { size: 'tile size, cells', grout: 'grout half-width, cells', jitter: 'per-tile value jitter', settle: 'share of the run one tile takes to set', speed: 'run length, seconds' },
  inputs: { source: 'optional: colours the tiles', timing: 'optional: drives the laying' },
  mechanism: 'courses = floor(D / size), D = chamfer distance to the guide edge; centres by Poisson-disk walk per course; cell -> nearest centre in its course; grout where d2 - d1 < grout',
  credits: ['Byzantine and Roman opus vermiculatum (andamento)', 'Voronoi 1908; Lloyd 1982 (partition)', 'Hausner 2001, Simulating Decorative Mosaics (direction-field tiles, prior art)', 'Bayer, Divisumma (tiles that stay tiles)'],
  create({ w = 160, h = 100, guide = null, text = null, size = 4, grout = 0.6, jitter = 0.12, palette = MOSAIC_PALETTE, settle = 0.04, speed = 8, seed = 'mosaic', box } = {}) {
    const G = guide ?? (text ? textMask(text, w, h, box) : circle(w, h)), D = chamfer(G, w, h), r = rngFrom(seed), n = w * h;
    const course = Int32Array.from(D, d => Math.floor(d / size)), centres = [];
    const order = [...Array(n).keys()].sort((a, b) => course[a] - course[b] || angle(a, w, h) - angle(b, w, h));
    const taken = new Map(), key = (i, j) => i * 100003 + j;
    for (const k of order) {
      const c = course[k], mid = (c + 0.5) * size; if (Math.abs(D[k] - mid) > 0.6) continue;
      const x = k % w + 0.5, y = (k / w | 0) + 0.5, gi = Math.floor(x / size), gj = Math.floor(y / size); let ok = true;
      for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1 && ok; b++) for (const q of taken.get(key(gi + a, gj + b)) ?? []) if (q.c === c && Math.hypot(q.x - x, q.y - y) < size * 0.95) { ok = false; break; }
      if (!ok) continue;
      const t = { x, y, c, id: centres.length, col: hexLin(palette[Math.floor(r() * palette.length)]), j: 1 + jitter * (r() * 2 - 1) };
      centres.push(t); const g = key(gi, gj); if (!taken.has(g)) taken.set(g, []); taken.get(g).push(t);
    }
    const tile = new Int32Array(n).fill(-1), edge = F32(n), R = 3;
    for (let k = 0; k < n; k++) {
      const x = k % w + 0.5, y = (k / w | 0) + 0.5, gi = Math.floor(x / size), gj = Math.floor(y / size); let d1 = 1e9, d2 = 1e9, best = -1;
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) for (const q of taken.get(key(gi + a, gj + b)) ?? []) { if (q.c !== course[k]) continue; const d = Math.hypot(q.x - x, q.y - y); if (d < d1) { d2 = d1; d1 = d; best = q.id; } else if (d < d2) d2 = d; }
      tile[k] = best; edge[k] = d2 - d1;
    }
    const L = makeLayer('mosaic', { w, h, law: { shape: 'tiles', params: {} }, weights: { size, grout, jitter, settle, speed }, fields: { rgb: F32(3 * n) }, state: { centres, tile, edge, D, p: 0 } });
    paint(L, null); return L;
  },
  step(L, dt, ctx) {
    const S = L.state; S.p = ctx.timing?.state ? ctx.timing.state.progress : Math.min(1, S.p + dt / L.weights.speed);
    paint(L, ctx.source);
  },
});

function paint(L, source) {
  const S = L.state, N = S.centres.length, A = L.fields.amount, C = L.fields.rgb, { grout, settle } = L.weights, src = source?.fields.amount;
  const laidF = S.laid ??= new Float32Array(L.n);   // per-cell laying weight: the transfer ticks (-1 outside the tiles)
  for (let k = 0; k < L.n; k++) {
    const id = S.tile[k]; if (id < 0) { A[k] = 0; laidF[k] = -1; continue; }
    const q = S.centres[id], laid = L.weights.global ? smooth(0, 1, S.p) : smooth(0, 1, (S.p - id / N) / settle);   // global: the crossfade control
    laidF[k] = laid; A[k] = laid * smooth(0, grout * 2, S.edge[k] - grout * 0.5);
    const tone = src ? 0.35 + 0.9 * src[Math.floor(q.y) * L.w + Math.floor(q.x)] : 1;
    for (let c = 0; c < 3; c++) C[3 * k + c] = clamp(q.col[c] * q.j * tone, 0, 1);
  }
}

// chamfer 3-4 distance to the guide's edge (cells), from both sides
function chamfer(G, w, h) {
  const D = F32(w * h), INF = 1e6;
  for (let k = 0; k < D.length; k++) { const i = k % w, j = k / w | 0, inside = G[k] > 0.5; let edge = false; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + a, y = j + b; if (x >= 0 && y >= 0 && x < w && y < h && (G[y * w + x] > 0.5) !== inside) edge = true; } D[k] = edge ? 0 : INF; }
  const pass = (fw) => { for (let jj = 0; jj < h; jj++) { const j = fw ? jj : h - 1 - jj; for (let ii = 0; ii < w; ii++) { const i = fw ? ii : w - 1 - ii, k = j * w + i, s = fw ? -1 : 1; for (const [a, b, c] of [[s, 0, 3], [0, s, 3], [s, s, 4], [-s, s, 4]]) { const x = i + a, y = j + b; if (x >= 0 && y >= 0 && x < w && y < h) D[k] = Math.min(D[k], D[y * w + x] + c); } } } };
  pass(true); pass(false); for (let k = 0; k < D.length; k++) D[k] /= 3;
  return D;
}
const angle = (k, w, h) => Math.atan2((k / w | 0) - h / 2, k % w - w / 2);
function circle(w, h) { const m = F32(w * h); for (let k = 0; k < m.length; k++) m[k] = Math.hypot(k % w - w / 2, (k / w | 0) - h / 2) < Math.min(w, h) * 0.22 ? 1 : 0; return m; }

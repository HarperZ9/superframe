// Paths for people on a plate as A* over a visibility graph (2026-10-21; the author's pathfinding
// reference showed a visibility graph finding an equal-cost path with far fewer expansions than grid
// A*). Our own implementation over the plate's walk grid (world/plateworld.mjs arenas):
//   nodes   the convex corners of what blocks the floor: an open cell whose diagonal neighbour is
//           blocked while both cells beside it are open (a path bends only round such a corner);
//   edges   pairs of nodes in sight of each other over open floor, no corner cut (within maxEdge m);
//   query   start and goal join the nodes they can see; A* with straight-line distance.
// The graph is built once per arena (cached) from hard floor (no prop margins), so paths keep the
// body's margin off props; water is checked at query time and a path that crosses water falls back
// to grid A* (findPath). Stats (expansions, nodes, edges) for the bench and the debug view.
//   visGraph(arena)                          -> { nodes: [[x, z]], adj: [[i, d]...], ms }
//   findPathVG(arena, from, to, opts)        -> [[x, z] ...] (ending on the goal) or null
//                                               opts: waterY, stats (filled: expanded, visible)
//   lineOpen(arena, a, b, waterY)            -> whether a body walks straight from a to b
import { findPath } from "./plateworld.mjs";

const KNEE = 0.35; // as plateworld: deeper water than this over the floor stops a walker
const cache = new WeakMap();

function cellOpen(arena, ci, ri, waterY = -Infinity) {
  if (ci < 0 || ri < 0 || ci >= arena.grid.w || ri >= arena.grid.h) return false;
  const c = arena.grid.cells[ri * arena.grid.w + ci];
  return !!c && !c.margin && !(waterY - c.h > KNEE);
}
const cellOf = (arena, x, z) => [Math.floor((x - arena.origin[0]) / arena.cell), Math.floor((z - arena.origin[1]) / arena.cell)];
const centre = (arena, ci, ri) => [arena.origin[0] + (ci + 0.5) * arena.cell, arena.origin[1] + (ri + 0.5) * arena.cell];

// Every cell the segment passes through is open, and where it crosses a cell corner diagonally both
// cells beside the corner are open (no squeezing between two props).
export function lineOpen(arena, a, b, waterY = -Infinity) {
  const c = arena.cell, ox = arena.origin[0], oz = arena.origin[1];
  let x = (a[0] - ox) / c, z = (a[1] - oz) / c; const X = (b[0] - ox) / c, Z = (b[1] - oz) / c;
  let ci = Math.floor(x), ri = Math.floor(z); const ce = Math.floor(X), re = Math.floor(Z);
  const dx = X - x, dz = Z - z, sx = Math.sign(dx), sz = Math.sign(dz);
  const tdx = sx ? Math.abs(1 / dx) : Infinity, tdz = sz ? Math.abs(1 / dz) : Infinity;
  let tx = sx ? (sx > 0 ? Math.floor(x) + 1 - x : x - Math.floor(x)) * tdx : Infinity, tz = sz ? (sz > 0 ? Math.floor(z) + 1 - z : z - Math.floor(z)) * tdz : Infinity;
  if (!cellOpen(arena, ci, ri, waterY)) return false;
  for (let n = 0; n < 4096 && (ci !== ce || ri !== re); n++) {
    if (Math.abs(tx - tz) < 1e-9) { // through a corner: both sides and the diagonal
      if (!cellOpen(arena, ci + sx, ri, waterY) || !cellOpen(arena, ci, ri + sz, waterY)) return false;
      ci += sx; ri += sz; tx += tdx; tz += tdz;
    } else if (tx < tz) { ci += sx; tx += tdx; } else { ri += sz; tz += tdz; }
    if (!cellOpen(arena, ci, ri, waterY)) return false;
  }
  return true;
}

export function visGraph(arena, { maxEdge = 14 } = {}) {
  if (cache.has(arena)) return cache.get(arena);
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const W = arena.grid.w, H = arena.grid.h, nodes = [], seen = new Set();
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (!cellOpen(arena, c, r)) continue;
    for (const [dc, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (cellOpen(arena, c + dc, r + dr) || !cellOpen(arena, c + dc, r) || !cellOpen(arena, c, r + dr)) continue;
      const k = r * W + c; if (!seen.has(k)) { seen.add(k); nodes.push(centre(arena, c, r)); }
    }
  }
  const adj = nodes.map(() => []), m2 = maxEdge * maxEdge; let edges = 0;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j], d2 = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; if (d2 > m2) continue;
    if (!lineOpen(arena, a, b)) continue;
    const d = Math.sqrt(d2); adj[i].push([j, d]); adj[j].push([i, d]); edges++;
  }
  const g = { nodes, adj, edges, ms: (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0 };
  cache.set(arena, g);
  return g;
}

// A binary heap of [f, id].
function heap() {
  const a = [];
  return {
    get size() { return a.length; },
    push(f, id) { a.push([f, id]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } },
    pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; },
  };
}

// Where a query point stands: itself on open floor, else the nearest open cell centre within 1.5 m.
function anchor(arena, p, waterY) {
  const [ci, ri] = cellOf(arena, p[0], p[1]); if (cellOpen(arena, ci, ri, waterY)) return p;
  const R = Math.ceil(1.5 / arena.cell); let best = null;
  for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) { const d = dc * dc + dr * dr; if (d <= R * R && cellOpen(arena, ci + dc, ri + dr, waterY) && (!best || d < best.d)) best = { d, p: centre(arena, ci + dc, ri + dr) }; }
  return best && best.p;
}

export function findPathVG(arena, from, to, { waterY = -Infinity, stats = null, fallback = true } = {}) {
  const s = anchor(arena, from, waterY), g = anchor(arena, to, waterY);
  const grid = () => (fallback ? findPath(arena, from, to, { waterY }) : null);
  if (!s || !g) return grid();
  if (lineOpen(arena, s, g, waterY)) { if (stats) Object.assign(stats, { expanded: 0, visible: 1 }); return [g]; }
  const G = visGraph(arena), N = G.nodes.length, S = N, T = N + 1, pt = (i) => (i === S ? s : i === T ? g : G.nodes[i]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // the start and goal see which nodes (and water is checked on every edge used, since the graph is dry)
  const fromS = [], toT = new Map();
  for (let i = 0; i < N; i++) { const p = G.nodes[i]; if (lineOpen(arena, s, p, waterY)) fromS.push([i, dist(s, p)]); if (lineOpen(arena, p, g, waterY)) toT.set(i, dist(p, g)); }
  const gs = new Map([[S, 0]]), came = new Map(), H = heap(), done = new Set(); let expanded = 0;
  H.push(dist(s, g), S);
  while (H.size) {
    const [, u] = H.pop(); if (done.has(u)) continue; done.add(u); expanded++;
    if (u === T) break;
    const nb = u === S ? fromS : G.adj[u].filter(([v]) => waterY === -Infinity || lineOpen(arena, G.nodes[u], G.nodes[v], waterY));
    const edges = toT.has(u) ? [...nb, [T, toT.get(u)]] : nb;
    for (const [v, d] of edges) { const t = gs.get(u) + d; if (t < (gs.get(v) ?? Infinity)) { gs.set(v, t); came.set(v, u); H.push(t + dist(pt(v), g), v); } }
  }
  if (stats) Object.assign(stats, { expanded, visible: fromS.length, nodes: N, edges: G.edges });
  if (!gs.has(T)) return grid();
  const out = []; for (let k = T; k !== S; k = came.get(k)) out.push(pt(k));
  return out.reverse();
}

// A path's length in metres from a start point.
export const pathLength = (from, pts) => pts.reduce((a, p, i) => a + Math.hypot(p[0] - (i ? pts[i - 1][0] : from[0]), p[1] - (i ? pts[i - 1][1] : from[1])), 0);

// Walking round the ground: a flow field over a plate's cells toward a goal, honouring walls, ledges
// (sim/terrain.mjs: a walk never crosses one) and water at the waist. Brains and the scripted pilot
// use it when the straight line is blocked, so a ledge sends a body to the stairs instead of
// stopping it at the lip. Row arenas have no ledges and walk straight.
//
//   wayToward(W, F, x, z) -> { mx, mz } unit stick toward (x, z) along the ground, or null on a row
//   arena or when no way exists (callers then walk straight).
//   go(W, F, x, z, s) -> a stick of size s: straight when the line is clear, else along the ground.
import { stepDrop, ledgeClear } from "./terrain.mjs";
import { OFF } from "../data/world.mjs";
import { dhypot } from "./math.mjs";

const fields = new WeakMap();
// tunables for tools (ablation runs): narrow gaps barred, the cost of a cell beside a wall, the half-width of the straight-line test
export const PATHS = { narrow: true, hug: 2, wide: 0.2 };
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Distance (in cells) from every cell to the goal cell over passable steps, a cell beside a wall
// costing more (label-correcting: a cell is queued again when a cheaper way to it is found).
function flow(W, gi) {
  const A = W.field.arena, { w, h, cells } = A.grid, c = A.cell, [ox, oz] = A.origin;
  let per = fields.get(A); if (!per) fields.set(A, (per = new Map()));
  const key = `${gi}:${Math.floor(W.tick / 120)}`, hit = per.get(key);
  if (hit) return hit;
  if (per.size > 64) per.clear();
  const cx = (i) => ox + ((i % w) + 0.5) * c, cz = (i) => oz + (Math.floor(i / w) + 0.5) * c;
  // a cell with solid ground on both opposite sides is a gap narrower than a body (0.5 m): not a way through
  const open1 = (X, Z) => X >= 0 && Z >= 0 && X < w && Z < h && !!cells[Z * w + X];
  const narrow = (i) => { const x = i % w, z = Math.floor(i / w); return (!open1(x - 1, z) && !open1(x + 1, z)) || (!open1(x, z - 1) && !open1(x, z + 1)); };
  const pass = (i) => cells[i] && W.field.depthAt(cx(i), cz(i)) < 0.85 && (i === gi || !PATHS.narrow || !narrow(i));
  const hug = (i) => { const x = i % w, z = Math.floor(i / w); for (const [dx, dz] of NB) { const X = x + dx, Z = z + dz; if (X >= 0 && Z >= 0 && X < w && Z < h && !cells[Z * w + X]) return true; } return false; };
  const dist = new Float32Array(w * h).fill(Infinity), q = [];
  let head = 0; dist[gi] = 0; q.push(gi);
  while (head < q.length) {
    const i = q[head++], x = i % w, z = Math.floor(i / w);
    for (const [dx, dz] of NB) {
      const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= w || Z >= h) continue;
      const j = Z * w + X; if (!pass(j)) continue;
      if (dx && dz && (!cells[z * w + X] || !cells[Z * w + x])) continue; // no cutting a wall's corner
      if (stepDrop(A, cx(j), cz(j), cx(i), cz(i)) !== 0) continue; // the step from j toward i must be walkable
      const nd = dist[i] + (dx && dz ? 1.414 : 1) + (hug(j) ? PATHS.hug : 0); if (nd >= dist[j]) continue; dist[j] = nd; q.push(j);   // keep off walls where there is room (a body has width)
    }
  }
  per.set(key, dist);
  return dist;
}

const cellOf = (A, x, z) => { const { w, h } = A.grid, c = Math.floor((x - A.origin[0]) / A.cell), r = Math.floor((z - A.origin[1]) / A.cell); return c >= 0 && r >= 0 && c < w && r < h ? r * w + c : -1; };

export function wayToward(W, F, x, z) {
  const A = W.field.arena; if (!A.grid) return null;
  const gi = cellOf(A, x, z), si = cellOf(A, F.x, F.z); if (gi < 0 || si < 0) return null;
  const D = flow(W, gi); if (D[si] === Infinity) return null;
  const { w } = A.grid, sx = si % w, sz = Math.floor(si / w);
  let best = -1, bd = D[si];
  for (const [dx, dz] of NB) { const j = (sz + dz) * w + (sx + dx); if (sx + dx < 0 || sz + dz < 0 || sx + dx >= w || j >= D.length) continue; if (D[j] < bd) { bd = D[j]; best = j; } }
  if (best < 0) return null;
  const tx = A.origin[0] + ((best % w) + 0.5) * A.cell, tz = A.origin[1] + (Math.floor(best / w) + 0.5) * A.cell, d = dhypot(tx - F.x, tz - F.z) || 1;
  return { mx: (tx - F.x) / d, mz: (tz - F.z) / d };
}

export function go(W, F, x, z, s = 1) {
  const d = dhypot(x - F.x, z - F.z) || 1, f = W.field;
  // straight only when a body's width fits: the line and its two edges 0.2 m either side are clear
  const px = (-(z - F.z) / d) * PATHS.wide, pz = ((x - F.x) / d) * PATHS.wide, wide = () => f.lineClear(F.x + px, F.z + pz, x + px, z + pz) && f.lineClear(F.x - px, F.z - pz, x - px, z - pz);
  if (OFF.has("paths") || OFF.has(F.team === "lamb" ? "lambpaths" : "foepaths") || !f.arena.grid || (f.lineClear(F.x, F.z, x, z) && wide() && ledgeClear(f.arena, F.x, F.z, x, z))) return { mx: ((x - F.x) / d) * s, mz: ((z - F.z) / d) * s };
  const way = wayToward(W, F, x, z);
  return way ? { mx: way.mx * s, mz: way.mz * s } : { mx: ((x - F.x) / d) * s, mz: ((z - F.z) / d) * s };
}

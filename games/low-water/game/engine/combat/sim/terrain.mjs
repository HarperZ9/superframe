// Terrain read from a painted plate: slope, ledges and hazards, so the ground itself shapes a fight
// (design/COMBAT-WORLD.md). Derived from the plate's own cell heights; the place's optional
// "terrain" record (agreed with the systems engineer, 2026-10-17) adds what geometry cannot show:
//   "terrain": { "hazards": [{ id, kind: net|rope|slick|loose, at: [x, y, z], r } | { ..., rect: [x0, z0, x1, z1] }],
//                "ledges": [{ a: [x, z], b: [x, z], drop, into }], "noLedge": [[x0, z0, x1, z1]] }
// Absent means derived only. Row arenas (the placeholder test arenas) have no ledges: their heights
// are a sketch, not ground.
//
//   terrainAt(arena, x, z) -> { slope, ledge, drop, hazard, slow, slick, root }   pure; the shell's
//                             walking uses it too, so walking and fighting agree on the ground
//   stepDrop(arena, ax, az, bx, bz) -> metres the body drops going from a to b across a ledge
//                             (negative: a climb), 0 when no ledge lies between
import { WORLD, OFF } from "../data/world.mjs";

const cache = new WeakMap();

function grid(arena) {
  if (!arena || !arena.grid) return null;
  let T = cache.get(arena);
  if (T) return T;
  const { w, h, cells } = arena.grid, c = arena.cell, [ox, oz] = arena.origin, t = arena.terrain || {};
  const inRect = (x, z, r) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
  const centre = (i) => [ox + ((i % w) + 0.5) * c, oz + (Math.floor(i / w) + 0.5) * c];
  const noLedge = (i) => (t.noLedge || []).some((r) => inRect(...centre(i), r));
  const slope = new Float32Array(w * h), drop = new Float32Array(w * h);
  for (let r = 0; r < h; r++) for (let x = 0; x < w; x++) {
    const i = r * w + x, a = cells[i]; if (!a) continue;
    let s = 0, d = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Z = r + dz, b = X >= 0 && Z >= 0 && X < w && Z < h ? cells[Z * w + X] : null;
      if (!b) continue;
      const step = a.h - b.h;
      if (Math.abs(step) >= WORLD.ledge && !noLedge(i)) d = Math.max(d, step); else s = Math.max(s, Math.abs(step) / c);
    }
    slope[i] = s; drop[i] = d;
  }
  T = { slope, drop, hazards: t.hazards || [], noLedge };
  cache.set(arena, T);
  return T;
}

function cellIndex(arena, x, z) {
  const { w, h } = arena.grid, c = Math.floor((x - arena.origin[0]) / arena.cell), r = Math.floor((z - arena.origin[1]) / arena.cell);
  return c >= 0 && r >= 0 && c < w && r < h ? r * w + c : -1;
}

function hazardAt(T, x, z) {
  for (const hz of T.hazards) {
    if (hz.rect ? x >= hz.rect[0] && x <= hz.rect[2] && z >= hz.rect[1] && z <= hz.rect[3] : Math.hypot(x - hz.at[0], z - hz.at[2]) <= (hz.r || 1)) return hz;
  }
  return null;
}

const NONE = Object.freeze({ slope: 0, ledge: false, drop: 0, hazard: null, slow: 1, slick: 1, root: 1 });

export function terrainAt(arena, x, z) {
  const T = grid(arena); if (!T) return NONE;
  const i = cellIndex(arena, x, z); if (i < 0) return NONE;
  const hz = hazardAt(T, x, z), H = hz ? WORLD.hazards[hz.kind] || {} : {}, S = WORLD.slope;
  const grade = T.slope[i], slopeSlow = grade > S.from ? 1 / (1 + S.k * (grade - S.from)) : 1;
  return { slope: grade, ledge: T.drop[i] > 0, drop: T.drop[i], hazard: hz ? hz.kind : null, slow: slopeSlow * (H.speed || 1), slick: H.grip || 1, root: H.root || 1, noRun: grade > S.noRun };
}

// Height drop from a to b when they lie in different cells with a ledge between (a step of
// WORLD.ledge or more); authored ledges count wherever their segment crosses the move.
export function stepDrop(arena, ax, az, bx, bz) {
  const T = OFF.has("ledges") ? null : grid(arena); if (!T) return 0;
  const i = cellIndex(arena, ax, az), j = cellIndex(arena, bx, bz);
  if (i < 0 || j < 0 || i === j) return authored(arena, ax, az, bx, bz);
  const A = arena.grid.cells[i], B = arena.grid.cells[j]; if (!A || !B) return 0;
  const step = A.h - B.h;
  if (Math.abs(step) < WORLD.ledge || T.noLedge(i) || T.noLedge(j)) return authored(arena, ax, az, bx, bz);
  return step;
}

function authored(arena, ax, az, bx, bz) {
  for (const L of (arena.terrain || {}).ledges || []) if (crosses(ax, az, bx, bz, L.a[0], L.a[1], L.b[0], L.b[1])) return L.drop || WORLD.ledge;
  return 0;
}

const side = (ax, az, bx, bz, px, pz) => Math.sign((bx - ax) * (pz - az) - (bz - az) * (px - ax));
const crosses = (ax, az, bx, bz, cx, cz, dx, dz) => side(ax, az, bx, bz, cx, cz) !== side(ax, az, bx, bz, dx, dz) && side(cx, cz, dx, dz, ax, az) !== side(cx, cz, dx, dz, bx, bz);

// A straight path from a to b with no ledge on it (sampled every half cell): what the brains use to
// tell a reachable Lamb from one up a wall or down on the floor.
export function ledgeClear(arena, ax, az, bx, bz) {
  if (OFF.has("ledges") || !grid(arena)) return true;
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / (arena.cell * 0.5)));
  let px = ax, pz = az;
  for (let k = 1; k <= n; k++) { const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n; if (stepDrop(arena, px, pz, x, z) !== 0) return false; px = x; pz = z; }
  return true;
}

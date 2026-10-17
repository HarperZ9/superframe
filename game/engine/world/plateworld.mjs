// Walking on a painted plate (author, 2026-10-17: one game, one look). The ground Lamb walks is the
// same ground a fight plays on: combat's plateArena() grid (combat/sim/plate.mjs), built from the
// plate's own geo buffers, in the plate's world coordinates. This module is pure: the grid, paths,
// heights, and the plate's depth and world point under a plate pixel (for hiding figures behind
// the painted room and for click-to-walk).
//   groundAt(arena, x, z)            the cell's height, or null where the ground is solid
//   walkable(arena, x, z, waterY)    open ground not under more than knee water (0.45 m)
//   findPath(arena, from, to, opts)  [[x, z] ...] from (x, z) to (x, z), or null; the goal snaps to
//                                    the nearest open cell within 2 m
//   camBasis(cam)                    { f, right, up, pos } of the plate's bake camera
//   geoAt(place, pos, px, py)        the world point painted at plate pixel (px, py), or null
//   depthAt(place, pos, px, py)      that point's distance along the camera's forward axis
//   depthOf(cam, p)                  a world point's distance along the same axis
//   fightFromScene(G, place, encId)  { fight marks laid where the scene stands, figure ids taken }
const KNEE = 0.45;

const cellIndex = (arena, x, z) => {
  const c = arena.cell, [ox, oz] = arena.origin, ci = Math.floor((x - ox) / c), ri = Math.floor((z - oz) / c);
  return ci >= 0 && ri >= 0 && ci < arena.grid.w && ri < arena.grid.h ? [ci, ri] : null;
};
const centre = (arena, ci, ri) => [arena.origin[0] + (ci + 0.5) * arena.cell, arena.origin[1] + (ri + 0.5) * arena.cell];

export function groundAt(arena, x, z) {
  const k = cellIndex(arena, x, z); if (!k) return null;
  const c = arena.grid.cells[k[1] * arena.grid.w + k[0]];
  return c ? c.h : null;
}

export function walkable(arena, x, z, waterY = -Infinity) {
  const h = groundAt(arena, x, z);
  return h != null && !(waterY - h > KNEE);
}

function open(arena, ci, ri, waterY) {
  if (ci < 0 || ri < 0 || ci >= arena.grid.w || ri >= arena.grid.h) return false;
  const c = arena.grid.cells[ri * arena.grid.w + ci];
  return !!c && !(waterY - c.h > KNEE);
}

// The nearest open cell to (x, z) within `reach` metres, or null.
export function nearestOpen(arena, x, z, waterY = -Infinity, reach = 2) {
  const k = cellIndex(arena, x, z) || [Math.floor((x - arena.origin[0]) / arena.cell), Math.floor((z - arena.origin[1]) / arena.cell)];
  const R = Math.ceil(reach / arena.cell);
  let best = null;
  for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) {
    const ci = k[0] + dc, ri = k[1] + dr; if (!open(arena, ci, ri, waterY)) continue;
    const d = dc * dc + dr * dr; if (d <= R * R && (!best || d < best.d)) best = { ci, ri, d };
  }
  return best && [best.ci, best.ri];
}

// A* over the grid, eight ways, no corner cutting; the result is cell centres with the straight
// runs dropped, ending on the goal point itself when its cell is open.
export function findPath(arena, from, to, { waterY = -Infinity, maxNodes = 60000 } = {}) {
  const s = nearestOpen(arena, from[0], from[1], waterY, 1.5), g = nearestOpen(arena, to[0], to[1], waterY, 2);
  if (!s || !g) return null;
  const W = arena.grid.w, key = (c, r) => r * W + c, goal = key(g[0], g[1]);
  const gScore = new Map([[key(s[0], s[1]), 0]]), came = new Map(), open_ = [[0, s[0], s[1]]], closed = new Set();
  const hdist = (c, r) => Math.hypot(c - g[0], r - g[1]);
  let n = 0;
  while (open_.length && n++ < maxNodes) {
    let bi = 0; for (let i = 1; i < open_.length; i++) if (open_[i][0] < open_[bi][0]) bi = i;
    const [, c, r] = open_.splice(bi, 1)[0], k = key(c, r);
    if (k === goal) break;
    if (closed.has(k)) continue; closed.add(k);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nc = c + dc, nr = r + dr; if (!open(arena, nc, nr, waterY)) continue;
      if (dr && dc && (!open(arena, c + dc, r, waterY) || !open(arena, c, r + dr, waterY))) continue;
      const nk = key(nc, nr), t = gScore.get(k) + (dr && dc ? Math.SQRT2 : 1);
      if (t < (gScore.get(nk) ?? Infinity)) { gScore.set(nk, t); came.set(nk, k); open_.push([t + hdist(nc, nr), nc, nr]); }
    }
  }
  if (!gScore.has(goal)) return null;
  const cells = []; for (let k = goal; k != null; k = came.get(k)) cells.push([k % W, Math.floor(k / W)]);
  cells.reverse();
  const pts = [];
  for (let i = 1; i < cells.length; i++) {
    const last = i === cells.length - 1, d0 = i > 0 ? [cells[i][0] - cells[i - 1][0], cells[i][1] - cells[i - 1][1]] : null, n1 = !last ? [cells[i + 1][0] - cells[i][0], cells[i + 1][1] - cells[i][1]] : null;
    if (last || d0[0] !== n1[0] || d0[1] !== n1[1]) pts.push(centre(arena, cells[i][0], cells[i][1]));
  }
  const gc = cellIndex(arena, to[0], to[1]);
  if (gc && gc[0] === g[0] && gc[1] === g[1]) { if (pts.length) pts[pts.length - 1] = [to[0], to[1]]; else pts.push([to[0], to[1]]); }
  return pts;
}

export function camBasis(cam) {
  const yaw = (cam.yawDeg * Math.PI) / 180, el = (cam.elevDeg * Math.PI) / 180, t = cam.target, dist = cam.dist;
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const f = norm([-Math.sin(yaw) * Math.cos(el), -Math.sin(el), -Math.cos(yaw) * Math.cos(el)]);
  const right = norm(cross(f, [0, 1, 0])), up = norm(cross(right, f));
  return { f, right, up, pos: [t[0] - f[0] * dist, t[1] - f[1] * dist, t[2] - f[2] * dist] };
}

export const depthOf = (cam, p, B = camBasis(cam)) => (p[0] - B.pos[0]) * B.f[0] + (p[1] - B.pos[1]) * B.f[1] + (p[2] - B.pos[2]) * B.f[2];

export function geoAt(place, pos, px, py) {
  const s = place.geoScale || 1, gw = Math.round(place.width * s), gh = Math.round(place.height * s);
  const gx = Math.floor(px * s), gy = Math.floor(py * s);
  if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return null;
  const k = (gy * gw + gx) * 3, x = pos[k], y = pos[k + 1], z = pos[k + 2];
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && !(x === 0 && y === 0 && z === 0) ? [x, y, z] : null;
}

export function depthAt(place, pos, px, py, B = camBasis(place.camera)) {
  const p = geoAt(place, pos, px, py);
  return p ? depthOf(place.camera, p, B) : Infinity;
}

// A fight on a painted plate (the play screen hands combat the plate's arena) takes the art lead's
// fight marks for the encounter's arena id laid where the scene stands, so a fight from a
// conversation starts where it was: Lamb on Lamb's own spot, each foe who is a figure in the scene on
// that figure's spot, the other foes on the marks moved by the same offset as Lamb's mark (props
// and anchors stay on their marks). Returns the figure ids the fight takes over.
const charOf = (rec) => { const x = rec && rec.kv && rec.kv.find((e) => e.key === "char"); return x ? x.value.trim() : null; };
export function fightFromScene(G, pj, id) {
  const C = G.ext.combat, enc = C && C.defs[id]; if (!enc) return null;
  const m = pj.marks || {}, mark = (m.fights || {})[enc.area] || m.fight || null, pos = G.state.pos;
  const figs = G.world.figures(), taken = [], foes = [], aliases = {};
  const off = mark && mark.lamb && pos ? [pos[0] - mark.lamb[0], pos[2] - mark.lamb[1]] : [0, 0];
  let k = 0;
  for (const f of enc.foes || []) for (let n = 0; n < (f.n || 1); n++) {
    const who = charOf(f.rec), fig = who && figs.find((x) => x.id === who && !taken.includes(x.id));
    if (fig) { const at = (G.figureAt && G.figureAt[fig.id]) || fig.at; taken.push(fig.id); aliases[`${f.id}#${n}`] = fig.id; foes.push([at[0], at[2]]); }
    else { const q = mark && mark.foes && mark.foes[k++ % mark.foes.length]; foes.push(q ? [q[0] + off[0], q[1] + off[1]] : [pos ? pos[0] + 2 + n : 2, pos ? pos[2] : 0]); }
  }
  return { fight: { ...(mark || {}), lamb: pos ? [pos[0], pos[2]] : mark && mark.lamb, foes }, taken, aliases }; // aliases: fighter id -> the figure it was
}

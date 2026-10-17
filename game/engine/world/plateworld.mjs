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
// The ground grid's cell for walking and fights on a plate (metres): fine enough for a body radius.
export const GROUND_CELL = 0.25;

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

function open(arena, ci, ri, waterY, soft = true) {
  if (ci < 0 || ri < 0 || ci >= arena.grid.w || ri >= arena.grid.h) return false;
  const c = arena.grid.cells[ri * arena.grid.w + ci];
  return !!c && !(waterY - c.h > KNEE) && (soft || !c.margin);
}

// The nearest open cell to (x, z) within `reach` metres, or null.
export function nearestOpen(arena, x, z, waterY = -Infinity, reach = 2) {
  const k = cellIndex(arena, x, z) || [Math.floor((x - arena.origin[0]) / arena.cell), Math.floor((z - arena.origin[1]) / arena.cell)];
  const R = Math.ceil(reach / arena.cell);
  let best = null;
  for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) {
    const ci = k[0] + dc, ri = k[1] + dr; if (!open(arena, ci, ri, waterY)) continue;
    const cc = arena.grid.cells[ri * arena.grid.w + ci], d = dc * dc + dr * dr + (inBig(arena, ri * arena.grid.w + ci) ? 0 : 1e6) + (cc && cc.margin ? 1e4 : 0); // clear floor anywhere in reach first, a margin only when nothing clear is near
    if (dc * dc + dr * dr <= R * R && (!best || d < best.d)) best = { ci, ri, d };
  }
  return best && [best.ci, best.ri];
}

// A* over the grid, eight ways, no corner cutting; the result is cell centres with the straight
// runs dropped, ending on the goal point itself when its cell is open.
export function findPath(arena, from, to, opts = {}) {
  // a body keeps its margin off props where it can (hardenGround soft margins), and squeezes when it must
  return pathOn(arena, from, to, { ...opts, soft: false }) || pathOn(arena, from, to, { ...opts, soft: true });
}
function pathOn(arena, from, to, { waterY = -Infinity, maxNodes = 60000, soft = true } = {}) {
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
      const nc = c + dc, nr = r + dr; if (!open(arena, nc, nr, waterY, soft) && !(nc === g[0] && nr === g[1])) continue;
      if (dr && dc && (!open(arena, c + dc, r, waterY, soft) || !open(arena, c, r + dr, waterY, soft))) continue;
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
  const gc = cellIndex(arena, to[0], to[1]), gcell = gc && arena.grid.cells[gc[1] * arena.grid.w + gc[0]];
  if (gc && gc[0] === g[0] && gc[1] === g[1] && !(gcell && gcell.margin)) { if (pts.length) pts[pts.length - 1] = [to[0], to[1]]; else pts.push([to[0], to[1]]); }
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

// ---- Collision (author, 2026-10-17: "Characters clipping through objects")
// A plate's ground grid (combat's plateArena) knows where walkable material is seen; it does not
// know that a bench top, a counter or a wall face stands over a cell. hardenGround() looks at
// every geo sample again and closes:
//   - a cell with anything standing in it: at least three samples of any material more than
//     `propStep` (0.4 m, over a stair riser) and less than `head` (2.0 m) above the cell's floor
//     (a bench, the bar, a wall face, a post);
//   - a cell more than `step` above the median of its open neighbours (a low prop read as floor);
// then keeps a body's radius (0.3 m) clear: an open cell whose centre is nearer than `radius` to a
// closed cell (or the grid's edge) closes too, so paths, walking and fights keep a body out of the
// props. The arena is changed in place; spawns are moved clear again. Returns
// { closed, props, steps, margin } counts.
//   blockedAt(arena, x, z)   true where the hardened grid has no ground
export function groundMask(arena, place, pos, ids, { step = 0.3, propStep = 0.4, head = 2.0, minProp = 3 } = {}) {
  const { w, h, cells } = arena.grid, c = arena.cell, [ox, oz] = arena.origin;
  const s = place.geoScale || 1, gw = Math.round(place.width * s), gh = Math.round(place.height * s), sx = place.width / gw;
  const tall = new Uint16Array(w * h), prop = new Uint8Array(w * h), seen = new Uint32Array(w * h), top = new Float32Array(w * h).fill(-Infinity);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const k = (gy * gw + gx) * 3, x = pos[k], y = pos[k + 1], z = pos[k + 2];
    if (!Number.isFinite(x)) continue;
    const ci = Math.floor((x - ox) / c), ri = Math.floor((z - oz) / c);
    if (ci < 0 || ri < 0 || ci >= w || ri >= h) continue;
    seen[ri * w + ci]++; if (y > top[ri * w + ci]) top[ri * w + ci] = y;
    const cell = cells[ri * w + ci]; if (!cell) continue;
    const up = y - cell.h; if (up > propStep && up < head) tall[ri * w + ci]++;
    void ids; void sx;
  }
  // a stray sample is noise; a prop shows as several (minProp, default 3)
  for (let i = 0; i < w * h; i++) if (tall[i] >= minProp) prop[i] = 1;
  const raised = new Uint8Array(w * h);
  for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) {
    const cell = cells[r * w + q]; if (!cell || prop[r * w + q]) continue;
    const nb = []; for (let dr = -1; dr <= 1; dr++) for (let dq = -1; dq <= 1; dq++) { if (!dr && !dq) continue; const n = (q + dq >= 0 && r + dr >= 0 && q + dq < w && r + dr < h) ? cells[(r + dr) * w + q + dq] : null; if (n && !prop[(r + dr) * w + q + dq]) nb.push(n.h); }
    if (nb.length >= 3) { nb.sort((a, b) => a - b); if (cell.h - nb[nb.length >> 1] > step) raised[r * w + q] = 1; }
  }
  return { prop, raised, seen, top };
}

export function hardenGround(arena, place, pos, ids, { step = 0.3, head = 2.0, radius = 0.3, marginFrom = "props", margin = "soft" } = {}) {
  const { w, h, cells } = arena.grid, c = arena.cell;
  const n = { filled: 0, closed: 0, props: 0, steps: 0, margin: 0 };
  // floor the camera cannot see well (behind a barrel or a table leg) is not a wall: fillHidden first
  { const m0 = groundMask(arena, place, pos, ids, { step, head }); fillHidden(arena, m0.top, step, n); }
  const { prop, raised } = groundMask(arena, place, pos, ids, { step, head });
  const shut = new Uint8Array(w * h);
  const wall = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { if (!cells[i]) shut[i] = 1; else if (prop[i]) { shut[i] = wall[i] = 1; n.props++; } else if (raised[i]) { shut[i] = wall[i] = 1; n.steps++; } }
  n.tops = closeTops(arena, shut, wall, step); // a counter or bench top read as floor
  const R = Math.ceil(radius / c) + 1, near = [];
  for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) {
    if (shut[r * w + q]) continue;
    let dist = Infinity;
    for (let dr = -R; dr <= R && dist >= radius; dr++) for (let dq = -R; dq <= R; dq++) {
      const qq = q + dq, rr = r + dr, out = qq < 0 || rr < 0 || qq >= w || rr >= h;
      if (!out && !shut[rr * w + qq]) continue;
      if (marginFrom === "props" && (out || !wall[rr * w + qq])) continue;
      const ex = Math.max(0, Math.abs(dq) - 0.5) * c, ez = Math.max(0, Math.abs(dr) - 0.5) * c, d = Math.hypot(ex, ez);
      if (d < dist) dist = d;
    }
    if (dist < radius) near.push(r * w + q);
  }
  // why each cell has no ground now: 0 never seen as ground (a void: behind a counter, off the plate),
  // 1 a prop, 2 a raised cell or a top (used by spotKind)
  const why = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (cells[i] && shut[i]) why[i] = prop[i] ? 1 : 2;
  arena.closedWhy = why;
  for (let i = 0; i < w * h; i++) if (shut[i] && cells[i]) { cells[i] = null; n.closed++; }
  // the body's margin: "hard" closes it (fights), "soft" marks it (walking: kept out of when there
  // is another way, used to squeeze past a bollard when there is not)
  for (const i of near) { if (!cells[i]) continue; n.margin++; if (margin === "hard") { cells[i] = null; n.closed++; } else cells[i] = { ...cells[i], margin: true }; }
  arena.hardened = { step, head, radius };
  labelRegions(arena);
  return n;
}

// A cell with no ground seen, open floor at one height around it, and nothing in it taller than a
// stair riser (only floor-level samples, or none: floor hidden behind a barrel or a table leg) is filled
// as floor. A cell with something tall in it stays shut.
function fillHidden(arena, top, step, n) {
  const { w, h, cells } = arena.grid;
  for (let pass = 0; pass < 3; pass++) {
    const add = [];
    for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) {
      const i = r * w + q; if (cells[i]) continue;
      const nb = []; for (let dr = -1; dr <= 1; dr++) for (let dq = -1; dq <= 1; dq++) { if (!dr && !dq) continue; const qq = q + dq, rr = r + dr; const x = qq >= 0 && rr >= 0 && qq < w && rr < h ? cells[rr * w + qq] : null; if (x) nb.push(x); }
      if (nb.length < 4) continue;
      const hs = nb.map((x) => x.h).sort((a, b) => a - b); if (hs[hs.length - 1] - hs[0] > step) continue;
      const est = hs[hs.length >> 1]; if (top[i] > est + 0.4) continue;
      add.push([i, { h: est, surface: nb[0].surface, hidden: true }]);
    }
    for (const [i, cell] of add) { cells[i] = cell; n.filled++; }
    if (!add.length) break;
  }
}

// For a body at (x, z): the grid says yes, and a step from outside a margin does not go into one.
export function bodyCan(arena, from, x, z, waterY = -Infinity) {
  if (!walkable(arena, x, z, waterY)) return false;
  const k = cellIndex(arena, x, z), c = arena.grid.cells[k[1] * arena.grid.w + k[0]];
  if (!c.margin) return true;
  const f = cellIndex(arena, from[0], from[1]), fc = f && arena.grid.cells[f[1] * arena.grid.w + f[0]];
  return !fc || !!fc.margin;
}
// The nearest spot for a figure to stand: its own when clear, else the nearest cell with no prop and
// no margin within reach (2 m), else the nearest open cell.
export function clearSpot(arena, at, reach = 2, { strict = false } = {}) {
  const k = cellIndex(arena, at[0], at[2]), c0 = k && arena.grid.cells[k[1] * arena.grid.w + k[0]];
  if (c0 && !c0.margin && inBig(arena, k[1] * arena.grid.w + k[0])) return at;
  const { w, h, cells } = arena.grid, R = Math.ceil(reach / arena.cell), b = k || [Math.floor((at[0] - arena.origin[0]) / arena.cell), Math.floor((at[2] - arena.origin[1]) / arena.cell)];
  let best = null;
  for (let dr = -R; dr <= R; dr++) for (let dq = -R; dq <= R; dq++) {
    const q = b[0] + dq, r = b[1] + dr; if (q < 0 || r < 0 || q >= w || r >= h) continue;
    const c = cells[r * w + q]; if (!c) continue;
    const d = Math.hypot(dq, dr) + (c.margin ? 100 : 0) + (inBig(arena, r * w + q) ? 0 : 1000);
    if (!best || d < best.d) best = { d, q, r, c };
  }
  if (!best || (strict && best.d >= 100)) return strict ? null : at; // strict: only clear floor will do
  const [x, z] = centre(arena, best.q, best.r);
  return [x, best.c.h, z];
}

// Tops: ground reached from its surroundings only by a climb (no step of `step` or less leads up to
// it) and small (under TOP_MAX cells, about 12 square metres): a bar counter, a bench seat, a table.
// The quay itself stands over the floor too, but it is large and its stairs come up to it.
export const TOP_MAX = 200;
function closeTops(arena, shut, wall, step) {
  const { w, h, cells } = arena.grid, lab = new Int32Array(w * h).fill(-1), reg = [];
  for (let i = 0; i < w * h; i++) {
    if (shut[i] || lab[i] >= 0) continue;
    const id = reg.length, st = [i], R = { cells: [], up: 0, down: 0 }; lab[i] = id;
    while (st.length) {
      const j = st.pop(); R.cells.push(j); const q = j % w, r = (j / w) | 0, hj = cells[j].h;
      for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const qq = q + dq, rr = r + dr; if (qq < 0 || rr < 0 || qq >= w || rr >= h) continue;
        const k = rr * w + qq; if (shut[k] && !wall[k]) continue; // past the grid's ground: nothing to compare
        const hk = wall[k] ? null : cells[k].h;
        if (hk != null && Math.abs(hk - hj) <= step) { if (lab[k] < 0) { lab[k] = id; st.push(k); } }
        else if (hk != null) { if (hk < hj) R.down++; else R.up++; }
      }
    }
    reg.push(R);
  }
  let n = 0;
  for (const R of reg) if (R.cells.length < TOP_MAX && R.down > 0 && R.up === 0) for (const j of R.cells) { shut[j] = wall[j] = 1; n++; }
  return n;
}

// Connected regions of open ground (four-way). A pocket left between props (a cell or two behind a
// bollard) is no place to start or end a walk: nearestOpen and clearSpot prefer cells in a region
// of at least BIG cells (about 2.5 square metres at quarter-metre cells).
export const BIG = 40;
export function labelRegions(arena) {
  const { w, h, cells } = arena.grid, lab = new Int32Array(w * h).fill(-1), size = [];
  for (let i = 0; i < w * h; i++) {
    if (!cells[i] || lab[i] >= 0) continue;
    const id = size.length, st = [i]; lab[i] = id; let n = 0;
    while (st.length) { const j = st.pop(); n++; const q = j % w, r = (j / w) | 0; for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const qq = q + dq, rr = r + dr; if (qq < 0 || rr < 0 || qq >= w || rr >= h) continue; const k = rr * w + qq; if (cells[k] && lab[k] < 0) { lab[k] = id; st.push(k); } } }
    size.push(n);
  }
  arena.regions = { lab, size };
}
const inBig = (arena, i) => !arena.regions || arena.regions.size[arena.regions.lab[i]] >= BIG;

// Where an authored figure spot stands: "clear" floor, "margin" (beside a prop), "prop" or "top" (in
// or on one: move it), or "void" (no ground seen there, such as behind the bar counter: a figure
// may stand there out of reach, and the drawer hides what the painting stands in front of).
export function spotKind(arena, at) {
  const k = cellIndex(arena, at[0], at[2]); if (!k) return "void";
  const i = k[1] * arena.grid.w + k[0], c = arena.grid.cells[i];
  if (c) return c.margin ? "margin" : "clear";
  const why = arena.closedWhy ? arena.closedWhy[i] : 0;
  return why === 1 ? "prop" : why === 2 ? "top" : "void";
}

// How far a held tool can reach ahead before a prop, a wall or unknown ground (metres, up to max),
// from a figure at `at` facing `face` (radians, atan2 of z and x): the drawer clamps a staff or a
// pole to it, or angles it up, so a tool does not pass through the bar counter.
export function clearAhead(arena, at, face, max = 2.2) {
  const dx = Math.cos(face), dz = Math.sin(face);
  for (let d = 0.2; d <= max; d += 0.05) if (groundAt(arena, at[0] + dx * d, at[2] + dz * d) == null) return +(d - 0.05).toFixed(2);
  return max;
}

// A chair or bench near a seated figure's mark, read from the plate. The back is the samples 0.6 to
// 1.3 m over the floor within 0.7 m of the mark; the seat is the samples 0.3 to 0.6 m up within 0.7 m
// that do not stand under the back (5 cm columns), taken as the middle of their extent (from a high
// camera a chair's back hides part of its seat, so an average leans toward the back). Returns
// { at: the seat's middle on the floor, face: from the back toward the seat (radians) or null, back }
// or null when nothing like a seat is there.
export function seatOf(place, pos, mark, floorY = mark[1]) {
  const R2 = 0.49, seat = [], backCols = new Set(); let bx = 0, bz = 0, nb = 0;
  const col = (x, z) => `${Math.round(x / 0.05)},${Math.round(z / 0.05)}`;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1] - floorY, z = pos[i + 2]; if ((x - mark[0]) ** 2 + (z - mark[2]) ** 2 > R2) continue;
    if (y > 0.6 && y < 1.3) { backCols.add(col(x, z)); bx += x; bz += z; nb++; } else if (y > 0.3 && y < 0.6) seat.push(x, z);
  }
  const flat = []; for (let k = 0; k < seat.length; k += 2) if (!backCols.has(col(seat[k], seat[k + 1]))) flat.push(seat[k], seat[k + 1]);
  const L = flat.length >= 100 ? flat : seat; if (L.length < 100) return null;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let k = 0; k < L.length; k += 2) { x0 = Math.min(x0, L[k]); x1 = Math.max(x1, L[k]); z0 = Math.min(z0, L[k + 1]); z1 = Math.max(z1, L[k + 1]); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, back = nb >= 50;
  return { at: [cx, floorY, cz], face: back ? Math.atan2(cz - bz / nb, cx - bx / nb) : null, back };
}

export const blockedAt = (arena, x, z) => groundAt(arena, x, z) == null;

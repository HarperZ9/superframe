// Fights in the world (author, 2026-10-17): an arena built from a painted plate's own geometry, so a
// fight runs on the plate's walkable ground in the plate's world coordinates, under the game
// camera, with the plate's lamps, exits and marks.
//
//   plateArena(place, pos, ids, { cell, datum, fight })
//     place  the plate's place.json (walk ids, footing per id, marks, camera)
//     pos    geo-pos.f32 as a Float32Array (x, y, z per sample at geoScale of the plate size)
//     ids    geo-id.u8 as a Uint8Array (a material id per plate pixel, full size)
//     datum  { a, b }: plate water height = a + b * tide (metres in the plate's world). The plates
//            are built with heights scaled by b; depths are turned back into real metres by
//            dividing by b, so knee and waist mean what they say. Default: the prototype's
//            mapping (game/night.mjs waterY), which the quay and floor plates share. Rooms and
//            hill plates have no tide (datum null).
//     fight  optional { lamb: [x, z], foes: [[x, z] ...], anchors } from the art lead's marks
//            (place.marks.fight), else chosen from the plate (below)
// Cells are `cell` metres square on the ground plane (x east, z toward the camera); a cell is
// walkable when most of its samples carry a walk id; its surface is the commonest footing among
// them and its height their mean. Other cells are solid: walls, furniture, the sea's edge.
import { terrainAt } from "./terrain.mjs";
import { dcos, dhypot, dsin } from "./math.mjs";

export const PLATE_DATUM = { a: -3.37 + 0.55 * 0.62, b: 0.62 };

// Doors a fight can be left by that the plate's marks do not list as the area's exits (2026-10-21:
// Shadow's way through a forced fight is out of it, and the quay's only exit mark was 37 m from the
// fight; the weigh-house's was behind the fighters). Each is a real door in the script: the quay
// steps, the Brine's door and the weigh-house's door on the quay; the tube room and the store
// inside the weigh-house, and its trestle's shadow, behind Lamb when the fighters hold the doors. Spots from each plate's own marks.
export const FIGHT_DOORS = {
  quay: [[-1.6, 0, -0.45], [-6.6, 0, -1.8]], // not the weigh-house door: fights on the quay start there
  floor: [[-2.45, -3.21, 6.13]],                       // the foot of the quay steps, back up to the quay
  spit: [[14, -0.5, 10.2], [19.8, -0.5, 5.5]],          // under the tarpaulin, in the Ann Tull's lee (the hide marks): back into hiding
  weigh: [[-4.9, 0, -3.4], [-3.6, 0, -4.1], [-3.2, 0, 2.2]], // and the dark under the trestle (the hide mark): the room's fights are after dark or in the switch room's dark
};

export function plateArena(place, pos, ids, { cell = 0.5, datum = PLATE_DATUM, fight = null } = {}) {
  const walk = new Set(place.walk || []), gw = Math.round(place.width * place.geoScale), gh = Math.round(place.height * place.geoScale);
  const reach = within(place);
  const sx = place.width / gw, samples = [];
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const id = ids[Math.floor(gy * sx) * place.width + Math.floor(gx * sx)];
    if (!walk.has(id)) continue;
    const k = (gy * gw + gx) * 3, x = pos[k], y = pos[k + 1], z = pos[k + 2];
    if (!isFinite(x) || !isFinite(y) || !isFinite(z) || !reach(x, z)) continue;
    samples.push(x, y, z, id);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  if (!samples.length) throw new Error(`plateArena ${place.place}: no walkable samples`);
  const W = Math.ceil((x1 - x0) / cell) + 1, H = Math.ceil((z1 - z0) / cell) + 1, acc = new Map();
  for (let i = 0; i < samples.length; i += 4) {
    const c = Math.floor((samples[i] - x0) / cell), r = Math.floor((samples[i + 2] - z0) / cell), key = r * W + c;
    const a = acc.get(key) || { n: 0, y: 0, kinds: {} };
    a.n++; a.y += samples[i + 1];
    const kind = surfaceOf((place.footing || {})[samples[i + 3]]); a.kinds[kind] = (a.kinds[kind] || 0) + 1;
    acc.set(key, a);
  }
  const cells = new Array(W * H).fill(null);
  for (const [key, a] of acc) if (a.n >= 2) cells[key] = { surface: Object.entries(a.kinds).sort((p, q) => q[1] - p[1])[0][0], h: a.y / a.n };
  // how tall the solid stuff in each solid cell stands (the highest painted surface over it): sight passes
  // over a bench or a crate, not over a wall (sim/field.mjs sightClear)
  const tops = new Float32Array(W * H).fill(NaN);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const k = (gy * gw + gx) * 3, x = pos[k], y = pos[k + 1], z = pos[k + 2];
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
    const c = Math.floor((x - x0) / cell), r = Math.floor((z - z0) / cell);
    if (c < 0 || r < 0 || c >= W || r >= H || cells[r * W + c]) continue;
    const key = r * W + c; if (!(tops[key] >= y)) tops[key] = y;
  }
  const marks = place.marks || {};
  const arena = {
    name: place.place, place: place.place, cell, origin: [x0, z0], grid: { w: W, h: H, cells, tops }, plate: place.place, camera: place.camera,
    water: datum ? { a: datum.a, b: datum.b, vscale: datum.b } : null, tideEnds: !!datum,
    // the lighthouse beam sweeps (sim/field.mjs) and lights only while Mother burns
    beams: (marks.lamps || []).filter((l) => Array.isArray(l.at) && l.kind === "beam").map((l) => ({ x: l.at[0], z: l.at[2], r: 40, k: 0.75, spread: 0.12 })),
    lights: (marks.lamps || []).filter((l) => Array.isArray(l.at) && l.kind !== "landmark" && l.kind !== "beam").map((l) => ({ x: l.at[0], z: l.at[2], r: l.r || (l.kind === "sodium" ? 8 : 5), k: l.k || (l.kind === "sodium" ? 0.55 : 0.45), sodium: l.kind === "sodium" })),
    exits: [...(marks.exits || []).map((e) => e.at), ...(FIGHT_DOORS[place.place] || [])].map((at) => [at[0] - 1, at[2] - 1, at[0] + 1, at[2] + 1]),
    // the place's terrain record (sim/terrain.mjs): hazards, authored ledges, stairs that are not ledges
    terrain: place.terrain || null,
  };
  arena.anchors = anchorsFrom(marks, arena);
  // the art lead's marks are placed on the painted room; a mark that lands on a cell this grid
  // leaves solid (a wall edge, a sample gap) moves to the nearest clear cell within 2 m
  arena.spawns = (fight && fight.lamb) ? { lamb: snapClear(arena, fight.lamb), foes: (fight.foes || []).map((f) => snapClear(arena, f)) } : chooseSpawns(arena, marks, place);
  return exitsOnGround(spawnsReachable(arena));
}

// The painted part of a plate: plates carry geometry past their cutaway (a room's floor goes on
// under the dark vignette), so fight ground is kept within a radius of the camera target that
// covers every marked spot, exit and hiding place, plus 1.5 m. A fight mark (marks.fight.r) can set
// it exactly.
function within(place) {
  const t = place.camera.target, m = place.marks || {}, pts = [...(m.spots || []), ...(m.exits || []), ...(m.hides || [])].map((s) => s.at);
  const r = (m.fight && m.fight.r) || Math.max(4, ...pts.map((p) => dhypot(p[0] - t[0], p[2] - t[2]))) + 1.5;
  return (x, z) => dhypot(x - t[0], z - t[2]) <= r;
}

// Footing kinds onto the surfaces combat knows (the hub's kinds pass straight through).
const surfaceOf = (k) => (k === "water" ? "mud" : k || "stone");

// Anchors from marks: lamps for lamp and cut props, spots by verb for snares and levers.
function anchorsFrom(marks, arena) {
  const spots = marks.spots || [], at = (s) => [s.at[0], s.at[2]];
  const lamps = arena.lights.map((l) => [l.x, l.z]);
  return {
    lamp: lamps.slice(0, 1), cut: lamps,
    snare: spots.filter((s) => /rig|rope|snare|trip/.test(s.verb)).map(at),
    sluice: spots.filter((s) => /sluice|lever|valve/.test(s.verb)).map(at),
  };
}

// The centre of the nearest cell whose 3 by 3 patch is walkable (else the nearest walkable cell),
// within 2 m of p; p itself when its cell is already walkable, or nothing clear is near. A cell on
// the lip of a ledge (sim/terrain.mjs) does not count as walkable here: nobody starts a fight with
// their heels over the quay edge (systems engineer, 2026-10-17).
export function snapClear(arena, p) {
  const { w, h, cells } = arena.grid, c = arena.cell, [ox, oz] = arena.origin;
  const lip = (x, z) => terrainAt(arena, ox + (x + 0.5) * c, oz + (z + 0.5) * c).ledge;
  const at = (x, z) => x >= 0 && z >= 0 && x < w && z < h && cells[z * w + x] && !lip(x, z);
  const ci = Math.floor((p[0] - ox) / c), ri = Math.floor((p[1] - oz) / c);
  if (at(ci, ri)) return p;
  const clear = (x, z) => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!at(x + dx, z + dz)) return false; return true; };
  const reach = Math.ceil(2 / c);
  for (const test of [clear, at]) {
    let best = null, bd = Infinity;
    for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) {
      const d = dhypot(dx, dz);
      if (d < bd && test(ci + dx, ri + dz)) { bd = d; best = [ox + (ci + dx + 0.5) * c, oz + (ri + dz + 0.5) * c]; }
    }
    if (best) return best;
  }
  return p;
}

// Every opponent on ground Lamb can be reached from (2026-10-21: in the Gut a gutter's mark snapped to a cell
// behind the stalls, and it stood out the whole fight while the bench and the game disagreed on where).
// A flood from Lamb's cell over open cells, stepping no more than `step` metres; an opponent outside it
// moves to the nearest reached cell within `reach` metres (else stays). Returns the arena.
export function spawnsReachable(arena, { step = 0.4, reach = 4 } = {}) {
  const S = arena.spawns; if (!S || !S.lamb || !arena.grid) return arena;
  const { w, h, cells } = arena.grid, c = arena.cell, [ox, oz] = arena.origin;
  const idx = (p) => [Math.floor((p[0] - ox) / c), Math.floor((p[1] - oz) / c)];
  const hOf = (cell) => (cell && typeof cell === "object" ? cell.h ?? 0 : 0);
  const [lc, lr] = idx(S.lamb); if (lc < 0 || lr < 0 || lc >= w || lr >= h || !cells[lr * w + lc]) return arena;
  const seen = new Uint8Array(w * h), q = [lr * w + lc]; seen[q[0]] = 1;
  while (q.length) {
    const k = q.pop(), x = k % w, z = (k - x) / w, hk = hOf(cells[k]);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const n = nz * w + nx; if (seen[n] || !cells[n] || Math.abs(hOf(cells[n]) - hk) > step) continue;
      seen[n] = 1; q.push(n);
    }
  }
  const R = Math.ceil(reach / c);
  S.foes = S.foes.map((f) => {
    const [fc, fr] = idx(f); if (fc >= 0 && fr >= 0 && fc < w && fr < h && seen[fr * w + fc]) return f;
    let best = null, bd = Infinity;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const x = fc + dx, z = fr + dz; if (x < 0 || z < 0 || x >= w || z >= h || !seen[z * w + x]) continue;
      const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [ox + (x + 0.5) * c, oz + (z + 0.5) * c]; }
    }
    return best ? snapClear(arena, best) : f;
  });
  return arena;
}

// Every way out on the fight's ground (2026-10-21: the Gut's quay mouth and culvert stand past the painted
// part, so their boxes had no ground and the game chalked two ways out nobody could reach). An exit whose
// box holds no open cell moves in along the line to the camera target to the first open cell, the edge
// where the lane runs out of the picture; one with no ground on that line within 8 m is dropped.
export function exitsOnGround(arena) {
  if (!arena.grid || !arena.exits) return arena;
  const { w, h, cells } = arena.grid, c = arena.cell, [ox, oz] = arena.origin, t = arena.camera && arena.camera.target ? [arena.camera.target[0], arena.camera.target[2]] : null;
  const open = (x, z) => { const ci = Math.floor((x - ox) / c), ri = Math.floor((z - oz) / c); return ci >= 0 && ri >= 0 && ci < w && ri < h && !!cells[ri * w + ci]; };
  const holds = ([x0, z0, x1, z1]) => { for (let z = z0 + c / 2; z < z1; z += c) for (let x = x0 + c / 2; x < x1; x += c) if (open(x, z)) return true; return false; };
  arena.exits = arena.exits.map((b) => {
    if (holds(b) || !t) return b;
    const cx = (b[0] + b[2]) / 2, cz = (b[1] + b[3]) / 2, d = dhypot(t[0] - cx, t[1] - cz) || 1, ux = (t[0] - cx) / d, uz = (t[1] - cz) / d;
    for (let s = c; s <= Math.min(8, d); s += c) { const x = cx + ux * s, z = cz + uz * s; if (open(x, z)) { const m = s + 0.75; return [b[0] + ux * m, b[1] + uz * m, b[2] + ux * m, b[3] + uz * m]; } }
    return null;
  }).filter(Boolean);
  return arena;
}

// Without fight marks: Lamb at the first exit (or the middle), opponents at walkable cells 5 to 9 m
// away, spread round Lamb.
// A spawn needs a fully walkable 3 by 3 patch (a body's width clear of walls) and must sit within
// 85% of the painted radius, away from the cutaway's edge.
function chooseSpawns(arena, marks, place) {
  const { w, h, cells } = arena.grid, c = arena.cell, ox = arena.origin[0], oz = arena.origin[1];
  const centre = (i) => [ox + ((i % w) + 0.5) * c, oz + (Math.floor(i / w) + 0.5) * c];
  const t = place.camera.target, m = marks, pts = [...(m.spots || []), ...(m.exits || []), ...(m.hides || [])].map((p) => p.at);
  const R = 0.85 * ((m.fight && m.fight.r) || Math.max(4, ...pts.map((p) => dhypot(p[0] - t[0], p[2] - t[2]))) + 1.5);
  const clear = (i) => { const cx = i % w, cz = Math.floor(i / w); for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= w || z >= h || !cells[z * w + x]) return false; } const p = centre(i); return dhypot(p[0] - t[0], p[1] - t[2]) <= R; };
  let open = cells.map((v, i) => (v && clear(i) ? i : -1)).filter((i) => i >= 0);
  if (!open.length) open = cells.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const ex = (marks.exits || [])[0];
  let lamb = ex ? [ex.at[0], ex.at[2]] : centre(open[Math.floor(open.length / 2)]);
  lamb = centre(open.reduce((b, i) => { const p = centre(i), q = centre(b); return dhypot(p[0] - lamb[0], p[1] - lamb[1]) < dhypot(q[0] - lamb[0], q[1] - lamb[1]) ? i : b; }, open[0]));
  const foes = [];
  for (const ring of [7, 5, 9, 4, 11]) for (let k = 0; k < 8 && foes.length < 5; k++) {
    const a = (k / 8) * Math.PI * 2, want = [lamb[0] + dcos(a) * ring, lamb[1] + dsin(a) * ring];
    const ci = Math.floor((want[0] - ox) / c), ri = Math.floor((want[1] - oz) / c);
    if (ci >= 0 && ri >= 0 && ci < w && ri < h && open.includes(ri * w + ci) && !foes.some((f) => dhypot(f[0] - want[0], f[1] - want[1]) < 1.5)) foes.push(want);
  }
  return { lamb, foes: foes.length ? foes : [[lamb[0] + 3, lamb[1]]] };
}

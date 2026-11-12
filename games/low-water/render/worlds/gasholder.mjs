// The Gasholder: three rings of iron lattice on shingle, open to the stars; the Congregation of the
// Filament's church inside it. Laid out on the combat arena (arenas2.mjs GASHOLDER, 20 x 11): world
// x, z = arena x, z, the shingle at y = 0 (arena h 8), the raised dais x 7 to 13, z 4 to 7 (h 8.3)
// with the trestle altar and the Old Bulb hung on chains over it at (10, 5); candles in jam jars, four
// standing lights at (3, 2), (17, 2), (3, 8.5), (17, 8.5); straw for kneeling; the gate and its post at
// the west exit, the stopcock at the foot of the west leg with the old gate lamp's pipe climbing to a
// bracket an arm's length from the Bulb; the vestry (the old valve house) past the east exit.
// Original block-out (Low Water look work).
import { box, cyl, sph, ell, cap, vnoise, fbm } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

export const CX = 10, CZ = 5.5, RING = 11.5, BULB = [10, 3.1, 5];
export function gasholder() {
  const W = makeWorld({ cell: 2, margin: 0.5 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.map((v) => v.toFixed(2)).join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => {
    const q = Math.hypot(x - CX, z - CZ), n = vnoise(x * 3.1, z * 3.1);
    T(y + 0.03 * n, q < RING - 0.6 ? ID.shingle : ID.cobble);
    T(Math.max(Math.abs(q - RING) - 0.45, y - 0.55, -y - 1), ID.brick); // the old tank's brick lip
    T(Math.max(box(x, y, z, 10, 0.15, 5.5, 3.0, 0.15, 1.5)), ID.slab); // the dais (arena 'a', 0.3 m up)
    // the lattice: legs, three rings, cross-bracing on the far half
    const a = Math.atan2(z - CZ, x - CX), seg = Math.PI / 8, aa = ((a % seg) + seg) % seg - seg / 2, near = (z - CZ) > 2;
    T(Math.max(Math.abs(aa * q) - 0.13, Math.abs(q - RING) - 0.13, y - 11.2, -y), ID.iron);
    for (const ry of [3.6, 7.2, 10.8]) T(Math.hypot(q - RING, y - ry) - (near ? 0.07 : 0.11), ID.iron);
  });
  // the trestle altar, the gantry, the chains, the Old Bulb (violet glass, the size of a curled child), the Eye
  add(K.shape([7.5, 0.3, 4.2, 12.5, 6.2, 6.8], (x, y, z, T) => {
    T(box(x, y, z, 10, 1.05, 5.5, 1.6, 0.05, 0.6), ID.timber); for (const sx of [-1, 1]) for (const sz of [-1, 1]) T(cap(x, y, z, [10 + sx * 1.4, 0.3, 5.5 + sz * 0.4], [10 + sx * 1.2, 1.0, 5.5], 0.04), ID.timber);
    T(box(x, y, z, 10, 1.11, 5.5, 1.5, 0.01, 0.55), ID.bonecloth);
    for (const sx of [-1, 1]) T(cap(x, y, z, [10 + sx * 2.2, 0.3, 5.0], [10 + sx * 1.6, 5.6, 5.0], 0.07), ID.iron); T(cap(x, y, z, [8.3, 5.6, 5.0], [11.7, 5.6, 5.0], 0.07), ID.iron);
    for (const sx of [-0.4, 0.4]) T(cap(x, y, z, [10 + sx, 5.6, 5.0], [10 + sx * 0.3, 3.6, 5.0], 0.012), ID.iron);
    T(Math.max(ell(x, y, z, BULB[0], BULB[1], BULB[2], 0.55, 0.7, 0.55), -ell(x, y, z, BULB[0], BULB[1], BULB[2], 0.5, 0.65, 0.5)), ID.violet); T(cyl(x, y, z, BULB[0], BULB[1] + 0.78, BULB[2], 0.2, 0.12), ID.brass);
    T(cap(x, y, z, [BULB[0] - 0.08, BULB[1] - 0.2, BULB[2]], [BULB[0] + 0.05, BULB[1] + 0.3, BULB[2]], 0.012), ID.iron);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 9 + 3 * r; k++) { const a = (k / (9 + 3 * r)) * Math.PI * 2, rr = 0.35 + 0.18 * r; T(Math.max(Math.abs(x - BULB[0] - Math.cos(a) * rr) + Math.abs(z - BULB[2] - Math.sin(a) * rr) - 0.05, Math.abs(y - BULB[1] - 1.05 - 0.12 * r) - 0.08), k % 3 ? ID.prism : ID.bottle); }
  }));
  marks.lamps.push({ id: "old_bulb", kind: "bulb", at: BULB, arena: [10, 5] });
  spot("old_bulb", "light", [10, 0.3, 6.2], "the Old Bulb on its chains; light it with the gas bag (G:557)"); spot("the_eye", "carry", [10, 0.3, 6.2], "the Eye: a crown of prisms in three rings; wire 113 empty (G:140)");
  // straw for kneeling in rows facing the altar; candles in jam jars along the rows; empty bell jars
  for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) {
    const sx = 2.6 + r * 1.3, sz = 2.2 + k * 1.6 + 0.2 * rnd(r, k); if (sx > 6.5) continue;
    add(K.shape([sx - 0.5, -0.05, sz - 0.4, sx + 0.5, 0.2, sz + 0.4], (x, y, z, T) => T(ell(x, y, z, sx, 0.0, sz, 0.42, 0.08 + 0.03 * vnoise(x * 9, z * 9), 0.32), ID.straw)));
    if (rnd(r, k, 3) < 0.25) add(K.bellJar(sx + 0.3, 0.08, sz - 0.25));
  }
  for (const [px, pz] of [[3, 2], [17, 2], [3, 8.5], [17, 8.5]]) add(K.shape([px - 0.3, 0, pz - 0.3, px + 0.3, 1.4, pz + 0.3], (x, y, z, T) => { T(cyl(x, y, z, px, 0.6, pz, 0.04, 0.6), ID.iron); T(cyl(x, y, z, px, 1.22, pz, 0.12, 0.02), ID.iron); }));
  for (const [px, pz] of [[3, 2], [17, 2], [3, 8.5], [17, 8.5]]) { const c = K.candle(px, 1.24, pz, 0.28, true, 10); c.light.group = "standing"; add(c); }
  for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2, rr = RING - 1.2 - 0.3 * rnd(k, 1); add(K.candle(CX + Math.cos(a) * rr, 0, CZ + Math.sin(a) * rr, 0.16 + 0.08 * rnd(k), true, 3.2)); }
  for (let k = 0; k < 6; k++) add(K.candle(8.6 + k * 0.55, 1.1, 5.85, 0.18, true, 3.5));
  // the gate and post at the west exit; the stopcock and pipe at the west leg
  add(K.shape([-1.8, 0, 3.6, 0.4, 2.6, 7.4], (x, y, z, T) => { for (const gz of [3.9, 7.1]) T(box(x, y, z, -0.6, 1.2, gz, 0.15, 1.2, 0.15), ID.iron); T(Math.max(box(x, y, z, -1.0, 1.0, 4.6, 0.04, 0.8, 0.75), -box(x, y, z, -1.0, 1.0, 4.6, 0.1, 0.7, 0.65)), ID.iron); for (let k = 0; k < 6; k++) T(box(x, y, z, -1.0, 1.0, 4.0 + k * 0.24, 0.02, 0.75, 0.015), ID.iron); T(box(x, y, z, -0.42, 1.5, 7.1, 0.02, 0.2, 0.15), ID.paper); }));
  marks.exits.push({ id: "west_gate", at: [0, 0, 5.5], note: "the gate; when it creaks every jar turns (G:114)" }, { id: "east", at: [20, 0, 5.5], note: "to the vestry" });
  const lx = CX - RING, lz = CZ;
  add(K.shape([lx - 0.3, 0, lz - 0.6, lx + 1.2, 4.0, lz + 0.6], (x, y, z, T) => { T(box(x, y, z, lx + 0.5, 0.35, lz + 0.4, 0.14, 0.35, 0.14), ID.iron); T(Math.hypot(Math.hypot(x - lx - 0.5, z - lz - 0.4) - 0.16, y - 0.75) - 0.025, ID.red); T(cap(x, y, z, [lx + 0.5, 0.7, lz + 0.4], [lx + 0.25, 3.9, lz + 0.2], 0.03), ID.iron); }));
  add(K.shape([lx, 3.5, lz - 1, BULB[0] - 0.5, 4.2, lz + 1], (x, y, z, T) => T(cap(x, y, z, [lx + 0.25, 3.9, lz + 0.2], [BULB[0] - 0.9, 3.6, BULB[2]], 0.03), ID.iron)));
  spot("stopcock", "rig", [lx + 0.9, 0, lz + 0.6], "the stopcock, MUNICIPAL LIGHT AND COKE CO. HOLDER No 2 (G:554)"); spot("frame_climb", "climb", [CX, 0, CZ - RING + 0.6], "the frame is climbable; the top ring looks over the town (G:756)");
  // the vestry past the east exit: the old valve house, a lit window
  add(K.shape([21, 0, 3.4, 25.6, 4.2, 8.0], (x, y, z, T) => { T(box(x, y, z, 23.3, 1.4, 5.7, 2.1, 1.4, 2.1), ID.brickdark); T(box(x, y, z, 23.3, 2.9, 5.7, 2.3, 0.1, 2.3), ID.slab); T(box(x, y, z, 21.18, 1.0, 5.7, 0.05, 1.0, 0.45), ID.darkwood); T(box(x, y, z, 21.18, 1.6, 7.0, 0.04, 0.35, 0.3), ID.windowdim); }));
  L.push({ pos: [20.7, 1.6, 7.0], type: 1, I: 1.8, cone: [-1, 0, 0], mode: 2, reach: 5, group: "window", key: "vestry" });
  marks.hides.push({ id: "kneelers", at: [4.5, 0, 5.5], r: 2.0, note: "among the kneelers, under a borrowed jar (Q:761)" });
  return { world: W.build(), marks, lights: (V = {}) => {
    const o = []; for (const l of L) { const f = V.emit && l.group in V.emit ? V.emit[l.group] : 1; if (f > 0) o.push({ ...l, I: l.I * f }); }
    if (V.bulb) o.push({ pos: BULB, type: 2, I: V.bulb, reach: 24, key: "bulb" });
    if (V.moon) o.push({ pos: V.moon.pos, type: 2, I: V.moon.I, reach: 400, key: "moon", soft: 30 });
    return o;
  } };
}

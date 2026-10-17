// The Spit at the second low water: shingle and weed out in the bay, two barges lying on their sides
// (the Patience and the Ann Tull, open coal hatches, a rudder stock, casks), the pool between them
// two feet deep, the gut of water the strippers' boat lies in, Lamb's boat at the left edge, and to
// the north the Old Light's base leaning out of the water, the hole toward the bay, nothing burning.
// Laid on the combat arena (arenas2.mjs SPIT, 22 x 12): world x, z = arena x, z and y = the arena's
// heights (weed -0.7, mud -0.5, the decks 0.2, the channel -1.1), the lantern at (18, 4), the painter
// line between the barges at (14.5, 4.5). Original block-out (Low Water look work).
import { box, cyl, ell, cap, vnoise, fbm, sat } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

// ground height by the arena's cells, smoothed
const cellH = (x, z) => {
  const dx = Math.min(Math.abs(x - 11), 12), dz = Math.min(Math.abs(z - 6), 7), edge = Math.hypot(dx / 11.5, dz / 6.5) * (0.92 + 0.16 * vnoise(x * 0.4, z * 0.4));
  if (x < 3.4 && z > 3.6 && z < 9.2) return -1.1 + 0.15 * vnoise(x, z); // the channel the tide fills first
  return edge > 0.92 ? -0.7 - 0.6 * sat((edge - 0.92) * 3) : -0.5 + 0.08 * (fbm(x * 0.4, z * 0.4) - 0.5);
};
export function spit() {
  const W = makeWorld({ cell: 2, margin: 0.5 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.map((v) => v.toFixed(2)).join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => {
    const h = cellH(x, z), dx = Math.min(Math.abs(x - 11), 12), dz = Math.min(Math.abs(z - 6), 7), edge = Math.hypot(dx / 11.5, dz / 6.5) * (0.92 + 0.16 * vnoise(x * 0.4, z * 0.4));
    T((y - h) * 0.8, edge > 0.92 ? ID.weed : x < 3.4 && z > 3.6 && z < 9.2 ? ID.mud : fbm(x * 0.7, z * 0.7) < 0.42 ? ID.shingle : ID.mud);
    T(y + 1.2, ID.pool); // the bay around the Spit (the game raises it with the tide)
    T(Math.max(y + 0.9, Math.hypot((x - 14.6) / 1.6, (z - 5.4) / 1.0) - 1), ID.pool); // the pool between the barges
  });
  // the Patience (top centre, along x) and the Ann Tull (right, along z), on their sides
  add(K.barge(10, -0.55, 3.0, 0, 7.4, 3.0, 1.8, 1.15, ID.boat)); add(K.barge(18, -0.55, 5.0, Math.PI / 2, 7.0, 2.8, 1.8, -1.1, ID.boatred));
  marks.spots.push({ id: "patience", verb: "climb", at: [10, 0.2, 3], note: "the Patience on her side: bilge about 40 degrees, frost on the deck (S:163)" }, { id: "ann_tull_hatch", verb: "salvage", at: [18, 0.2, 5], note: "the Ann Tull's open coal hatches, MUNICIPAL L. & C. CO. (S:421)" });
  // casks: some on the Ann Tull's high side, some down the slope, stencilled
  for (let k = 0; k < 7; k++) add(K.cask(15.8 + (k % 3) * 0.7, k < 4 ? 0.6 : -0.5, 3.0 + Math.floor(k / 3) * 0.8 + 0.3 * rnd(k), rnd(k, 1) * 3, k >= 4));
  spot("casks", "carry", [16.5, -0.5, 3.4], "casks stencilled S. BRINE, GULLET and W.G.G., blue chalk O.R. (S:420)");
  // the strippers' boat in the gut, bows to the Ann Tull, its painter to the rudder chains
  add(K.beachedBoat(13.8, -1.05, 8.6, -0.5, 2.6, 0.05, ID.boatred, false)); add(K.rope([15.2, -0.4, 8.0], [17.6, 0.3, 8.4], 0.35, 0.02));
  spot("strippers_painter", "rig", [14.5, -0.5, 4.5], "the painter line between the barges; cut it at the turn of the flood (S:345)");
  // Lamb's boat at the left edge, its painter to the Patience's rudder
  add(K.beachedBoat(0.9, -1.15, 6.0, 0.2, 2.2, 0.15, ID.boat, false)); add(K.rope([2.6, -0.8, 5.8], [6.1, -0.2, 3.2], 0.5, 0.02));
  spot("lambs_painter", "rig", [2.8, -0.8, 5.6], "make Lamb's boat fast to the Patience's rudder, or it floats off at 00:10 (S:74)");
  marks.exits.push({ id: "boat", at: [0.4, -1.1, 6.0], note: "Lamb's boat at the left edge (arena exit 0..0.8, 4..8)" });
  // the lantern on a pole on the Ann Tull (arena lamp at 18, 4), bars and boathooks, a tarpaulin
  add({ bb: [17.6, -0.6, 3.6, 18.4, 2.6, 4.4], light: { pos: [18, 2.0, 4], type: 1, I: 7, reach: 10, group: "lantern" }, f: (x, y, z, T) => { T(cap(x, y, z, [18.2, -0.5, 4.2], [18, 2.2, 4.0], 0.03), ID.timber); T(ell(x, y, z, 18, 1.95, 4, 0.09, 0.14, 0.09), ID.lantern); T(Math.max(box(x, y, z, 18, 1.95, 4, 0.13, 0.18, 0.13), -box(x, y, z, 18, 1.95, 4, 0.1, 0.15, 0.2), -box(x, y, z, 18, 1.95, 4, 0.2, 0.15, 0.1)), ID.iron); } });
  marks.lamps.push({ id: "pole_lantern", kind: "paraffin", at: [18, 1.95, 4], arena: [18, 4] });
  add(K.shape([12.5, -0.6, 9.6, 15.5, -0.1, 11], (x, y, z, T) => T(ell(x, y, z, 14, -0.45, 10.2, 1.2, 0.18, 0.6) + 0.03 * vnoise(x * 6, z * 6), ID.canvas)));
  for (let k = 0; k < 3; k++) add(K.shape([6 + k * 3, -0.6, 8.5, 7 + k * 3, -0.3, 10.5], ((kk) => (x, y, z, T) => T(cap(x, y, z, [6.1 + kk * 3, -0.48, 8.8], [6.9 + kk * 3, -0.46, 10.2], 0.03), kk === 1 ? ID.iron : ID.timber))(k)));
  marks.hides.push({ id: "ann_tull_lee", at: [19.8, -0.5, 5.5], r: 0.8, note: "the Ann Tull's lee, a sump, shin deep (S:276)" }, { id: "tarpaulin", at: [14, -0.5, 10.2], r: 0.6, note: "under the tarpaulin among the casks (S:498)" });
  // the Old Light to the north: leaning out of the water, the hole toward the bay, nothing burning
  add(K.shape([0, -2, -13, 12, 14, -3], (x, y, z, T) => {
    const ca = Math.cos(0.18), sa = Math.sin(0.18), lx = x - 5, ly = y + 1.2, rx = lx * ca - ly * sa, ry = lx * sa + ly * ca;
    const t = Math.max(Math.hypot(rx, z + 8) - (1.9 - 0.06 * ry), ry - 7.5 - vnoise(rx * 2, z * 2), -ry) * 0.85, hole = ell(rx, ry, z, 0, 4.6, -6.2, 0.7, 1.1, 1.0);
    T(Math.max(t, -hole), ID.wall); T(Math.max(Math.abs(Math.hypot(rx, z + 8) - 2.0) - 0.12, Math.abs(ry - 7.0) - 0.1), ID.iron);
  }));
  marks.lamps.push({ id: "old_light", kind: "landmark", at: [5, 6, -8] });
  return { world: W.build(), marks, lights: (V = {}) => {
    const o = []; for (const l of L) { const f = V.emit && l.group in V.emit ? V.emit[l.group] : 1; if (f > 0) o.push({ ...l, I: l.I * f }); }
    if (V.extra) for (const p of V.extra) o.push({ pos: p, type: 1, I: 4, reach: 9, key: `x${p.join(",")}` });
    if (V.moon) o.push({ pos: V.moon.pos, type: 2, I: V.moon.I, reach: 400, key: "moon", soft: 30 });
    return o;
  } };
}

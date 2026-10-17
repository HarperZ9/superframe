// Inside the weigh-house, the after-vote: a barn of a room older than the quay. The voting pans (two
// brass dishes on a beam), chalk tallies, trestles with tankards, benches at the walls, four lamps,
// the weighbridge and its book on a chain, the Board's padlocked store, the quay board (a slate face
// with a fuse), the tube terminus in the corner (a brass pipe down through the ceiling to a brass
// mouth, a wire basket, a stool, a lamp), the louvre, and the balance chains running up through the
// roof. The near walls are cut away. Same room coordinates as the Phase 3 plate (balance at 0, 0).
import { box, rbox, cyl, sph, ell, cap, fbm } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

export function weighRoom({ set = "night" } = {}) {
  const W = makeWorld({ cell: 1.5, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] }, day = set === "day";
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => {
    T(Math.max(y, box(x, y, z, 0, -0.5, 0, 6.3, 0.6, 5.6)), ID.boards);
    const back = box(x, y, z, 0, 2.7, -5.3, 6.6, 2.7, 0.3), side = box(x, y, z, -6.3, 2.7, 0, 0.3, 2.7, 5.6), lou = box(x, y, z, -6.3, 2.9, 0.6, 0.5, 0.9, 1.2), store = box(x, y, z, -3.6, 1.05, -5.0, 0.55, 1.05, 0.5), quay = box(x, y, z, 3.4, 1.15, -5.0, 0.65, 1.15, 0.5);
    T(Math.max(side, -lou), ID.brick); T(Math.max(back, -store, -quay), ID.brick);
    for (let k = 0; k < 5; k++) T(box(x, y, z, -6.3, 2.15 + 0.38 * k, 0.6, 0.06, 0.04, 1.2), ID.timber);
    for (let k = -2; k <= 2; k++) T(box(x, y, z, k * 2.6, 5.2, -3.4, 0.14, 0.14, 1.9), ID.timber); // tie beams, the back half only (the near half is cut away)
    T(box(x, y, z, 0, 5.45, -1.5, 6.6, 0.08, 0.08), ID.timber);
  });
  // the voting pans on their beam, and the balance chains up through the roof
  add(K.shape([-2.8, 0, -1.0, 2.8, 5.5, 1.0], (x, y, z, T) => {
    T(cyl(x, y, z, 0, 1.5, 0, 0.14, 1.5), ID.timber); T(cap(x, y, z, [-2.1, 3.1, 0.2], [2.1, 2.9, -0.2], 0.09), ID.timber); T(sph(x, y, z, 0, 3.0, 0, 0.16), ID.iron);
    for (const [px, py, pz] of [[-2.1, 1.55, 0.2], [2.1, 1.35, -0.2]]) { for (const s of [-1, 1]) T(cap(x, y, z, [px, py + 1.5, pz], [px + 0.5 * s, py + 0.08, pz], 0.015), ID.iron); T(Math.max(ell(x, y, z, px, py, pz, 0.7, 0.2, 0.7), y - py - 0.04), ID.brass); }
    for (const cx of [-0.6, 0.6]) T(cap(x, y, z, [cx, 3.2, -0.6], [cx, 5.5, -0.6], 0.03), ID.iron); // the chains to the roof balance
  }));
  spot("pans", "weigh", [0, 0, 1.2], "the voting pans; weigh the vote fish (W:612)");
  // chalk tallies on the back wall; trestles with tankards; benches round the walls
  add(K.shape([-2.8, 1.4, -5.1, 1.6, 3.6, -4.9], (x, y, z, T) => { T(box(x, y, z, -0.6, 2.5, -5.0, 2.1, 0.9, 0.03), ID.slate); for (let k = 0; k < 24; k++) T(box(x, y, z, -2.5 + (k % 12) * 0.32 + 0.04 * Math.floor(k / 6), 2.0 + 0.55 * Math.floor(k / 12) + 0.2, -4.96, 0.012, 0.16, 0.01), ID.chalk); for (let k = 0; k < 4; k++) T(cap(x, y, z, [-2.55 + k * 1.28, 2.05, -4.96], [-1.45 + k * 1.28, 2.38, -4.96], 0.012), ID.chalk); }));
  for (const [tx, tz, a] of [[-3.2, 2.2, 0.15], [2.8, 2.6, -0.2]]) { add(K.table(tx, 0, tz, 1.2, 0.4, 0.82, a)); if (!day) add(K.shape([tx - 1.2, 0.8, tz - 0.5, tx + 1.2, 1.1, tz + 0.5], (x, y, z, T) => { for (let k = 0; k < 4; k++) T(cyl(x, y, z, tx - 0.8 + k * 0.5, 0.92, tz + 0.12 * Math.sin(k * 3), 0.06, 0.1), ID.iron); })); }
  for (const [bx, bz, a] of [[-5.6, -1.0, Math.PI / 2], [-1.5, -4.6, 0], [4.8, -4.6, 0], [-5.6, 3.4, Math.PI / 2]]) add(K.table(bx, 0, bz, 1.3, 0.2, 0.45, a));
  // the weighbridge: an iron plate in the floor; its book on a chain on a lectern
  add(K.shape([1.6, -0.1, -3.4, 4.6, 1.4, -1.6], (x, y, z, T) => { T(box(x, y, z, 3.1, 0.0, -2.5, 1.2, 0.03, 0.8), ID.iron); T(box(x, y, z, 4.4, 0.55, -1.9, 0.08, 0.55, 0.08), ID.timber); T(box(x, y, z, 4.4, 1.12, -1.9, 0.28, 0.03, 0.22), ID.timber); T(box(x, y, z, 4.4, 1.17, -1.9, 0.22, 0.03, 0.17), ID.paper); T(cap(x, y, z, [4.6, 1.15, -1.8], [4.5, 0.6, -1.75], 0.012), ID.iron); }));
  spot("weighbridge_book", "read", [4.4, 0, -1.3], "the weighbridge book on its chain (W:613)");
  // the Board's store, padlocked; the quay board by the quay door
  add(K.shape([-4.3, 0, -5.1, -2.9, 2.2, -4.5], (x, y, z, T) => { T(box(x, y, z, -3.6, 1.05, -4.62, 0.52, 1.05, 0.04), ID.darkwood); T(box(x, y, z, -3.25, 1.05, -4.56, 0.05, 0.08, 0.03), ID.brass); }));
  spot("store", "pry", [-3.6, 0, -4.1], "the Board's store, padlocked: weights, chain, the hammer, a boathook (W:942)");
  add(K.shape([1.6, 1.0, -5.1, 2.5, 2.2, -4.8], (x, y, z, T) => { T(box(x, y, z, 2.05, 1.6, -4.95, 0.38, 0.5, 0.04), ID.slate); T(box(x, y, z, 2.05, 1.85, -4.89, 0.12, 0.06, 0.03), ID.brass); }));
  spot("quay_board", "cutpower", [2.05, 0, -4.4], "the quay board, a slate face with a fuse (W:2166)");
  add(K.shape([2.7, 0, -5.0, 4.1, 2.4, -4.5], (x, y, z, T) => T(box(x, y, z, 3.4, 1.15, -4.65, 0.62, 1.15, 0.04), ID.teal)));
  marks.exits.push({ id: "quay", at: [3.4, 0, -4.2], note: "the door to the quay" });
  // the tube terminus in the corner
  add(K.shape([-6.1, 0, -5.1, -4.4, 5.5, -3.4], (x, y, z, T) => { T(cyl(x, y, z, -5.5, 3.6, -4.5, 0.1, 1.9), ID.brass); T(cap(x, y, z, [-5.5, 1.7, -4.5], [-5.2, 1.35, -4.2], 0.12), ID.brass); T(Math.max(sph(x, y, z, -5.15, 1.3, -4.15, 0.2), -sph(x, y, z, -5.08, 1.27, -4.08, 0.16)), ID.brass); T(Math.max(cyl(x, y, z, -5.0, 0.95, -3.9, 0.2, 0.15), -cyl(x, y, z, -5.0, 1.0, -3.9, 0.18, 0.15)), ID.iron); }));
  add(K.stool(-4.7, 0, -3.6, 0.17, 0.55));
  spot("tube", "read", [-4.9, 0, -3.4], "the tube terminus: brass mouth, wire basket, stool, lamp (W:1228)");
  add(K.crateStack(-5.2, 0, 1.8, 3, 21, Math.PI / 2));
  // the Guild's aprons on pegs along the side wall, fish boxes with the vote fish, buckets, weights
  add(K.shape([-6.1, 0.9, -3.2, -5.8, 2.1, 4.8], (x, y, z, T) => { T(box(x, y, z, -6.0, 1.95, 0.8, 0.05, 0.05, 3.9), ID.timber); for (let k = 0; k < 10; k++) { const pz = -2.7 + k * 0.78; if (Math.abs(pz - 0.6) < 1.3) continue; T(box(x, y, z, -5.95, 1.45, pz, 0.04 + 0.02 * Math.sin(y * 7), 0.48, 0.24), k % 3 ? ID.oilskin : ID.canvas); } }));
  for (let k = 0; k < 3; k++) add(K.fishbox(1.0 + k * 0.95, 0, 4.2 + 0.2 * k, 0.15 * k, true));
  for (const [bx, bz] of [[0.6, 3.6], [-0.4, 4.1]]) add(K.shape([bx - 0.25, 0, bz - 0.25, bx + 0.25, 0.45, bz + 0.25], (x, y, z, T) => T(Math.max(cyl(x, y, z, bx, 0.2, bz, 0.19 + 0.04 * y, 0.2), -cyl(x, y, z, bx, 0.25, bz, 0.17 + 0.04 * y, 0.2)), ID.iron)));
  add(K.shape([-2.9, 0, -4.4, -1.9, 0.7, -3.6], (x, y, z, T) => { for (let k = 0; k < 5; k++) T(cyl(x, y, z, -2.4 + 0.08 * Math.sin(k), 0.05 + k * 0.1, -4.0, 0.3 - k * 0.04, 0.05), ID.iron); })); add(K.barrel(5.3, 0, -3.8, 0.35, 0.9)); add(K.coil(4.7, 0, -2.9, 0.3));
  // four lamps on hooks, and Pip's lamp at the tube
  for (const [lx, ly, lz] of [[-2.6, 3.0, -1.2], [2.6, 3.0, -1.6], [-3.2, 3.0, 2.6], [3.0, 3.0, 2.8], [-4.8, 1.9, -3.9]]) add({ bb: [lx - 0.3, ly - 0.4, lz - 0.3, lx + 0.3, 5.3, lz + 0.3], light: day ? null : { pos: [lx, ly - 0.05, lz], type: 1, I: lx === -4.8 ? 6 : 16, reach: 12, group: "lantern" }, f: (x, y, z, T) => { T(cap(x, y, z, [lx, 5.2, lz], [lx, ly + 0.25, lz], 0.01), ID.iron); T(cyl(x, y, z, lx, ly + 0.22, lz, 0.17, 0.02), ID.iron); T(ell(x, y, z, lx, ly, lz, 0.1, 0.15, 0.1), day ? ID.glass : ID.lantern); } });
  marks.hides.push({ id: "store_corner", at: [-4.6, 0, -3.0], r: 0.6, note: "the dark corner by the store" }, { id: "under_trestle", at: [-3.2, 0, 2.2], r: 0.7, note: "under a trestle" });
  return { world: W.build(), lights: (V = {}) => { const o = L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })); o.push({ pos: [-12, 4.5, 0.6], type: 0, I: V.sodiumIn ?? 260, reach: 30, key: "louvre" }); if (V.fill) o.push({ pos: [0, 4.8, 0.5], type: 1, I: V.fill, reach: 20, key: "fill", soft: 2 }); if (V.sun) o.push({ pos: V.sun.pos, type: 3, I: V.sun.I, reach: 400, key: "sun", soft: 30 }); return o; }, marks };
}

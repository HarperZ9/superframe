// The road post at the district line, The Quota era 2 (the perspective pair "the requisition": the post turning
// back the Haldane cart). The road from Krall's End crossing the white plain on a low causeway between ditches
// of black water skinned with ice; the barrier pole across it on its post with a counterweight; the guard hut of
// planks with its stove pipe smoking, a window, a lantern on a bracket; a brazier by the barrier; the district
// board on two legs; a line of bare poplars; the Haldane handcart stopped at the pole (sacks, a blanket, the
// shafts down). Snow on everything. Original block-out.
import { box, cyl, sph, ell, cap, fbm } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { seasonOf, fieldId, roofId, poplarCrown } from "./_season.mjs";

// season: winter (era 2, the default), harvest (era 1) or autumn (era 3); render/worlds/_season.mjs
export function roadPost({ season = "winter" } = {}) {
  const S = seasonOf(season);
  const W = makeWorld({ cell: 2, margin: 0.5 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => {
    const field = y - 0.15 * fbm(x * 0.15, z * 0.15, 3) + 0.0;
    const cause = box(x, y, z, 0, -0.2, 0, 40, 0.45, 2.2) - 0.1;   // the road on its low causeway (along x)
    const ditch = Math.max(Math.abs(Math.abs(z) - 3.6) - 0.8, -(y + 0.35));
    T(Math.max(Math.min(field, cause), -ditch), fieldId(S, x, z));   // the plain under snow (frost whitens it)
    T(Math.max(cause, -(y - 0.24)), ID.cobble);
    T(Math.max(box(x, y, z, 0, 0.25, 0, 40, 0.03, 1.6), -(y - 0.25)), ID.mud);   // the trodden road: wheel ruts through the snow, black
    T(Math.max(Math.abs(Math.abs(z) - 3.6) - 0.75, y + 0.36, -(y + 0.45)), ID.pool);   // the ditches' black water, a skin of ice at the edges
  });
  // the barrier: a post with a pivot, the pole across the road, its counterweight
  W.add(K.shape([-0.6, 0, -3.0, 0.6, 2.0, 3.2], (x, y, z, T) => {
    T(box(x, y, z, 0, 0.6, -2.7, 0.12, 0.6, 0.12), ID.timber); T(box(x, y, z, 0, 0.5, 2.8, 0.1, 0.5, 0.1), ID.timber);
    const stripe = Math.floor((z + 4) / 0.5) % 2 ? ID.red : ID.bonecloth; T(cap(x, y, z, [0, 1.15, -3.1], [0, 1.0, 2.9], 0.07), stripe);
    T(box(x, y, z, 0, 1.15, -3.25, 0.16, 0.16, 0.2), ID.iron);
  }));
  spot("barrier", "stop", [1.2, 0, 0], "the barrier pole at the district line");
  // the guard hut on the near side of the line: planks, a window with a lamp behind it, the stove pipe
  W.add(K.shape([-4.5, 0, -6.8, -1.3, 3.6, -3.4], (x, y, z, T) => {
    const hut = box(x, y, z, -2.9, 1.2, -5.1, 1.4, 1.2, 1.4); T(Math.max(hut, -box(x, y, z, -2.9, 1.5, -3.7, 0.4, 0.3, 0.2), -box(x, y, z, -2.0, 0.95, -3.7, 0.36, 0.95, 0.2)), ID.plank);
    T(box(x, y, z, -2.9, 1.5, -3.75, 0.36, 0.26, 0.02), ID.window);
    T(Math.max(box(x, y, z, -2.9, 2.55, -5.1, 1.6, 0.15, 1.6) + 0.12 * Math.abs(x + 2.9), -(y - 2.4)), roofId(S, x, z));
    T(cyl(x, y, z, -3.6, 2.9, -5.6, 0.08, 0.6), ID.stove);
    T(cap(x, y, z, [-1.55, 2.0, -3.6], [-1.3, 2.0, -3.3], 0.02), ID.iron); T(ell(x, y, z, -1.3, 1.85, -3.3, 0.08, 0.12, 0.08), ID.lantern);
  }));
  L.push({ pos: [-1.3, 1.85, -3.1], type: 1, I: 7, reach: 9, key: "hutlamp", group: "lantern" });
  marks.hides.push({ id: "behind_hut", at: [-4.6, 0, -5.4], r: 0.6, note: "behind the guard hut" });
  // the brazier by the barrier
  W.add(K.shape([-1.6, 0, 2.6, -0.6, 1.1, 3.6], (x, y, z, T) => { T(Math.max(cyl(x, y, z, -1.1, 0.75, 3.1, 0.28, 0.2), -cyl(x, y, z, -1.1, 0.85, 3.1, 0.24, 0.2)), ID.iron); for (const a of [0, 2.1, 4.2]) T(cap(x, y, z, [-1.1 + 0.25 * Math.cos(a), 0.6, 3.1 + 0.25 * Math.sin(a)], [-1.1 + 0.4 * Math.cos(a), 0, 3.1 + 0.4 * Math.sin(a)], 0.02), ID.iron); T(ell(x, y, z, -1.1, 0.88, 3.1, 0.22, 0.06, 0.22), ID.stovefire); }));
  L.push({ pos: [-1.1, 1.1, 3.1], type: 1, I: 8, reach: 7, key: "brazier", group: "fire" });
  spot("brazier", "warm", [-1.8, 0, 3.0], "the guards' brazier");
  // the district board: DISTRICT LINE, PASSES SHOWN HERE (the words are the game's; the board is blank paint here)
  W.add(K.shape([2.2, 0, 2.6, 3.8, 2.4, 3.2], (x, y, z, T) => { for (const lx of [2.5, 3.5]) T(box(x, y, z, lx, 0.9, 2.9, 0.05, 0.9, 0.05), ID.timber); T(box(x, y, z, 3.0, 1.8, 2.92, 0.7, 0.35, 0.03), ID.bone); }));
  spot("board", "read", [3.0, 0, 2.2], "the district board: passes shown here");
  // the Haldane handcart stopped at the pole on the far side: two wheels, the bed, sacks and a blanket, shafts down
  W.add(K.shape([1.3, 0, -1.4, 4.8, 1.3, 1.4], (x, y, z, T) => {
    for (const wz of [-0.75, 0.75]) T(Math.max(Math.abs(Math.hypot(x - 2.7, y - 0.55) - 0.48) - 0.05, Math.abs(z - wz) - 0.04), ID.timber);
    T(box(x, y, z, 2.9, 0.75, 0, 1.0, 0.05, 0.68), ID.plank); T(Math.max(box(x, y, z, 2.9, 0.95, 0, 1.0, 0.2, 0.7), -box(x, y, z, 2.9, 1.0, 0, 0.95, 0.25, 0.65)), ID.plank);
    for (const sz of [-0.5, 0.5]) T(cap(x, y, z, [1.95, 0.75, sz], [1.35, 0.05, sz * 1.2], 0.035), ID.timber);
    T(ell(x, y, z, 3.2, 0.98, -0.25, 0.32, 0.2, 0.26), ID.sack); T(ell(x, y, z, 2.7, 0.95, 0.3, 0.4, 0.16, 0.32), ID.oxblood);   // a sack, and the blanket over the children
  }));
  spot("cart", "search", [2.9, 0, 1.5], "the Haldane cart at the pole: a sack, and a blanket over something that moves");
  // bare poplars along the road, far side
  for (let k = 0; k < 9; k++) { const px = -14 + k * 4.2, pz = -2.9 + (k % 2) * 6; W.add(K.shape([px - 0.9, 0, pz - 0.9, px + 0.9, 9, pz + 0.9], (x, y, z, T) => { T(cyl(x, y, z, px, 3.5, pz, 0.12, 3.5), ID.darkwood); for (let b = 0; b < 6; b++) { const a = b * 1.05 + k; T(cap(x, y, z, [px, 2.5 + b * 0.9, pz], [px + 0.6 * Math.cos(a), 3.6 + b * 0.95, pz + 0.6 * Math.sin(a)], 0.03), ID.darkwood); } poplarCrown(S, T, x, y, z, px, pz, 3.2, 8.6, 0.7, k); })); }
  marks.exits.push({ id: "krall", at: [12, 0, 0], note: "the road on to Krall's End" }, { id: "town", at: [-12, 0, 0], note: "the road back to Edrin" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).concat(V.sun ? [{ pos: V.sun.pos, type: 3, I: V.sun.I, reach: 400, key: "sun", soft: V.sun.soft ?? 30 }] : [], V.fill ? [{ pos: [0, 12, 6], type: 1, I: V.fill, reach: 40, key: "fill", soft: 8 }] : []) };
}

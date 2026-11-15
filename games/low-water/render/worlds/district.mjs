// The district office, The Quota era 2 (design/quota/07-PRODUCTION.md: where the player reports a figure, true,
// inflated, or blamed on Hesh hoarding). The old registrar's room taken over by the Directorate: a high counter
// across the room with a brass grille and a slot, behind it the clerk's desk with the district ledger open and
// the abacus, the chairman's door, the district map on the back wall with its eleven villages pinned and a
// figure chalked under each, shelves of ledgers to the ceiling, the Directorate's sheaf banner, a cold stove,
// the bench for those who wait, the window on Exchange Square. Near walls cut away. Original block-out.
import { box, cyl, ell, cap } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function district() {
  const W = makeWorld({ cell: 1.2, margin: 0.35 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 3.4, HZ = 2.8, H = 3.4;
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.plaster, wallNear: ID.brick, sill: 0.45, cuts: [[-HX - 0.12, 1.9, -0.6, 0.3, 0.8, 0.55], [1.9, 1.1, -HZ - 0.12, 0.5, 1.1, 0.3]] });
    T(box(x, y, z, 0, 0.55, -HZ + 0.03, HX + 0.2, 0.55, 0.04), ID.darkwood); T(box(x, y, z, -HX + 0.03, 0.55, 0, 0.04, 0.55, HZ + 0.2), ID.darkwood);   // wainscot
  });
  // the window on the square (left wall), tall, its sash
  W.add(K.shape([-HX - 0.3, 1.0, -1.3, -HX + 0.2, 2.8, 0.1], (x, y, z, T) => { T(box(x, y, z, -HX - 0.1, 1.9, -0.6, 0.02, 0.76, 0.5), ID.window); T(Math.max(box(x, y, z, -HX - 0.08, 1.9, -0.6, 0.04, 0.8, 0.55), -box(x, y, z, -HX - 0.08, 1.9, -0.6, 0.1, 0.74, 0.48)), ID.timber); T(box(x, y, z, -HX - 0.07, 1.9, -0.6, 0.03, 0.02, 0.5), ID.timber); }));
  // the counter across the room with its brass grille and slot
  W.add(K.shape([-2.2, 0, -0.3, 3.3, 2.3, 0.4], (x, y, z, T) => {
    T(box(x, y, z, 0.6, 0.55, 0.05, 2.7, 0.55, 0.28), ID.darkwood); T(box(x, y, z, 0.6, 1.12, 0.05, 2.75, 0.03, 0.32), ID.timber);
    for (let k = 0; k < 28; k++) { const gx = -1.9 + k * 0.2; if (Math.abs(gx - 0.6) < 0.32) continue; T(cap(x, y, z, [gx, 1.15, 0.0], [gx, 2.15, 0.0], 0.008), ID.brass); }
    T(box(x, y, z, 0.6, 2.15, 0.0, 2.7, 0.02, 0.02), ID.brass); T(box(x, y, z, 0.6, 1.25, 0.0, 0.3, 0.1, 0.015), ID.brass);
  }));
  spot("counter", "report", [0.6, 0, 0.9], "the counter: the slot where the district figure is handed in (true, inflated, or blamed on Hesh hoarding)");
  // the clerk's desk behind: the district ledger open, the abacus, the stamp, a paraffin lamp
  W.add(K.table(0.6, 0, -1.2, 0.8, 0.4, 0.78, 0, ID.darkwood)); W.add(K.stool(0.6, 0, -1.8, 0.2, 0.55));
  W.add(K.shape([-0.3, 0.76, -1.6, 1.5, 1.1, -0.8], (x, y, z, T) => {
    T(box(x, y, z, 0.45, 0.8, -1.15, 0.28, 0.02, 0.2), ID.paper); T(box(x, y, z, 0.45, 0.79, -1.15, 0.01, 0.025, 0.2), ID.oxblood);
    T(box(x, y, z, 1.05, 0.83, -1.25, 0.18, 0.06, 0.11), ID.darkwood); for (let k = 0; k < 5; k++) for (let b = 0; b < 4; b++) T(ell(x, y, z, 0.92 + b * 0.05 + (k % 2) * 0.03, 0.86, -1.33 + k * 0.04, 0.018, 0.018, 0.012), ID.brass);
    T(cyl(x, y, z, 0.05, 0.85, -1.0, 0.03, 0.06), ID.iron);
  }));
  W.add(K.paraffin(0.0, 0.78, -1.4, 0, false, 10)); L.push({ pos: [0.0, 1.0, -1.4], type: 1, I: 9, reach: 7, key: "lamp", group: "lantern" });
  spot("ledger", "read", [0.6, 0, -0.7], "the district ledger, open at Krall's End: the figure in pencil, and the figure over it in ink");
  // the district map on the back wall: the plain, the river, eleven pins with chalked figures
  W.add(K.shape([-2.0, 1.2, -HZ - 0.05, 1.4, 2.9, -HZ + 0.1], (x, y, z, T) => {
    T(box(x, y, z, -0.3, 2.05, -HZ + 0.04, 1.5, 0.78, 0.015), ID.canvas);
    T(Math.max(cap(x, y, z, [-1.7, 1.5, -HZ + 0.06], [1.1, 2.6, -HZ + 0.06], 0.02) + 0.01 * Math.sin(x * 9), 0), ID.navy);
    for (let k = 0; k < 11; k++) { const px = -1.6 + ((k * 0.61) % 2.7), py = 1.45 + ((k * 0.37) % 1.15); T(cyl(x, y, z, px, py, -HZ + 0.07, 0.022, 0.02), ID.red); T(box(x, y, z, px + 0.07, py - 0.07, -HZ + 0.058, 0.08, 0.018, 0.003), ID.chalk); }
  }));
  spot("map", "read", [-0.3, 0, -1.9], "the district map: eleven villages, a pin and a chalked quota under each");
  // the ledger shelves on the right of the back wall; the chairman's door; the sheaf banner over the counter
  W.add(K.shape([1.6, 0, -HZ - 0.05, HX + 0.05, H, -HZ + 0.45], (x, y, z, T) => { if (x < 1.65) return; T(box(x, y, z, 2.6, 1.5, -HZ + 0.2, 0.75, 1.5, 0.2), ID.darkwood); for (let s = 0; s < 6; s++) for (let k = 0; k < 14; k++) T(box(x, y, z, 1.95 + k * 0.095, 0.3 + s * 0.48, -HZ + 0.25, 0.035, 0.17 + 0.02 * Math.sin(k * 3 + s), 0.13), [ID.oxblood, ID.navy, ID.darkwood, ID.green][(k + s) % 4]); }));
  W.add(K.shape([-HX - 0.05, 0, 1.2, -HX + 0.1, 2.3, 2.4], (x, y, z, T) => T(box(x, y, z, -HX + 0.03, 1.05, 1.8, 0.03, 1.05, 0.48), ID.darkwood)));
  marks.exits.push({ id: "chairman", at: [-HX + 0.4, 0, 1.8], note: "the chairman's door" });
  W.add(K.shape([-1.6, 2.4, -0.1, 2.8, 3.3, 0.1], (x, y, z, T) => { T(box(x, y, z, 0.6, 2.8, 0.0, 1.4, 0.35, 0.01 + 0.01 * Math.sin(x * 6)), ID.oxblood); T(Math.max(ell(x, y, z, 0.6, 2.8, 0.012, 0.16, 0.24, 0.01), 0), ID.mustard); }));
  // the bench for those who wait (the public side), the cold stove
  W.add(K.table(-1.0, 0, 1.9, 1.2, 0.2, 0.45, 0)); W.add(K.shape([2.1, 0, 1.4, 2.9, 2.6, 2.2], (x, y, z, T) => { T(cyl(x, y, z, 2.5, 0.4, 1.8, 0.26, 0.4), ID.stove); T(cap(x, y, z, [2.5, 0.8, 1.8], [2.5, 2.6, 1.8], 0.06), ID.stove); }));
  spot("bench", "sit", [-1.0, 0, 2.3], "the bench where the villages' men wait their turn");
  marks.exits.push({ id: "square", at: [1.9, 0, 2.4], note: "the street door to Exchange Square" });
  marks.hides.push({ id: "behind_shelves", at: [3.0, 0, -1.6], r: 0.4, note: "behind the ledger shelves" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).concat(V.window ? [{ pos: [-HX - 1.5, 2.0, -0.6], type: 1, I: V.window, cone: [1, -0.2, 0], mode: 2, reach: 10, key: "window", soft: 1.4 }] : [], V.fill ? [{ pos: [0.5, 2.6, 0.8], type: 1, I: V.fill, reach: 10, key: "fill", soft: 2 }] : []) };
}

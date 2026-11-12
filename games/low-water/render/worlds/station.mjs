// The Lamplighters' station on Chancel Hill: "one whitewashed room, lit so hard the whitewash hums".
// Laid out on the combat arena (game/engine/combat/data/arenas2.mjs HILL): world x, z = arena x, z
// in metres, floor y = 0, the back wall at z = 0 with the three white lamps over x = 3, 7, 11 at
// z = 1, the door at the bottom (x 6 to 8, z = 10). A rack of brass poles, the key board with a hook
// for every house (one labelled CRAKE, SIDE), the shelf of black books with the bench under it,
// Gorm's desk, a stool, and the stove (proposed arena anchor: cover at 1.6, 7.4). The near walls
// (x = 14, z = 10) are cut away. Original block-out (Low Water look work).
import { box, cyl, sph, cap } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

export function station() {
  const W = makeWorld({ cell: 1.5, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => {
    T(Math.max(y, box(x, y, z, 7, -0.3, 5, 7.3, 0.3, 5.3)), ID.slab);
    T(box(x, y, z, 7, 2.0, -0.25, 7.5, 2.0, 0.25), ID.limewash); T(box(x, y, z, -0.25, 2.0, 5, 0.25, 2.0, 5.5), ID.limewash);
    T(box(x, y, z, 7, 0.25, -0.02, 7.5, 0.25, 0.04), ID.tar); T(box(x, y, z, -0.02, 0.25, 5, 0.04, 0.25, 5.5), ID.tar); // tarred skirting
    T(Math.max(box(x, y, z, 7, 0.1, 10.1, 7.4, 0.1, 0.12), -box(x, y, z, 7, 0.1, 10.1, 1.0, 0.3, 0.3)), ID.limewash); // the cut near wall's footing, open at the door
    for (const s of [-1, 1]) T(box(x, y, z, 7 + s * 1.08, 1.1, 10.1, 0.08, 1.1, 0.1), ID.timber); // the door frame
  });
  // three white trial lamps hung over the floor
  for (const lx of [3, 7, 11]) { W.add(K.shape([lx - 0.4, 2.6, 0, lx + 0.4, 4.0, 1.4], (x, y, z, T) => { T(cap(x, y, z, [lx, 3.9, 0.02], [lx, 3.9, 1.0], 0.03), ID.iron); T(cap(x, y, z, [lx, 3.9, 1.0], [lx, 3.3, 1.0], 0.015), ID.iron); T(cyl(x, y, z, lx, 3.25, 1.0, 0.3, 0.06), ID.iron); T(sph(x, y, z, lx, 3.05, 1.0, 0.14), ID.whitelamp); })); L.push({ pos: [lx, 3.0, 1.0], type: 3, I: 70, reach: 22, group: "white", key: `white${lx}` }); }
  marks.lamps.push(...[3, 7, 11].map((x) => ({ id: `white_${x}`, kind: "white", at: [x, 3.05, 1.0], arena: [x, 1] })));
  // the rack of poles on the left wall; the key board; the shelf of black books and the bench
  W.add(K.shape([0, 0, 1.6, 0.6, 3.4, 5.4], (x, y, z, T) => { T(box(x, y, z, 0.12, 0.9, 3.5, 0.1, 0.05, 1.8), ID.timber); T(box(x, y, z, 0.12, 2.6, 3.5, 0.1, 0.05, 1.8), ID.timber); for (let k = 0; k < 8; k++) T(cap(x, y, z, [0.25, 0.05, 2.0 + k * 0.42], [0.18, 3.2, 2.0 + k * 0.42], 0.03), ID.brass); }));
  spot("pole_rack", "salvage", [0.8, 0, 3.5], "the rack of poles (H:541)");
  W.add(K.shape([7.6, 1.2, 0, 10.4, 2.6, 0.2], (x, y, z, T) => { T(box(x, y, z, 9.0, 1.9, 0.05, 1.3, 0.6, 0.04), ID.timber); for (let k = 0; k < 24; k++) { const kx = 7.9 + (k % 8) * 0.3, ky = 2.25 - Math.floor(k / 8) * 0.35; T(cap(x, y, z, [kx, ky, 0.08], [kx, ky, 0.16], 0.012), ID.brass); if (rnd(k, 2) < 0.8) T(box(x, y, z, kx, ky - 0.1, 0.15, 0.025, 0.06, 0.01), ID.iron); T(box(x, y, z, kx, ky + 0.08, 0.1, 0.1, 0.025, 0.005), ID.paper); } }));
  spot("key_board", "salvage", [9.0, 0, 0.7], "the board of keys; one hook labelled CRAKE, SIDE (H:655)");
  W.add(K.shape([3.6, 0, 0, 6.6, 2.6, 0.7], (x, y, z, T) => { T(box(x, y, z, 5.1, 2.0, 0.2, 1.4, 0.03, 0.18), ID.timber); for (let k = 0; k < 22; k++) T(box(x, y, z, 3.85 + k * 0.12, 2.18 + 0.03 * rnd(k), 0.2, 0.045, 0.15 + 0.03 * rnd(k, 1), 0.14), ID.navy); }));
  W.add(K.table(5.1, 0, 0.55, 1.4, 0.22, 0.45, 0)); spot("black_books", "read", [5.1, 0, 1.1], "the shelf of black books (H:541)");
  // coats and lanterns on pegs by the door, a map of the hill's lamps, a second bench, a bucket of sand
  W.add(K.shape([12.4, 0.8, 0, 14.0, 2.4, 0.3], (x, y, z, T) => { T(box(x, y, z, 13.2, 1.9, 0.06, 0.8, 0.04, 0.04), ID.timber); for (let k = 0; k < 4; k++) { const px = 12.6 + k * 0.4; T(box(x, y, z, px, 1.4, 0.14, 0.14 + 0.04 * Math.sin(y * 8), 0.5, 0.06), k % 2 ? ID.navy : ID.oilskin); } }));
  W.add(K.shape([1.6, 1.2, 0, 3.0, 2.6, 0.12], (x, y, z, T) => { T(box(x, y, z, 2.3, 1.9, 0.04, 0.65, 0.5, 0.01), ID.paper); for (let k = 0; k < 9; k++) T(sph(x, y, z, 1.8 + k * 0.12, 1.6 + 0.07 * k, 0.05, 0.02), ID.red); }));
  W.add(K.table(12.8, 0, 6.0, 1.2, 0.2, 0.45, Math.PI / 2)); W.add(K.shape([11.4, 0, 8.4, 12.0, 0.5, 9.0], (x, y, z, T) => T(Math.max(cyl(x, y, z, 11.7, 0.22, 8.7, 0.22, 0.22), -cyl(x, y, z, 11.7, 0.3, 8.7, 0.19, 0.22)), ID.iron)));
  // Gorm's desk and stool; the stove with its red line
  W.add(K.table(10.6, 0, 3.2, 0.9, 0.5, 0.78, 0.0, ID.darkwood)); W.add(K.stool(10.4, 0, 4.1, 0.18, 0.5));
  W.add(K.shape([9.9, 0.7, 2.7, 11.4, 1.0, 3.7], (x, y, z, T) => { T(box(x, y, z, 10.4, 0.8, 3.1, 0.3, 0.01, 0.22), ID.paper); T(box(x, y, z, 11.1, 0.83, 3.3, 0.12, 0.04, 0.17), ID.navy); }));
  spot("gorms_desk", "read", [10.6, 0, 4.0], "Gorm's desk");
  W.add(K.shape([1.0, 0, 6.8, 2.2, 4.0, 8.0], (x, y, z, T) => { T(cyl(x, y, z, 1.6, 0.5, 7.4, 0.42, 0.5), ID.stove); T(box(x, y, z, 1.6, 0.42, 7.85, 0.18, 0.025, 0.02), ID.stovefire); T(cap(x, y, z, [1.6, 1.0, 7.4], [0.4, 3.9, 7.4], 0.09), ID.stove); }));
  L.push({ pos: [1.6, 0.42, 8.0], type: 1, I: 1.6, cone: [0, 0, 1], mode: 2, reach: 4, group: "fire", key: "stove" });
  marks.hides.push({ id: "stove", at: [1.6, 0, 6.6], r: 0.5, note: "nothing to hide behind but the stove (H:682); proposed arena cover at 1.6, 7.4" });
  marks.exits.push({ id: "lane", at: [7, 0, 10], note: "the door to the hill path (arena exit 6..8, 9.3..10)" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [7, 3.6, 5], type: 2, I: V.fill, reach: 20, key: "fill", soft: 2 }] : []) };
}

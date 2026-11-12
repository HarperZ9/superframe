// The harbour office and the cells beneath it, as one section: the office above (the stove with
// Gorm's book on its warm iron, the bay chart under glass, Keel's chair with a hole in its seat over
// a bucket, the telephone on the wall, the harbour table on a nail, the desk with its paraffin lamp,
// the window to the mole), its floor cut back so the cellar shows below: six steps down among coils of
// wick and a crate of mantles, a wet bench, the crate Gorm sits on, and high in the wall the grating to
// the quay with the sodium coming through in bars. Original block-out (Low Water look work).
import { box, cyl, sph, cap, ell } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

export const CELL_Y = -2.6;
export function officeRoom() {
  const W = makeWorld({ cell: 1.2, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => {
    // office floor: the back part only (z < 0.1); the stair opening on the right
    T(Math.max(box(x, y, z, 0, -0.15, -1.0, 2.6, 0.15, 1.1), -box(x, y, z, 1.75, -0.15, -0.5, 0.6, 0.4, 0.75)), ID.boards);
    T(box(x, y, z, 0, CELL_Y - 0.2, 0, 2.6, 0.2, 2.2), ID.slab); // the cell floor
    T(box(x, y, z, 0, 0.0, -2.35, 2.9, 3.4, 0.25), ID.teal); T(box(x, y, z, 0, CELL_Y / 2 - 0.15, -2.35, 2.9, -CELL_Y / 2 + 0.15, 0.25), ID.wall); // back wall: office planking, cellar stone
    T(Math.max(box(x, y, z, -2.85, 0.0, 0, 0.25, 3.4, 2.4), -box(x, y, z, -2.85, 1.6, -0.3, 0.4, 0.5, 0.6)), ID.teal); // left wall with the window to the mole
    T(Math.max(box(x, y, z, -2.85, CELL_Y / 2 - 0.15, 0, 0.25, -CELL_Y / 2 + 0.15, 2.4), -box(x, y, z, -2.85, -0.6, 0.9, 0.4, 0.35, 0.55)), ID.wall); // cellar wall with the grating
    T(box(x, y, z, 0, 3.2, -1.0, 2.9, 0.12, 1.4), ID.timber); // ceiling beam line
  });
  add(K.shape([-3.1, 1.0, -1.0, -2.6, 2.2, 0.4], (x, y, z, T) => { T(box(x, y, z, -2.7, 1.6, -0.3, 0.03, 0.5, 0.6), ID.window); T(box(x, y, z, -2.68, 1.6, -0.3, 0.02, 0.5, 0.015), ID.timber); }));
  add(K.shape([-3.1, -1.0, 0.2, -2.55, -0.2, 1.6], (x, y, z, T) => { for (let k = -4; k <= 4; k++) T(box(x, y, z, -2.7, -0.6, 0.9 + k * 0.12, 0.04, 0.34, 0.014), ID.iron); T(Math.max(box(x, y, z, -2.7, -0.6, 0.9, 0.05, 0.37, 0.58), -box(x, y, z, -2.7, -0.6, 0.9, 0.2, 0.33, 0.54)), ID.iron); }));
  spot("grating", "pry", [-2.4, CELL_Y, 0.9], "the grating to the quay, two bolts and a padlock (Q:2462)");
  // the stove with Gorm's book on it; the pipe
  add(K.shape([-2.4, 0, -2.2, -1.2, 3.2, -1.0], (x, y, z, T) => { T(cyl(x, y, z, -1.8, 0.45, -1.6, 0.36, 0.45), ID.stove); T(box(x, y, z, -1.8, 0.93, -1.6, 0.4, 0.03, 0.4), ID.iron); T(box(x, y, z, -1.78, 0.98, -1.55, 0.18, 0.03, 0.13), ID.paper); T(box(x, y, z, -1.5, 0.4, -1.32, 0.12, 0.12, 0.02), ID.stovefire); T(cap(x, y, z, [-1.8, 0.95, -1.7], [-1.8, 3.2, -1.9], 0.08), ID.stove); }));
  L.push({ pos: [-1.45, 0.4, -1.1], type: 1, I: 5, cone: [0.4, 0, 1], mode: 2, reach: 6, group: "fire", key: "stove" });
  spot("gorms_book", "read", [-1.8, 0, -1.0], "Gorm's book open on the warm iron (Q:1035)");
  // the bay chart under glass on the back wall; the telephone; the harbour table on its nail
  add(K.shape([-0.9, 1.0, -2.15, 1.3, 2.4, -2.0], (x, y, z, T) => { T(box(x, y, z, 0.2, 1.75, -2.08, 1.0, 0.6, 0.02), ID.paper); T(box(x, y, z, 0.2, 1.75, -2.05, 1.06, 0.66, 0.012), ID.glass); for (let k = 0; k < 7; k++) T(box(x, y, z, -0.5 + k * 0.22, 1.55 + 0.3 * Math.sin(k * 1.3), -2.06, 0.05, 0.02, 0.005), ID.blue); }));
  spot("chart", "read", [0.2, 0, -1.6], "the bay chart under glass; the Old Light on Hound Rock (Q:1030)");
  add(K.shape([1.4, 1.2, -2.15, 2.1, 2.2, -1.95], (x, y, z, T) => { T(box(x, y, z, 1.7, 1.7, -2.07, 0.12, 0.2, 0.05), ID.darkwood); T(cap(x, y, z, [1.6, 1.82, -2.0], [1.82, 1.82, -2.0], 0.03), ID.coal); T(box(x, y, z, 1.95, 1.45, -2.08, 0.1, 0.16, 0.01), ID.paper); }));
  spot("telephone", "eavesdrop", [1.7, 0, -1.6], "the telephone on the wall; Crake rings three times (Q:1087)");
  // the desk, its paraffin lamp; Keel's chair with the hole and the bucket
  add(K.table(0.2, 0, -1.25, 0.7, 0.38, 0.78, 0, ID.darkwood)); add(K.shape([0.2, 0.7, -1.6, 1.0, 1.3, -0.9], (x, y, z, T) => { T(box(x, y, z, 0.05, 0.8, -1.25, 0.25, 0.01, 0.18), ID.paper); T(cyl(x, y, z, 0.7, 0.86, -1.35, 0.08, 0.08), ID.brass); T(ell(x, y, z, 0.7, 1.05, -1.35, 0.07, 0.11, 0.07), ID.lantern); }));
  L.push({ pos: [0.7, 1.05, -1.35], type: 1, I: 7, reach: 9, group: "lantern", key: "desklamp" });
  add(K.shape([-0.2, 0, -0.9, 0.6, 1.1, -0.1], (x, y, z, T) => { T(Math.max(box(x, y, z, 0.2, 0.45, -0.5, 0.24, 0.03, 0.24), -cyl(x, y, z, 0.2, 0.45, -0.5, 0.09, 0.1)), ID.darkwood); T(box(x, y, z, 0.2, 0.85, -0.27, 0.24, 0.4, 0.03), ID.darkwood); for (const sx of [-1, 1]) for (const sz of [-1, 1]) T(box(x, y, z, 0.2 + sx * 0.2, 0.22, -0.5 + sz * 0.2, 0.025, 0.22, 0.025), ID.darkwood); T(Math.max(cyl(x, y, z, 0.2, 0.13, -0.5, 0.14, 0.13), -cyl(x, y, z, 0.2, 0.2, -0.5, 0.12, 0.13)), ID.iron); }));
  spot("keels_chair", "wait", [0.2, 0, -0.1], "Keel's chair, the hole in its seat over the bucket (Q:1388)");
  // the cellar door and the six steps down along the right wall
  add(K.stairs(1.75, CELL_Y, 1.1, Math.PI, 6, 1.0, -CELL_Y / 6, 0.32, ID.steps));
  add(K.shape([2.3, 0, -1.8, 2.7, 2.2, -0.9], (x, y, z, T) => T(box(x, y, z, 2.45, 1.05, -1.35, 0.04, 1.05, 0.42), ID.oxblood)));
  marks.exits.push({ id: "quay", at: [2.2, 0, -1.35], note: "the office door to the quay" }, { id: "cells_stair", at: [1.75, 0, -0.4], note: "the six steps down to the cells" });
  // the cells: coils of wick, a crate of mantles, the wet bench, Gorm's crate, a candle
  add(K.table(-1.6, CELL_Y, -1.75, 0.9, 0.25, 0.45, 0, ID.plank)); spot("wet_bench", "wait", [-1.6, CELL_Y, -1.3], "the wet bench (Q:1898)");
  add(K.crate(0.2, CELL_Y, 0.9, 0.34, 0.3)); add(K.crate(-0.6, CELL_Y, -1.6, 0.28, -0.2, ID.timber));
  for (let k = 0; k < 4; k++) add(K.coil(-1.8 + (k % 2) * 0.7, CELL_Y + Math.floor(k / 2) * 0.16, 0.6 + (k % 2) * 0.3, 0.3));
  add(K.crateStack(1.0, CELL_Y, -1.6, 3, 31, 0.0));
  add(K.candle(0.2, CELL_Y + 0.62, 0.9, 0.16, false, 2.4));
  for (let k = 0; k < 3; k++) L.push({ pos: [-4.2, 0.4, 0.62 + k * 0.28], type: 0, I: 40, cone: [0.8, -0.6, 0], mode: 2, reach: 8, group: "sodium", key: `grate${k}` });
  marks.hides.push({ id: "under_stair", at: [1.8, CELL_Y, 0.4], r: 0.5, note: "the dark under the six steps" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [0, 2.6, 0], type: 1, I: V.fill, reach: 12, key: "fill", soft: 2 }, { pos: [0.3, CELL_Y + 1.6, 0.6], type: 0, I: V.fill * 0.8, reach: 8, key: "cellfill", soft: 2 }] : [], V.moonIn ? [{ pos: [-12, 4, -0.3], type: 2, I: V.moonIn, reach: 30, key: "moon" }] : []) };
}

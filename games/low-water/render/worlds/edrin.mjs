// Edrin's Upper Town as one map (the camera proposal approved 2026-10-22, design/CAMERA.md: a whole-town map plate
// in Oil and Ink, at the one exterior angle, so every place the Quota visits sits where it is). Composed: Exchange
// Square is the square world itself (worlds/square.mjs) set in the middle; round it the terraces of Exchange Street
// and Mill Street (the Sheaf on its corner, the pump at the street's end), the district office on the square's west
// side, the granary to the south-west by Haldane Yard (the barns, the hands' barn kitchen), Tilney Road running
// north to the Furrow Church's home with its railings, the burial ground on the hill's shoulder, and the post road
// east across the white plain to the district line. Original block-out; placement is the map's, not a survey.
//   edrin() -> { world, marks, lights }
import { box, cyl, ell, cap, gable, fbm } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { square } from "./square.mjs";

const TONES = [ID.oxblood, ID.bone, ID.limewash, ID.mustard, ID.plaster, ID.brick, ID.bone, ID.teal];
// a world placed inside another as one prop: its own distance and surface, offset by (ox, oz)
function inset(S, bb, ox = 0, oz = 0) { return K.shape([bb[0] + ox, bb[1], bb[2] + oz, bb[3] + ox, bb[4], bb[5] + oz], (x, y, z, T) => { const d = S.map(x - ox, y, z - oz); T(d, S.idOf()); }); }

export function edrin() {
  const W = makeWorld({ cell: 6, margin: 1 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [], places: {} };
  const place = (id, at, note) => { marks.places[id] = { at, note }; marks.spots.push({ id, verb: "go", at, note }); };
  // the land: the town's ground, a rise to the north (the hill's shoulder), the plain falling away east
  const hgt = (x, z) => Math.max(0, (-z - 60) * 0.18) + 0.25 * fbm(x * 0.03, z * 0.03);
  W.ground((x, y, z, T) => {
    const g = y - hgt(x, z);
    T(g, Math.abs(z + 2) < 4 && x > 30 ? ID.mud : x > 34 || z < -66 ? ID.mud : ID.cobble);
  });
  // Exchange Square in the middle: the wide lens's own world
  const S = square({ train: true, standins: 0 }).world;
  W.add(inset(S, [-26, -1, -47, 25, 22, 20]));
  place("q_tower", [0, 0, 0], "Exchange Square and the bell tower");
  // terraces: a row of houses along a line, fronts toward face, with a gap for a street mouth
  const row = (x0, z0, dx, dz, n, face, seed, opts = {}) => { for (let k = 0; k < n; k++) { const s = seed * 31 + k, hx = 1.9 + 0.5 * rnd(s, 1), h = 6 + 4 * rnd(s, 2); W.add(K.house(x0 + dx * k, z0 + dz * k, hx, 2.2, h, { id: TONES[(s * 7) % TONES.length], seed: s, lit: 0.12, face, k: 0.01 * (rnd(s, 3) - 0.5), ...opts })); } };
  // Exchange Street west of the square (the Furrowes' house among them), Mill Street south-east to the pump
  row(-62, -30, 4.6, 0, 8, 1, 3); row(-62, -18, 4.6, 0, 8, -1, 4);
  place("q_furrowe_door", [-40, 0, -24], "the Furrowes' front step, Exchange Street");
  row(30, 28, 4.4, 2.2, 7, -1, 5); row(24, 40, 4.4, 2.2, 7, 1, 6);
  place("q_sheaf", [36, 0, 36], "the Sheaf on the corner of Mill Street");
  W.add(K.shape([58, 0, 50, 61, 2.4, 53], (x, y, z, T) => { T(box(x, y, z, 59.5, 0.12, 51.5, 0.7, 0.12, 0.7), ID.slab); T(box(x, y, z, 59.5, 1.0, 51.5, 0.18, 0.9, 0.18), ID.iron); }));
  place("q_pump", [59.5, 0, 51.5], "the pump at the end of Mill Street");
  // the district office on the square's west side: a long stone block with the cells under it (a grating)
  W.add(K.shape([-40, 0, -6, -26, 12, 10], (x, y, z, T) => { T(box(x, y, z, -33, 5, 2, 6.5, 5, 7.5), ID.wall); T(gable(x, y, z, -33, 10, 2, 6.8, 7.8, 2.4), ID.roof); for (let k = 0; k < 5; k++) T(box(x, y, z, -26.4, 3.5 + (k % 2) * 3, -3 + k * 2.5, 0.05, 0.6, 0.45), ID.windowdim); T(box(x, y, z, -26.4, 0.25, 2, 0.05, 0.2, 1.4), ID.iron); }));
  place("q_returns", [-25, 0, 2], "the district office: the returns room, the meeting room, the cells under it");
  // Haldane Yard and the granary to the south-west
  W.add(K.shape([-70, 0, 26, -44, 9, 50], (x, y, z, T) => {
    T(box(x, y, z, -60, 2.4, 34, 6, 2.4, 3), ID.plank); T(gable(x, y, z, -60, 4.8, 34, 6.2, 3.2, 2.6), ID.roof);   // the barn
    T(box(x, y, z, -50, 1.25, 33, 2.4, 1.25, 2.2), ID.limewash); T(gable(x, y, z, -50, 2.5, 33, 2.6, 2.4, 1.6), ID.roof);   // the hands' barn kitchen
    T(Math.max(box(x, y, z, -57, 0.6, 44, 12, 0.6, 5) - 0.05 * fbm(x, z), -box(x, y, z, -57, 0.6, 44, 11.5, 1, 4.5)), ID.wall);   // the yard wall
  }));
  place("q_haldane", [-50, 0, 36], "Haldane Yard: the barn and the kitchen in the hands' barn");
  W.add(K.shape([-44, 0, 24, -28, 12, 40], (x, y, z, T) => { T(box(x, y, z, -36, 4, 32, 6, 4, 6), ID.brickdark); T(gable(x, y, z, -36, 8, 32, 6.3, 6.3, 3), ID.roof); T(box(x, y, z, -36, 1.4, 25.9, 1.2, 1.4, 0.1), ID.darkwood); }));
  W.add(K.paraffin(-34.5, 2.6, 25.9, 0, false, 6)); L.push({ pos: [-34.5, 2.55, 26.4], type: 1, I: 6, reach: 12, key: "granary", group: "lantern" });
  place("q_granary", [-36, 0, 23], "the district granary");
  // Tilney Road north to the home, with its railings; the burial ground on the hill's shoulder beyond
  W.add(K.shape([-14, 0, -76, 14, 14, -58], (x, y, z, T) => { const y0 = hgt(0, -66); T(box(x, y, z, 0, y0 + 5, -70, 12, 5, 4), ID.brickdark); T(box(x, y, z, 0, y0 + 10.3, -70, 12.2, 0.3, 4.4), ID.bone); for (let k = 0; k < 9; k++) for (let r = 0; r < 3; r++) T(box(x, y, z, -10 + k * 2.5, y0 + 2 + r * 3, -65.95, 0.4, 0.8, 0.05), (k + r) % 4 === 1 ? ID.windowdim : ID.glass); }));
  W.add(K.railing([[-12, -63], [-1, -63]], hgt(0, -63), 1.5, 2)); W.add(K.railing([[1, -63], [12, -63]], hgt(0, -63), 1.5, 2));
  place("q_tilney", [0, 0, -61], "the Furrow Church's home on Tilney Road");
  W.add(K.shape([18, 0, -100, 48, 30, -76], (x, y, z, T) => { for (let r = 0; r < 6; r++) for (let k = 0; k < 10; k++) { const px = 22 + k * 2.4, pz = -96 + r * 3, py = hgt(px, pz); T(box(x, y, z, px, py + 0.3, pz, 0.35, 0.3, 0.9), (r + k) % 7 === 0 ? ID.mud : ID.wall); } const wy = hgt(x, z); T(Math.max(box(x, y, z, 33, wy + 0.5, -88, 14, 0.5, 11), -box(x, y, z, 33, wy + 0.5, -88, 13.6, 2, 10.6)), ID.wall); }));   // the burial ground's rows and the low wall round it
  place("q_burial", [33, 0, -76], "the burial ground on the hill's shoulder: the new rows");
  // the post road east across the plain, its poplars, and the post at the district line far off
  for (let k = 0; k < 14; k++) { const px = 40 + k * 7, pz = (k % 2 ? 4 : -8); W.add(K.shape([px - 1, 0, pz - 1, px + 1, 10, pz + 1], (x, y, z, T) => { T(cyl(x, y, z, px, 4, pz, 0.15, 4), ID.darkwood); T(ell(x, y, z, px, 7.5, pz, 0.7, 2.6, 0.7), ID.darkwood); })); }
  W.add(K.shape([128, 0, -6, 136, 4, 2], (x, y, z, T) => { T(box(x, y, z, 131, 1.2, -4, 1.4, 1.2, 1.4), ID.plank); T(gable(x, y, z, 131, 2.4, -4, 1.6, 1.6, 1), ID.roof); T(cap(x, y, z, [132, 1.1, -2], [132, 1.0, 2], 0.08), ID.red); }));
  L.push({ pos: [131, 1.9, -2.4], type: 1, I: 5, reach: 10, key: "post", group: "lantern" });
  place("q_post", [132, 0, 0], "the road post at the district line");
  place("q_road_home", [80, 0, -2], "the post road between the line and the town");
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).concat(V.sun ? [{ pos: V.sun.pos, type: 3, I: V.sun.I, reach: 900, key: "sun", soft: V.sun.soft ?? 30 }] : [], V.fill ? [{ pos: [0, 60, 40], type: 1, I: V.fill, reach: 300, key: "fill", soft: 30 }] : []) };
}

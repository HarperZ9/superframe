// Chancel Hill: the path climbing from the quay's sodium to the Alderman's house, a white trial arc
// every few paces on both sides with a church candle at the foot of each, so nothing casts a shadow;
// the Lamplighters' station halfway up (whitewashed, its door on the path), the Municipal substation
// (a brick box, a louvred window, a padlock, a notice, the cable pole with the outside fuse, the duct
// grating), and at the top Crake's house, blinds down, the study window close to the lane's last
// lamp and the foot-wide strip of shadow under its sill. Lane along x, climbing toward -x.
// Original block-out (Low Water look work).
import { box, cyl, cap, gable, lean, sat } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

export const laneY = (x) => 0.16 * Math.max(-22, Math.min(22, -x));
const PAINTS = [ID.limewash, ID.bone, ID.teal, ID.oxblood, ID.mustard, ID.limewash, ID.cobalt];
export function hill() {
  const W = makeWorld({ cell: 2.5, margin: 0.6 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.map((v) => v.toFixed(2)).join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  // the path: setts climbing in short flights, kerbs, the hillside terraced off both sides
  W.ground((x, y, z, T) => {
    const step = (xx) => laneY(Math.round(xx / 1.2) * 1.2), ly = step(x);
    T(Math.max(y - ly, Math.abs(z) - 1.7), ID.cobble);
    T(Math.max(y - ly - 0.12, Math.abs(z) - 1.95, -(Math.abs(z) - 1.7)), ID.slab);
    T(Math.max(y - laneY(x) - (Math.abs(z) > 1.95 ? 0.45 : -3), Math.abs(z) - 30), ID.mud);
  });
  // terraced houses both sides, stepping up the hill
  for (const side of [-1, 1]) for (let k = 0; k < 9; k++) {
    const cx = 20 - k * 5.0 - (side > 0 ? 2.2 : 0), w = 2.2 + 0.3 * rnd(k, side), base = laneY(cx) + 0.45, h = 6 + 2.5 * rnd(k, side, 2);
    if (side < 0 && Math.abs(cx - 2) < 3) continue; // the station stands here
    if (side > 0 && Math.abs(cx + 10) < 3) continue; // the substation
    if (side < 0 && cx < -15) continue; // Crake's house
    add(K.house(cx, side * 4.6, w, 2.3, h, { y: base, k: (rnd(k, side, 3) - 0.5) * 0.06, id: PAINTS[(k + (side > 0 ? 3 : 0)) % PAINTS.length], seed: 60 + k * 2 + side, lit: 0.18, face: -side, door: true }));
  }
  // white arcs both sides, staggered, a church candle at each foot
  for (let x = 18; x > -18; x -= 3.6) for (const side of [-1, 1]) {
    const px = x - (side > 0 ? 1.8 : 0), py = laneY(px) + 0.12;
    add(K.arcPost(px, py, side * 2.05, 4.6, side > 0 ? Math.PI : 0, 46)); add(K.candle(px + 0.25, py, side * 1.85, 0.3, false, 2.2));
  }
  marks.lamps.push({ id: "white_arcs", kind: "white", note: "every 3.6 m both sides, x 18 to -18, z +-2.05" });
  // the Lamplighters' station: whitewashed, lit so hard the whitewash hums
  const SX = 2, SZ = -5.2, sb = laneY(SX) + 0.45;
  add(K.shape([SX - 3.8, sb - 0.5, SZ - 3.2, SX + 3.8, sb + 6.5, SZ + 3.4], (x, y, z, T) => {
    T(box(x, y, z, SX, sb + 1.9, SZ, 3.4, 1.9, 2.8), ID.limewash); T(gable(x, y, z, SX, sb + 3.8, SZ, 3.6, 3.0, 1.4), ID.roof);
    T(box(x, y, z, SX + 1.2, sb + 1.05, SZ + 2.82, 0.55, 1.05, 0.05), ID.navy); for (const wx of [SX - 1.6, SX + 2.6]) T(box(x, y, z, wx, sb + 1.7, SZ + 2.82, 0.5, 0.6, 0.04), ID.window);
    T(box(x, y, z, SX - 0.4, sb + 2.7, SZ + 2.85, 1.0, 0.18, 0.04), ID.sign); T(cap(x, y, z, [SX - 2, sb + 4.4, SZ - 1], [SX - 2, sb + 6.0, SZ - 1], 0.18), ID.chimney);
  }));
  for (const wx of [SX - 1.6, SX + 2.6]) L.push({ pos: [wx, sb + 1.7, SZ + 3.3], type: 2, I: 3, cone: [0, 0, 1], mode: 2, reach: 6, group: "window", key: `station${wx}` });
  spot("station_door", "enter", [SX + 1.2, sb, SZ + 3.3], "the Lamplighters' station door"); marks.exits.push({ id: "station", at: [SX + 1.2, sb, SZ + 3.3], note: "into the station (plate: station)" });
  // the substation: brick box, louvres, padlock, notice; the cable pole with the outside fuse; the duct grating
  const BX = -10, BZ = 4.4, bb = laneY(BX) + 0.45;
  add(K.shape([BX - 2.6, bb - 0.3, BZ - 2.4, BX + 2.6, bb + 4.6, BZ + 2.4], (x, y, z, T) => {
    T(box(x, y, z, BX, bb + 1.6, BZ, 2.0, 1.6, 1.8), ID.brickdark); T(box(x, y, z, BX, bb + 3.25, BZ, 2.15, 0.08, 1.95), ID.slab);
    T(box(x, y, z, BX - 0.8, bb + 1.05, BZ - 1.82, 0.5, 1.05, 0.05), ID.iron); T(box(x, y, z, BX - 0.45, bb + 1.05, BZ - 1.9, 0.05, 0.07, 0.04), ID.brass); T(box(x, y, z, BX - 0.8, bb + 1.6, BZ - 1.88, 0.25, 0.18, 0.01), ID.paper);
    for (let k = 0; k < 5; k++) T(box(x, y, z, BX + 1.0, bb + 1.6 + k * 0.18, BZ - 1.84, 0.45, 0.025, 0.06), ID.iron); // the louvres
  }));
  L.push({ pos: [BX + 1.0, bb + 1.9, BZ - 2.2], type: 2, I: 0.8, cone: [0, 0, -1], mode: 2, reach: 4, group: "window", key: "louvre" });
  add(K.shape([BX + 2.6, bb - 0.2, BZ - 2.4, BX + 3.4, bb + 6, BZ - 1.6], (x, y, z, T) => { T(cyl(x, y, z, BX + 3.0, bb + 2.9, BZ - 2.0, 0.11, 2.9), ID.timber); T(box(x, y, z, BX + 3.0, bb + 1.6, BZ - 2.15, 0.15, 0.22, 0.08), ID.iron); T(cap(x, y, z, [BX + 3.0, bb + 5.6, BZ - 2.0], [BX + 1.6, bb + 3.3, BZ - 1.0], 0.025), ID.tar); }));
  add(K.shape([BX - 2.0, bb - 0.05, BZ - 3.0, BX - 0.6, bb + 0.1, BZ - 2.1], (x, y, z, T) => { for (let k = 0; k < 6; k++) T(box(x, y, z, BX - 1.3, laneY(BX - 1.3) + 0.01, BZ - 2.9 + k * 0.14, 0.6, 0.02, 0.03), ID.iron); }));
  spot("substation_louvres", "cutpower", [BX + 1.0, bb, BZ - 2.4], "the second switch, hooked through the louvres with the Vane's stick (H:743)"); spot("outside_fuse", "cutpower", [BX + 3.0, bb, BZ - 2.5], "the outside fuse on the cable pole (H:873)");
  spot("candle_timer", "rig", [BX + 1.0, bb, BZ - 2.4], "the candle timer on the switch handle (H:744)"); spot("duct_grating", "pry", [BX - 1.3, bb, BZ - 2.5], "the cable duct's grating (H:958)");
  // Crake's house at the top: blinds down, the study window by the last lamp, the strip under the sill
  const CX = -19, CZ = -5.0, cb = laneY(CX) + 0.45;
  add(K.shape([CX - 4.4, cb - 0.3, CZ - 3.4, CX + 4.4, cb + 10, CZ + 3.0], (x, y, z, T) => {
    T(box(x, y, z, CX, cb + 3.4, CZ, 4.0, 3.4, 2.8), ID.bone); T(gable(x, y, z, CX, cb + 6.8, CZ, 4.2, 3.0, 2.0), ID.roof);
    T(box(x, y, z, CX - 2.2, cb + 1.15, CZ + 2.82, 0.6, 1.15, 0.05), ID.navy); T(box(x, y, z, CX - 2.2, cb + 0.1, CZ + 3.2, 0.9, 0.1, 0.4), ID.steps);
    T(box(x, y, z, CX + 2.0, cb + 1.6, CZ + 2.82, 0.7, 0.75, 0.04), ID.windowdim); T(box(x, y, z, CX + 2.0, cb + 0.8, CZ + 2.95, 0.85, 0.05, 0.16), ID.slab); // the study window and its sill
    for (const wx of [CX - 0.4, CX + 2.0]) T(box(x, y, z, wx, cb + 4.6, CZ + 2.82, 0.55, 0.7, 0.04), ID.glass);
    T(cap(x, y, z, [CX + 2.8, cb + 7.2, CZ - 1], [CX + 2.8, cb + 9.4, CZ - 1], 0.22), ID.chimney);
  }));
  L.push({ pos: [CX + 2.0, cb + 1.6, CZ + 3.2], type: 1, I: 2.2, cone: [0, 0, 1], mode: 2, reach: 5, group: "window", key: "study" });
  marks.hides.push({ id: "sill_strip", at: [CX + 2.0, cb, CZ + 3.0], r: 0.3, note: "the only shadow on the lane: a foot wide, under the study sill (H:523)" });
  spot("study_window", "eavesdrop", [CX + 2.0, cb, CZ + 3.3], "the study window and its blind (H:159)"); spot("crake_side", "enter", [CX - 3.9, cb, CZ + 1.0], "Crake's side door, on the latch (H:818)");
  marks.exits.push({ id: "quay", at: [21, laneY(21), 0], note: "down to the quay: the white ends and the sodium begins" }, { id: "gasholder", at: [-22, laneY(-22), 0], note: "on to the Gasholder gate" });
  // at the foot, the first sodium post: the white stops, the orange begins
  add(K.sodiumPost(21.5, laneY(21.5) + 0.12, 2.0, 4.7, Math.PI));
  return { world: W.build(), lights: (V = {}) => {
    const o = []; for (const l of L) { const f = V.emit && l.group in V.emit ? V.emit[l.group] : 1; if (f > 0) o.push({ ...l, I: l.I * f }); }
    if (V.moon) o.push({ pos: V.moon.pos, type: 2, I: V.moon.I, reach: 400, key: "moon", soft: 30 });
    if (V.sun) o.push({ pos: V.sun.pos, type: 3, I: V.sun.I, reach: 600, key: "sun", soft: 40 });
    return o;
  }, marks };
}

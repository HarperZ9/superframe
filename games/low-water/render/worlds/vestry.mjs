// Brother Ash's vestry at the Gasholder (Act 2, place gas_vestry; content/act2/gasholder.lwd): the old
// valve house. A desk with the ledger bound in red cloth, a padlocked poor box, a rack of spare bell jars,
// a bench along the wall, the old gas main and its valve wheel coming through the floor, candles. About
// 4 m by 3.2 m. Original block-out.
import { box, cyl, ell } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function vestry() {
  const W = makeWorld({ cell: 1.0, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 2.0, HZ = 1.6, H = 2.9, wood = ID.darkwood || ID.timber;
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.slab, wall: ID.brickdark, wallNear: ID.brickdark, sill: 0.4, cuts: [[-HX - 0.1, 1.0, -0.6, 0.3, 1.0, 0.45]] });
    T(box(x, y, z, -HX - 0.3, 1.0, -0.6, 0.05, 1.0, 0.45), wood);   // the door to the frame, shut
    // the old gas main through the floor and up the back wall, its valve wheel
    T(cyl(x, y, z, 1.3, 1.4, -1.35, 0.13, 1.4), ID.rust); T(box(x, y, z, 1.3, 0.05, -1.35, 0.3, 0.05, 0.3), ID.iron);
  });
  add(K.shape([1.0, 0.9, -1.2, 1.6, 1.5, -0.9], (x, y, z, T) => { const d = Math.hypot(x - 1.3, y - 1.2), ring = Math.max(Math.abs(d - 0.22) - 0.022, Math.abs(z + 1.05) - 0.02), spokes = Math.max(Math.min(Math.abs(x - 1.3), Math.abs(y - 1.2)) - 0.015, d - 0.22, Math.abs(z + 1.05) - 0.015); T(Math.min(ring, spokes), ID.iron); }));
  spot("valve", "use", [1.3, 0, -0.7], "the old valve wheel on the gas main");
  // the desk with the red ledger (open, the ink wet), the pen, a candle
  add(K.table(-0.2, 0, -1.1, 0.7, 0.35, 0.78, 0, wood));
  add(K.shape([-0.9, 0.78, -1.45, 0.5, 1.2, -0.75], (x, y, z, T) => { T(box(x, y, z, -0.3, 0.8, -1.05, 0.22, 0.015, 0.15), ID.paper); T(box(x, y, z, -0.3, 0.795, -1.05, 0.24, 0.012, 0.17), ID.red); T(cyl(x, y, z, 0.25, 0.86, -1.25, 0.03, 0.08), ID.wax); T(ell(x, y, z, 0.25, 0.97, -1.25, 0.012, 0.025, 0.012), ID.candle); }));
  L.push({ pos: [0.25, 1.0, -1.2], type: 1, I: 4, reach: 4, group: "candle", key: "deskcandle" });
  spot("ledger", "read", [-0.3, 0, -0.5], "Ash's ledger bound in red cloth");
  // the padlocked poor box on its post
  add(K.shape([0.7, 0, 0.6, 1.2, 1.1, 1.1], (x, y, z, T) => { T(box(x, y, z, 0.95, 0.4, 0.85, 0.06, 0.4, 0.06), wood); T(box(x, y, z, 0.95, 0.92, 0.85, 0.2, 0.14, 0.16), wood); T(box(x, y, z, 0.95, 0.9, 1.02, 0.04, 0.05, 0.015), ID.iron); }));
  spot("poor_box", "use", [0.95, 0, 1.3], "the padlocked poor box");
  // the rack of spare bell jars on the left wall
  add(K.shape([-2.0, 0, -0.2, -1.5, 2.0, 1.4], (x, y, z, T) => { for (const sy of [0.5, 1.2]) T(box(x, y, z, -1.78, sy, 0.6, 0.2, 0.02, 0.75), wood); }));
  for (const sy of [0.52, 1.22]) for (let k = 0; k < 4; k++) add(K.bellJar(-1.78, sy, 0.0 + k * 0.38, 0.12, 0.22));
  spot("jars", "use", [-1.3, 0, 0.6], "the rack of spare bell jars");
  // the bench along the front, where a hurt man lies with a cold cloth
  add(K.shape([-1.4, 0, 1.0, 0.4, 0.6, 1.5], (x, y, z, T) => { T(box(x, y, z, -0.5, 0.45, 1.25, 0.85, 0.03, 0.2), wood); for (const a of [-1.25, 0.25]) T(box(x, y, z, a, 0.22, 1.25, 0.03, 0.22, 0.17), wood); }));
  spot("bench", "wait", [-0.5, 0, 0.8], "the bench: a cold cloth, straw smoke");
  // candles on a shelf by the main: the room's warm light
  add(K.candle(1.7, 1.5, -0.4, 0.2, true, 5)); add(K.candle(1.7, 1.5, -0.1, 0.16, true, 4));
  add(K.shape([1.55, 1.4, -0.7, 2.0, 1.55, 0.2], (x, y, z, T) => T(box(x, y, z, 1.8, 1.47, -0.25, 0.18, 0.02, 0.4), wood)));
  marks.exits.push({ id: "frame", at: [-1.6, 0, -0.6], note: "out to the gasholder frame" });
  marks.hides.push({ id: "behind_main", at: [1.7, 0, -1.2], r: 0.3, note: "behind the gas main" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [0.4, 2.2, 1.0], type: 1, I: V.fill, reach: 7, group: "fill", key: "fill" }] : []) };
}

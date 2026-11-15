// The Guild hall (design/PLACES-NEW.md section 2): a long low hall, about 12 m by 5 m; a scrubbed table
// down the middle with benches both sides, a barrel on a trestle, the door to the lane at the foot, two
// brass pans on chains over the table, the brass words over the head of the table with the scratched line
// under them, Shadwell's back door into the smoke. Two hanging lamps and a candle at the head.
// Original block-out. The long axis runs along x; the head of the table at -x.
import { box, cyl, cap, ell } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function hallRoom() {
  const W = makeWorld({ cell: 1.2, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 6, HZ = 2.5, H = 2.9;
  W.ground((x, y, z, T) => shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.brickdark, wallNear: ID.timber, beams: { n: 6, id: ID.darkwood },
    cuts: [[HX + 0.1, 1.05, 0.9, 0.3, 1.05, 0.5], [-HX - 0.1, 1.0, 1.6, 0.3, 1.0, 0.45]] }));   // the lane door at the foot (+x), the back door at the head (-x)
  // the table down the middle and the benches either side
  add(K.table(0, 0, 0, 4.4, 0.55, 0.78, 0, ID.timber));
  add(K.table(0, 0, -1.1, 4.2, 0.17, 0.45, 0, ID.darkwood)); add(K.table(0, 0, 1.1, 4.2, 0.17, 0.45, 0, ID.darkwood));
  spot("bench", "climb", [1.6, 0, 1.1], "a bench to stand on and tell the hall about Agnes Spratt");
  spot("line", "wait", [2.5, 0, 1.8], "where the blindfolded line forms for the vote");
  // the head of the table: Marrow's chair, the candle, the brass plate and its scratched words
  add(K.shape([-5.2, 0, -0.5, -4.4, 1.3, 0.5], (x, y, z, T) => { T(box(x, y, z, -4.8, 0.45, 0, 0.26, 0.04, 0.26), ID.darkwood); T(box(x, y, z, -5.04, 0.9, 0, 0.03, 0.45, 0.26), ID.darkwood); for (const [a, b] of [[-0.2, -0.2], [-0.2, 0.2], [0.2, -0.2], [0.2, 0.2]]) T(cyl(x, y, z, -4.8 + a, 0.22, b, 0.025, 0.22), ID.darkwood); }));
  spot("head", "talk", [-4.4, 0, 0.0], "Marrow's place at the head of the table");
  add(K.candle(-4.1, 0.78, 0.0, 0.2, false, 6));
  add(K.shape([-6.0, 1.7, -1.2, -5.85, 2.5, 1.2], (x, y, z, T) => { T(box(x, y, z, -5.92, 2.15, 0, 0.03, 0.18, 0.9), ID.brass); T(box(x, y, z, -5.91, 1.88, 0, 0.02, 0.05, 0.75), ID.chalk); }));
  spot("plate", "read", [-5.2, 0, 0.6], "the brass words over the head of the table, AND NEVER FOR THE SEA scratched under them");
  // the two brass pans on chains from hooks in the beams, turning over the table
  for (const [px, k] of [[-1.2, 0], [1.2, 1]]) {
    add(K.rope([px, H - 0.05, 0], [px, 1.75, 0], 0.0, 0.012, ID.iron));
    add(K.shape([px - 0.45, 1.5, -0.45, px + 0.45, 1.8, 0.45], (x, y, z, T) => { const e = ell(x, y, z, px, 1.62, 0, 0.38, 0.09, 0.38); T(Math.max(e, -ell(x, y, z, px, 1.68, 0, 0.35, 0.09, 0.35)), ID.brass); }));
    void k;
  }
  spot("pans", "read", [0, 0, 0.75], "the two pans turning on their hooks: pull them down, smell the two fish");
  // two hanging lamps over the table
  for (const lx of [-2.8, 2.8]) { add(K.rope([lx, H - 0.05, 0], [lx, 2.1, 0], 0.0, 0.01, ID.iron)); add(K.shape([lx - 0.2, 1.8, -0.2, lx + 0.2, 2.15, 0.2], (x, y, z, T) => { T(ell(x, y, z, lx, 1.98, 0, 0.11, 0.14, 0.11), ID.lantern); T(cyl(x, y, z, lx, 2.13, 0, 0.13, 0.02), ID.iron); })); L.push({ pos: [lx, 1.95, 0], type: 1, I: 9, reach: 8, group: "lantern", key: `hall${lx}` }); }
  // the barrel on a trestle by the lane door, aprons on pegs along the back wall
  add(K.table(4.9, 0, -1.7, 0.5, 0.35, 0.55, 0, ID.timber)); add(K.barrel(4.9, 0.55, -1.7, 0.32, 0.8, true, 0));
  for (let k = 0; k < 9; k++) add(K.shape([-4 + k * 0.9 - 0.2, 1.0, -2.5, -4 + k * 0.9 + 0.2, 1.8, -2.3], (x, y, z, T) => T(box(x, y, z, -4 + k * 0.9, 1.35, -2.42, 0.17, 0.4, 0.02), k % 3 ? ID.navy : ID.oilskin)));
  marks.exits.push({ id: "lane", at: [5.6, 0, 0.9], note: "the door to the lane at the foot of the hall" }, { id: "smoke", at: [-5.6, 0, 1.6], note: "Shadwell's back door into the smoke" });
  spot("back_door", "sneak", [-5.3, 0, 1.6], "Shadwell's back door, to watch from the smoke");
  marks.hides.push({ id: "foot_shadow", at: [5.2, 0, 2.0], r: 0.6, note: "the dark at the foot of the hall by the barrel" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [0, 2.6, 0], type: 1, I: V.fill, reach: 12, group: "fill", key: "fill" }] : []).concat(V.struck ? [{ pos: [0.5, 1.5, 1.4], type: 1, I: 5, reach: 5, group: "struck", key: "struck" }] : []) };
}

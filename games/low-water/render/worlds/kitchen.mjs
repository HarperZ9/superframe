// Two Tarn kitchens of The Quota's era 2 slice (design/quota/07-PRODUCTION.md), at the evening meal.
//   furrowe: the district inspector's house on Exchange Street: a black range, a dresser with plates still on it,
//     an oilcloth on the table, four places laid (Ned, Mary, Pell, old Abel) with bread and a pot, the paraffin
//     lamp lit, Abel's good hat on its peg by the door, the inspector's satchel on a chair.
//   brack: the militia sergeant's house on Mill Street: narrower, a stair up the back wall with the cupboard under
//     it (the door ajar: the son's place in "the house"), a plain table with a bottle, three places, a candle,
//     the rifle by the door, the greatcoat on its peg, the stove small.
// Near walls cut away (shell). Original block-out.
//   kitchen({ who: "furrowe" | "brack" })
import { box, cyl, ell, cap } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function kitchen({ who = "furrowe" } = {}) {
  const W = makeWorld({ cell: 1.2, margin: 0.35 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] }, fur = who === "furrowe";
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = fur ? 2.9 : 2.3, HZ = fur ? 2.3 : 2.0, H = fur ? 2.7 : 2.4;
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: fur ? ID.slab : ID.boards, wall: fur ? ID.plaster : ID.limewash, wallNear: ID.brick, sill: 0.4, beams: fur ? null : { n: 2, id: ID.timber }, cuts: [[fur ? 1.2 : -0.9, 1.55, -HZ - 0.12, 0.38, 0.45, 0.3], [-HX - 0.12, 1.0, 1.4, 0.3, 1.0, 0.45]] });
    if (fur) T(box(x, y, z, 0, 0.45, -HZ + 0.03, HX + 0.2, 0.45, 0.04), ID.teal);   // a painted dado: they could afford paint once
  });
  // the window on the street
  const wx = fur ? 1.2 : -0.9;
  W.add(K.shape([wx - 0.5, 1.0, -HZ - 0.3, wx + 0.5, 2.1, -HZ + 0.15], (x, y, z, T) => {
    T(box(x, y, z, wx, 1.55, -HZ - 0.1, 0.36, 0.43, 0.02), ID.glass);   // the street outside is dark: glass, not a lit window
    T(Math.max(box(x, y, z, wx, 1.55, -HZ - 0.08, 0.4, 0.47, 0.03), -box(x, y, z, wx, 1.55, -HZ - 0.08, 0.35, 0.42, 0.1)), ID.timber);
    T(box(x, y, z, wx, 1.55, -HZ - 0.07, 0.015, 0.45, 0.02), ID.timber);
    T(box(x, y, z, wx, 1.08, -HZ + 0.02, 0.45, 0.03, 0.1), ID.timber);
  }));
  // the stove: a black range (Furrowe) or a small iron stove (Brack), its fire showing
  W.add(K.shape([-HX - 0.1, 0, -1.8, -HX + 0.9, 2.6, -0.3], (x, y, z, T) => {
    if (fur) { T(box(x, y, z, -HX + 0.35, 0.45, -1.05, 0.33, 0.45, 0.6), ID.stove); T(box(x, y, z, -HX + 0.69, 0.32, -1.05, 0.02, 0.1, 0.16), ID.stovefire); T(box(x, y, z, -HX + 0.35, 0.92, -1.05, 0.35, 0.02, 0.62), ID.iron); T(cyl(x, y, z, -HX + 0.35, 1.05, -1.3, 0.13, 0.12), ID.iron); T(box(x, y, z, -HX + 0.2, 1.8, -1.05, 0.18, 0.85, 0.35), ID.brickdark); }
    else { T(cyl(x, y, z, -HX + 0.4, 0.33, -1.05, 0.24, 0.33), ID.stove); T(box(x, y, z, -HX + 0.63, 0.28, -1.05, 0.02, 0.08, 0.1), ID.stovefire); T(cap(x, y, z, [-HX + 0.4, 0.66, -1.05], [-HX + 0.4, 2.4, -1.05], 0.06), ID.stove); }
  }));
  L.push({ pos: [-HX + 0.9, 0.35, -1.05], type: 1, I: fur ? 3 : 1.8, cone: [1, 0, 0], mode: 2, reach: 4, key: "stove", group: "fire" });
  // the table and its places
  const TX = fur ? 0.4 : 0.2, TZ = fur ? 0.1 : 0.0, places = fur ? [[-0.45, 0.1], [0.4, -0.3], [1.25, 0.1], [0.4, 0.5]] : [[-0.35, 0.0], [0.6, -0.25], [0.6, 0.3]];
  W.add(K.table(TX, 0, TZ, fur ? 1.05 : 0.85, fur ? 0.55 : 0.45, 0.76, 0));
  for (const [px, pz] of places) W.add(K.stool(TX + px * 1.25 - (px < 0 ? 0.25 : px > 1 ? -0.25 : 0), 0, TZ + pz * 1.6, 0.17, 0.46));
  W.add(K.shape([TX - 1.1, 0.74, TZ - 0.6, TX + 1.1, 1.05, TZ + 0.6], (x, y, z, T) => {
    if (fur) T(box(x, y, z, TX, 0.765, TZ, 1.0, 0.006, 0.52), ID.oxblood);   // the oilcloth
    for (const [px, pz] of places) T(Math.max(ell(x, y, z, TX + px, 0.8, TZ + pz, 0.13, 0.02, 0.13), -(y - 0.79)), fur ? ID.bonecloth : ID.darkwood);
    if (fur) { T(Math.max(cyl(x, y, z, TX + 0.4, 0.86, TZ + 0.1, 0.16, 0.09), -cyl(x, y, z, TX + 0.4, 0.9, TZ + 0.1, 0.14, 0.09)), ID.iron); T(ell(x, y, z, TX - 0.2, 0.8, TZ - 0.15, 0.17, 0.06, 0.09), ID.straw); }
    else { T(cyl(x, y, z, TX + 0.1, 0.9, TZ - 0.1, 0.04, 0.14), ID.bottle); T(cyl(x, y, z, TX + 0.25, 0.82, TZ + 0.05, 0.035, 0.05), ID.glass); }
  }));
  spot("table", "sit", [TX, 0, TZ + 1.0], fur ? "the Furrowe table: four places, bread and the pot (the 4.1 dinner)" : "the Brack table: three places, the bottle");
  if (fur) {
    // the paraffin lamp lit on the table; the dresser with its plates; Abel's good hat; the satchel on a chair
    W.add(K.paraffin(TX + 0.75, 0.76, TZ - 0.25, 0, false, 12));
    L.push({ pos: [TX + 0.75, 1.0, TZ - 0.25], type: 1, I: 12, reach: 7, key: "lamp", group: "lantern" });
    W.add(K.shape([-0.9, 0, -HZ - 0.05, 0.4, 2.2, -HZ + 0.5], (x, y, z, T) => {
      T(box(x, y, z, -0.25, 0.45, -HZ + 0.25, 0.6, 0.45, 0.22), ID.darkwood); T(box(x, y, z, -0.25, 1.5, -HZ + 0.1, 0.6, 0.6, 0.06), ID.darkwood);
      for (const sy of [1.25, 1.65]) { T(box(x, y, z, -0.25, sy, -HZ + 0.17, 0.58, 0.015, 0.08), ID.timber); for (let k = 0; k < 5; k++) T(ell(x, y, z, -0.7 + k * 0.22, sy + 0.11, -HZ + 0.13, 0.095, 0.095, 0.012), ID.bonecloth); }
    }));
    W.add(K.shape([-HX - 0.05, 1.5, 1.7, -HX + 0.35, 1.95, 2.2], (x, y, z, T) => { T(cap(x, y, z, [-HX, 1.7, 1.95], [-HX + 0.12, 1.7, 1.95], 0.012), ID.timber); T(cyl(x, y, z, -HX + 0.17, 1.74, 1.95, 0.15, 0.012), ID.navy); T(cyl(x, y, z, -HX + 0.17, 1.8, 1.95, 0.09, 0.07), ID.navy); T(cyl(x, y, z, -HX + 0.17, 1.79, 1.95, 0.092, 0.015), ID.brass); }));
    spot("good_hat", "read", [-HX + 0.7, 0, 1.95], "Abel's good hat on its peg: the brass band he polishes");
    W.add(K.stool(2.2, 0, -1.4, 0.2, 0.46)); W.add(K.shape([2.0, 0.45, -1.6, 2.4, 0.8, -1.2], (x, y, z, T) => T(box(x, y, z, 2.2, 0.6, -1.4, 0.16, 0.12, 0.06), ID.case)));
    spot("satchel", "read", [2.2, 0, -0.9], "the inspector's satchel: the district figures, and the blank form");
  } else {
    // the stair up the back wall and the cupboard under it, its door ajar; the rifle by the door; the greatcoat
    W.add(K.shape([0.6, 0, -HZ - 0.05, HX + 0.05, H + 0.1, -HZ + 0.9], (x, y, z, T) => {
      for (let k = 0; k < 9; k++) T(box(x, y, z, 0.8 + k * 0.17, 0.12 + k * 0.26, -HZ + 0.45, 0.1, 0.12 + k * 0.13, 0.42), ID.timber);
      T(Math.max(box(x, y, z, 1.55, 0.6, -HZ + 0.88, 0.55, 0.6, 0.02), -(y - 0.25 - (x - 0.9) * 1.5)), ID.darkwood);   // the cupboard's front under the stair
      T(box(x, y, z, 1.3, 0.55, -HZ + 1.05, 0.02, 0.5, 0.2), ID.darkwood);   // its door, ajar
    }));
    spot("under_stairs", "hide", [1.4, 0, -HZ + 1.3], "the cupboard under the stairs, its door ajar");
    marks.hides.push({ id: "under_stairs", at: [1.6, 0, -HZ + 0.4], r: 0.4, note: "the cupboard under the stairs" });
    W.add(K.shape([-HX - 0.05, 0, 0.6, -HX + 0.35, 2.0, 1.0], (x, y, z, T) => { T(cap(x, y, z, [-HX + 0.12, 0.02, 0.8], [-HX + 0.08, 1.3, 0.8], 0.025), ID.darkwood); T(cap(x, y, z, [-HX + 0.08, 0.9, 0.8], [-HX + 0.07, 1.25, 0.8], 0.012), ID.iron); }));
    spot("rifle", "read", [-HX + 0.6, 0, 0.8], "the rifle by the door, unloaded on the rack (the rounds are counted)");
    W.add(K.shape([-HX - 0.05, 0.8, 1.9, -HX + 0.3, 1.9, 2.3], (x, y, z, T) => { T(cap(x, y, z, [-HX, 1.75, 2.1], [-HX + 0.1, 1.75, 2.1], 0.012), ID.timber); T(Math.max(ell(x, y, z, -HX + 0.12, 1.3, 2.1, 0.09, 0.48, 0.2), -(y - 1.75)), ID.navy); }));
    W.add(K.candle(TX + 0.2, 0.76, TZ - 0.2, 0.12, false, 2)); L.push({ pos: [TX + 0.2, 0.93, TZ - 0.2], type: 1, I: 3, reach: 6, key: "candle" });
  }
  marks.exits.push({ id: "street", at: [-HX + 0.4, 0, 1.4], note: fur ? "the door to Exchange Street" : "the door to Mill Street" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => l.I > 0).concat(V.window ? [{ pos: [wx, 1.6, -HZ - 1.2], type: 1, I: V.window, cone: [0, -0.1, 1], mode: 2, reach: 8, key: "window", soft: 1.2 }] : [], V.fill ? [{ pos: [0.5, 2.0, 0.5], type: 1, I: V.fill, reach: 9, key: "fill", soft: 2 }] : []) };
}

// The Haldane table (The Quota, era 2, day 41 of the famine winter; design/quota/07-PRODUCTION.md, the narrow
// lens). A room made out of the end of a hands' barn in Haldane Yard: limewashed boards over a brick plinth, a
// low ceiling on two beams, one small window on the yard with frost on its lower panes, the hearth with its
// pot hook and the embers kept in, a plank table with a bench and stools, the bowls (five in the morning; in
// the coda, four, the fifth turned over on the shelf and its stool pushed to the wall), the Well shelf with
// the shared cup and a water jug (the Hesh water faith), empty sacks on pegs, the ration card on its nail, a
// felt hanging by the bed-curtain. The near walls are cut away (shell). Original block-out.
//   haldane({ set: "morning" | "coda" })
import { box, cyl, sph, ell, cap } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function haldane({ set = "morning" } = {}) {
  const W = makeWorld({ cell: 1.2, margin: 0.35 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] }, coda = set === "coda";
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 2.9, HZ = 2.3, H = 2.5;
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.limewash, wallNear: ID.brick, sill: 0.4, beams: { n: 2, id: ID.timber }, cuts: [[-0.6, 1.5, -HZ - 0.12, 0.4, 0.42, 0.3], [-HX - 0.12, 1.0, 1.3, 0.3, 1.0, 0.5]] });
    T(Math.max(box(x, y, z, 0, 0.3, -HZ + 0.02, HX + 0.2, 0.3, 0.1), -box(x, y, z, -HX - 0.12, 1.0, 1.3, 0.3, 1.0, 0.5)), ID.brick);   // the brick plinth under the limewash
    T(Math.max(box(x, y, z, -HX + 0.02, 0.3, 0, 0.1, 0.3, HZ + 0.2), -box(x, y, z, -HX - 0.12, 1.0, 1.3, 0.3, 1.0, 0.5)), ID.brick);
  });
  // the window on the yard: four panes, frost on the lower two; its sill
  W.add(K.shape([-1.1, 1.0, -HZ - 0.3, -0.1, 2.0, -HZ + 0.15], (x, y, z, T) => {
    T(box(x, y, z, -0.6, 1.5, -HZ - 0.1, 0.38, 0.4, 0.02), ID.window);
    T(Math.max(box(x, y, z, -0.6, 1.5, -HZ - 0.08, 0.4, 0.42, 0.03), -box(x, y, z, -0.6, 1.5, -HZ - 0.08, 0.36, 0.38, 0.1)), ID.timber);
    T(box(x, y, z, -0.6, 1.5, -HZ - 0.07, 0.015, 0.4, 0.02), ID.timber); T(box(x, y, z, -0.6, 1.5, -HZ - 0.07, 0.4, 0.015, 0.02), ID.timber);
    T(box(x, y, z, -0.6, 1.3, -HZ - 0.075, 0.36, 0.17, 0.008), ID.ice);   // frost on the lower panes
    T(box(x, y, z, -0.6, 1.07, -HZ + 0.02, 0.45, 0.03, 0.1), ID.timber);
  }));
  // the hearth in the left wall: brick cheeks, an iron pot on its hook, the embers kept in under ash
  W.add(K.shape([-HX - 0.1, 0, -1.6, -HX + 0.8, 2.5, -0.2], (x, y, z, T) => {
    for (const cz of [-1.4, -0.4]) T(box(x, y, z, -HX + 0.25, 0.6, cz, 0.25, 0.6, 0.12), ID.brick);
    T(box(x, y, z, -HX + 0.25, 1.3, -0.9, 0.3, 0.12, 0.62), ID.timber);   // the mantel beam
    T(box(x, y, z, -HX + 0.1, 0.05, -0.9, 0.18, 0.05, 0.38), ID.coal);
    T(ell(x, y, z, -HX + 0.18, 0.1, -0.9, 0.14, 0.04, 0.22), ID.stovefire);   // embers
    T(cap(x, y, z, [-HX + 0.15, 1.18, -0.9], [-HX + 0.3, 0.75, -0.9], 0.012), ID.iron);
    T(Math.max(sph(x, y, z, -HX + 0.32, 0.55, -0.9, 0.17), y - 0.66), ID.iron);   // the pot
    T(box(x, y, z, -HX + 0.25, 1.9, -0.9, 0.2, 0.6, 0.3), ID.brickdark);   // the flue breast
  }));
  L.push({ pos: [-HX + 0.4, 0.2, -0.9], type: 1, I: coda ? 0.7 : 1.1, reach: 4, key: "embers", group: "fire" });
  spot("hearth", "read", [-HX + 0.9, 0, -0.9], "the hearth: the embers kept in under ash, the pot on its hook");
  // the table, its bench along the back, and the stools; the bowls (five, or four and one turned over)
  W.add(K.table(0.3, 0, -0.1, 1.05, 0.45, 0.76, 0));
  W.add(K.table(0.3, 0, -0.85, 1.0, 0.16, 0.44, 0));
  const stools = coda ? [[-0.6, 0.35], [0.4, 0.62], [1.25, 0.35], [2.4, -1.7]] : [[-0.6, 0.35], [0.0, 0.62], [0.75, 0.62], [1.35, 0.3]];
  for (const [sx, sz] of stools) W.add(K.stool(sx, 0, sz, 0.17, 0.46));
  const bowls = coda ? [[-0.45, 0.05], [0.15, -0.35], [0.45, 0.15], [1.05, -0.05]] : [[-0.45, 0.05], [0.0, 0.2], [0.15, -0.35], [0.7, 0.2], [1.05, -0.05]];
  W.add(K.shape([-0.8, 0.74, -0.6, 1.4, 0.95, 0.4], (x, y, z, T) => {
    for (const [bx, bz] of bowls) {
      const b = ell(x, y, z, bx, 0.83, bz, 0.12, 0.07, 0.12); T(Math.max(b, -ell(x, y, z, bx, 0.86, bz, 0.105, 0.06, 0.105), y - 0.85), ID.darkwood);
      T(Math.max(ell(x, y, z, bx, 0.8, bz, 0.1, 0.04, 0.1), y - 0.815), ID.bonecloth);   // a thin grey gruel, little of it
    }
    T(box(x, y, z, 0.3, 0.8, -0.15, 0.12, 0.03, 0.07), ID.straw);   // the heel of a loaf, black bread
    T(cyl(x, y, z, -0.1, 0.83, -0.25, 0.05, 0.07), ID.iron);   // the salt
  }));
  spot("table", "sit", [0.3, 0, 0.9], coda ? "the table, four bowls: the fifth turned over on the shelf, its stool by the wall" : "the table, five bowls, the gruel thin");
  // the Well shelf by the window: the shared cup, the water jug, a folded cloth; in the coda the fifth bowl turned over on it
  W.add(K.shape([0.6, 1.2, -HZ - 0.05, 2.0, 1.75, -HZ + 0.35], (x, y, z, T) => {
    T(box(x, y, z, 1.3, 1.3, -HZ + 0.14, 0.6, 0.025, 0.16), ID.timber);
    T(Math.max(cyl(x, y, z, 1.0, 1.4, -HZ + 0.16, 0.05, 0.08), -cyl(x, y, z, 1.0, 1.45, -HZ + 0.16, 0.042, 0.08)), ID.brass);   // the shared cup
    T(Math.max(ell(x, y, z, 1.35, 1.46, -HZ + 0.14, 0.09, 0.15, 0.09), -ell(x, y, z, 1.35, 1.5, -HZ + 0.14, 0.07, 0.14, 0.07)), ID.cobalt);   // the water jug
    T(box(x, y, z, 1.7, 1.34, -HZ + 0.14, 0.12, 0.02, 0.1), ID.canvas);
    if (coda) T(Math.max(ell(x, y, z, 1.68, 1.4, -HZ + 0.14, 0.12, 0.07, 0.12), -(y - 1.33)), ID.darkwood);   // the fifth bowl, turned over
  }));
  spot("well_shelf", "read", [1.3, 0, -1.6], "the Well shelf: the shared cup, the water jug" + (coda ? ", and a bowl turned over" : ""));
  // empty sacks on pegs on the left wall; the ration card on its nail by the door
  W.add(K.shape([-HX - 0.05, 0.9, 0.2, -HX + 0.3, 2.0, 1.0], (x, y, z, T) => {
    T(box(x, y, z, -HX + 0.06, 1.85, 0.6, 0.04, 0.03, 0.4), ID.timber);
    for (const pz of [0.35, 0.62, 0.88]) T(Math.max(ell(x, y, z, -HX + 0.1, 1.5, pz, 0.05, 0.36, 0.12), -(y - 1.85)), ID.sack);
  }));
  W.add(K.shape([-HX - 0.05, 1.3, 1.85, -HX + 0.1, 1.7, 2.1], (x, y, z, T) => { T(box(x, y, z, -HX + 0.03, 1.5, 1.98, 0.01, 0.1, 0.07), ID.paper); T(sph(x, y, z, -HX + 0.04, 1.62, 1.98, 0.012), ID.iron); }));
  spot("ration_card", "read", [-HX + 0.6, 0, 1.9], "the ration card on its nail: this week's stamp, and the space for next week's");
  // the bed-curtain at the back right and the felt hanging beside it (the Hesh side of the house)
  W.add(K.shape([1.8, 0, -HZ - 0.05, HX + 0.05, 2.2, -0.6], (x, y, z, T) => {
    T(box(x, y, z, 2.45, 0.25, -1.55, 0.45, 0.25, 0.7), ID.timber); T(ell(x, y, z, 2.45, 0.52, -1.55, 0.42, 0.08, 0.66), ID.canvas);
    T(box(x, y, z, 2.0, 1.15, -1.5, 0.02 + 0.015 * Math.sin(z * 18), 1.0, 0.75), ID.oxblood);   // the curtain
    T(box(x, y, z, 2.5, 1.55, -HZ + 0.05, 0.35, 0.45, 0.02), ID.teal);   // the felt hanging, a blue thread through it
  }));
  marks.exits.push({ id: "yard", at: [-HX + 0.4, 0, 1.3], note: "the door to Haldane Yard" });
  marks.hides.push({ id: "behind_curtain", at: [2.5, 0, -1.4], r: 0.5, note: "behind the bed-curtain" });
  if (coda) { W.add(K.candle(0.75, 0.76, -0.25, 0.14, false, 2)); L.push({ pos: [0.75, 0.95, -0.25], type: 1, I: 2.4, reach: 6, key: "candle" }); }
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => l.I > 0).concat(
    V.window ? [{ pos: [-0.6, 1.6, -HZ - 1.2], type: V.windowType ?? 3, I: V.window, cone: [0.15, -0.35, 1], mode: 2, reach: 9, key: "window", soft: 1.2 }] : [],
    V.sun ? [{ pos: V.sun.pos, type: 3, I: V.sun.I, reach: 400, key: "sun", soft: 20 }] : [],
    V.fill ? [{ pos: [0.5, 2.0, 0.5], type: 1, I: V.fill, reach: 9, key: "fill", soft: 2 }] : []) };
}

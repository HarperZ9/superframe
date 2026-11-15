// The telegraph office on the Ropewalk (Act 2, place telegraph; content/act2/ropewalk.lwd): a public side
// with a bench and the posted rates, the counter across the room with its brass grille, and behind it
// Rook's side: the instrument desk (the key and the sounder), the spike of forms, the oilcloth book, a
// paraffin lamp, a small stove, the wire coming in high on the wall. About 4.6 m by 3.4 m. Original block-out.
import { box, cyl, ell, cap } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function telegraph() {
  const W = makeWorld({ cell: 1.0, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 2.3, HZ = 1.7, H = 3.0, wood = ID.darkwood || ID.timber, CX = -0.3;   // the counter runs along z at x CX: Rook's side behind it (-x), the public side toward the camera
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.plaster, wallNear: ID.plaster, sill: 0.4, cuts: [[1.4, 1.0, -HZ - 0.1, 0.45, 1.0, 0.3]] });
    T(box(x, y, z, 1.4, 1.0, -HZ - 0.3, 0.45, 1.0, 0.05), wood);   // the street door, shut, on the public side
    // the counter and its brass grille, a hatch in the grille
    T(box(x, y, z, CX, 0.55, -0.1, 0.22, 0.55, 1.5), wood); T(box(x, y, z, CX, 1.12, -0.1, 0.26, 0.03, 1.55), wood);
    { const g = Math.max(Math.abs(((z + 4) / 0.09) % 1 - 0.5) * 0.09 - 0.008, Math.abs(y - 1.6) - 0.45, Math.abs(x - CX) - 0.008, Math.abs(z + 0.1) - 1.5); T(Math.max(g, -box(x, y, z, CX, 1.3, 0.2, 0.05, 0.16, 0.25)), ID.brass); }
    T(Math.max(Math.abs(y - 2.07) - 0.025, Math.abs(x - CX) - 0.02, Math.abs(z + 0.1) - 1.5), ID.brass);
    // the rates posted on the public side, the wire coming in high on the back wall
    T(box(x, y, z, 0.6, 1.7, -HZ + 0.02, 0.3, 0.4, 0.01), ID.paper);
    T(cyl(x, y, z, 1.6, 2.6, -HZ + 0.05, 0.05, 0.05), ID.bone);
  });
  // Rook's desk behind the counter: the key, the sounder, the spike, the oilcloth book, the lamp
  add(K.table(-1.3, 0, -0.2, 0.35, 0.8, 0.78, 0, wood));
  add(K.shape([-1.8, 0.78, -1.1, -0.8, 1.5, 0.7], (x, y, z, T) => {
    T(box(x, y, z, -1.3, 0.82, -0.2, 0.05, 0.03, 0.08), ID.brass); T(cap(x, y, z, [-1.3, 0.86, -0.25], [-1.3, 0.88, -0.1], 0.01), ID.brass);   // the key
    T(box(x, y, z, -1.45, 0.86, 0.3, 0.06, 0.07, 0.08), ID.brass);   // the sounder
    T(cyl(x, y, z, -1.2, 0.9, -0.75, 0.004, 0.1), ID.iron); T(box(x, y, z, -1.2, 0.86, -0.75, 0.05, 0.04, 0.06), ID.paper);   // the spike of forms
    T(box(x, y, z, -1.1, 0.8, 0.45, 0.1, 0.02, 0.13), ID.oilskin);   // the oilcloth book
    T(cyl(x, y, z, -1.5, 0.84, -0.6, 0.05, 0.05), ID.brass); T(ell(x, y, z, -1.5, 1.0, -0.6, 0.045, 0.08, 0.045), ID.lantern);   // the paraffin lamp
  }));
  L.push({ pos: [-1.5, 1.05, -0.6], type: 1, I: 6, reach: 5, group: "lantern", key: "rooklamp" });
  add(K.shape([-0.95, 0, -0.4, -0.55, 1.0, 0.0], (x, y, z, T) => { T(box(x, y, z, -0.75, 0.45, -0.2, 0.2, 0.025, 0.2), wood); T(box(x, y, z, -0.95, 0.7, -0.2, 0.02, 0.25, 0.2), wood); }));   // her stool
  // the small stove in the corner behind the counter
  add(K.shape([-2.2, 0, -1.65, -1.6, 2.9, -1.05], (x, y, z, T) => { T(cyl(x, y, z, -1.9, 0.4, -1.35, 0.25, 0.4), ID.stove); T(cyl(x, y, z, -1.9, 1.9, -1.4, 0.06, 1.0), ID.iron); T(box(x, y, z, -1.9, 0.35, -1.09, 0.1, 0.07, 0.02), ID.stovefire); }));
  L.push({ pos: [-1.9, 0.4, -1.0], type: 1, I: 3, reach: 3, group: "fire", key: "stove" });
  // the public bench by the door
  add(K.shape([1.6, 0, -0.4, 2.3, 0.6, 1.0], (x, y, z, T) => { T(box(x, y, z, 1.95, 0.45, 0.3, 0.2, 0.03, 0.6), wood); for (const b of [-0.2, 0.8]) T(box(x, y, z, 1.95, 0.22, b, 0.17, 0.22, 0.03), wood); }));
  spot("grille", "talk", [0.2, 0, 0.2], "Rook behind the grille");
  spot("forms", "read", [0.2, 0, -0.7], "the spike of forms, through the grille");
  spot("book", "read", [0.2, 0, 0.6], "the book bound in oilcloth by her hand: not the office's book");
  spot("rates", "read", [0.6, 0, -1.1], "the rates posted on the public side");
  spot("bench", "wait", [1.5, 0, 0.3], "the public bench by the door");
  marks.exits.push({ id: "lane", at: [1.4, 0, -1.3], note: "out to the Ropewalk" });
  marks.hides.push({ id: "under_counter", at: [0.1, 0, 1.4], r: 0.3, note: "low by the counter's end" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [0.6, 2.3, 1.2], type: 1, I: V.fill, reach: 7, group: "fill", key: "fill" }] : []) };
}

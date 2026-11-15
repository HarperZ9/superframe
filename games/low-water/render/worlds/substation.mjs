// The Municipal substation on Chancel Hill (Act 2, place substation; content/act2/hill.lwd and the
// e.substation fight at 03:00): a brick box with a hum. The switch board on the back wall (HILL, HOUSES;
// HILL, STREET ARCS over an older plate, HEAD LIGHT; the brass standing order under both), two knife
// switches, the transformer, the louvred window, the padlocked door, the cable duct's grating in the
// floor, a caged white bulb, the bench for the engineer's tools. About 4.4 m by 3.2 m, room to fight.
// Original block-out.
import { box, cyl, ell } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function substation() {
  const W = makeWorld({ cell: 1.0, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 2.2, HZ = 1.6, H = 3.0, LOUV = [-HX - 0.1, 1.9, -0.2, 0.3, 0.4, 0.55];
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.slab, wall: ID.brick, wallNear: ID.brick, sill: 0.4, cuts: [LOUV], floorCuts: [[1.0, -0.1, 0.6, 0.35, 0.3, 0.25]] });
    // the louvres: slats across the window, the frost light between
    { const k = Math.round((y - 1.55) / 0.12); if (k >= 0 && k <= 6) T(box(x, y, z, -HX - 0.05, 1.55 + k * 0.12, -0.2, 0.08, 0.012, 0.54), ID.timber); }
    T(box(x, y, z, -HX - 0.6, 1.9, -0.2, 0.04, 0.6, 0.8), ID.windowdim);
    // the duct under its grating: a dark slot, iron bars over it
    T(box(x, y, z, 1.0, -0.6, 0.6, 0.5, 0.05, 0.4), ID.coal);
    { const k = Math.round((x - 0.7) / 0.1); if (k >= 0 && k <= 6) T(box(x, y, z, 0.7 + k * 0.1, -0.02, 0.6, 0.012, 0.02, 0.25), ID.iron); }
    T(Math.max(box(x, y, z, 1.0, -0.02, 0.6, 0.36, 0.02, 0.26), -box(x, y, z, 1.0, -0.02, 0.6, 0.33, 0.1, 0.23)), ID.iron);
  });
  // the switch board: slate on the back wall, the two knife switches, their labels, the brass order
  add(K.shape([-1.4, 0.6, -1.65, 0.6, 2.6, -1.25], (x, y, z, T) => {
    T(box(x, y, z, -0.4, 1.6, -1.56, 0.9, 0.9, 0.04), ID.slate);
    for (const [sx, closed] of [[-0.85, true], [0.05, false]]) {   // HILL, HOUSES (closed); HILL, STREET ARCS (the second switch)
      T(box(x, y, z, sx, 1.55, -1.5, 0.12, 0.2, 0.025), ID.iron);
      T(box(x, y, z, sx, closed ? 1.72 : 1.5, closed ? -1.46 : -1.38, 0.02, closed ? 0.17 : 0.06, closed ? 0.02 : 0.12), ID.brass);
      T(box(x, y, z, sx, 2.1, -1.51, 0.28, 0.06, 0.008), ID.paper);
    }
    T(box(x, y, z, -0.4, 0.95, -1.51, 0.5, 0.08, 0.006), ID.brass);   // the standing order
  }));
  spot("board", "read", [-0.4, 0, -0.9], "the switch board: HILL, HOUSES; HILL, STREET ARCS over HEAD LIGHT; the brass standing order");
  spot("second_switch", "use", [0.05, 0, -0.9], "the second switch: the hill's street arcs");
  // the transformer humming in the corner
  add(K.shape([1.0, 0, -1.6, 2.2, 1.7, -0.6], (x, y, z, T) => { T(box(x, y, z, 1.6, 0.75, -1.1, 0.45, 0.75, 0.38), ID.tar); for (let k = 0; k < 4; k++) T(box(x, y, z, 1.2 + k * 0.27, 0.8, -0.71, 0.08, 0.6, 0.02), ID.iron); T(cyl(x, y, z, 1.6, 1.62, -1.1, 0.06, 0.1), ID.bone); }));
  spot("transformer", "listen", [1.3, 0, -0.3], "the hum");
  spot("duct", "hide", [1.0, 0, 1.1], "the cable duct's grating: the way in under the floor");
  spot("louvres", "look", [-1.6, 0, -0.2], "the louvred window");
  spot("bench", "use", [-1.2, 0, 0.5], "the bench where the engineer lays his tools out by size");
  add(K.table(-1.2, 0, 1.0, 0.6, 0.25, 0.75, 0));
  add(K.shape([-1.7, 0.75, 0.8, -0.7, 0.85, 1.2], (x, y, z, T) => { for (let k = 0; k < 6; k++) T(box(x, y, z, -1.6 + k * 0.17, 0.765, 1.0, 0.012, 0.012, 0.04 + k * 0.025), ID.iron); }));
  // the caged white bulb over the board
  add(K.shape([-0.6, 2.3, -1.3, -0.2, 3.0, -0.9], (x, y, z, T) => { T(cyl(x, y, z, -0.4, 2.8, -1.1, 0.01, 0.2), ID.iron); T(ell(x, y, z, -0.4, 2.52, -1.1, 0.06, 0.08, 0.06), ID.whitelamp); for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI; T(Math.max(Math.abs((x + 0.4) * Math.sin(a) - (z + 1.1) * Math.cos(a)) - 0.006, ell(x, y, z, -0.4, 2.52, -1.1, 0.1, 0.12, 0.1), -ell(x, y, z, -0.4, 2.52, -1.1, 0.09, 0.11, 0.09)), ID.iron); } }));
  L.push({ pos: [-0.4, 2.45, -1.0], type: 3, I: 12, reach: 7, group: "white", key: "cagebulb" });
  L.push({ pos: [-HX - 0.9, 1.9, -0.2], type: 1, I: 6, reach: 5, group: "window", key: "louvrelight" });
  marks.exits.push({ id: "door", at: [1.8, 0, 1.2], note: "the padlocked door to the hill" }, { id: "duct", at: [1.0, 0, 0.6], note: "down into the cable duct" });
  marks.hides.push({ id: "behind_transformer", at: [1.9, 0, -0.4], r: 0.35, note: "between the transformer and the wall" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [0.6, 2.3, 1.2], type: 1, I: V.fill, reach: 7, group: "fill", key: "fill" }] : []) };
}

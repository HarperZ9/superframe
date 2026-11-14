// The weigh-house office (design/PLACES-NEW.md section 6): a small office about 4 m by 3.5 m. A desk with a
// green blotter, a chair with a drain hole over a tin basin, the drawer marked BOARD, WORKS, red ledger spines
// on a shelf, the window onto the yard with the sodium's orange coming through, the speaking tube's door
// through to the tube room. Dark (place light 0.08). Original block-out. Its id is weighoffice: office is
// the harbour office.
import { box, cyl, ell } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function weighOffice() {
  const W = makeWorld({ cell: 1.0, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 2.0, HZ = 1.75, H = 2.8, WIN = [-0.4, 1.45, -HZ - 0.1, 0.55, 0.55, 0.3];
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.plaster, wallNear: ID.plaster, sill: 0.35, cuts: [WIN, [-HX - 0.1, 1.0, 0.6, 0.3, 1.0, 0.45]] });
    // the window's frame and its glass, the yard's sodium beyond
    T(Math.max(box(x, y, z, WIN[0], WIN[1], -HZ - 0.06, WIN[3] + 0.06, WIN[4] + 0.06, 0.05), -box(x, y, z, WIN[0], WIN[1], -HZ - 0.06, WIN[3] - 0.02, WIN[4] - 0.02, 0.1)), ID.timber);
    T(Math.max(box(x, y, z, WIN[0], WIN[1], -HZ - 0.06, 0.03, WIN[4], 0.03), 0) , ID.timber);   // the mullion
    T(box(x, y, z, WIN[0], WIN[1], -HZ - 0.5, WIN[3] + 0.3, WIN[4] + 0.3, 0.05), ID.windowdim);   // the yard's orange, seen through the glass
    // the tube room's door, dark, at -x
    T(box(x, y, z, -HX - 0.3, 1.0, 0.6, 0.05, 1.0, 0.45), ID.darkwood || ID.timber);
  });
  // the desk under the window: top, the green blotter, the drawers, the drawer marked BOARD, WORKS
  add(K.shape([-1.4, 0, -1.7, 0.6, 1.0, -0.6], (x, y, z, T) => {
    T(box(x, y, z, -0.4, 0.76, -1.15, 0.95, 0.03, 0.45), ID.timber);
    T(box(x, y, z, -0.4, 0.795, -1.12, 0.38, 0.006, 0.26), ID.green);
    T(box(x, y, z, 0.25, 0.37, -1.15, 0.28, 0.37, 0.42), ID.timber); T(box(x, y, z, -1.05, 0.37, -1.15, 0.28, 0.37, 0.42), ID.timber);
    T(box(x, y, z, 0.25, 0.55, -0.72, 0.24, 0.1, 0.02), ID.paper);   // the drawer's card: BOARD, WORKS
    T(box(x, y, z, 0.25, 0.4, -0.71, 0.05, 0.015, 0.02), ID.brass);
  }));
  spot("blotter", "read", [-0.4, 0, -0.4], "the green blotter, the last hand pressed into it");
  spot("drawer", "use", [0.3, 0, -0.35], "the drawer marked BOARD, WORKS");
  spot("desk", "use", [-0.9, 0, -0.4], "the desk: the lantern on it, or low under it");
  // the chair with a drain hole in its seat over a tin basin
  add(K.shape([-0.75, 0, -0.75, -0.05, 1.05, -0.1], (x, y, z, T) => {
    T(Math.max(box(x, y, z, -0.4, 0.46, -0.42, 0.22, 0.025, 0.22), -cyl(x, y, z, -0.4, 0.46, -0.42, 0.05, 0.05)), ID.timber);
    T(box(x, y, z, -0.4, 0.78, -0.2, 0.22, 0.27, 0.02), ID.timber);
    for (const [a, b] of [[-0.6, -0.62], [-0.2, -0.62], [-0.6, -0.22], [-0.2, -0.22]]) T(box(x, y, z, a, 0.22, b, 0.022, 0.22, 0.022), ID.timber);
    T(Math.max(cyl(x, y, z, -0.4, 0.06, -0.42, 0.16, 0.06), -cyl(x, y, z, -0.4, 0.09, -0.42, 0.14, 0.06)), ID.iron);   // the basin
  }));
  // the shelf of red ledgers on the left wall
  add(K.shape([-2.0, 1.1, -1.5, -1.6, 2.0, 0.6], (x, y, z, T) => {
    T(box(x, y, z, -1.85, 1.2, -0.45, 0.15, 0.02, 0.9), ID.timber); T(box(x, y, z, -1.85, 1.75, -0.45, 0.15, 0.02, 0.9), ID.timber);
    const k = Math.floor((z + 1.35) / 0.07); if (k >= 0 && k < 22) T(box(x, y, z, -1.86, 1.42, -1.35 + (k + 0.5) * 0.07, 0.12, 0.2 - (k % 3) * 0.02, 0.028), k === 9 ? ID.bone : ID.red);
  }));
  spot("ledger", "read", [-1.3, 0, -0.3], "the red ledgers: the town balance ledger among them");
  spot("window", "read", [-0.4, 0, -1.0], "by the window's orange");
  // a rain-butt outside under the window, glimpsed; a coat on a peg
  add(K.barrel(-0.4, -0.3, -HZ - 0.7, 0.3, 0.9));
  add(K.shape([1.4, 1.0, -1.75, 1.8, 1.9, -1.45], (x, y, z, T) => T(ell(x, y, z, 1.6, 1.45, -1.6, 0.18, 0.42, 0.08), ID.oilskin)));
  marks.exits.push({ id: "window", at: [-0.4, 0, -1.4], note: "the window onto the yard, the way Shadow comes in" }, { id: "tube", at: [-1.7, 0, 0.6], note: "through to the tube room" });
  marks.hides.push({ id: "under_desk", at: [-0.4, 0, -1.1], r: 0.35, note: "low under the desk" });
  marks.lamps.push({ id: "desk_lantern", at: [-0.6, 0.8, -1.1], note: "the lantern Lamb sets on the desk (run-time light)" });
  L.push({ pos: [-0.4, 1.6, -HZ - 0.8], type: 0, I: 12, reach: 6, cone: [0, -0.2, 1], mode: 2, group: "sodium", key: "yardsodium" });   // the yard's sodium through the window
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [0.8, 2.2, 1.0], type: 1, I: V.fill, reach: 7, group: "fill", key: "fill" }] : []) };
}

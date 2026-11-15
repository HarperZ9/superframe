// The Gannet house's front room on the Ropewalk (Act 2, place gannet_house; content/act2/ropewalk.lwd):
// Pip's front room. The stove ticking, the table with the crossword done in capitals, Pip's chair with a
// blanket, the shut door to the back room with light under it, the window onto the Ropewalk, a dresser.
// About 4 m by 3.4 m. Original block-out.
import { box, cyl, ell } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function gannet() {
  const W = makeWorld({ cell: 1.0, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 2.0, HZ = 1.7, H = 2.6, wood = ID.darkwood || ID.timber, BACK = [0.9, 1.0, -HZ - 0.1, 0.42, 1.0, 0.3], WIN = [-HX - 0.1, 1.45, -0.3, 0.3, 0.5, 0.5];
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.mustard, wallNear: ID.mustard, sill: 0.35, cuts: [BACK, WIN] });
    T(box(x, y, z, -0.2, 0.004, 0.0, 1.2, 0.006, 0.9), ID.rug);
    // the back room's door, shut, the light under it
    T(box(x, y, z, 0.9, 1.02, -HZ - 0.06, 0.4, 0.98, 0.04), wood);
    T(box(x, y, z, 0.9, 0.02, -HZ - 0.3, 0.4, 0.02, 0.2), ID.windowdim);
    // the window onto the Ropewalk: frame, bars, the lane's paraffin beyond
    T(Math.max(box(x, y, z, -HX - 0.06, WIN[1], WIN[2], 0.05, WIN[4] + 0.06, WIN[5] + 0.06), -box(x, y, z, -HX - 0.06, WIN[1], WIN[2], 0.1, WIN[4] - 0.02, WIN[5] - 0.02)), wood);
    T(Math.min(box(x, y, z, -HX - 0.06, WIN[1], WIN[2], 0.025, WIN[4], 0.025), box(x, y, z, -HX - 0.06, WIN[1], WIN[2], 0.025, 0.025, WIN[5])), wood);
    T(box(x, y, z, -HX - 0.3, WIN[1], WIN[2], 0.03, WIN[4] + 0.02, WIN[5] + 0.02), ID.windowdim);
  });
  L.push({ pos: [0.9, 0.15, -HZ - 0.5], type: 1, I: 2.2, reach: 3, group: "window", key: "underdoor" });
  L.push({ pos: [-HX - 1.2, 1.6, -0.3], type: 1, I: 3, reach: 5, group: "window", key: "lanewindow" });
  // the stove ticking, its glow
  add(K.shape([-1.95, 0, -1.65, -1.25, 2.6, -0.95], (x, y, z, T) => { T(box(x, y, z, -1.6, 0.42, -1.3, 0.3, 0.42, 0.28), ID.stove); T(cyl(x, y, z, -1.6, 1.7, -1.45, 0.07, 0.9), ID.iron); T(box(x, y, z, -1.6, 0.33, -1.01, 0.15, 0.1, 0.02), ID.stovefire); }));
  L.push({ pos: [-1.6, 0.4, -0.9], type: 1, I: 6, reach: 4.5, group: "fire", key: "stove" });
  spot("stove", "wait", [-1.2, 0, -0.5], "the stove ticks");
  // the table with the crossword, a candle; Pip's chair by the stove with a blanket
  add(K.table(0.2, 0, 0.1, 0.55, 0.4, 0.75, 0, wood));
  add(K.shape([-0.3, 0.75, -0.3, 0.7, 1.1, 0.5], (x, y, z, T) => { T(box(x, y, z, 0.1, 0.76, 0.1, 0.16, 0.004, 0.11), ID.paper); T(cyl(x, y, z, 0.5, 0.82, -0.1, 0.025, 0.07), ID.wax); T(ell(x, y, z, 0.5, 0.92, -0.1, 0.01, 0.022, 0.01), ID.candle); }));
  L.push({ pos: [0.5, 0.95, -0.1], type: 1, I: 3, reach: 3.5, group: "candle", key: "tablecandle" });
  spot("crossword", "read", [0.1, 0, 0.7], "the crossword, done in capitals that sit dead on their lines");
  add(K.shape([-1.3, 0, -0.6, -0.5, 1.1, 0.2], (x, y, z, T) => { T(box(x, y, z, -0.9, 0.42, -0.2, 0.28, 0.06, 0.28), wood); T(box(x, y, z, -0.9, 0.8, -0.45, 0.28, 0.32, 0.04), wood); T(ell(x, y, z, -0.9, 0.55, -0.2, 0.27, 0.1, 0.3), ID.canvas); }));
  spot("pip_chair", "talk", [-0.6, 0, 0.3], "Pip's chair by the stove, her knees up");
  spot("back_door", "use", [0.9, 0, -1.2], "the shut door to the back room, light under it");
  spot("floor", "listen", [0.4, 0, -0.9], "under the floor, toward the back: a breath");
  // the dresser along the right
  add(K.shape([1.5, 0, -0.6, 2.0, 1.9, 1.0], (x, y, z, T) => { T(box(x, y, z, 1.8, 0.45, 0.2, 0.2, 0.45, 0.75), wood); T(box(x, y, z, 1.9, 1.4, 0.2, 0.1, 0.5, 0.75), wood); for (let k = 0; k < 5; k++) T(cyl(x, y, z, 1.86, 1.25, -0.35 + k * 0.28, 0.08, 0.005), ID.bone); }));
  marks.exits.push({ id: "lane", at: [-1.6, 0, 1.3], note: "the front door to the Ropewalk" }, { id: "back_room", at: [0.9, 0, -1.5], note: "the back room (locked)" });
  marks.hides.push({ id: "behind_dresser", at: [1.4, 0, 1.2], r: 0.3, note: "by the dresser's end" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [0.6, 2.1, 1.2], type: 1, I: V.fill, reach: 7, group: "fill", key: "fill" }] : []) };
}

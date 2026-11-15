// The district office's other two rooms in The Quota era 2 (design/quota/03-STORY.md, the office meeting and the four
// days in the cells). Near walls cut away (shell). Original block-outs.
//   meeting(): the district meeting room at eleven. The long table under the window on Exchange Square, the
//     commissioner's chair at its head with the Directorate's sheaf on the wall behind, the eleven villages' returns
//     in a stack, a carafe of water nobody touches, the chairs for the village men along the wall, a cold stove.
//   cells(): under the office. A corridor of slab and brick; three barred cells along the back wall (the end cell,
//     the middle, the women's cell), a bench and a bucket in each, the high grating on the street where the daylight
//     comes down grey; the guardroom at the right with its stove and fender, the chair, a table with the cards and
//     the cell log, the lamp on its hook. lights(V): V.grate for the day through the grating, V.stove the stove's
//     fire (it goes down at night).
import { box, cyl, ell, cap, sph } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

const marksNew = () => ({ spots: [], hides: [], exits: [], lamps: [] });

export function meeting() {
  const W = makeWorld({ cell: 1.2, margin: 0.35 }), L = [], marks = marksNew();
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 3.6, HZ = 2.8, H = 3.4;
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.plaster, wallNear: ID.brick, sill: 0.45, cuts: [[-1.2, 1.9, -HZ - 0.12, 0.6, 0.85, 0.3], [1.2, 1.9, -HZ - 0.12, 0.6, 0.85, 0.3], [-HX - 0.12, 1.1, 1.6, 0.3, 1.1, 0.55]] });
    T(box(x, y, z, 0, 0.55, -HZ + 0.03, HX + 0.2, 0.55, 0.04), ID.darkwood); T(box(x, y, z, -HX + 0.03, 0.55, 0, 0.04, 0.55, HZ + 0.2), ID.darkwood);
    T(Math.max(box(x, y, z, 0.3, 0.004, -0.6, 2.2, 0.004, 1.0), -(y - 0.008)), ID.rug);   // a worn carpet under the table
  });
  // two tall windows on the square: flat winter noon
  for (const wx of [-1.2, 1.2]) W.add(K.shape([wx - 0.7, 0.9, -HZ - 0.35, wx + 0.7, 2.9, -HZ + 0.15], (x, y, z, T) => {
    T(box(x, y, z, wx, 1.9, -HZ - 0.1, 0.56, 0.81, 0.02), ID.window);
    T(Math.max(box(x, y, z, wx, 1.9, -HZ - 0.08, 0.6, 0.85, 0.03), -box(x, y, z, wx, 1.9, -HZ - 0.08, 0.55, 0.8, 0.1)), ID.timber);
    T(box(x, y, z, wx, 1.9, -HZ - 0.07, 0.012, 0.8, 0.02), ID.timber); T(box(x, y, z, wx, 2.2, -HZ - 0.07, 0.56, 0.012, 0.02), ID.timber);
  }));
  // the long table, the commissioner's chair at its head (far end), chairs down both sides
  W.add(K.table(0.3, 0, -0.6, 1.9, 0.55, 0.78, 0, ID.darkwood));
  W.add(K.shape([-2.15, 0, -1.0, -1.55, 1.5, -0.2], (x, y, z, T) => { T(box(x, y, z, -1.85, 0.47, -0.6, 0.25, 0.03, 0.25), ID.darkwood); T(box(x, y, z, -2.08, 0.95, -0.6, 0.03, 0.5, 0.26), ID.oxblood); for (const s of [-1, 1]) for (const t of [-1, 1]) T(box(x, y, z, -1.85 + s * 0.2, 0.23, -0.6 + t * 0.2, 0.025, 0.23, 0.025), ID.darkwood); }));
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) W.add(K.stool(-1.0 + k * 0.85, 0, -0.6 + s * 0.85, 0.17, 0.47));
  W.add(K.shape([-1.6, 0.76, -1.15, 2.2, 1.1, -0.05], (x, y, z, T) => {
    T(box(x, y, z, -1.35, 0.84, -0.6, 0.16, 0.06, 0.22), ID.paper);   // the eleven returns, stacked at his hand
    T(Math.max(ell(x, y, z, -0.9, 0.9, -0.95, 0.06, 0.12, 0.06), -ell(x, y, z, -0.9, 0.94, -0.95, 0.045, 0.12, 0.045)), ID.glass);   // the carafe
    for (let k = 0; k < 4; k++) T(box(x, y, z, -0.4 + k * 0.7, 0.785, -0.1 - (k % 2) * 0.95, 0.12, 0.004, 0.09), ID.paper);
    T(cyl(x, y, z, -1.15, 0.8, -0.3, 0.03, 0.05), ID.iron);   // the inkwell
  }));
  spot("returns", "read", [-0.9, 0, 0.3], "the eleven returns stacked at the commissioner's hand");
  // the Directorate's sheaf behind the head of the table; the district map beside it
  W.add(K.shape([-HX - 0.05, 1.2, -1.8, -HX + 0.1, 3.0, 0.6], (x, y, z, T) => { T(box(x, y, z, -HX + 0.03, 2.2, -0.6, 0.012, 0.6, 0.4), ID.oxblood); T(ell(x, y, z, -HX + 0.045, 2.2, -0.6, 0.01, 0.3, 0.2), ID.mustard); }));
  // the chairs for the village men along the back wall; the cold stove in the corner
  for (let k = 0; k < 3; k++) W.add(K.stool(2.4 + (k % 2) * 0.1, 0, -2.2 + k * 0.6, 0.16, 0.45));
  W.add(K.shape([2.9, 0, 1.4, HX + 0.05, 2.8, 2.4], (x, y, z, T) => { T(cyl(x, y, z, 3.2, 0.4, 1.9, 0.26, 0.4), ID.stove); T(cap(x, y, z, [3.2, 0.8, 1.9], [3.2, 2.8, 1.9], 0.06), ID.stove); }));
  marks.exits.push({ id: "stairs", at: [-HX + 0.4, 0, 1.6], note: "the door to the stairs" });
  return { world: W.build(), marks, lights: (V = {}) => L.concat(
    V.window ? [-1.2, 1.2].map((wx, i) => ({ pos: [wx, 2.4, -HZ + 0.35], type: V.windowType ?? 1, I: V.window, cone: [0.1, -0.35, 1], mode: 2, reach: 11, key: `window${i}`, soft: 1.5 })) : [],
    V.fill ? [{ pos: [0.5, 2.8, 0.8], type: 1, I: V.fill, reach: 10, key: "fill", soft: 2 }] : []) };
}

export function cells() {
  const W = makeWorld({ cell: 1.2, margin: 0.35 }), L = [], marks = marksNew();
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 3.6, HZ = 2.6, H = 2.6, FRONT = -0.45;
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.slab, wall: ID.brickdark, wallNear: ID.brickdark, sill: 0.5, cuts: [[-0.4, 2.3, -HZ - 0.12, 0.5, 0.14, 0.3]] });
    T(box(x, y, z, 0, 0.9, -HZ + 0.02, HX + 0.2, 0.9, 0.03), ID.limewash);   // limewash to shoulder height, flaking
    for (const px of [-1.2, 1.2]) T(box(x, y, z, px, H / 2, (FRONT - HZ) / 2, 0.11, H / 2, (HZ + FRONT) / 2), ID.brickdark);   // the walls between the cells
  });
  // the grating high on the street: daylight comes down it grey, and the feet of whoever passes
  W.add(K.shape([-1.0, 2.0, -HZ - 0.35, 0.2, 2.55, -HZ + 0.1], (x, y, z, T) => { T(box(x, y, z, -0.4, 2.3, -HZ - 0.12, 0.48, 0.12, 0.02), ID.window); for (let k = 0; k < 7; k++) T(cyl(x, y, z, -0.85 + k * 0.15, 2.3, -HZ - 0.06, 0.012, 0.13), ID.iron); }));
  // the bars across the three cells, a door in each (the end cell's ajar a hand's breadth)
  W.add(K.shape([-HX, 0, FRONT - 0.08, 3.6, H, FRONT + 0.08], (x, y, z, T) => {
    for (let k = 0; k < 38; k++) { const bx = -HX + 0.1 + k * 0.19; if (bx > 3.55) break; T(cap(x, y, z, [bx, 0, FRONT], [bx, H - 0.05, FRONT], 0.014), ID.iron); }
    for (const by of [0.15, 1.1, 2.1]) T(box(x, y, z, 0, by, FRONT, HX, 0.02, 0.02), ID.iron);
  }));
  // in each cell a plank bench on the side wall and a bucket
  for (const [cx, side] of [[-2.4, -1], [0, -1], [2.4, 1]]) W.add(K.shape([cx - 1.2, 0, -HZ, cx + 1.2, 0.6, FRONT - 0.1], (x, y, z, T) => { T(box(x, y, z, cx + side * 0.8, 0.42, -1.6, 0.28, 0.03, 0.85), ID.plank); T(box(x, y, z, cx + side * 0.8, 0.2, -1.6, 0.25, 0.2, 0.03), ID.plank); T(Math.max(cyl(x, y, z, cx - side * 0.7, 0.16, -2.1, 0.13, 0.16), -cyl(x, y, z, cx - side * 0.7, 0.2, -2.1, 0.11, 0.16)), ID.iron); }));
  spot("end_cell", "look", [-2.4, 0, 0.1], "the end cell: the bench, the bucket, the straw");
  spot("womens_cell", "look", [2.4, 0, 0.1], "the women's cell");
  W.add(K.shape([-3.4, 0, -2.4, -1.4, 0.2, -0.6], (x, y, z, T) => T(Math.max(ell(x, y, z, -2.6, 0.02, -1.4, 0.7, 0.05, 0.6), -y), ID.straw)));
  // the guardroom in front at the right: the stove with its fender, the chair, the table with cards and the log
  W.add(K.shape([2.0, 0, 0.4, HX + 0.05, H, 2.4], (x, y, z, T) => {
    T(cyl(x, y, z, 3.1, 0.38, 1.0, 0.25, 0.38), ID.stove); T(box(x, y, z, 2.84, 0.32, 1.0, 0.02, 0.08, 0.1), ID.stovefire); T(cap(x, y, z, [3.1, 0.76, 1.0], [3.1, H, 1.0], 0.06), ID.stove);
    T(Math.max(cyl(x, y, z, 3.1, 0.05, 1.0, 0.5, 0.05), -cyl(x, y, z, 3.1, 0.05, 1.0, 0.46, 0.1)), ID.brass);   // the fender
  }));
  L.push({ pos: [2.7, 0.35, 1.0], type: 1, I: 2.2, cone: [-1, 0.1, 0], mode: 2, reach: 5, key: "stove", group: "fire" });
  W.add(K.stool(2.1, 0, 1.2, 0.2, 0.46)); W.add(K.shape([2.0, 0.4, 1.3, 2.3, 1.1, 1.5], (x, y, z, T) => T(box(x, y, z, 2.1, 0.75, 1.4, 0.18, 0.3, 0.02), ID.timber)));
  W.add(K.table(1.6, 0, 0.3, 0.45, 0.32, 0.76, 0, ID.timber));
  W.add(K.shape([1.1, 0.74, 0.0, 2.1, 0.9, 0.6], (x, y, z, T) => { T(box(x, y, z, 1.45, 0.79, 0.3, 0.16, 0.025, 0.11), ID.oxblood); T(box(x, y, z, 1.45, 0.805, 0.3, 0.15, 0.003, 0.1), ID.paper); for (let k = 0; k < 5; k++) T(box(x, y, z, 1.8 + k * 0.03, 0.775, 0.2 + (k % 2) * 0.12, 0.03, 0.002, 0.045), ID.bonecloth); }));
  spot("log", "read", [1.6, 0, 0.9], "the cell log, open: the day's names and what each was given");
  // the lamp on its hook by the guardroom door
  W.add(K.paraffin(HX - 0.05, 1.9, 0.0, -Math.PI / 2, false, 7)); L.push({ pos: [HX - 0.5, 1.85, 0.0], type: 1, I: 7, reach: 8, key: "lamp", group: "lantern" });
  marks.exits.push({ id: "stairs", at: [3.0, 0, 2.2], note: "the stairs up to the brigade office" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => (l.key === "stove" && V.stove != null ? { ...l, I: l.I * V.stove } : l)).concat(
    V.grate ? [{ pos: [-0.4, 2.2, -HZ + 0.35], type: V.grateType ?? 1, I: V.grate, cone: [0, -0.8, 0.6], mode: 2, reach: 7, key: "grate", soft: 0.8 }] : [],
    V.fill ? [{ pos: [0, 2.2, 1.0], type: 1, I: V.fill, reach: 9, key: "fill", soft: 2 }] : []) };
}

// Era 3 interiors of The Quota (Allocation, year 20; design/eras/era3.md sections 5 and 11), plates package,
// 2026-10-22. Near walls cut away (shell). The town rebuilt by allocation: every room full of people it was not
// built for, bare bulbs and brownouts, limewash patched in a flatter, newer distemper that stops at a hard edge
// (look L3). Each room has one motivated key: a bulb on its flex or a window, never both at full.
//   school(): the schoolroom in the old exchange offices; desks, the blackboard, "The Plain Rebuilt" open.
//   office(): the allocation counter in the old district office; the register shelf, the queue rail, one bulb.
//   hall(): the Furrowe hall: the front door with its fanlight, the mirror, the stair foot, one bulb.
//   mott(): the old Mott house front room: the door table for ten families, bowls, rolled mattresses, the stair.
//   church(): the Furrow Church: pews, the pulpit, the altarpiece under a sheet, a tall window.
// Squad room, wards, kitchens and the Well House are in q3_rooms_b.mjs.
import { box } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";
import { distinct } from "../props/shell.mjs";
import { aimLight } from "../props/light.mjs";
import { timber, bench, stool, doorLeaf, ladder } from "../props/wood.mjs";
import { cup, jug, loaf, cloth, candle } from "../props/food.mjs";
import { sack, cobweb, ropeCoil } from "../props/gear.mjs";
import { bulb, chair, schoolDesk, blackboard, counter, registerShelf, pew, pulpit, hallMirror, coatRail, potStove, notice, rolledMattress, tinBowl, photo } from "../props/e3_room.mjs";

// The common frame of an era 3 room: the shell, a repaint patch with a hard edge on the back wall, windows cut and
// glazed, and a light set (its own lamps, a sun or sky through its window, a soft fill from the camera side).
export function e3room({ HX, HZ, H, floor = ID.boards, wall = ID.limewash, patch = ID.bone, windows = [], doors = [], cell = 1.2 }) {
  const W = makeWorld({ cell, margin: 0.35 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const cuts = [...windows.map((w) => w.cut), ...doors];
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor, wall, sill: 0.4, cuts });
    // the repaint: a newer flat distemper over the old limewash, stopped where the paint ran out
    T(Math.max(box(x, y, z, -HX * 0.35, H * 0.38, -HZ + 0.004, HX * 0.55, H * 0.38, 0.01), ...cuts.map((c) => -box(x, y, z, ...c))), patch);
    T(box(x, y, z, 0, 0.07, -HZ + 0.01, HX + 0.25, 0.07, 0.02), ID.darkwood);   // skirting
    T(box(x, y, z, -HX + 0.01, 0.07, 0, 0.02, 0.07, HZ + 0.25), ID.darkwood);
  });
  for (const w of windows) W.add(K.shape([w.cut[0] - w.cut[3] - 0.1, w.cut[1] - w.cut[4] - 0.1, w.cut[2] - w.cut[5] - 0.1, w.cut[0] + w.cut[3] + 0.1, w.cut[1] + w.cut[4] + 0.1, w.cut[2] + w.cut[5] + 0.1], (x, y, z, T) => {
    const [cx, cy, cz, ex, ey, ez] = w.cut, onX = ez > ex;
    T(box(x, y, z, cx, cy, cz, onX ? 0.012 : ex, ey, onX ? ez : 0.012), ID.glass);
    T(Math.max(box(x, y, z, cx, cy, cz, onX ? 0.04 : ex + 0.04, ey + 0.04, onX ? ez + 0.04 : 0.04), -box(x, y, z, cx, cy, cz, onX ? 0.1 : ex - 0.03, ey - 0.03, onX ? ez - 0.03 : 0.1)), ID.timber);
    T(box(x, y, z, cx, cy, cz, onX ? 0.03 : ex, 0.015, onX ? ez : 0.03), ID.timber); T(box(x, y, z, cx, cy, cz, onX ? 0.03 : 0.015, ey, onX ? 0.015 : 0.03), ID.timber);
    T(box(x, y, z, onX ? cx + 0.1 : cx, cy - ey - 0.03, onX ? cz : cz + 0.1, onX ? 0.12 : ex + 0.06, 0.025, onX ? ez + 0.06 : 0.12), ID.timber);
  }));
  const lights = (sunFrom) => (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => (V.brown && l.group === "lantern" ? { ...l, I: l.I * V.brown } : l)).concat(
    V.sun ? [{ pos: V.sun.pos || sunFrom, type: 3, I: V.sun.I, reach: 400, key: "sun", soft: V.sun.soft ?? 12 }] : [],
    V.sky ? windows.map((w, i) => ({ pos: [w.cut[0] + (w.cut[5] > w.cut[3] ? 0.5 : 0), w.cut[1], w.cut[2] + (w.cut[5] > w.cut[3] ? 0 : 0.5)], type: 2, I: V.sky, reach: 6, cone: w.cut[5] > w.cut[3] ? [1, -0.3, 0] : [0, -0.3, 1], mode: 2, key: `sky${i}`, soft: 2 })) : [],
    V.fill ? [{ pos: [0.6, 2.3, 1.6], type: 1, I: V.fill, reach: 9, key: "fill", soft: 2 }] : []);
  const hang = (x, z, y, o) => { const [p, l] = bulb(x, H, y, z, o); W.add(p); L.push(l); };
  const done = (sunFrom) => ({ world: W.build(), marks, lights: lights(sunFrom), distinct: distinct(W), props: W.props.length });
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  return { W, L, marks, add: (p) => W.add(p), hang, done, spot };
}

export function school() {
  const HX = 3.2, HZ = 2.4, H = 3.3, R = e3room({ HX, HZ, H, windows: [{ cut: [-HX - 0.12, 1.75, -0.9, 0.3, 0.85, 0.5] }, { cut: [-HX - 0.12, 1.75, 0.9, 0.3, 0.85, 0.5] }], patch: ID.teal });
  const { add, spot } = R;
  add(blackboard(0.4, 1.55, -HZ, { w: 2.0, h: 1.0 }));
  add(K.shape([0.9, 0, -HZ + 0.2, 2.0, 1.0, -HZ + 1.0], (x, y, z, T) => { T(box(x, y, z, 1.4, 0.38, -HZ + 0.6, 0.45, 0.38, 0.28), ID.darkwood); T(box(x, y, z, 1.4, 0.77, -HZ + 0.6, 0.5, 0.015, 0.32), ID.oakx); }));   // the teacher's table
  add(chair(1.4, -HZ + 1.2, { a: 3.14, name: "teachers_chair" }));
  add(K.shape([1.0, 0.78, -HZ + 0.4, 1.8, 0.86, -HZ + 0.8], (x, y, z, T) => { T(box(x, y, z, 1.2, 0.8, -HZ + 0.6, 0.15, 0.012, 0.11), ID.paper); T(box(x, y, z, 1.2, 0.81, -HZ + 0.6, 0.004, 0.012, 0.11), ID.red); T(box(x, y, z, 1.6, 0.795, -HZ + 0.55, 0.16, 0.006, 0.012), ID.timber); }));   // the schoolbook open, the ruler
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) add(schoolDesk(-1.2 + c * 1.6, -0.5 + r * 0.95, { book: (r + c) % 2 === 0, name: r === 1 && c === 0 ? "mims_desk" : "school_desk" }));
  add(coatRail(-2.35, -HZ, 4, { name: "pinafore_pegs", ids: [ID.navy, ID.canvas, ID.oxblood, ID.slate] }));
  add(notice(2.6, 1.9, -HZ, { name: "the_plain_rebuilt_chart", w: 0.6, h: 0.8, seed: 4 }));
  const [st, sg] = potStove(2.6, -1.2, H, { name: "school_stove", lit: false }); add(st);
  add(cobweb([HX * 0 - HX + 0.02, H - 0.05, -HZ + 0.02], [1, 0, 0], [0, 0, 1], { size: 0.5, seed: 4 }));
  R.hang(0.2, 0.2, 2.3, { I: 4, name: "school_bulb" });
  spot("schoolbook", "read", [1.2, 0, -HZ + 1.4], "\"The Plain Rebuilt\" open on the teacher's table; Heshen words struck out in red");
  spot("ruler", "read", [-1.2, 0, 0.9], "Mim's desk: the ruler came down here");
  R.marks.exits.push({ id: "street", at: [HX - 0.5, 0, HZ - 0.3], note: "the passage to Exchange Street" });
  return R.done([-200, 50, 40]);
}

export function office() {
  const HX = 3.0, HZ = 2.3, H = 3.0, R = e3room({ HX, HZ, H, windows: [{ cut: [-HX - 0.12, 1.6, -1.1, 0.3, 0.7, 0.45] }], patch: ID.mustard });
  const { add, spot } = R;
  add(counter(0.0, -0.6, 2.2));
  add(registerShelf(-0.4, -HZ, { w: 2.4 }));
  add(chair(-0.6, -1.25, { a: 0, name: "clerks_chair" })); add(chair(0.9, -1.25, { a: 0.3, name: "krall_chair" }));
  add(K.shape([1.6, 0, -HZ, 2.8, 2.2, -HZ + 0.4], (x, y, z, T) => { T(box(x, y, z, 2.2, 0.9, -HZ + 0.2, 0.5, 0.9, 0.2), ID.darkwood); for (let k = 0; k < 4; k++) T(box(x, y, z, 2.2, 0.25 + k * 0.42, -HZ + 0.41, 0.42, 0.17, 0.01), ID.timber); }));   // the slip cabinet
  for (const zz of [0.6, 1.6]) add(K.shape([-2.4, 0, zz - 0.05, 2.2, 1.0, zz + 0.05], (x, y, z, T) => { T(Math.max(Math.abs(Math.hypot(0, y - 0.95)) - 0.02, Math.abs(z - zz) - 0.02, Math.abs(x + 0.1) - 2.2), ID.brass); for (const px of [-2.2, -0.1, 2.0]) T(box(x, y, z, px, 0.47, zz, 0.02, 0.47, 0.02), ID.brass); }));   // the queue rails
  add(notice(-2.0, 1.75, -HZ, { name: "allocation_notice", seed: 7 })); add(notice(-1.45, 1.6, -HZ, { name: "ration_scale_notice", w: 0.32, h: 0.44, seed: 9 }));
  add(bench(-1.6, 2.0, 0.8, { name: "waiting_bench" }));
  R.hang(0.0, -0.5, 2.2, { I: 8, name: "counter_bulb" });
  spot("register", "read", [-0.8, 0, 0.2], "the register open at the counter: Walter's finger on \"per A.F.\"");
  spot("slip", "read", [0.6, 0, 0.2], "the Sallis allocation slip, a pencil line through the flat");
  R.marks.exits.push({ id: "street", at: [HX - 0.4, 0, 1.8], note: "the door to Exchange Street" });
  return R.done([-210, 30, -80]);
}

export function hall() {
  const HX = 1.9, HZ = 2.2, H = 3.1, door = [0.3, 1.1, -HZ - 0.12, 0.5, 1.1, 0.3];
  const R = e3room({ HX, HZ, H, floor: ID.slab, wall: ID.limewash, patch: ID.pink, doors: [door], windows: [{ cut: [0.3, 2.55, -HZ - 0.12, 0.45, 0.22, 0.3] }] });
  const { add, spot } = R;
  add(doorLeaf([0.8, 0, -HZ + 0.06], 1.0, 2.2, -0.55, { name: "furrowe_front_door", seed: 7 }));
  add(hallMirror(-HX, 1.45, -0.6));
  add(K.shape([-HX, 0, 0.6, -HX + 0.5, 1.0, 1.6], (x, y, z, T) => { T(box(x, y, z, -HX + 0.22, 0.42, 1.1, 0.2, 0.42, 0.45), ID.darkwood); T(box(x, y, z, -HX + 0.22, 0.86, 1.1, 0.22, 0.02, 0.47), ID.oakx); }));   // the hall stand
  add(K.shape([-HX + 0.05, 0.86, 0.75, -HX + 0.45, 1.0, 1.0], (x, y, z, T) => { T(box(x, y, z, -HX + 0.2, 0.9, 0.85, 0.08, 0.03, 0.12), ID.paper); }));   // letters on the stand
  add(K.stairs(1.1, 0, 0.2, Math.PI, 8, 0.9, 0.19, 0.27, ID.darkwood));
  add(timber("newel_post", [0.62, 0.6, 1.05], [0.05, 0.6, 0.05], ID.darkwood));
  add(K.shape([-0.4, 0.002, -1.6, 0.9, 0.012, 0.2], (x, y, z, T) => T(box(x, y, z, 0.2, 0.006, -0.7, 0.55, 0.006, 0.8), ID.rug)));   // the runner
  add(coatRail(-1.0, -HZ, 4, { name: "hall_pegs", ids: [ID.navy, ID.oilskin, ID.darkwood, ID.canvas] }));
  R.hang(-0.3, -0.3, 2.35, { I: 6, name: "hall_bulb" });
  spot("mirror", "look", [-HX + 0.8, 0, -0.6], "the hall mirror: two faces in it");
  R.marks.exits.push({ id: "step", at: [0.3, 0, -HZ + 0.4], note: "the front door, the step" });
  return R.done([-120, 15, -200]);
}

export function mott() {
  const HX = 3.4, HZ = 2.6, H = 2.9, R = e3room({ HX, HZ, H, windows: [{ cut: [-HX - 0.12, 1.5, -1.2, 0.3, 0.7, 0.45] }], patch: ID.bone, cell: 1.4 });
  const { add, spot } = R, TX = -0.3, TZ = -0.3, TOP = 0.76;
  add(K.table(TX, 0, TZ, 1.4, 0.5, TOP, 0, ID.oakx));
  add(cloth(TX, TOP + 0.012, TZ, 1.0, 0.48, { drop: 0.15, name: "oilcloth", seed: 4 }));
  const chairs = [[-1.4, -1.0, 0], [-0.6, -1.0, 0.2], [0.3, -1.0, -0.1], [-1.2, 0.45, 3.1], [0.0, 0.45, 2.9], [1.25, -0.3, 1.57]];
  chairs.forEach(([x, z, a], i) => add(i % 2 ? chair(TX + x + 0.3, TZ + z + 0.3, { a, name: "odd_chair" }) : stool(TX + x + 0.3, TZ + z + 0.3, { name: "kitchen_stool" })));
  add(bench(TX - 0.1, TZ + 0.9, 0.9, { name: "shift_bench" }));
  for (const [bx, up] of [[-1.1, true], [-0.7, true], [-0.3, false], [0.1, true], [0.5, true], [0.85, false]]) add(tinBowl(TX + bx, TOP + 0.015, TZ + (up ? -0.15 : 0.18), { up }));
  add(loaf(TX + 1.0, TOP + 0.014, TZ + 0.1, { name: "relief_loaf", r: 0.1 })); add(jug(TX - 0.5, TOP + 0.014, TZ + 0.2, { name: "water_jug" })); add(cup(TX + 0.3, TOP + 0.014, TZ + 0.25));
  add(K.shape([TX + 1.2, TOP, TZ - 0.2, TX + 1.4, TOP + 0.08, TZ], (x, y, z, T) => T(box(x, y, z, TX + 1.3, TOP + 0.02, TZ - 0.1, 0.05, 0.02, 0.04), ID.crumb ?? ID.bone)));   // the heel of bread at the place nobody sits
  add(K.stairs(HX - 0.6, 0, HZ - 0.3, Math.PI, 9, 0.85, 0.2, 0.26, ID.darkwood));
  for (const [x, z, a, id] of [[-2.7, 1.6, 0.2, ID.bonecloth], [-2.5, 2.1, 1.6, ID.canvas], [-1.9, 1.9, 0.6, ID.navy]]) add(rolledMattress(x, z, { a, id }));
  add(sack(2.2, 0, 1.8, { s: 0.28, name: "bundled_belongings", id: ID.sack ?? ID.canvas }));
  // the washing on a short line in the corner by the stove, where it dries (2026-10-24: strung across the room over the bulb, its
  // shadows were thrown up the limewash as black blotches)
  add(K.washing([-HX + 0.1, 2.35, 0.4], [-0.4, 2.35, -HZ + 0.1], 5, 9));
  add(photo(-1.6, 1.65, -HZ, { cut: true, name: "haldane_five" }));
  add(notice(-0.4, 1.55, -HZ, { name: "shift_table_list", w: 0.5, h: 0.62, seed: 12 }));
  const [st, sg] = potStove(-HX + 0.6, -HZ + 0.6, H, { name: "front_room_stove" }); add(st); R.L.push({ ...sg, I: sg.I * 0.5 });   // the stove low (plates pass 2026-10-24: at full it lit the corner wall above the table)
  add(cobweb([-HX + 0.02, H - 0.05, -HZ + 0.02], [1, 0, 0], [0, 0, 1], { size: 0.45, seed: 7 }));
  R.hang(TX, TZ, 1.85, { I: 1.0, name: "door_table_bulb" });
  R.L[R.L.length - 1].soft = 2.5;   // a soft bulb shadow (2026-10-24)
  // key: the bulb aimed down on the door table (plates pass 2026-10-24: bare at 12 it lit the clean limewash brighter than the
  // table, squint 37.5%); the bare bulb stays at 1 for the room
  R.L.push(aimLight(R.L[R.L.length - 1].pos, [TX, TOP, TZ], { type: 1, I: 15, key: "door_table_key", group: "lantern", soft: 2.5 }));
  spot("door_table", "read", [TX, 0, TZ + 1.5], "the door table on its trestles: ten families in shifts, the bowls stamped for relief");
  spot("heel", "look", [TX + 1.9, 0, TZ], "the heel of bread at the place nobody sits");
  spot("photograph", "read", [-1.6, 0, -HZ + 1.0], "the Haldane five on the wall, one of them cut out with scissors");
  R.marks.exits.push({ id: "stairs", at: [HX - 1.4, 0, 1.6], note: "the stairs, the back room under them" });
  return R.done([-220, 25, -90]);
}

export function church() {
  const HX = 3.6, HZ = 3.0, H = 4.6, R = e3room({ HX, HZ, H, floor: ID.slab, wall: ID.limewash, patch: ID.bone, windows: [{ cut: [-HX - 0.12, 2.8, -0.6, 0.3, 1.3, 0.45] }], cell: 1.6 });
  const { add, spot } = R;
  for (let r = 0; r < 4; r++) { add(pew(-0.9, -0.2 + r * 0.85, 1.4)); }
  add(pulpit(2.2, -1.6));
  add(K.shape([-1.6, 0.8, -HZ, 0.6, 3.6, -HZ + 0.25], (x, y, z, T) => { T(box(x, y, z, -0.5, 2.2, -HZ + 0.08, 1.0, 1.3, 0.04), ID.darkwood); T(box(x, y, z, -0.5, 2.15, -HZ + 0.14, 1.05 + 0.03 * Math.sin(y * 9), 1.32, 0.02 + 0.02 * (0.5 + 0.5 * Math.sin(x * 7 + y * 3))), ID.bonecloth); }));   // the altarpiece under its sheet
  add(K.shape([-1.6, 0, -HZ + 0.2, 0.6, 1.1, -HZ + 1.1], (x, y, z, T) => { T(box(x, y, z, -0.5, 0.45, -HZ + 0.65, 1.0, 0.45, 0.35), ID.darkwood); T(box(x, y, z, -0.5, 0.92, -HZ + 0.65, 1.05, 0.02, 0.38), ID.bonecloth); }));   // the table
  add(candle(-1.2, 0.94, -HZ + 0.6, { name: "altar_candle", lit: false })); add(candle(0.2, 0.94, -HZ + 0.6, { name: "altar_candle", lit: false }));
  add(K.shape([2.9, 0.9, -HZ, 3.5, 2.0, -HZ + 0.1], (x, y, z, T) => T(box(x, y, z, 3.2, 1.45, -HZ + 0.03, 0.3, 0.5, 0.02), ID.darkwood)));   // the hymn board
  add(notice(1.0, 1.6, -HZ, { name: "well_house_notice", seed: 21 }));
  add(K.shape([-HX, 3.2, -1.5, -HX + 0.2, 4.4, 1.5], (x, y, z, T) => T(box(x, y, z, -HX + 0.05, 3.9, 0, 0.03, 0.04, 1.4), ID.darkwood)));
  for (const zz of [-1.6, 0.6, 2.0]) add(timber("roof_tie", [0, H - 0.2, zz], [HX, 0.1, 0.09], ID.darkwood));
  spot("pulpit", "look", [1.4, 0, -0.6], "the pulpit: \"water that comes down the hill\"");
  spot("altar", "read", [-0.5, 0, -1.6], "the altarpiece under a sheet");
  // pass 2 (2026-10-23): the sleet light was spent on the cut-away wall and left no pool. The window's light now sits
  // inside the glass and falls in a long grey wedge across the slabs to the front pew, the room's one key.
  R.L.push({ pos: [-HX + 0.3, 3.3, -0.6], type: 1, I: 30, reach: 11, key: "window_sleet", group: "window", cone: [1, -0.75, 0.12], mode: 2 });
  R.marks.exits.push({ id: "hall", at: [HX - 0.5, 0, 2.4], note: "through to the church hall, the ward" });
  return R.done([-150, 75, 20]);
}

// Era 3 interiors and the Well House yard (Allocation, year 20; design/eras/era3.md sections 5 and 11), plates
// package, 2026-10-22. Shares e3room() with q3_rooms.mjs.
//   ward(): the church hall turned fever ward: cots in two rows, screens, carbolic, a stove, brownout bulbs.
//   squad(): the militia squad room: rifle rack, a table with cards and mugs, greatcoats, the duty board, a stove.
//   brackKitchen(): the Brack kitchen at year 20: the range, the table, the cracked wedding photograph.
//   farBank(): Aaron's estate kitchen on the far bank at year 46 (look L4, its window on era 3's town).
//   wellHouse({ burning }): the Well House in Pask's rented yard, fenced "for health"; burning: the night of the fire.
import { box, cyl, cap, ell, sph } from "../sdf.mjs";
import { n3, fb3 } from "../props/noise.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { distinct } from "../props/shell.mjs";
import { timber, bench, stool, barrel, bucket, doorLeaf } from "../props/wood.mjs";
import { cup, jug, loaf, plate } from "../props/food.mjs";
import { sack, cobweb, ropeCoil } from "../props/gear.mjs";
import { chair, cot, screen, coatRail, rifleRack, potStove, notice, chalkCross, photo, tinBowl } from "../props/e3_room.mjs";
import { flameKind } from "../props/e3_fire.mjs";
const hashF = (k, s) => { let h = Math.imul(k + 7, 374761393) ^ Math.imul(s + 3, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
import { e3room } from "./q3_rooms.mjs";

export function ward() {
  const HX = 3.8, HZ = 2.8, H = 3.6, R = e3room({ HX, HZ, H, floor: ID.boards, wall: ID.limewash, patch: ID.bone, windows: [{ cut: [-HX - 0.12, 2.3, -1.0, 0.3, 0.8, 0.4] }], cell: 1.6 });
  const { add, spot } = R;
  [-2.4, -1.0, 0.4, 1.8].forEach((x, i) => add(cot(x, -1.5, { a: 0, empty: i === 2, seed: i, name: i === 1 ? "bets_cot" : "iron_cot" })));
  [-2.4, -1.0, 0.4].forEach((x, i) => add(cot(x, 1.3, { a: Math.PI, seed: i + 7 })));
  add(screen(-1.7, -0.3, { a: 0.1 })); add(screen(1.1, 0.1, { a: -0.2 }));
  add(K.shape([2.6, 0, -HZ + 0.1, 3.6, 1.3, -HZ + 0.7], (x, y, z, T) => {   // the dressing table: carbolic, a basin, the jug
    T(box(x, y, z, 3.1, 0.4, -HZ + 0.4, 0.45, 0.4, 0.26), ID.darkwood); T(box(x, y, z, 3.1, 0.81, -HZ + 0.4, 0.48, 0.015, 0.28), ID.oakx);
    for (const [bx, h] of [[2.8, 0.2], [2.92, 0.16], [3.05, 0.22]]) { T(cyl(x, y, z, bx, 0.83 + h / 2, -HZ + 0.25, 0.035, h / 2), ID.glass); T(cyl(x, y, z, bx, 0.84 + h, -HZ + 0.25, 0.014, 0.02), ID.tar); }
    T(Math.max(ell(x, y, z, 3.3, 0.86, -HZ + 0.45, 0.17, 0.07, 0.17), -ell(x, y, z, 3.3, 0.9, -HZ + 0.45, 0.15, 0.06, 0.15)), ID.bone);
  }));
  add(jug(3.3, 0.83, -HZ + 0.25, { name: "ward_jug", s: 0.9 }));
  add(bucket(3.2, 0, -0.4, { name: "slop_pail" }));
  add(chair(-0.3, -0.4, { a: 2.6, name: "nurses_chair" }));
  add(notice(-2.6, 1.8, -HZ, { name: "quarantine_notice", seed: 31 }));
  add(chalkCross([-0.9, 1.7, -HZ + 0.02], "z", { name: "quarantine_chalk" }));
  const [st, sg] = potStove(-HX + 0.6, 0.4, H, { name: "ward_stove" }); add(st); R.L.push(sg);
  add(K.shape([1.3, 0, 2.0, 2.6, 0.8, 2.7], (x, y, z, T) => { T(box(x, y, z, 1.9, 0.42, 2.35, 0.55, 0.06, 0.28), ID.timber); for (const s of [-1, 1]) { T(cyl(z, y, x, 2.35, 0.32, 1.9 + s * 0.6, 0.3, 0.025) , ID.iron); } T(cap(x, y, z, [2.45, 0.48, 2.35], [2.85, 0.75, 2.35], 0.018), ID.timber); }));   // the handcart
  for (const zz of [-1.4, 0.9]) add(timber("hall_tie", [0, H - 0.15, zz], [HX, 0.09, 0.08], ID.darkwood));
  R.hang(-1.7, -0.6, 2.6, { I: 9, name: "ward_bulb" }); R.hang(1.1, -0.6, 2.6, { I: 9, name: "ward_bulb" });   // 5 under the brownout left the ward near black (2026-10-24)
  spot("bed", "look", [-1.0, 0, -0.1], "the one bed by the stove");
  spot("handcart", "look", [1.9, 0, 1.5], "the handcart they brought her in on; its wheel squeaks");
  R.marks.exits.push({ id: "church", at: [HX - 0.4, 0, 1.0], note: "back through to the church" });
  return R.done([-200, 20, -60]);
}

export function squad() {
  const HX = 2.9, HZ = 2.3, H = 2.9, R = e3room({ HX, HZ, H, floor: ID.boards, wall: ID.limewash, patch: ID.slate, windows: [{ cut: [-HX - 0.12, 1.6, 0.9, 0.3, 0.6, 0.4] }] });
  const { add, spot } = R, TX = 0.3, TZ = -0.2;
  add(rifleRack(-HX, -1.0, 6));
  add(K.table(TX, 0, TZ, 0.9, 0.5, 0.76, 0, ID.oakx));
  for (const [x, z, a] of [[-0.7, 0, 1.57], [0.3, -0.85, 0], [1.3, 0.2, -1.57], [0.6, 0.75, 3.1]]) add(chair(TX + x - 0.3, TZ + z, { a, name: "squad_chair" }));
  add(K.shape([TX - 0.8, 0.76, TZ - 0.4, TX + 0.8, 0.9, TZ + 0.4], (x, y, z, T) => {   // cards dealt, a tally, a lamp chimney with no lamp
    for (let k = 0; k < 6; k++) T(box(x, y, z, TX - 0.45 + k * 0.12, 0.765, TZ + 0.1 * Math.sin(k * 2), 0.03, 0.002, 0.045), ID.paper);
    T(box(x, y, z, TX + 0.4, 0.766, TZ - 0.2, 0.1, 0.003, 0.14), ID.paper);
  }));
  for (const [x, z] of [[-0.4, 0.25], [0.1, -0.3], [0.55, 0.2]]) add(cup(TX + x, 0.775, TZ + z, { id: ID.iron, name: "enamel_mug" }));
  add(coatRail(1.0, -HZ, 5, { name: "greatcoat_pegs", ids: [ID.navy, ID.navy, ID.oilskin, ID.navy, ID.darkwood] }));
  add(K.shape([-1.6, 1.0, -HZ, -0.2, 2.1, -HZ + 0.05], (x, y, z, T) => T(box(x, y, z, -0.9, 1.55, -HZ + 0.02, 0.65, 0.5, 0.015), ID.slate)));   // the duty board
  add(notice(-1.25, 1.65, -HZ + 0.03, { name: "duty_roster", w: 0.36, h: 0.48, seed: 41 })); add(notice(-0.55, 1.5, -HZ + 0.03, { name: "crowd_orders", w: 0.32, h: 0.4, seed: 43 }));
  const [st, sg] = potStove(2.2, -1.5, H, { name: "squad_stove" }); add(st); R.L.push(sg);
  add(K.shape([2.0, 0, 0.6, 2.8, 0.4, 1.4], (x, y, z, T) => { for (const [bx, bz] of [[2.2, 0.8], [2.5, 1.1]]) { T(cyl(x, y, z, bx, 0.12, bz, 0.09, 0.12), ID.leather ?? ID.darkwood); T(cyl(x, y, z, bx, 0.3, bz, 0.07, 0.08), ID.leather ?? ID.darkwood); } }));   // boots by the stove (Aaron's, era3.md s11)
  add(bench(-1.2, 1.7, 0.8, { name: "squad_bench" }));
  R.hang(TX, TZ, 1.9, { I: 9, name: "squad_bulb" });
  spot("boots", "look", [2.0, 0, 0.9], "a pair of boots too big for the boy who brought them");
  spot("roster", "read", [-1.0, 0, -1.2], "the duty board: the square at noon, the scale");
  R.marks.exits.push({ id: "street", at: [HX - 0.4, 0, 1.7], note: "the door to the yard" });
  return R.done([-200, 20, 80]);
}

export function brackKitchen() {
  const HX = 2.5, HZ = 2.1, H = 2.6, R = e3room({ HX, HZ, H, floor: ID.slab, wall: ID.limewash, patch: ID.mustard, windows: [{ cut: [0.8, 1.5, -HZ - 0.12, 0.42, 0.45, 0.3] }] });
  const { add, spot } = R, TX = 0.4, TZ = -0.2;
  add(K.shape([-HX, 0, -HZ, -HX + 0.8, 1.5, -HZ + 1.3], (x, y, z, T) => {   // the black range in the chimney breast
    T(box(x, y, z, -HX + 0.35, 0.42, -HZ + 0.65, 0.35, 0.42, 0.55), ID.iron); T(box(x, y, z, -HX + 0.35, 0.86, -HZ + 0.65, 0.37, 0.02, 0.57), ID.iron);
    T(box(x, y, z, -HX + 0.7, 0.35, -HZ + 0.45, 0.01, 0.12, 0.15), ID.stovefire); T(box(x, y, z, -HX + 0.7, 0.35, -HZ + 0.9, 0.01, 0.15, 0.18), ID.iron);
    T(box(x, y, z, -HX + 0.35, 1.35, -HZ + 0.65, 0.4, 0.03, 0.6), ID.darkwood);   // the mantel
  }));
  R.L.push({ pos: [-HX + 0.9, 0.4, -HZ + 0.45], type: 1, I: 1.8, reach: 3, key: "range", group: "stove" });
  add(K.table(TX, 0, TZ, 0.7, 0.45, 0.76, 0, ID.oakx));
  for (const [x, z, a] of [[-0.85, 0, 1.57], [0, -0.7, 0], [0.1, 0.7, 3.1]]) add(chair(TX + x, TZ + z, { a, name: "kitchen_chair" }));
  add(jug(TX + 0.2, 0.775, TZ - 0.1, { name: "brack_jug" })); add(cup(TX - 0.2, 0.775, TZ + 0.15, { id: ID.iron, name: "enamel_mug" })); add(cup(TX + 0.35, 0.775, TZ + 0.2, { id: ID.iron, name: "enamel_mug" }));
  add(plate(TX - 0.3, 0.776, TZ - 0.15, { id: ID.bone, name: "plate" })); add(loaf(TX - 0.3, 0.79, TZ - 0.15, { r: 0.07, name: "relief_heel" }));
  add(photo(0.0, 1.7, -HZ, { cracked: true, n: 2, w: 0.3, h: 0.38, name: "brack_wedding_photograph" }));
  add(K.shape([1.6, 0.8, -HZ, 2.4, 1.4, -HZ + 0.3], (x, y, z, T) => { T(box(x, y, z, 2.0, 0.9, -HZ + 0.15, 0.4, 0.015, 0.14), ID.timber); for (const [bx, up] of [[1.75, true], [2.0, true], [2.25, false]]) T(Math.max(ell(x, y, z, bx, up ? 0.97 : 0.95, -HZ + 0.15, 0.09, 0.05, 0.09), up ? -ell(x, y, z, bx, 1.0, -HZ + 0.15, 0.075, 0.045, 0.075) : -(y - 0.915)), ID.iron); }));
  add(coatRail(-1.2, -HZ + 0.0, 2, { name: "militia_coat_peg", ids: [ID.navy, ID.oilskin] }));
  add(bucket(-HX + 0.9, 0, 0.6, { name: "coal_scuttle" }));
  R.hang(TX, TZ, 1.75, { I: 7, name: "brack_bulb" });
  spot("photograph", "look", [0.0, 0, -HZ + 1.0], "the wedding photograph, cracked across the glass");
  R.marks.exits.push({ id: "street", at: [-HX + 0.4, 0, 1.4], note: "the door to Mill Street" });
  return R.done([-90, 20, -220]);
}

export function farBank() {
  const HX = 2.4, HZ = 2.0, H = 2.5, R = e3room({ HX, HZ, H, floor: ID.boards, wall: ID.limewash, patch: ID.teal, windows: [{ cut: [-0.2, 1.45, -HZ - 0.12, 0.7, 0.5, 0.3] }] });
  const { add, spot } = R, TX = 0.5, TZ = 0.0;
  add(K.shape([TX - 0.75, 0, TZ - 0.5, TX + 0.75, 0.8, TZ + 0.5], (x, y, z, T) => { T(box(x, y, z, TX, 0.745, TZ, 0.65, 0.016, 0.42), ID.bone); T(Math.max(box(x, y, z, TX, 0.745, TZ, 0.66, 0.012, 0.43), -box(x, y, z, TX, 0.745, TZ, 0.645, 0.02, 0.415)), ID.iron); for (const sx of [-1, 1]) for (const sz of [-1, 1]) T(cyl(x, y, z, TX + sx * 0.58, 0.37, TZ + sz * 0.35, 0.016, 0.37), ID.iron); }));   // the formica table on tube legs: cream top, steel edge (pass 3: the teal top and the oxblood lino read teal on pink under the window, 2026-10-24; the floor is worn boards)
  for (const [x, z, a] of [[-0.85, 0, 1.57], [0.2, 0.7, 3.1]]) add(chair(TX + x, TZ + z, { a, name: "tube_chair", id: ID.iron }));
  add(tinBowl(TX - 0.1, 0.762, TZ - 0.05, { name: "stamped_relief_bowl" }));
  add(cup(TX + 0.3, 0.762, TZ + 0.1, { id: ID.bone, name: "tea_cup" }));
  add(K.shape([-HX, 0, -HZ, -HX + 0.65, 1.0, -HZ + 1.6], (x, y, z, T) => { T(box(x, y, z, -HX + 0.32, 0.45, -HZ + 0.8, 0.3, 0.45, 0.78), ID.bone); T(box(x, y, z, -HX + 0.32, 0.92, -HZ + 0.8, 0.31, 0.015, 0.8), ID.slate); T(Math.max(box(x, y, z, -HX + 0.32, 0.88, -HZ + 0.4, 0.22, 0.05, 0.2), -box(x, y, z, -HX + 0.32, 0.9, -HZ + 0.4, 0.2, 0.05, 0.18)), ID.iron); }));   // the sink unit
  add(K.shape([-1.2, 2.25, -HZ, 1.0, 2.35, -HZ + 0.2], (x, y, z, T) => { T(box(x, y, z, -0.1, 2.32, -HZ + 0.1, 0.6, 0.03, 0.05), ID.bone); T(cyl(z, y, x, -HZ + 0.1, 2.28, -0.1, 0.022, 0.55), ID.lantern); }));   // the fluorescent tube, off
  add(photo(1.6, 1.6, -HZ, { cut: true, name: "haldane_five_copy" }));
  add(K.shape([-0.9, 2.0, -HZ - 4.5, 0.5, 2.6, -HZ - 3.6], (x, y, z, T) => T(box(x, y, z, -0.2, 2.2, -HZ - 4, 0.6, 0.25, 0.3), ID.brickdark)));   // the town's roofs across the river, through the glass
  R.L.push({ pos: [-0.2, 1.6, -HZ + 0.3], type: 2, I: 0, reach: 1, key: "tube", group: "tube" });
  // pass 2 (2026-10-23): the walls read olive and the room underlit. Limewash in place of bone, and the river window's
  // grey daylight placed inside the glass so it reaches the table and the bowl: the room's one key.
  R.L.push({ pos: [-0.2, 1.55, -HZ + 0.35], type: 1, I: 26, reach: 9, key: "window_day", group: "window", cone: [0.05, -0.3, 1], mode: 2 });
  spot("bowl", "read", [TX - 0.1, 0, TZ + 0.9], "the stamped relief bowl, kept 26 years");
  spot("window", "look", [-0.2, 0, -HZ + 0.9], "the window: the town across the river, the old roofs");
  R.marks.exits.push({ id: "stair", at: [HX - 0.4, 0, 1.5], note: "the estate stair" });
  return R.done([-60, 35, -240]);
}

// The Well House: a low limewashed prayer house of brick and timber in Pask's rented yard, its door on the yard,
// a back window high in the gable end; a board fence put round it "for health", the notice on the gate.
export function wellHouse({ burning = false } = {}) {
  const W = makeWorld({ cell: 2, margin: 0.5 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const BX = -1.5, BZ = -2.5, bx = 2.6, bz = 1.8, bh = 2.6;
  W.ground((x, y, z, T) => {
    T(y + 0.02 * Math.sin(x * 1.3) * Math.sin(z * 1.1) - 0.04 * Math.max(0, 1 - Math.hypot(x - 1.5, z - 1.5) / 3), ID.mud);
    T(Math.max(Math.abs(x - 2.5 - 0.3 * Math.sin(z * 0.5)) - 0.5, Math.abs(z) - 6, y - 0.01), ID.cobble);
    const wall = Math.max(box(x, y, z, BX, bh / 2, BZ, bx, bh / 2, bz), -box(x, y, z, BX, bh / 2 + 0.01, BZ, bx - 0.2, bh / 2, bz - 0.2));
    const door = box(x, y, z, BX + 0.6, 1.0, BZ + bz, 0.45, 1.0, 0.3), win = box(x, y, z, BX - bx, 1.9, BZ - 0.5, 0.3, 0.35, 0.3), win2 = box(x, y, z, BX - 0.8, 1.6, BZ + bz, 0.35, 0.35, 0.3);
    T(Math.max(wall, -door, -win, -win2), burning ? ID.brickdark : ID.limewash);
    const roof = Math.max(Math.abs(y - bh - 1.0 + Math.abs(z - BZ) * 0.6) - 0.08, Math.abs(x - BX) - bx - 0.3, Math.abs(z - BZ) - bz - 0.35);
    T(burning ? Math.max(roof, -box(x, y, z, BX - 0.8, bh + 0.8, BZ, 1.0, 0.8, 1.5)) : roof, ID.tile);
    T(box(x, y, z, BX + 1.8, bh + 1.3, BZ - 0.4, 0.22, 0.6, 0.22), ID.brick);   // the chimney
  });
  W.add(doorLeaf([BX + 0.15, 0, BZ + bz + 0.05], 0.9, 2.0, 0.0, { name: "well_house_door", seed: 11 }));
  W.add(K.shape([BX + 1.15, 0, BZ + bz, BX + 1.5, 1.4, BZ + bz + 0.4], (x, y, z, T) => T(box(x, y, z, BX + 1.2, 0.95, BZ + bz + 0.15, 0.06, 0.06, 0.15), ID.iron)));   // the bar's staple
  if (burning) W.add(K.shape([BX - 0.6, 0, BZ + bz + 0.05, BX + 1.8, 1.4, BZ + bz + 0.5], (x, y, z, T) => T(cap(x, y, z, [BX - 0.4, 1.0, BZ + bz + 0.2], [BX + 1.6, 1.0, BZ + bz + 0.2], 0.05), ID.timber)));   // the bar across the door
  // the fence "for health": boards on rails round three sides, a gap at the back where a board is down, the gate
  W.add(K.shape([-6.5, 0, -6.2, 3.8, 1.8, 1.8], (x, y, z, T) => {
    const run = (ax, az, bx2, bz2, gap) => { const L2 = Math.hypot(bx2 - ax, bz2 - az), ux = (bx2 - ax) / L2, uz = (bz2 - az) / L2, u = (x - ax) * ux + (z - az) * uz, v = -(x - ax) * uz + (z - az) * ux, k = Math.floor(u / 0.16);
      if (u < 0 || u > L2) return 9; if (gap && Math.abs(u - gap) < 0.25) return 9; const h = 1.55 + 0.1 * Math.sin(k * 2.3);
      return Math.min(Math.max(Math.abs(v) - 0.015, Math.abs(u - (k + 0.5) * 0.16) - 0.07, Math.abs(y - h / 2) - h / 2), Math.max(Math.abs(v + 0.04) - 0.02, Math.min(Math.abs(y - 0.4), Math.abs(y - 1.3)) - 0.04)); };
    T(Math.min(run(-6, 1.2, 0.2, 1.2), run(1.4, 1.2, 3.3, 1.2), run(-6, -5.8, -6, 1.2, 3.0), run(-6, -5.8, 3.3, -5.8), run(3.3, -5.8, 3.3, 1.2)), burning ? ID.greyx ?? ID.timber : ID.timber);
  }));
  W.add(notice(0.8, 1.3, 1.22, { name: "for_health_notice", seed: 51 }));
  W.add(K.shape([0.15, 0, 0.9, 1.45, 1.6, 1.5], (x, y, z, T) => T(Math.max(box(x, y, z, 0.8, 0.8, 1.2, 0.6, 0.78, 0.02), -box(x, y, z, 0.8, 0.8, 1.2, 0.5, 0.65, 0.05)), ID.timber)));   // the gate frame
  W.add(barrel(2.9, 0, -4.2, { name: "pask_water_butt" })); W.add(bucket(2.5, 0, -3.6, { name: "fire_bucket" }));
  W.add(K.crateStack(-5.0, 0, -5.0, 3, 4)); W.add(sack(-4.4, 0, -4.4, { s: 0.3, name: "pask_sack" }));
  W.add(K.washing([3.3, 2.0, -5.8], [3.3, 2.0, 0.8], 5, 17));
  marks.spots.push({ id: "door", verb: "look", at: [BX + 0.6, 0, BZ + bz + 1.2], note: burning ? "the door, the bar across it, Gedge" : "the door of the Well House" });
  marks.spots.push({ id: "notice", verb: "read", at: [0.8, 0, 1.9], note: "the notice on the gate: closed for health" });
  marks.exits.push({ id: "lane", at: [2.5, 0, 3.5], note: "the lane to Mill Street" });
  if (burning) {
    // the fire inside: the windows and the broken roof glow; slow swells, never a strobe (era3.md s10, F5)
    W.add(K.shape([BX - bx - 0.2, 1.4, BZ - 0.9, BX - bx + 0.3, 2.3, BZ - 0.1], (x, y, z, T) => T(box(x, y, z, BX - bx + 0.05, 1.9, BZ - 0.5, 0.05, 0.33, 0.28), ID.porthole)));
    W.add(K.shape([BX - 1.2, 1.2, BZ + bz - 0.2, BX - 0.4, 2.0, BZ + bz + 0.1], (x, y, z, T) => T(box(x, y, z, BX - 0.8, 1.6, BZ + bz - 0.05, 0.33, 0.33, 0.05), ID.porthole)));
    // the flames through the broken roof. Pass 3 (2026-10-24): four thin capsules read as pale pins, and a bed of round
    // tongues read as bulbs, so the fire is now three ragged sheets across the hole (from above, a fire reads by its jagged
    // tops), with the charred rafters crossing in front. A smoke plume was tried and painted as a black post; smoke is left
    // to the shell. Colours from render/props/e3_fire.mjs, under the red rule.
    // the sheets of flame across the hole (seen from above a fire reads by its jagged tops, not by round tongues),
    // leaning downwind, one flame kind graded by height (render/props/e3_fire.mjs flameKind)
    const sheets = [[-0.95, 1.25, 0.3], [-0.15, 1.0, 2.1], [0.75, 0.8, 4.4]], FIRE = flameKind(bh, 1.2);
    W.add(K.shape([BX - 2.0, bh - 0.1, BZ - 1.6, BX + 1.4, bh + 2.4, BZ + 1.6], (x, y, z, T) => {
      let d = 1e9;
      for (const [sz, h0, ph] of sheets) {
        const yy = Math.max(0, y - bh), lx = x - 0.4 * yy * yy / h0, top = h0 * (0.45 + 0.35 * Math.abs(Math.sin(lx * 3.1 + ph)) + 0.25 * Math.abs(Math.sin(lx * 7.3 + ph * 2)) + 0.2 * (fb3(lx * 2.5, ph, sz) - 0.5));
        const th = 0.07 + 0.05 * (1 - Math.min(1, yy / h0)), e = Math.max(Math.abs(z - BZ - sz - 0.1 * Math.sin(lx * 4 + ph)) - th, (y - bh - top) * 0.5, bh + 0.05 - y, Math.abs(lx - BX + 0.75) - 0.95) + 0.02 * (n3(x * 11, y * 7 - ph, z * 11) - 0.5);
        d = Math.min(d, e);
      }
      T(d * 0.7, FIRE);
    }));
    W.add(K.shape([BX - 1.9, bh + 0.3, BZ - 1.5, BX + 0.3, bh + 1.3, BZ + 1.5], (x, y, z, T) => { for (const rz of [-1.0, -0.2, 0.7]) T(Math.max(Math.abs(z - BZ - rz) - 0.06, Math.abs(y - (bh + 0.5 + 0.35 * (1 - Math.abs(x - BX + 0.8))) ) - 0.06 - 0.02 * n3(x * 8, y * 8, z * 8), Math.abs(x - BX + 0.8) - 1.0), ID.coal); }));
    for (const [p, I] of [[[BX - 0.8, bh + 1.8, BZ], 28], [[BX - bx + 0.4, 1.9, BZ - 0.5], 10], [[BX - 0.8, 1.6, BZ + bz + 0.3], 13]]) L.push({ pos: p, type: 1, I, reach: 12, key: `fire${L.length}`, group: "fire" });
  } else {
    W.add(K.shape([BX - 1.2, 1.2, BZ + bz - 0.2, BX - 0.4, 2.0, BZ + bz + 0.1], (x, y, z, T) => T(box(x, y, z, BX - 0.8, 1.6, BZ + bz - 0.05, 0.33, 0.33, 0.03), ID.windowdim)));
    W.add(chalkCross([BX + 0.6, 1.4, BZ + bz + 0.12], "z", { name: "quarantine_chalk" }));
  }
  return { world: W.build(), marks, distinct: distinct(W), props: W.props.length, lights: (V = {}) => L.map((l) => ({ ...l, I: l.I * (V.fire ?? 1) })).concat(
    V.sun ? [{ pos: V.sun.pos, type: 3, I: V.sun.I, reach: 600, key: "sun", soft: V.sun.soft ?? 30 }] : [],
    V.moon ? [{ pos: V.moon.pos, type: 3, I: V.moon.I, reach: 600, key: "moon", soft: 20 }] : []) };
}

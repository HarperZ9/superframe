// Era 4 interiors, part 2 (year 70; design/eras/era4.md): Joss Haldane's flat with the door table and Anni's chair,
// Mira Saro's kitchen in year 103 (look L5, the tea glass), the mill floor stopping, the Well House floor rebuilt,
// and the far-bank estate's stairwell C with its broken bulb. Original code (plates agent, 2026-10-22).
import { ID, box, cyl, cap, slab, hash, prop, bbc } from "./prim.mjs";
import { lettering } from "./e4_kinds.mjs";
import { plasterShell, tube, bulb, chair, mug, teaGlass, kettle, cooker, sink, formicaTable, armchair, sideboard, radiator, panel, curtain, bottle, clock, binBag, papers } from "./e4_kit.mjs";
import { timber, bench } from "./wood.mjs";
import { sack } from "./gear.mjs";

const lamp = (W, L, r) => { W.add(r.p); if (r.l) L.push(r.l); };
const spot = (marks, id, verb, at, note) => marks.spots.push({ id, verb, at, note });
const bowl = (x, y, z, { id = ID.red, name = "plastic_bowl", r = 0.075 } = {}) => prop(name, bbc(x, y + 0.04, z, r + 0.01, 0.05, r + 0.01), (px, py, pz, T) => T(Math.max(Math.hypot(px - x, py - y - r, pz - z) - r, -(Math.hypot(px - x, py - y - r, pz - z) - r + 0.006), py - y - r * 0.7), id));

// Joss's flat in Haldane Yard: the door table Ilo made, its edge cut with initials; Anni's chair by the stove; red
// plastic bowls; the last fair bowl on the sill with a plant in it. Key: the one bulb over the table.
export function dressJoss(W, L, marks, { HX = 2.4, HZ = 2.0, H = 2.5 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.lino, wall: ID.paper4, cuts: [[-0.6, 1.45, -HZ - 0.08, 0.45, 0.45, 0.12]] }));
  W.add(panel("yard_window", -0.6, 1.45, -HZ - 0.05, 0.9, 0.9, ID.windowdim, { face: "z", th: 0.01, frame: ID.bone })); W.add(timber("sill", [-0.6, 0.98, -HZ + 0.08], [0.55, 0.02, 0.1], ID.bone));
  W.add(bowl(-0.75, 1.0, -HZ + 0.08, { id: ID.clay, name: "fair_bowl", r: 0.08 })); W.add({ name: "plant", bb: [-0.95, 1.05, -HZ - 0.15, -0.55, 1.4, -HZ + 0.3], f: (x, y, z, T) => { for (let k = 0; k < 6; k++) { const a = k * 1.05; T(cap(x, y, z, [-0.75, 1.07, -HZ + 0.08], [-0.75 + Math.cos(a) * 0.12, 1.25 + 0.05 * (k % 2), -HZ + 0.08 + Math.sin(a) * 0.1], 0.012), ID.green); } } });
  const ini = lettering("e4initials", ["A.H.  L.H.  J.H."], { o: [-0.95, 0.745, 0.79], u: [1, 0, 0], v: [0, -1, 0], cell: 0.0045, ink: ["lw tar", 0.2], ground: ["lw wood", 0.42] });
  W.add({ name: "door_table", bb: [-1.3, 0, -0.5, 0.6, 0.8, 0.85], f: (x, y, z, T) => { T(slab(x, y, z, [-0.35, 0.74, 0.17], [0.9, 0.035, 0.6], 0.01), ID.oakx); T(Math.max(Math.abs(x + 0.35) - 0.9, Math.abs(y - 0.74) - 0.03, Math.abs(z - 0.775) - 0.004), ini); for (const sx of [-1, 1]) for (const sz of [-1, 1]) T(slab(x, y, z, [-0.35 + sx * 0.8, 0.36, 0.17 + sz * 0.5], [0.035, 0.36, 0.035], 0.006), ID.oaky); for (const hz of [-0.2, 0.5]) T(slab(x, y, z, [-1.1, 0.776, hz], [0.12, 0.003, 0.02], 0.002), ID.iron); } });
  for (const [x, z] of [[-0.9, 0.1], [-0.4, 0.3], [0.1, 0.05]]) W.add(bowl(x, 0.775, z));
  W.add(mug(0.3, 0.775, 0.5)); W.add(papers(-1.0, 0.775, 0.55, { n: 2, name: "pay_slips" }));
  for (const [x, z, a] of [[-0.35, -0.65, 0], [-0.35, 1.05, Math.PI]]) W.add(chair(x, z, { a }));
  W.add(armchair(1.5, -0.9, { a: -0.6, id: ID.oilskin, name: "annis_chair" })); W.add({ name: "knitting_blanket", bb: [1.1, 0.4, -1.3, 1.9, 0.8, -0.6], f: (x, y, z, T) => T(slab(x, y, z, [1.5, 0.52, -0.85], [0.3, 0.05, 0.25], 0.05) + 0.004 * Math.sin(x * 60) * Math.sin(z * 60), ID.rug) });
  W.add(cooker(-HX + 0.35, -1.3, { a: Math.PI / 2 })); W.add(kettle(-HX + 0.3, 0.92, -1.2)); W.add(sink(-HX + 0.32, 0.0, { a: Math.PI / 2 })); W.add(radiator(1.0, -HZ + 0.12, { w: 0.7 }));
  W.add(panel("mill_photo", 1.4, 1.65, -HZ + 0.02, 0.5, 0.35, ID.slate, { frame: ID.darkwood })); W.add(clock(-HX + 0.04, 2.0, 1.2, { face: "x" }));
  lamp(W, L, bulb(-0.35, H - 0.75, 0.17, { drop: 0.7, I: 3.2, name: "table_bulb" }));
  spot(marks, "table", "read", [-0.35, 0, 1.5], "the door table: initials cut all round the edge, A.H. the oldest with a line through it");
  spot(marks, "chair", "talk", [1.2, 0, -0.1], "Anni's chair: the blanket on it, turned to the stove");
  marks.exits.push({ id: "yard", at: [HX - 0.4, 0, 1.4], note: "the door down to Haldane Yard" });
}

// Mira Saro's kitchen on Mill Street, year 103 (look L5): the guest's seat, the tea glass, the samovar-shaped kettle, a
// Vell rug on the wall, the window. Key: the low lamp on the table; the window behind is the year 70 street (L8).
export function dressSaro(W, L, marks, { HX = 2.3, HZ = 1.9, H = 2.5 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.terrazzo, wall: ID.gloss, cuts: [[0.9, 1.45, -HZ - 0.08, 0.5, 0.55, 0.12]] }));
  W.add(panel("night_window", 0.9, 1.45, -HZ - 0.05, 1.0, 1.1, ID.windowdim, { face: "z", th: 0.01, frame: ID.bone })); W.add(curtain(0.25, 2.1, -HZ + 0.06, { w: 0.25, h: 1.3, id: ID.cobalt }));
  W.add(panel("vell_rug", -HX + 0.02, 1.4, -0.3, 1.5, 1.1, ID.rug, { face: "x", th: 0.012 })); W.add(panel("rug_border", -HX + 0.01, 1.4, -0.3, 1.6, 1.2, ID.mustard, { face: "x", th: 0.008 }));
  W.add(formicaTable(-0.3, 0.2, { hx: 0.55, hz: 0.4, name: "kitchen_table" })); for (const [x, z, a] of [[-0.3, -0.45, 0], [-0.3, 0.85, Math.PI]]) W.add(chair(x, z, { a }));
  W.add(teaGlass(-0.25, 0.74, 0.45)); W.add(teaGlass(-0.4, 0.74, -0.05, { name: "tea_glass_hers" })); W.add({ name: "sugar_bowl", bb: [-0.05, 0.74, 0.0, 0.15, 0.86, 0.2], f: (x, y, z, T) => T(Math.hypot(x - 0.05, (y - 0.78) * 1.3, z - 0.1) - 0.055, ID.cobalt) });
  W.add(kettle(1.7, 0.92, -HZ + 0.28, { name: "tea_kettle" })); W.add(cooker(1.75, -HZ + 0.35)); W.add(sink(0.9, -HZ + 0.32));
  W.add(sideboard(-HX + 0.3, 1.2, { hx: 0.5, a: Math.PI / 2 })); W.add(panel("photo_anzo", -HX + 0.02, 1.7, 1.2, 0.3, 0.4, ID.slate, { face: "x", frame: ID.darkwood }));
  lamp(W, L, bulb(-0.3, 1.6, 0.2, { drop: 0.85, I: 2.6, name: "table_lamp" }));
  L.push({ pos: [0.9, 2.2, -HZ - 3], type: 0, I: 8, reach: 7, key: "year70_sodium", group: "sodium", cone: [0, -0.3, 1], mode: 2 });
  spot(marks, "tea_glass", "read", [-0.3, 0, 1.3], "the tea glass at the guest's place: the brass holder, sugar beside it");
  marks.exits.push({ id: "stair", at: [HX - 0.4, 0, 1.3], note: "the stair down to Mill Street" });
}

// a spinning frame: a long green-painted bed, a creel of bobbins on top, the drafting rollers, the spindle rail
const frame = (x, z, len, { name = "spinning_frame", seed = 1 } = {}) => prop(name, bbc(x, 0.9, z, len / 2 + 0.1, 0.95, 0.5), (px, py, pz, T) => {
  T(slab(px, py, pz, [x, 0.45, z], [len / 2, 0.45, 0.32], 0.02), ID.machine); T(slab(px, py, pz, [x, 1.05, z], [len / 2, 0.06, 0.22], 0.01), ID.machine);
  T(cap(px, py, pz, [x - len / 2, 0.98, z + 0.34], [x + len / 2, 0.98, z + 0.34], 0.03), ID.steel); T(cap(px, py, pz, [x - len / 2, 0.98, z - 0.34], [x + len / 2, 0.98, z - 0.34], 0.03), ID.steel);
  const k = Math.round((px - x) / 0.16); if (Math.abs(k * 0.16) < len / 2 - 0.05) for (const s of [-1, 1]) { T(cyl(px, py, pz, x + k * 0.16, 1.32, z + s * 0.12, 0.035, 0.12), hash(k, seed, s + 2) < 0.12 ? ID.steel : ID.bone); T(cyl(px, py, pz, x + k * 0.16, 0.76, z + s * 0.36, 0.012, 0.14), ID.steel); }
});
// The mill floor: two rows of spinning frames down a fifty-metre room cut to its first bays, the line shaft overhead
// with its belts, the great wheel's guard at the back. Key: sodium high bays, and the windows' last daylight.
export function dressMillFloor(W, L, marks, { HX = 6.0, HZ = 3.4, H = 4.8 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.concrete, wall: ID.brick4, sill: 0.5, skirt: ID.tar, cuts: [-3.6, -1.2, 1.2, 3.6].map((cx) => [cx, 2.6, -HZ - 0.08, 0.7, 1.2, 0.12]) }));
  for (const cx of [-3.6, -1.2, 1.2, 3.6]) W.add(panel("mill_window", cx, 2.6, -HZ - 0.05, 1.4, 2.4, ID.windowdim, { face: "z", th: 0.01, frame: ID.iron }));
  // glazing bars: small panes in an iron grid, some panes painted over (2026-10-24: the plain lit panels blew out to white blocks)
  for (const cx of [-3.6, -1.2, 1.2, 3.6]) W.add(prop("mill_window_bars", bbc(cx, 2.6, -HZ + 0.0, 0.75, 1.25, 0.05), (px, py, pz, T) => {
    const u = (px - cx + 0.7) / 0.233, v = (py - 1.4) / 0.24, fu = u - Math.round(u), fv = v - Math.round(v), pane = Math.floor(u) * 7 + Math.floor(v);
    T(Math.max(Math.min(Math.abs(fu) * 0.233 - 0.012, Math.abs(fv) * 0.24 - 0.012), Math.abs(px - cx) - 0.7, Math.abs(py - 2.6) - 1.2, Math.abs(pz + HZ - 0.0) - 0.02), ID.iron);
    if ((pane * 37) % 11 < 3) T(Math.max(Math.abs(px - cx) - 0.7, Math.abs(py - 2.6) - 1.2, Math.abs(pz + HZ - 0.012) - 0.004, -Math.min(Math.abs(fu) * 0.233 - 0.012, Math.abs(fv) * 0.24 - 0.012)), ID.tar);
  }));
  for (const z of [-1.6, 0.6]) for (const x of [-3.1, 1.1]) W.add(frame(x, z, 3.6, { seed: Math.round(x + z * 3) }));
  for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) W.add(timber("iron_column", [x, H / 2, -0.5], [0.1, H / 2, 0.1], ID.iron));
  W.add({ name: "line_shaft", bb: [-HX, 3.6, -0.7, HX, 4.0, -0.3], f: (x, y, z, T) => { T(cap(x, y, z, [-HX, 3.8, -0.5], [HX, 3.8, -0.5], 0.045), ID.steel); const k = Math.round(x / 1.6); T(Math.max(Math.abs(Math.hypot(y - 3.8, z + 0.5) - 0.2) - 0.03, Math.abs(x - k * 1.6) - 0.06), ID.iron); } });
  for (const x of [-4.0, -2.4, 0.8, 2.4]) W.add({ name: "drive_belt", bb: [x - 0.1, 1.0, -1.7, x + 0.1, 4.0, -0.3], f: (px, py, pz, T) => T(Math.max(Math.abs(px - x) - 0.05, Math.abs((pz + 0.5) - (py - 3.8) * (1.1 / 2.6)) - 0.012, py - 3.8, 1.2 - py), ID.leather) });
  W.add({ name: "wheel_guard", bb: [-HX, 0, -HZ, -HX + 1.6, 3.4, -HZ + 1.0], f: (x, y, z, T) => { T(Math.max(Math.abs(Math.hypot(x + HX, y - 1.7) - 1.5) - 0.06, Math.abs(z + HZ - 0.45) - 0.12), ID.machine); T(Math.max(Math.hypot(x + HX, y - 1.7) - 0.2, Math.abs(z + HZ - 0.45) - 0.2), ID.steel); } });
  for (const [x, z] of [[4.9, 1.9], [5.3, 1.6], [4.6, 2.5]]) W.add(sack(x, 0, z, { s: 0.3, seed: Math.round(x * 7), name: "cotton_bale_sack" }));
  W.add(binBag(-0.2, 2.4, { s: 0.6, name: "waste_bin" })); W.add(panel("closure_notice", 2.4, 1.6, -HZ + 0.02, 0.5, 0.7, ID.paper, { face: "z" }));
  for (const x of [-3.0, 0.6, 4.2]) { L.push({ pos: [x, H - 0.3, 0.2], type: 0, I: 18, reach: 10, key: `bay_${x}`, group: "sodium", cone: [0, -1, 0], mode: 1 }); W.add(prop("high_bay", bbc(x, H - 0.3, 0.2, 0.3, 0.4, 0.3), (px, py, pz, T) => { T(Math.max(Math.hypot(px - x, pz - 0.2) - 0.25 * (H - py + 0.05) / 0.3, py - H + 0.05, H - 0.45 - py), ID.steel); T(Math.hypot(px - x, py - (H - 0.38), pz - 0.2) - 0.08, ID.sodium); T(cap(px, py, pz, [x, H - 0.1, 0.2], [x, H + 0.4, 0.2], 0.01), ID.iron); })); }
  L.push({ pos: [0, 4, -HZ - 6], type: 1, I: 40, reach: 14, key: "dusk_windows", group: "window", cone: [0, -0.3, 1], mode: 2 });   // I 40 under the plate's window emit 0.45
  spot(marks, "frames", "look", [0.0, 0, 2.2], "the frames stopping one by one, the bobbins left half spun");
  marks.exits.push({ id: "yard", at: [HX - 0.6, 0, 2.6], note: "the big doors to the yard" });
}

// The Well House floor, rebuilt after era 3's fire: new boards, rugs laid edge to edge, low benches round the walls,
// the reading desk, a shelf of books, tea glasses on a tray. Key: brass lamps hung low on chains.
export function dressWellFloor(W, L, marks, { HX = 3.0, HZ = 2.4, H = 3.0 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.oakx, wall: ID.limewash, sill: 0.45 }));
  for (const [x, z, id] of [[-1.4, -0.4, ID.rug], [0.2, -0.4, ID.carpet], [1.8, -0.4, ID.rug], [-0.6, 1.2, ID.carpet], [1.0, 1.2, ID.rug]]) W.add(prop("prayer_rug", bbc(x, 0.01, z, 0.8, 0.02, 0.8), (px, py, pz, T) => T(Math.max(Math.abs(px - x) - 0.75, Math.abs(pz - z) - 0.72, Math.abs(py - 0.006) - 0.006), id)));
  W.add(bench(0, -HZ + 0.35, HX - 0.3, { h: 0.4, name: "wall_bench" })); W.add(timber("left_bench", [-HX + 0.3, 0.4, 0], [0.2, 0.03, HZ - 0.4], ID.oakz));
  W.add(timber("reading_desk", [-0.2, 0.55, -1.5], [0.35, 0.55, 0.25], ID.darkwood)); W.add(timber("desk_slope", [-0.2, 1.12, -1.48], [0.4, 0.02, 0.3], ID.darkwood)); W.add(papers(-0.2, 1.14, -1.48, { n: 3, name: "open_book" }));
  W.add(timber("book_shelf", [1.8, 1.6, -HZ + 0.15], [0.9, 0.02, 0.14], ID.darkwood)); W.add(prop("books", bbc(1.8, 1.75, -HZ + 0.15, 0.9, 0.15, 0.14), (px, py, pz, T) => { const k = Math.floor((px - 0.9) / 0.06); T(Math.max(Math.abs(((px - 0.9) / 0.06 - k) - 0.5) * 0.06 - 0.026, Math.abs(py - 1.62 - 0.11 - 0.02 * hash(k, 1, 1)) - 0.11 - 0.02 * hash(k, 1, 1), Math.abs(pz + HZ - 0.15) - 0.11, Math.abs(px - 1.8) - 0.88), hash(k, 2, 2) < 0.3 ? ID.oxblood : hash(k, 2, 3) < 0.5 ? ID.navy : ID.leather); }));
  W.add(timber("tea_tray", [1.2, 0.03, 0.6], [0.25, 0.015, 0.18], ID.brass)); for (let k = 0; k < 4; k++) W.add(teaGlass(1.05 + (k % 2) * 0.25, 0.045, 0.5 + Math.floor(k / 2) * 0.18, { name: "tray_glass" }));
  W.add(panel("burn_mark", -HX + 0.02, 1.2, 1.4, 0.7, 1.4, ID.coal, { face: "x", th: 0.003 })); W.add(panel("new_board_patch", -HX + 0.03, 1.2, 1.4, 0.5, 1.1, ID.oaky, { face: "x", th: 0.004 }));
  for (const [x, z] of [[-1.0, 0.0], [1.0, 0.0]]) { W.add(prop("brass_lamp", bbc(x, 2.3, z, 0.15, 0.7, 0.15), (px, py, pz, T) => { T(Math.hypot(px - x, (py - 2.0) * 1.4, pz - z) - 0.1, ID.brass); T(Math.hypot(px - x, py - 1.93, pz - z) - 0.05, ID.lantern); T(cap(px, py, pz, [x, 2.1, z], [x, H, z], 0.006), ID.iron); })); L.push({ pos: [x, 1.9, z], type: 1, I: 3.5, reach: 6, key: `brass_${x}`, group: "lantern" }); }
  spot(marks, "desk", "read", [-0.2, 0, -0.8], "the reading desk: the book open at the evening prayer, new wood under old brass");
  marks.exits.push({ id: "yard", at: [HX - 0.4, 0, 1.8], note: "the door out to Pask's yard" });
}

// Stairwell C on the far-bank estate: two concrete flights and a half landing, a steel rail, flat doors, a bin bag and
// a pram, the scrubbed-out C on the wall. Key: the one tube left working on the half landing; the broken bulb below.
export function dressStair(W, L, marks, { HX = 2.4, HZ = 2.0, H = 4.6 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.concrete, wall: ID.concrete, sill: 0.5, skirt: ID.tar, cuts: [[1.5, 3.3, -HZ - 0.08, 0.15, 0.6, 0.12]] }));
  W.add({ name: "stair_flights", bb: [-HX, 0, -HZ, 1.0, 2.4, 0.3], f: (x, y, z, T) => {
    const k1 = Math.max(0, Math.min(7, Math.floor((x + 2.2) / 0.28))); let d = 1e9; for (let j = Math.max(0, k1 - 1); j <= Math.min(7, k1 + 1); j++) d = Math.min(d, box(x, y, z, -2.2 + (j + 0.5) * 0.28 + (7 - j) * 0.14, (j + 1) * 0.085, -0.45, (8 - j) * 0.14 + 0.14, (j + 1) * 0.085, 0.55));
    d = Math.min(d, box(x, y, z, 0.55, 1.36 / 2 + 0.0, -1.0, 0.45, 0.68, 1.0)); T(d * 0.9, ID.concrete);
    T(box(x, y, z, -0.8, 2.0, -1.45, 1.4, 0.06, 0.5), ID.concrete); } });
  W.add({ name: "stair_rail", bb: [-2.3, 0, 0.0, 1.05, 2.4, 0.2], f: (x, y, z, T) => { const t = Math.max(0, Math.min(1, (x + 2.2) / 2.3)); T(cap(x, y, z, [-2.2, 0.95, 0.1], [0.1, 1.63, 0.1], 0.025), ID.steel); const k = Math.round((x + 2.2) / 0.5); T(cap(x, y, z, [-2.2 + k * 0.5, 0.0 + Math.min(0.68, Math.max(0, k * 0.5 * 0.3)), 0.1], [-2.2 + k * 0.5, 0.95 + Math.min(0.68, k * 0.5 * 0.3), 0.1], 0.012), ID.steel); void t; } });
  W.add({ name: "flat_door_2", bb: [-HX, 2.0, -1.2, -HX + 0.15, 4.2, 0.2], f: (x, y, z, T) => { T(box(x, y, z, -HX + 0.05, 3.1, -0.5, 0.04, 1.0, 0.45), ID.teal); T(Math.hypot(x + HX - 0.1, y - 3.1, z + 0.15) - 0.03, ID.brass); } });
  W.add({ name: "flat_door_1", bb: [1.0, 0, -HZ, 2.2, 2.2, -HZ + 0.15], f: (x, y, z, T) => { T(box(x, y, z, 1.6, 1.0, -HZ + 0.05, 0.45, 1.0, 0.04), ID.oxblood); T(box(x, y, z, 1.6, 1.4, -HZ + 0.09, 0.08, 0.02, 0.01), ID.brass); } });
  W.add(panel("stair_letter", -HX + 0.02, 1.4, 1.0, 0.7, 0.9, lettering("e4stairC", ["C"], { o: [-HX + 0.03, 1.75, 1.3], u: [0, 0, -1], v: [0, -1, 0], cell: 0.09, ink: ["lw bone", 0.55], ground: ["stone", 0.45], rough: 0.4 }), { face: "x" }));
  W.add(binBag(1.6, 1.2, { s: 0.8 })); W.add(binBag(2.0, 0.9, { s: 0.6 }));
  W.add({ name: "pram", bb: [0.6, 0, 0.6, 1.4, 1.1, 1.4], f: (x, y, z, T) => { T(slab(x, y, z, [1.0, 0.65, 1.0], [0.35, 0.18, 0.22], 0.06), ID.navy); T(Math.max(Math.hypot(x - 0.75, y - 0.85) - 0.25, Math.abs(z - 1.0) - 0.22, 0.85 - y, x - 0.75), ID.navy); for (const sx of [-1, 1]) for (const sz of [-1, 1]) T(Math.max(Math.abs(Math.hypot(x - 1.0 - sx * 0.28, y - 0.17) - 0.15) - 0.015, Math.abs(z - 1.0 - sz * 0.24) - 0.012), ID.tar); T(cap(x, y, z, [1.35, 0.8, 0.8], [1.5, 1.05, 0.8], 0.012) , ID.steel); } });
  W.add(bottle(-1.2, 0.34, 0.3, { name: "dropped_bottle" })); W.add(panel("scrawl", 0.0, 1.0, -HZ + 0.02, 1.6, 0.5, lettering("e4scrawl", ["CHAFFERS"], { o: [-0.75, 1.15, -HZ + 0.03], u: [1, 0, 0], v: [0, -1, 0], cell: 0.03, ink: ["lw slate", 0.5], ground: ["stone", 0.45], rough: 0.7 })));
  lamp(W, L, bulb(1.6, 2.6, 0.4, { drop: 0.3, lit: false, name: "broken_bulb" }));
  lamp(W, L, tube(-0.8, 3.9, -1.45, { len: 1.0, I: 15, name: "landing_tube" }));
  // the estate door propped on its brick: the walkway sodium lays a long orange wedge over the pram, the bags and the
  // foot of the flight, so the lower stair reads (pass 2, 2026-10-23: the first bake left everything below the tube black)
  L.push({ pos: [1.8, 1.9, HZ + 1.4], type: 0, I: 34, reach: 9, key: "door_sodium", group: "sodium", cone: [-0.35, -0.35, -1], mode: 2 });
  L.push({ pos: [1.5, 3.3, -HZ - 0.8], type: 0, I: 34, reach: 8, key: "slot_sodium", group: "sodium", cone: [0, -0.4, 1], mode: 2 });
  spot(marks, "stair", "look", [-0.4, 0, 1.2], "the stair: the bulb on the first landing gone, the tube above blinking");
  marks.exits.push({ id: "out", at: [1.8, 0, 1.6], note: "the door out to the estate" });
}

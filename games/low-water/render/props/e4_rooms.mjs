// Era 4 interiors, part 1 (year 70, the closure; design/eras/era4.md sections 5 and 11, look L4): the mill manager's
// office, the bank's boardroom with the map on the easel, the police station desk with Ann's report, Pell Furrowe's
// kitchen, Davey Brack's flat over the Crown. Each dresser builds its shell and props into W, pushes its lamps to L and
// its spots to marks. One motivated light per room leads; the rest is fill. Original code (plates agent, 2026-10-22).
import { ID, box } from "./prim.mjs";
import { lettering, bankMap } from "./e4_kinds.mjs";
import { plasterShell, tube, bulb, steelDesk, chair, cabinet, phone, typewriter, papers, ashtray, mug, kettle, cooker, sink, formicaTable, armchair, sideboard, radiator, panel, noticeBoard, easel, curtain, bottle, clock, binBag } from "./e4_kit.mjs";
import { timber } from "./wood.mjs";
import { aimLight } from "./light.mjs";

const lamp = (W, L, r) => { W.add(r.p); if (r.l) L.push(r.l); };
const spot = (marks, id, verb, at, note) => marks.spots.push({ id, verb, at, note });

// The mill manager's office: the window onto the stopped floor, the desk with the phone, the cabinets, the calendar
// left at the month. Key: the tube over the desk; the floor's sodium comes cold-orange through the internal window.
export function dressMillOffice(W, L, marks, { HX = 2.6, HZ = 2.0, H = 2.8 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.lino, wall: ID.gloss, cuts: [[0.6, 1.55, -HZ - 0.08, 1.1, 0.5, 0.12], [-HX - 0.08, 1.0, 1.1, 0.12, 1.0, 0.45]] }));
  W.add(panel("floor_glass", 0.6, 1.55, -HZ - 0.06, 2.2, 1.0, ID.windowdim, { face: "z", th: 0.01, frame: ID.darkwood }));
  W.add(steelDesk(0.1, -0.6, { hx: 0.75, hz: 0.4 })); W.add(chair(0.3, -1.25, { a: 0.2, name: "managers_chair" })); W.add(chair(-0.2, 0.25, { a: Math.PI + 0.3 }));
  W.add(phone(-0.4, 0.74, -0.75, { a: 0.4 })); W.add(typewriter(0.35, 0.74, -0.55, { a: -0.1 })); W.add(papers(-0.1, 0.74, -0.35, { n: 9, a: 0.2 })); W.add(ashtray(0.65, 0.74, -0.3)); W.add(mug(-0.6, 0.74, -0.4));
  for (let k = 0; k < 3; k++) W.add(cabinet(-HX + 0.35, -1.3 + k * 0.6, { a: Math.PI / 2, open: k === 1 ? 0.3 : 0, name: "filing_cabinet" }));
  W.add(noticeBoard(-HX + 0.02, 1.6, 0.0, { face: "x", w: 1.0, seed: 4, name: "shift_board" }));
  W.add(panel("wall_calendar", 2.0, 1.65, -HZ + 0.01, 0.4, 0.55, lettering("e4cal", ["OCT", "", "70"], { o: [1.84, 1.88, -HZ + 0.02], u: [1, 0, 0], v: [0, -1, 0], cell: 0.022, ink: ["lw oxblood", 0.5], ground: ["lw paper", 0.7] })));
  W.add(clock(-1.2, 2.2, -HZ + 0.03)); W.add(radiator(-1.3, -HZ + 0.12, { w: 0.8 })); W.add(binBag(2.1, 1.3, { s: 0.6, name: "waste_sack" }));
  W.add(timber("coat_rail", [-HX + 0.06, 1.75, 1.1], [0.03, 0.03, 0.4], ID.darkwood)); W.add(panel("hung_coat", -HX + 0.1, 1.3, 1.0, 0.45, 0.85, ID.navy, { face: "x", th: 0.05 }));
  // key: the tube aimed down on the desk (plates pass 2026-10-24: bare at 10 it lit the walls with the desk, squint 34.7%)
  const ot = tube(0.1, H - 0.35, -0.6, { len: 1.2, I: 0.6, name: "office_tube" }); lamp(W, L, ot); L.push(aimLight(ot.l.pos, [0.15, 0.74, -0.7], { type: 2, I: 14, key: "desk_key", group: "white", soft: 1.5 }));
  L.push({ pos: [0.6, 2.6, -HZ - 2.5], type: 0, I: 14, reach: 9, key: "floor_sodium", group: "sodium", cone: [0, -0.4, 1], mode: 2 });
  spot(marks, "desk", "read", [0.1, 0, 0.4], "the desk: the phone, the typed notice of closure under the ashtray");
  spot(marks, "window", "look", [0.6, 0, -1.2], "the window on the floor: the machines standing in rows under the sodium");
  marks.exits.push({ id: "floor", at: [-HX + 0.5, 0, 1.1], note: "the door down to the floor" });
}

// The bank's boardroom: a long table, leather chairs, the map on its easel at the head, water and glasses, a tall window
// with the autumn afternoon low in it. Key: that window; the pendant over the table is lit and weak against it.
export function dressBoard(W, L, marks, { HX = 3.2, HZ = 2.2, H = 3.2 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.carpet, wall: ID.paper4, wallLeft: ID.paper4, cuts: [[-HX - 0.08, 1.7, -0.3, 0.12, 1.15, 0.6]] }));
  W.add(panel("wainscot_back", 0, 0.5, -HZ + 0.01, 2 * HX, 1.0, ID.darkwood, { face: "z", th: 0.015 })); W.add(panel("wainscot_left", -HX + 0.01, 0.5, 0, 2 * HZ, 1.0, ID.darkwood, { face: "x", th: 0.015 }));
  W.add(panel("tall_window", -HX - 0.04, 1.7, -0.3, 1.2, 2.3, ID.windowdim, { face: "x", th: 0.01, frame: ID.bone })); W.add(curtain(-HX + 0.08, 3.0, -1.15, { w: 0.5, h: 2.6, face: "x", id: ID.oxblood, name: "velvet_curtain" }));
  W.add(timber("board_table", [0.6, 0.73, 0.1], [1.8, 0.03, 0.55], ID.darkwood)); for (const sx of [-1, 1]) W.add(timber("table_pedestal", [0.6 + sx * 1.3, 0.36, 0.1], [0.12, 0.36, 0.35], ID.darkwood));
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) W.add(chair(-0.6 + k * 0.8, 0.1 + s * 0.85, { a: s > 0 ? Math.PI : 0, name: "board_chair" }));
  for (let k = 0; k < 4; k++) { W.add(papers(-0.6 + k * 0.8, 0.76, 0.1 + (k % 2 ? 0.35 : -0.35), { n: 4, a: k * 0.3, name: "board_papers" })); }
  W.add(bottle(0.4, 0.76, 0.05, { name: "water_carafe", id: ID.glass, h: 0.24 })); W.add(ashtray(1.3, 0.76, 0.2)); W.add(ashtray(-0.2, 0.76, -0.05));
  const map = bankMap("e4bankmap", { o: [-2.1, 1.85, -1.18], u: [0.8, 0, 0.6], v: [0, -1, 0], w: 1.0, h: 0.8 });
  W.add(easel(-1.7, -0.9, { a: 0.65 })); W.add({ name: "bank_map", bb: [-2.25, 0.95, -1.4, -1.1, 1.95, -0.6], f: (x, y, z, T) => { const u = (x + 1.7) * 0.8 + (z + 0.9) * 0.6, v = -(x + 1.7) * 0.6 + (z + 0.9) * 0.8 + 0.06; T(Math.max(Math.abs(u) - 0.52, Math.abs(y - 1.4) - 0.42, Math.abs(v) - 0.006), map); } });
  W.add(panel("portrait", 1.2, 1.95, -HZ + 0.02, 0.7, 0.9, ID.darkwood, { frame: ID.brass })); W.add(clock(2.6, 2.4, -HZ + 0.03)); W.add(sideboard(1.4, -HZ + 0.3, { hx: 0.8 }));
  W.add(bottle(1.1, 0.8, -HZ + 0.3, { name: "decanter", id: ID.bottle, h: 0.28 })); W.add(radiator(-HX + 0.12, 1.5, { side: "x", w: 0.8 }));
  lamp(W, L, bulb(0.6, H - 0.6, 0.1, { drop: 0.55, I: 2.5, name: "pendant_lamp" }));
  L.push({ pos: [-HX + 0.35, 2.3, -0.3], type: 1, I: 30, reach: 12, key: "window_sun", group: "window", cone: [1, -0.35, 0.2], mode: 2 });
  spot(marks, "map", "read", [-1.0, 0, -0.1], "the map on the easel: the streets by the race shaded in grey wash, a key in a clerk's hand");
  spot(marks, "table", "read", [0.6, 0, 1.2], "the board table: papers squared at every place, the vote already counted");
  marks.exits.push({ id: "door", at: [HX - 0.4, 0, 1.6], note: "the door to the bank's stair" });
}

// The police station desk: the public counter with its flap, the bench, the notices, the duty desk behind with Ann's
// report in the typewriter. Key: two tubes, one of them failing.
export function dressPolice(W, L, marks, { HX = 2.8, HZ = 2.2, H = 2.9 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.terrazzo, wall: ID.gloss }));
  W.add(timber("counter", [0.3, 0.52, 0.2], [2.0, 0.52, 0.25], ID.darkwood)); W.add(timber("counter_top", [0.3, 1.06, 0.2], [2.05, 0.025, 0.3], ID.formica)); W.add(timber("counter_flap", [2.6, 1.06, 0.2], [0.25, 0.02, 0.28], ID.darkwood));
  W.add(steelDesk(-0.8, -1.2, { hx: 0.7, hz: 0.38 })); W.add(chair(-0.7, -0.55, { a: Math.PI, name: "duty_chair" })); W.add(typewriter(-0.9, 0.74, -1.2, { a: 0.1 }));
  const rep = lettering("e4report", ["ELECTRICAL", "FAULT"], { o: [-0.98, 0.98, -1.315], u: [1, 0, 0], v: [0, -1, 0], cell: 0.0065, ink: ["lw tar", 0.25], ground: ["lw paper", 0.75] });
  W.add({ name: "fire_report", bb: [-1.05, 0.8, -1.34, -0.75, 1.0, -1.3], f: (x, y, z, T) => T(Math.max(Math.abs(x + 0.9) - 0.105, Math.abs(y - 0.92) - 0.08, Math.abs(z + 1.32) - 0.002), rep) });
  W.add(papers(-0.3, 0.74, -1.1, { n: 7, name: "occurrence_book" })); W.add(phone(-1.35, 0.74, -1.05)); W.add(mug(-0.4, 0.74, -1.35)); W.add(ashtray(-1.2, 0.74, -1.35));
  W.add(cabinet(-HX + 0.35, -1.5, { a: Math.PI / 2 })); W.add(cabinet(-HX + 0.35, -0.9, { a: Math.PI / 2 })); W.add(noticeBoard(1.2, 1.6, -HZ + 0.02, { w: 1.4, h: 0.9, n: 10, seed: 7, name: "wanted_board" }));
  W.add(panel("police_sign", -0.6, 2.35, -HZ + 0.02, 1.0, 0.24, lettering("e4police", ["POLICE"], { o: [-0.93, 2.42, -HZ + 0.03], u: [1, 0, 0], v: [0, -1, 0], cell: 0.019, ink: ["lw bone", 0.8], ground: ["lw navy", 0.3] })));
  for (let k = 0; k < 2; k++) W.add(timber("public_bench", [0.2 + k * 1.4, 0.42, 1.7], [0.6, 0.03, 0.2], ID.darkwood)); W.add(timber("bench_rail", [0.9, 0.2, 1.7], [1.3, 0.02, 0.02], ID.steel));
  W.add(clock(2.2, 2.3, -HZ + 0.03)); W.add(radiator(2.0, -HZ + 0.12, { w: 0.9 }));
  // key: the duty tube aimed on the counter (plates pass 2026-10-24: bare at 12 it lit the walls with the counter, squint 41.6%)
  const dt = tube(-0.6, H - 0.3, -0.6, { len: 1.5, I: 0.6, name: "duty_tube" }); lamp(W, L, dt); L.push(aimLight(dt.l.pos, [-0.1, 1.0, 0.0], { type: 2, I: 24, key: "counter_key", group: "white", soft: 1.5 })); lamp(W, L, tube(1.4, H - 0.3, 0.8, { len: 1.5, I: 0.8, name: "failing_tube" }));   // 7 and 1.2 left the desk dim (2026-10-24)
  spot(marks, "report", "read", [-0.6, 0, -0.1], "the report in the typewriter: the cause of the fire typed as an electrical fault");
  spot(marks, "counter", "talk", [0.6, 0, 0.9], "the public counter: the flap down, the bell, the book for names");
  marks.exits.push({ id: "street", at: [HX - 0.4, 0, 1.6], note: "the door to the street" });
}

// Pell Furrowe's kitchen, year 70: the old man's table, the cooker, the sink under the window, the sideboard with the
// family's things. Key: grey afternoon in the window over the sink; the bulb unlit.
export function dressFurrowe(W, L, marks, { HX = 2.4, HZ = 2.0, H = 2.6 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.lino, wall: ID.paper4, cuts: [[0.6, 1.5, -HZ - 0.08, 0.55, 0.5, 0.12]] }));
  W.add(panel("sink_window", 0.6, 1.5, -HZ - 0.05, 1.1, 1.0, ID.windowdim, { face: "z", th: 0.01, frame: ID.bone })); W.add(curtain(0.0, 2.05, -HZ + 0.06, { w: 0.25, h: 1.1, id: ID.mustard })); W.add(curtain(1.2, 2.05, -HZ + 0.06, { w: 0.25, h: 1.1, id: ID.mustard }));
  W.add(sink(0.6, -HZ + 0.32)); W.add(cooker(1.75, -HZ + 0.32)); W.add(kettle(1.62, 0.92, -HZ + 0.2));
  W.add(formicaTable(-0.4, 0.3, { hx: 0.6, hz: 0.42 })); for (const [x, z, a] of [[-0.4, -0.35, 0], [-0.4, 0.95, Math.PI], [-1.2, 0.3, Math.PI / 2]]) W.add(chair(x, z, { a }));
  W.add(mug(-0.5, 0.74, 0.2)); W.add(mug(-0.2, 0.74, 0.45, { id: ID.cobalt })); W.add(papers(-0.75, 0.74, 0.4, { n: 3, name: "letters" })); W.add(ashtray(-0.1, 0.74, 0.1, { n: 2 }));
  W.add(sideboard(-HX + 0.3, -0.5, { hx: 0.8, a: Math.PI / 2 })); W.add(panel("wedding_photo", -HX + 0.02, 1.55, -0.5, 0.35, 0.45, ID.bone, { face: "x", frame: ID.darkwood }));
  W.add(clock(-HX + 0.04, 2.0, 0.6, { face: "x" })); W.add(radiator(-0.8, -HZ + 0.12, { w: 0.8 }));
  lamp(W, L, bulb(-0.4, H - 0.65, 0.3, { drop: 0.6, lit: false, name: "kitchen_bulb" }));
  L.push({ pos: [0.6, 1.8, -HZ + 0.35], type: 1, I: 22, reach: 10, key: "window_day", group: "window", cone: [0, -0.35, 1], mode: 2 });
  spot(marks, "table", "talk", [-0.4, 0, 1.4], "Pell's table: two mugs, the letters from the Company, his chair turned to the window");
  marks.exits.push({ id: "hall", at: [HX - 0.4, 0, 1.4], note: "the hall and the front door" });
}

// Davey Brack's flat over the Crown: an armchair to the television, bottles by it, the curtains not drawn, the street's
// sodium coming up through the glass. Key: that sodium; the bulb is lit low and warm.
export function dressBrack(W, L, marks, { HX = 2.4, HZ = 2.0, H = 2.5 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.carpet, wall: ID.paper4, cuts: [[-HX - 0.08, 1.35, -0.4, 0.12, 0.6, 0.55]] }));
  W.add(panel("street_window", -HX - 0.05, 1.35, -0.4, 1.1, 1.2, ID.windowdim, { face: "x", th: 0.01, frame: ID.bone })); W.add(curtain(-HX + 0.08, 2.1, -1.1, { w: 0.35, h: 1.6, face: "x", id: ID.teal }));
  W.add(armchair(0.4, 0.5, { a: -2.4 })); W.add(timber("tv_table", [-0.9, 0.3, -1.4], [0.35, 0.3, 0.25], ID.darkwood));
  W.add({ name: "television", bb: [-1.3, 0.6, -1.7, -0.5, 1.15, -1.1], f: (x, y, z, T) => { T(Math.max(Math.abs(x + 0.9) - 0.3, Math.abs(y - 0.85) - 0.24, Math.abs(z + 1.42) - 0.22) - 0.02, ID.darkwood); T(Math.max(Math.abs(x + 0.95) - 0.21, Math.abs(y - 0.86) - 0.17, Math.abs(z + 1.19) - 0.01) - 0.015, ID.glass); } });
  for (const [x, z, id] of [[0.95, 0.9, ID.bottle], [1.05, 0.75, ID.glass], [0.85, 1.05, ID.bottle], [1.2, 1.0, ID.bottle]]) W.add(bottle(x, 0, z, { id, name: "empty_bottle" }));
  W.add(ashtray(0.9, 0.0, 0.45, { n: 8 })); W.add(sideboard(1.2, -HZ + 0.3, { hx: 0.7 })); W.add(panel("racing_page", 1.2, 0.86, -HZ + 0.4, 0.5, 0.3, ID.paper, { face: "z" }));
  W.add(panel("crown_calendar", 0.0, 1.7, -HZ + 0.02, 0.4, 0.55, ID.paper, { frame: ID.oxblood })); W.add(radiator(0.2, -HZ + 0.12)); W.add(binBag(1.9, 1.3, { s: 0.7 }));
  lamp(W, L, bulb(0.2, H - 0.6, 0.2, { drop: 0.5, I: 3.0, name: "low_bulb" }));
  L.push({ pos: [-HX + 0.3, 1.0, -0.4], type: 0, I: 14, reach: 8, key: "street_sodium", group: "sodium", cone: [1, 0.35, 0.1], mode: 2 });
  spot(marks, "chair", "talk", [0.9, 0, 1.4], "Davey's chair: turned to the set, the bottles where his hand falls");
  marks.exits.push({ id: "stair", at: [HX - 0.4, 0, 1.4], note: "the stair down past the Crown's back door" });
}

// Era 5 interiors, part 2 (The Clearance, year 115, April; design/eras/era5.md sections 5 and 11, look L5 with L11
// pen and glaze where the record is): the council chamber and its public gallery, the archive in the old district
// office, the Well House with its windows meshed, the fourth-floor corridor at headquarters, the syndicate's office
// with the model of the road. Plates agent, 2026-10-23. Original code.
import { ID } from "./prim.mjs";
import { plasterShell, tube, bulb, chair, papers, mug, steelDesk, phone, panel, curtain, clock, binBag, cabinet, radiator, noticeBoard } from "./e4_kit.mjs";
import { photo, notice, pew, registerShelf } from "./e3_room.mjs";
import { screenOn, laptop, councilDesk, archiveShelves, archiveBox, meshWindow, mug5 } from "./e5_kit.mjs";
import { flat } from "./e5_kit.mjs";
import { timber } from "./wood.mjs";
import { aimLight } from "./light.mjs";

const lamp = (W, L, r) => { W.add(r.p); if (r.l) L.push(r.l); };
const spot = (marks, id, verb, at, note) => marks.spots.push({ id, verb, at, note });

// The council chamber: the horseshoe of desks, the chair's dais, the wall screen with the CCTV stills, the public gallery
// rail at the back with its benches. Key: the tall windows' April afternoon; the screen answers it cold.
export function dressCouncil(W, L, marks, { HX = 3.6, HZ = 2.8, H = 3.6 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.carpet, wall: ID.paper4, wallLeft: ID.limewash, cuts: [[-HX - 0.08, 2.0, -1.0, 0.12, 1.1, 0.5], [-HX - 0.08, 2.0, 0.9, 0.12, 1.1, 0.5]] }));
  for (const z of [-1.0, 0.9]) W.add(panel("tall_window", -HX - 0.04, 2.0, z, 0.9, 2.1, ID.windowdim, { face: "x", th: 0.01, frame: ID.bone }));
  W.add(panel("wainscot", 0, 0.55, -HZ + 0.01, 2 * HX, 1.1, ID.darkwood, { face: "z", th: 0.015 }));
  W.add(timber("dais", [0.6, 0.12, -HZ + 0.7], [1.6, 0.12, 0.6], ID.darkwood)); W.add(councilDesk(0.6, -HZ + 0.75, { hx: 1.4, n: 3, a: 0 }));
  W.add(councilDesk(-1.6, -0.2, { hx: 1.1, n: 3, a: -Math.PI / 2 })); W.add(councilDesk(2.7, -0.2, { hx: 1.1, n: 3, a: Math.PI / 2 }));
  lamp(W, L, screenOn(0.6, 2.35, -HZ + 0.04, { w: 1.6, h: 0.9, wall: true, I: 0.12, name: "cctv_screen" }));
  W.add(panel("crest", -1.6, 2.6, -HZ + 0.02, 0.5, 0.6, ID.brass, { frame: ID.darkwood }));
  W.add(timber("gallery_rail", [0.6, 1.0, 1.7], [2.6, 0.03, 0.03], ID.brass)); for (let k = -5; k <= 5; k++) W.add(timber("rail_post", [0.6 + k * 0.5, 0.5, 1.7], [0.02, 0.5, 0.02], ID.brass));
  for (const z of [2.1, 2.55]) W.add(pew(0.6, z, 2.4, { name: "gallery_bench" }));
  for (const [x, z] of [[0.0, -HZ + 0.65], [0.6, -HZ + 0.6], [1.2, -HZ + 0.62]]) W.add(papers(x, 0.98, z, { n: 3, name: "agenda" }));
  W.add(mug5(-1.4, 0.77, -0.5, { name: "water_glass", id: ID.glass }));
  // key: the chamber's ceiling light, aimed straight down on the horseshoe of desks (plates pass 2026-10-24: the two windows'
  // wide spread lit the papered back wall above everything else; a key aimed in from the window ran on up that wall)
  L.push({ pos: [-HX + 0.4, 2.6, -0.1], type: 1, I: 2, reach: 12, key: "window_sun", group: "window", cone: [1, -0.4, 0.1], mode: 2 });
  const chandelier = bulb(0.4, H - 0.9, -0.9, { drop: 0.9, I: 0.4, name: "chamber_pendant" }); lamp(W, L, chandelier);
  L.push(aimLight(chandelier.l.pos, [0.4, 0.8, -0.9], { type: 2, I: 48, reach: 14, key: "window_key", group: "window" }));
  spot(marks, "screen", "look", [0.6, 0, 0.0], "the wall screen: the CCTV stills of Mill Street, frame by frame, the time in the corner");
  spot(marks, "gallery", "talk", [0.6, 0, 1.95], "the public gallery: the Vell families on the benches, the residents' group behind them");
  marks.exits.push({ id: "lobby", at: [HX - 0.5, 0, 2.3], note: "the lobby and the town hall steps" });
}

// The archive in the old district office: steel shelving on both walls, the reading table under a green-shaded lamp,
// the register and the Tesk book in its box, the old office's painted sign leant against the shelves. Key: the
// reading lamp, warm, in a room lit otherwise by a high window.
export function dressArchive(W, L, marks, { HX = 2.8, HZ = 2.2, H = 3.0 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.limewash, wallLeft: ID.limewash, cuts: [[1.6, 2.5, -HZ - 0.08, 0.5, 0.25, 0.12]] }));
  W.add(archiveShelves(-HX + 0.1, 1.1, -HZ, { h: 2.3, seed: 4 })); W.add(archiveShelves(-HX + 0.1, 0.9, HZ - 0.02, { h: 2.0, seed: 9, face: -1 }));
  W.add(panel("high_window", 1.6, 2.5, -HZ - 0.06, 1.0, 0.5, ID.windowdim, { face: "z", th: 0.01, frame: ID.bone }));
  W.add(timber("reading_table", [0.6, 0.76, 0.1], [0.9, 0.025, 0.45], ID.darkwood)); for (const [sx, sz] of [[-0.8, -0.38], [0.8, -0.38], [-0.8, 0.38], [0.8, 0.38]]) W.add(timber("table_leg", [0.6 + sx, 0.37, 0.1 + sz], [0.03, 0.37, 0.03], ID.darkwood));
  W.add(archiveBox(0.4, 0.785, 0.1, { name: "tesk_book_box" })); W.add(flat("register_open", 1.0, 0.79, 0.15, 0.5, 0.34, ID.paper));
  W.add(chair(0.5, 0.75, { a: Math.PI, name: "reading_chair" })); W.add(chair(1.1, -0.55, { a: 0 }));
  W.add(panel("exchange_sign", 2.3, 0.6, -0.6, 1.4, 0.3, ID.green, { face: "x", th: 0.02, frame: ID.darkwood }));
  W.add(registerShelf(2.0, -HZ, { w: 1.2 })); W.add(cabinet(HX - 0.35, 1.2, { a: -Math.PI / 2, name: "plan_chest" }));
  W.add(notice(-0.5, 2.55, -HZ + 0.3, { w: 0.5, h: 0.32, name: "archive_opening_card" }));
  const rl = bulb(0.9, 1.2, 0.0, { drop: 0.35, I: 4.5, name: "reading_lamp" }); lamp(W, L, rl); W.add(panel("lamp_shade", 0.9, 1.25, 0.0, 0.3, 0.1, ID.green, { face: "z", th: 0.12 }));
  L.push({ pos: [1.6, 2.4, -HZ + 0.3], type: 1, I: 4, reach: 7, key: "high_window", group: "window", cone: [0, -0.6, 1], mode: 2 });
  spot(marks, "tesk_book", "read", [0.4, 0, 0.8], "the Tesk book in its archive box, scorched along the bottom edge");
  spot(marks, "register", "read", [1.0, 0, 0.8], "the district register open at year 0, Walter's sevens without a bar");
  spot(marks, "sign", "look", [1.8, 0, -0.6], "the old sign, painted over in heritage green, EXCHANGE STREET showing through");
  marks.exits.push({ id: "street", at: [HX - 0.4, 0, 1.6], note: "the door to Exchange Street" });
}

// The Well House: the prayer room, long and low, rugs on boards, a reading stand, the windows meshed with steel over the
// glass since the fire, a new plaque, the scorch on one beam left. Key: the sodium through the mesh, cut into squares.
export function dressWellHouse(W, L, marks, { HX = 3.0, HZ = 2.0, H = 2.8 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.limewash, wallLeft: ID.limewash, cuts: [[-1.4, 1.5, -HZ - 0.08, 0.45, 0.55, 0.12], [1.0, 1.5, -HZ - 0.08, 0.45, 0.55, 0.12]] }));
  for (const x of [-1.4, 1.0]) W.add(meshWindow(x, 1.5, -HZ, { w: 0.9, h: 1.1 }));
  for (const [x, z, id] of [[-1.2, 0.0, ID.oxblood], [0.0, 0.1, ID.navy], [1.2, 0.0, ID.oxblood], [-0.6, 1.1, ID.teal], [0.7, 1.1, ID.oxblood]]) W.add(flat("prayer_rug", x, 0.0, z, 0.75, 1.1, id, { th: 0.008 }));
  W.add(timber("reading_stand", [0.0, 0.55, -1.3], [0.25, 0.03, 0.18], ID.darkwood)); W.add(timber("stand_post", [0.0, 0.28, -1.3], [0.04, 0.28, 0.04], ID.darkwood));
  W.add(timber("scorched_beam", [0.0, H - 0.15, 0.0], [HX, 0.12, 0.12], ID.coal)); W.add(timber("beam", [0.0, H - 0.15, -1.3], [HX, 0.12, 0.12], ID.darkwood));
  W.add(panel("memorial_plaque", -HX + 0.02, 1.5, 0.3, 0.6, 0.4, ID.brass, { face: "x", frame: ID.darkwood }));
  W.add(timber("shoe_rack", [HX - 0.3, 0.2, 1.2], [0.15, 0.2, 0.6], ID.darkwood)); W.add(radiator(-HX + 0.12, -0.8, { side: "x", w: 0.9 }));
  // key: the sodium through the left mesh window, aimed on the rugs (plates pass 2026-10-24: both windows' wide spread lit the
  // limewash walls above the rugs); the right window and the porch bulb are weaker
  for (const x of [-1.4, 1.0]) L.push({ pos: [x, 2.1, -HZ - 1.4], type: 0, I: 12, reach: 10, key: `mesh_sodium_${x}`, group: "sodium", cone: [0, -0.35, 1], mode: 2 });
  L.push(aimLight([-1.4, 1.9, -HZ + 0.15], [-0.3, 0.0, 0.4], { type: 0, I: 32, reach: 10, key: "mesh_key", group: "sodium" }));
  lamp(W, L, bulb(1.8, H - 0.6, 1.0, { drop: 0.35, I: 1.5, name: "porch_bulb" }));
  spot(marks, "plaque", "read", [-HX + 0.8, 0, 0.3], "the plaque: six names and Ilo's, and the date of the December fire");
  spot(marks, "window", "look", [-1.4, 0, -1.2], "the window meshed with steel over the glass; the street cut into squares");
  marks.exits.push({ id: "yard", at: [HX - 0.4, 0, 1.5], note: "the door to Pask's old yard" });
}

// Headquarters, the fourth-floor corridor: lino, the doors of offices with their glass panels, the bench outside
// Professional Standards, the water cooler, the noticeboard. Key: the tubes in a line, cold.
export function dressPolice5(W, L, marks, { HX = 3.4, HZ = 1.5, H = 2.7 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.lino, wall: ID.gloss, wallLeft: ID.gloss }));
  for (const x of [-2.2, 0.0, 2.2]) { W.add(panel("office_door", x, 1.0, -HZ + 0.02, 0.85, 2.0, ID.darkwood, { frame: ID.steel })); W.add(panel("door_glass", x, 1.45, -HZ + 0.04, 0.3, 0.5, ID.windowdim)); W.add(panel("door_plate", x + 0.5, 1.5, -HZ + 0.02, 0.22, 0.08, ID.brass)); }
  W.add(timber("bench", [-1.1, 0.42, 0.9], [0.7, 0.03, 0.2], ID.darkwood)); for (const s of [-0.6, 0.6]) W.add(timber("bench_leg", [-1.1 + s, 0.2, 0.9], [0.03, 0.2, 0.18], ID.steel));
  W.add(timber("water_cooler", [1.2, 0.55, 1.1], [0.16, 0.55, 0.16], ID.bone)); W.add(panel("cooler_bottle", 1.2, 1.3, 1.1, 0.26, 0.38, ID.glass, { face: "z", th: 0.13 }));
  W.add(noticeBoard(-HX + 0.02, 1.5, 0.0, { face: "x", w: 1.2, seed: 11, name: "corridor_board" })); W.add(binBag(HX - 0.4, 1.0, { s: 0.5, name: "waste_bin" }));
  W.add(clock(1.1, 2.25, -HZ + 0.03)); W.add(papers(-1.3, 0.45, 0.9, { n: 2, name: "federation_leaflet" }));
  // key: the middle tube aimed down on the bench and the door (plates pass 2026-10-24: three tubes in a line lit the gloss walls
  // and the whole floor evenly); the outer two stay lit, weaker, the right one failing
  for (const x of [-2.2, 0.0, 2.2]) lamp(W, L, tube(x, H - 0.25, 0.0, { len: 1.2, I: x === 2.2 ? 0.3 : 0.7, name: "corridor_tube" }));
  L.push(aimLight([-0.4, H - 0.32, 0.0], [-0.5, 0.2, 0.3], { type: 2, I: 16, key: "tube_key", group: "white", soft: 1.5 }));
  spot(marks, "bench", "talk", [-1.1, 0, 0.4], "the bench outside Professional Standards: the federation rep's leaflet on it");
  spot(marks, "door", "look", [0.0, 0, -0.6], "the door with the glass panel: two shapes inside, one of them writing");
  marks.exits.push({ id: "lift", at: [HX - 0.4, 0, 0.6], note: "the lifts" });
}

// The syndicate's office: glass and carpet tile, the model of the ring road on its table under a perspex lid, the
// renders on the wall, a laptop, coffee. Key: the window's flat April afternoon; the model has its own small lamps.
export function dressSyndicate(W, L, marks, { HX = 3.0, HZ = 2.2, H = 2.8 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.carpet, wall: ID.bone, wallLeft: ID.bone, cuts: [[-HX - 0.08, 1.5, 0.0, 0.12, 1.1, 1.8]] }));
  W.add(panel("glazing", -HX - 0.04, 1.5, 0.0, 3.6, 2.2, ID.windowdim, { face: "x", th: 0.01, frame: ID.steel }));
  W.add(timber("model_table", [0.4, 0.8, -0.2], [1.1, 0.03, 0.7], ID.bone)); W.add(timber("model_plinth", [0.4, 0.4, -0.2], [1.0, 0.4, 0.6], ID.slate));
  W.add({ name: "ring_road_model", bb: [-0.7, 0.82, -0.9, 1.5, 0.95, 0.5], f: (x, y, z, T) => { const r = Math.hypot(x - 0.4, (z + 0.2) * 1.5); T(Math.max(Math.abs(r - 0.55) - 0.05, Math.abs(y - 0.86) - 0.03), ID.slate); const k = Math.round((x - 0.4) / 0.14), j = Math.round((z + 0.2) / 0.14); T(r < 0.48 ? Math.max(Math.abs(x - 0.4 - k * 0.14) - 0.045, Math.abs(z + 0.2 - j * 0.14) - 0.045, Math.abs(y - 0.87) - 0.04) : 1, ID.bone); T(Math.max(r < 0.75 && r > 0.62 ? -1 : 1, Math.abs(y - 0.84) - 0.012), ID.green); } });
  W.add(panel("model_lid", 0.4, 1.05, -0.2, 2.1, 0.4, ID.glass, { face: "z", th: 0.6 }));
  for (const [x, id] of [[-1.4, ID.teal], [0.4, ID.green], [2.0, ID.slate]]) W.add(panel("render_print", x, 1.6, -HZ + 0.02, 1.2, 0.75, id, { frame: ID.steel }));
  W.add(steelDesk(2.0, 1.2, { hx: 0.7, hz: 0.38, name: "glass_desk" })); W.add(laptop(2.0, 0.74, 1.15)); W.add(mug5(2.4, 0.74, 1.3, { name: "coffee_cup" }));
  for (const [x, z, a] of [[-0.6, 0.9, 0.4], [1.3, 0.9, -0.4]]) W.add(chair(x, z, { a: a + Math.PI, name: "meeting_chair" }));
  // key: the model's own spot, high over the table and aimed straight down (plates pass 2026-10-24: the window's spread lit the
  // back wall and the renders; a key aimed in from the window ran on up the back wall)
  L.push({ pos: [-HX + 0.4, 2.0, 0.0], type: 1, I: 1, reach: 12, key: "window_day", group: "window", cone: [1, -0.3, 0], mode: 2 });
  const hang = bulb(0.4, 2.0, -0.2, { drop: 0.8, I: 0.3, name: "model_pendant" }); lamp(W, L, hang);
  L.push(aimLight(hang.l.pos, [0.4, 0.85, -0.2], { type: 1, I: 16, reach: 12, key: "window_key", group: "window" }));
  lamp(W, L, bulb(0.4, 1.45, -0.2, { drop: 0.1, I: 1.5, name: "model_spot" }));
  spot(marks, "model", "look", [0.4, 0, 0.9], "the model of the ring road: the Upper Town as white blocks inside the loop, the burial corner under green felt");
  marks.exits.push({ id: "lift", at: [HX - 0.4, 0, 1.6], note: "the lift down to the street" });
}

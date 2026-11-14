// Era 5 interiors, part 1 (The Clearance, year 115, April; design/eras/era5.md sections 5 and 11, look L5): Nan
// Furrowe's kitchen, Leon Brack's kitchen on the far-bank estate, Ellie Ashby's spare room with the ring light, the
// Saros' flat over the shop, Mara's flat in Haldane Yard, the room behind the mortuary. Each dresser builds its shell
// and props into W, pushes its lamps to L and its spots to marks. One motivated light leads each room; the cold of the
// screens is its second voice (L5: sodium with its line, phone glow). Plates agent, 2026-10-23. Original code.
import { ID } from "./prim.mjs";
import { plasterShell, tube, bulb, chair, papers, mug, kettle, formicaTable, armchair, sideboard, radiator, panel, curtain, bottle, clock, binBag, cabinet } from "./e4_kit.mjs";
import { photo, notice } from "./e3_room.mjs";
import { handset, screenOn, ringLight, laptop, kitchenRun, fridge, sofa, trolley, mug5, carrier } from "./e5_kit.mjs";
import { flat } from "./e5_kit.mjs";
import { timber } from "./wood.mjs";
import { aimLight } from "./light.mjs";

const lamp = (W, L, r) => { W.add(r.p); if (r.l) L.push(r.l); };
const spot = (marks, id, verb, at, note) => marks.spots.push({ id, verb, at, note });
// the evening outside a window on the back wall: sodium from the street, cold, coming in low
const streetGlow = (L, x, z, I = 10, key = "street_sodium") => L.push({ pos: [x, 2.0, z - 1.6], type: 0, I, reach: 8, key, group: "sodium", cone: [0, -0.3, 1], mode: 2 });

// Nan Furrowe's kitchen, the family dinner over the clip: the table laid for five, the pendant over it, the phone face
// up among the plates, Abel's hat photograph on the sideboard. Key: the pendant, warm, low over the table.
export function dressFurroweKitchen(W, L, marks, { HX = 2.6, HZ = 2.1, H = 2.6 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.vinyl, wall: ID.paper4, wallLeft: ID.limewash, cuts: [[-0.9, 1.5, -HZ - 0.08, 0.6, 0.55, 0.12]] }));
  W.add(panel("kitchen_window", -0.9, 1.5, -HZ - 0.06, 1.2, 1.1, ID.windowdim, { face: "z", th: 0.01, frame: ID.bone })); W.add(curtain(-0.9, 2.15, -HZ + 0.06, { w: 1.3, h: 0.35, id: ID.teal, name: "valance" }));
  W.add(kitchenRun(-HX + 0.05, 0.4, -HZ, { sinkAt: -0.9, hobAt: -1.9, door: ID.limewash })); W.add(kettle(-0.2, 0.91, -HZ + 0.3)); W.add(carrier(0.1, 0.91, -HZ + 0.35, { name: "bread_bag" }));
  W.add(fridge(1.0, -HZ + 0.36, { seed: 3 }));
  W.add(formicaTable(0.2, 0.5, { hx: 0.8, hz: 0.5 }));
  for (const [x, z, a] of [[-0.45, 0.5, Math.PI / 2], [0.85, 0.5, -Math.PI / 2], [-0.1, 1.15, Math.PI], [0.5, 1.15, Math.PI], [0.2, -0.15, 0]]) W.add(chair(x, z, { a, name: "kitchen_chair" }));
  for (const [x, z] of [[-0.25, 0.5], [0.65, 0.5], [0.0, 0.85], [0.45, 0.85], [0.2, 0.18]]) W.add(flat("dinner_plate", x, 0.755, z, 0.24, 0.24, ID.bone));
  lamp(W, L, handset(0.25, 0.75, 0.55, { a: 0.4, name: "phone_on_table" })); W.add(bottle(0.2, 0.75, 0.35, { name: "ketchup", id: ID.red, h: 0.18 }));
  W.add(sideboard(-HX + 0.32, 1.0, { hx: 0.7, a: Math.PI / 2 })); W.add(photo(-HX + 0.32, 1.12, 0.9, { w: 0.24, h: 0.3, n: 1, name: "abel_hat_photograph" }));
  W.add(clock(1.6, 2.1, -HZ + 0.03)); W.add(radiator(HX - 0.6, -HZ + 0.12, { w: 0.8 })); W.add(binBag(HX - 0.4, 1.4, { s: 0.5, name: "pedal_bin" }));
  // key: the pendant aimed down on the laid table (plates pass 2026-10-24: its bare spread lit the far walls as bright as the table)
  const pend = bulb(0.2, H - 0.75, 0.5, { drop: 0.7, I: 1.4, name: "pendant_lamp" }); lamp(W, L, pend); L.push(aimLight(pend.l.pos, [0.2, 0.75, 0.5], { type: 1, I: 3.2, key: "pendant_key", group: "lantern" }));
  streetGlow(L, -0.9, -HZ, 4);
  spot(marks, "table", "look", [0.2, 0, 1.5], "the table: five places, the phone face up in the middle, nobody eating");
  spot(marks, "sideboard", "look", [-HX + 0.9, 0, 1.0], "the sideboard: Abel in his hat in a frame, the glass gone milky");
  marks.exits.push({ id: "hall", at: [HX - 0.4, 0, 1.4], note: "the hall and the front door" });
}

// Leon Brack's kitchen on the far-bank estate: a short run of units, the breakfast bar, his vest over a chair, the
// wedding photograph cracked across in its frame on the windowsill, the phone charging. Key: the cooker-hood light,
// a hard small white; the estate's sodium in the window behind.
export function dressBrackKitchen(W, L, marks, { HX = 2.3, HZ = 1.9, H = 2.4 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.vinyl, wall: ID.gloss, wallLeft: ID.gloss, cuts: [[0.6, 1.45, -HZ - 0.08, 0.55, 0.5, 0.12]] }));
  W.add(panel("estate_window", 0.6, 1.45, -HZ - 0.06, 1.1, 1.0, ID.windowdim, { face: "z", th: 0.01, frame: ID.bone }));
  W.add(kitchenRun(-HX + 0.05, 1.6, -HZ, { sinkAt: 0.6, hobAt: -1.2, door: ID.slate, top: ID.formica }));
  W.add(photo(0.95, 0.99, -HZ + 0.12, { w: 0.22, h: 0.17, cracked: true, n: 2, name: "wedding_photograph" }));
  W.add(timber("breakfast_bar", [-0.2, 0.95, 0.3], [1.0, 0.025, 0.3], ID.formica)); W.add(timber("bar_end", [-1.2, 0.47, 0.3], [0.03, 0.47, 0.3], ID.slate));
  for (const x of [-0.5, 0.3]) W.add(chair(x, 0.95, { a: Math.PI, name: "bar_stool" }));
  W.add(panel("stab_vest", 0.3, 0.75, 1.15, 0.45, 0.55, ID.navy, { face: "z", th: 0.06 })); W.add(mug5(-0.1, 0.975, 0.25, { band: ID.blue, name: "police_mug" }));
  lamp(W, L, handset(0.55, 0.975, 0.3, { a: -0.3, name: "phone_charging" })); W.add(papers(-0.6, 0.975, 0.35, { n: 3, name: "statement_draft" }));
  W.add(binBag(HX - 0.4, 1.2, { s: 0.6, name: "takeaway_bag" })); W.add(fridge(HX - 0.4, -HZ + 0.36, { seed: 7 }));
  // key: the hood light aimed on the hob and the counter (plates pass 2026-10-24: the gloss wall on the left outshone it)
  const hood = bulb(-1.2, 1.55, -HZ + 0.3, { drop: 0.08, I: 1.2, name: "hood_light" }); lamp(W, L, hood); L.push(aimLight(hood.l.pos, [-0.7, 0.92, -1.5], { type: 1, I: 4.5, key: "hood_key", group: "lantern" }));
  streetGlow(L, 0.6, -HZ, 5);
  spot(marks, "bar", "read", [-0.1, 0, 1.0], "the breakfast bar: the statement draft, his phone face down, then face up");
  spot(marks, "photo", "look", [0.95, 0, -0.9], "the windowsill: the wedding photograph, the glass cracked from one corner");
  marks.exits.push({ id: "landing", at: [HX - 0.4, 0, 0.4], note: "the landing, the lift that doesn't work" });
}

// Ellie Ashby's spare room: the ring light, three screens on a desk, a mic on an arm, the bookshelf she bought by the
// metre, her grandad Paul's photograph with the press card. Key: the ring light, cold white, as bright as a room gets.
export function dressChannel(W, L, marks, { HX = 2.2, HZ = 1.9, H = 2.4 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.carpet, wall: ID.limewash, wallLeft: ID.limewash }));
  W.add(timber("desk", [0.0, 0.73, -HZ + 0.4], [1.0, 0.02, 0.35], ID.bone)); for (const s of [-0.95, 0.95]) W.add(timber("desk_leg", [s, 0.36, -HZ + 0.4], [0.02, 0.36, 0.3], ID.steel));
  for (const [x, a] of [[-0.6, 0], [0.0, 0], [0.6, 0]]) lamp(W, L, screenOn(x, 0.75, -HZ + 0.25, { w: 0.55, h: 0.32, I: 0.9, name: "screen" }));
  // key: the ring light aimed at the chair and the desk (plates pass 2026-10-24: bare, it lit the back wall and the shelves)
  W.add(chair(0.0, -0.9, { a: 0, name: "gaming_chair" })); const ring = ringLight(0.2, 0.3, { a: 0.3 }); W.add(ring.p); L.push({ ...ring.l, I: 2.2 });
  L.push(aimLight(ring.l.pos, [0.0, 0.8, -1.3], { type: 2, I: 9, reach: 6, key: "ring_key", group: "ring", soft: 0.8 }));
  for (let r = 0; r < 4; r++) W.add(timber("bookshelf", [-HX + 0.18, 0.4 + r * 0.45, 0.2], [0.16, 0.012, 0.9], ID.bone));
  for (let r = 0; r < 4; r++) W.add(panel("books", -HX + 0.2, 0.58 + r * 0.45, 0.2, 1.7, 0.3, [ID.oxblood, ID.navy, ID.teal, ID.mustard][r], { face: "x", th: 0.12 }));
  W.add(photo(0.9, 1.65, -HZ + 0.01, { w: 0.3, h: 0.38, n: 1, name: "grandad_press_photo" })); W.add(mug5(0.85, 0.75, -HZ + 0.5, { band: ID.red, name: "sponsor_mug" }));
  W.add(timber("mic_arm", [-0.6, 1.05, -HZ + 0.55], [0.02, 0.25, 0.02], ID.tar));
  spot(marks, "desk", "look", [0.0, 0, -0.3], "the desk: three screens, the comments climbing on the left one");
  spot(marks, "ring", "look", [0.9, 0, 0.9], "the ring light: in its circle everything is warm and lit, her face, the books");
  marks.exits.push({ id: "landing", at: [HX - 0.4, 0, 1.3], note: "the landing of the semi on the Arlen road" });
}

// The Saros' flat over the shop: the front room, a settee and the low table, the bread video paused on a phone, the
// window on Mill Street with the net curtain, Danil's trainer by the door. Key: the street's sodium through the net.
export function dressSaroFlat(W, L, marks, { HX = 2.3, HZ = 1.9, H = 2.5 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.carpet, wall: ID.paper4, wallLeft: ID.paper4, cuts: [[0.2, 1.4, -HZ - 0.08, 0.7, 0.6, 0.12]] }));
  W.add(panel("street_window", 0.2, 1.4, -HZ - 0.06, 1.4, 1.2, ID.windowdim, { face: "z", th: 0.01, frame: ID.bone })); W.add(panel("net_curtain", 0.2, 1.4, -HZ + 0.04, 1.4, 1.2, ID.bonecloth, { face: "z", th: 0.003 }));
  W.add(sofa(-0.6, 0.9, { a: Math.PI, id: ID.oxblood, throwId: ID.teal })); W.add(armchair(1.3, 0.3, { a: -Math.PI / 2 }));
  W.add(timber("low_table", [-0.4, 0.38, 0.0], [0.5, 0.02, 0.3], ID.darkwood)); lamp(W, L, handset(-0.4, 0.4, 0.0, { a: 0.2, name: "bread_video_phone" }));
  for (const [x, z] of [[-0.7, 0.1], [-0.15, -0.1]]) W.add(mug(x, 0.4, z));
  W.add(photo(-HX + 0.01, 1.6, 0.1, { w: 0.3, h: 0.4, n: 1, name: "danil_school_photo" }));
  W.add(timber("prayer_shelf", [-1.2, 1.5, -HZ + 0.1], [0.3, 0.012, 0.08], ID.darkwood)); W.add(bottle(-1.2, 1.52, -HZ + 0.1, { name: "rose_water", id: ID.glass, h: 0.14 }));
  W.add(panel("lone_trainer", HX - 0.6, 0.06, 1.4, 0.28, 0.1, ID.bone, { face: "z", th: 0.05 })); W.add(radiator(-0.9, -HZ + 0.12, { w: 0.7 }));
  // key: the street's sodium through the net, aimed at the low table and the phone (plates pass 2026-10-24: it spread on the
  // right wall; the standard lamp lit the back wall)
  streetGlow(L, 0.2, -HZ, 4); L.push(aimLight([0.2, 2.0, -HZ - 1.6], [-0.4, 0.4, 0.1], { type: 0, I: 34, key: "net_key", group: "sodium" }));
  lamp(W, L, bulb(1.6, 1.2, -1.4, { drop: 0.05, I: 0.35, name: "standard_lamp" }));
  spot(marks, "phone", "look", [-0.4, 0, 0.6], "the phone on the low table: Danil holding up a loaf, burnt on top, laughing");
  spot(marks, "window", "look", [0.2, 0, -1.0], "the net curtain, and through it Mill Street, the place on the paving");
  marks.exits.push({ id: "stair", at: [HX - 0.4, 0, 1.4], note: "the stair down to the shop" });
}

// Mara's flat in Haldane Yard: the kitchen table with Walter's ledger, Joss's chair by the window with the fair bowl
// on the sill, the drawer under the takeaway menus. Key: the window, April morning, grey; the strip light is off.
export function dressMaraFlat(W, L, marks, { HX = 2.4, HZ = 2.0, H = 2.5 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.vinyl, wall: ID.paper4, wallLeft: ID.limewash, cuts: [[-0.6, 1.4, -HZ - 0.08, 0.6, 0.55, 0.12]] }));
  W.add(panel("yard_window", -0.6, 1.4, -HZ - 0.06, 1.2, 1.1, ID.windowdim, { face: "z", th: 0.01, frame: ID.bone })); W.add(timber("sill", [-0.6, 0.86, -HZ + 0.08], [0.7, 0.02, 0.1], ID.bone));
  W.add(panel("fair_bowl", -0.75, 0.94, -HZ + 0.1, 0.18, 0.1, ID.clay, { face: "z", th: 0.07 })); W.add(panel("bowl_plant", -0.75, 1.06, -HZ + 0.1, 0.16, 0.14, ID.green, { face: "z", th: 0.05 }));
  W.add(armchair(-1.4, -1.1, { a: 0.6, id: ID.mustard, name: "joss_chair" }));
  W.add(kitchenRun(0.6, HX - 0.05, -HZ, { sinkAt: 1.4, door: ID.bone })); W.add(cabinet(HX - 0.3, 0.4, { a: -Math.PI / 2, h: 0.85, open: 0.15, name: "drawer_unit" }));
  W.add(formicaTable(0.1, 0.4, { hx: 0.7, hz: 0.45 })); for (const [x, z, a] of [[-0.55, 0.4, Math.PI / 2], [0.75, 0.4, -Math.PI / 2], [0.1, 1.05, Math.PI]]) W.add(chair(x, z, { a }));
  W.add(flat("walter_ledger", 0.1, 0.755, 0.35, 0.42, 0.3, ID.paper)); W.add(timber("ledger_spine", [0.1, 0.765, 0.35], [0.012, 0.012, 0.15], ID.leather));
  W.add(mug(-0.25, 0.75, 0.55)); W.add(mug(0.45, 0.75, 0.6)); W.add(papers(0.5, 0.75, 0.2, { n: 2, name: "clearance_letter" }));
  W.add(notice(-HX + 0.01, 1.5, 0.6, { w: 0.4, h: 0.5, name: "tenants_meeting_notice" }));
  // key: the window's grey morning aimed across the table and the ledger (plates pass 2026-10-24: its wide spread lit the
  // limewash wall brighter than the table)
  L.push({ pos: [-0.6, 1.9, -HZ + 0.4], type: 1, I: 3, reach: 9, key: "window_day", group: "window", cone: [0.1, -0.35, 1], mode: 2 });
  L.push(aimLight([-0.6, 1.9, -HZ + 0.2], [0.1, 0.75, 0.4], { type: 1, I: 20, key: "window_key", group: "window" }));
  lamp(W, L, tube(0.2, H - 0.3, 0.4, { len: 1.0, I: 0.6, name: "strip_light" }));
  spot(marks, "ledger", "read", [0.1, 0, 1.4], "Walter's ledger open on the table, Frank's bus ticket keeping the place");
  spot(marks, "drawer", "look", [1.4, 0, 0.4], "the drawer under the takeaway menus, the envelope in it");
  spot(marks, "bowl", "look", [-0.6, 0, -0.9], "the bowl from Osby fair on the sill, a plant in it; Joss won't have it moved");
  marks.exits.push({ id: "yard", at: [HX - 0.4, 0, 1.5], note: "the door to the yard steps" });
}

// The room behind the mortuary: tiled to the ceiling, the trolley under its sheet, a steel sink, a viewing window with
// its curtain, two plastic chairs, the box of tissues. Key: the tubes, one with a fault, green-white.
export function dressMortuary(W, L, marks, { HX = 2.4, HZ = 2.0, H = 2.7 } = {}) {
  W.ground((x, y, z, T) => plasterShell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.terrazzo, wall: ID.tile4, wallLeft: ID.tile4, skirt: ID.slate }));
  W.add(trolley(0.4, -0.7, { a: 0.05 })); W.add(panel("viewing_window", -HX - 0.04, 1.4, -0.6, 1.4, 0.9, ID.windowdim, { face: "x", th: 0.01, frame: ID.steel }));
  W.add(curtain(-HX + 0.08, 1.9, -1.3, { w: 0.6, h: 1.0, face: "x", id: ID.teal, name: "viewing_curtain" }));
  W.add(timber("steel_sink", [1.7, 0.85, -HZ + 0.3], [0.45, 0.05, 0.25], ID.steel)); W.add(timber("sink_legs", [1.7, 0.4, -HZ + 0.3], [0.4, 0.4, 0.02], ID.steel));
  for (const [x, z, a] of [[-1.2, 1.0, 0.3], [-0.5, 1.2, -0.2]]) W.add(chair(x, z, { a: a + Math.PI, name: "plastic_chair" }));
  W.add(timber("side_table", [-0.85, 0.3, 1.5], [0.25, 0.02, 0.2], ID.formica)); W.add(panel("tissues", -0.85, 0.37, 1.5, 0.2, 0.08, ID.bone, { face: "z", th: 0.06 }));
  W.add(clock(0.6, 2.25, -HZ + 0.03)); W.add(notice(1.4, 1.6, -HZ, { w: 0.35, h: 0.45, name: "hand_wash_notice" })); W.add(binBag(HX - 0.4, 0.9, { s: 0.5, name: "clinical_bin" }));
  lamp(W, L, tube(0.4, H - 0.3, -0.7, { len: 1.2, I: 13, name: "mortuary_tube" })); lamp(W, L, tube(-0.8, H - 0.3, 1.0, { len: 1.2, I: 1.5, name: "failing_tube" }));
  spot(marks, "trolley", "look", [0.4, 0, 0.3], "the trolley under its sheet; the shape of a boy's feet at the end");
  spot(marks, "chairs", "talk", [-0.9, 0, 0.6], "the two plastic chairs, set facing the window for the family");
  marks.exits.push({ id: "corridor", at: [HX - 0.4, 0, 1.4], note: "the corridor to the hospital's back door" });
}

// Era 5 exteriors (The Clearance, year 115, three weeks in April; design/eras/era5.md sections 5 and 11, look L5:
// sodium with its line, phone glow, police blue). Mill Street at night with the Saros' shutter, Haldane Yard on the
// clearance day with the van and the tape, Exchange Square as a car park with the bronze sheaf, the churchyard under
// the phone mast where the bell hung, the ring road verge over the burial corner, the antique shop's window on the
// hill. Plates agent, 2026-10-23. Original code.
import { ID, box, cyl, cap, sph, prop, bbc, bbr, fb3, n3, hash } from "./prim.mjs";
import { lettering } from "./e4_kinds.mjs";
import { street } from "./e4_outside.mjs";
import { binBag, bottle, panel, formicaTable } from "./e4_kit.mjs";
import { notice } from "./e3_room.mjs";
import { van, tape, barrier, wheelie, car, mast, stone, pegs, handset, flat } from "./e5_kit.mjs";
import * as K from "../kit/props.mjs";
import { aimLight } from "./light.mjs";
import { churchGround, grave, rubbleWall, gate, yew, compound, pegLine, meshFence, bracketLamp, jarFlowers, jarCandle, can, cone, TARMAC } from "./e5_church.mjs";

const spot = (marks, id, verb, at, note) => marks.spots.push({ id, verb, at, note });
const lit = (W, L, p, I = 48) => { W.add(p); if (p.light) L.push({ ...p.light, I, key: `sodium${L.length}` }); };
const lamp = (W, L, r) => { W.add(r.p); if (r.l) L.push(r.l); };
const terrace = (W, L, x0, n, { seed = 1, z = -5.0, h = 5.4, lit: on = 0.45, id = ID.brick4 } = {}) => {
  for (let i = 0; i < n; i++) { const hs = K.house(x0 + i * 3.6, z, 1.75, 2.4, h, { id, face: 1, seed: seed + i, lit: on, roofId: ID.roof }); W.add(hs); for (const [wx, wy, kd] of hs.wins) if (kd === "lit") L.push({ ...K.windowSpill(wx, wy, z + 2.45, 1, 0.8), key: `win${L.length}` }); }
};
// a tarmac ground with bay lines and a kerb on -z, for the car park and the estate
const tarmac = (x, y, z, T, { kerbZ = -2.2, bays = false } = {}) => {
  const line = bays && z > kerbZ + 0.4 && z < kerbZ + 5 && Math.abs(((x / 2.6) % 1 + 1) % 1 - 0.5) > 0.485;
  T(box(x, y, z, 0, -0.1, 0, 30, 0.1, 30), z < kerbZ ? ID.slab : line ? ID.bone : ID.concrete); T(box(x, y, z, 0, 0.06, kerbZ - 0.08, 30, 0.06, 0.08), ID.steps);
};

// Mill Street at night: the Vell shops, the Saros' with its shutter down and the bread in the window, one boarded, the
// first-floor window opposite with its net curtain (where the clip was filmed from), flowers on the paving where he
// lay, a phone face up beside them. Key: the sodium post outside the Saros'.
export function dressMillStreet(W, L, marks) {
  W.ground((x, y, z, T) => { street(x, y, z, T, { kerbZ: -2.0 }); if (Math.abs(x - 1.2) < 0.9 && z > -3.6 && z < -2.4) T(box(x, y, z, 1.2, 0.001, -3.0, 0.9, 0.006, 0.6), ID.slab); });
  terrace(W, L, -7.2, 5, { seed: 53, lit: 0.3 });
  W.add(prop("shop_shutter", bbc(1.2, 1.2, -2.5, 1.3, 1.3, 0.1), (px, py, pz, T) => T(box(px, py, pz, 1.2, 1.15, -2.55, 1.2, 1.15, 0.03 + 0.008 * Math.cos(py * 60)), ID.steel)));
  W.add(panel("shop_sign", 1.2, 2.55, -2.52, 2.6, 0.38, lettering("e5saro", ["SARO BAKERY"], { o: [0.05, 2.66, -2.47], u: [1, 0, 0], v: [0, -1, 0], cell: 0.03, ink: ["lw bone", 0.8], ground: ["lw teal", 0.35] }), { face: "z", frame: ID.tar }));
  W.add(panel("boarded_shop", -5.4, 1.3, -2.5, 2.4, 2.0, ID.timber, { face: "z", th: 0.03 })); W.add(notice(-5.0, 1.4, -2.47, { w: 0.5, h: 0.65, name: "to_let_notice" }));
  W.add(panel("net_curtain_opposite", 5.0, 3.6, -2.48, 0.7, 0.9, ID.bonecloth, { face: "z", th: 0.004 }));
  for (let k = 0; k < 9; k++) { const fx = 0.6 + hash(k, 3, 1) * 1.2, fz = -1.8 + hash(k, 3, 2) * 0.7; W.add(prop("flowers", bbc(fx, 0.08, fz, 0.2, 0.1, 0.12), (px, py, pz, T) => { T(Math.max(Math.hypot(px - fx, pz - fz) - 0.16, Math.abs(py - 0.05) - 0.05), ID.glass); T(sph(px, py, pz, fx, 0.11, fz, 0.07), [ID.mustard, ID.bone, ID.pink, ID.red][k % 4]); })); }
  lamp(W, L, handset(1.0, 0.01, -1.4, { a: 0.6, cracked: true, name: "the_clip_phone" }));
  W.add(prop("candles", bbc(1.6, 0.06, -1.6, 0.25, 0.08, 0.1), (px, py, pz, T) => { for (const dx of [-0.15, 0, 0.15]) T(cyl(px, py, pz, 1.6 + dx, 0.05, -1.6, 0.03, 0.05), ID.wax); }));
  W.add(prop("gutter_grate", bbc(2.6, 0.0, -1.95, 0.3, 0.02, 0.15), (px, py, pz, T) => T(box(px, py, pz, 2.6, 0.0, -1.95, 0.28, 0.01 + (Math.abs((px * 25) % 1) < 0.3 ? 0 : 0.02), 0.12), ID.iron)));
  W.add(wheelie(-2.8, -2.2)); W.add(binBag(-3.4, -2.0, { s: 0.6 })); W.add(bottle(3.5, 0, -0.6));
  // key: the post outside the Saros' aimed down on the flowers and the phone (plates pass 2026-10-24: at full spread it lit the
  // house fronts and the road as bright as the place he lay); the far post is weaker
  const saroPost = K.sodiumPost(2.8, 0, -1.6, 4.8, 0); lit(W, L, saroPost, 5); L.push(aimLight(saroPost.light.pos, [1.2, 0, -0.9], { type: 0, I: 50, reach: 24, key: "saro_key", group: "sodium" }));
  lit(W, L, K.sodiumPost(-8.0, 0, -1.6, 4.8, 0), 8);
  L.push({ pos: [1.6, 0.16, -1.5], type: 1, I: 0.5, reach: 2.5, key: "shrine_candles", group: "candle" });   // the candles, lit
  spot(marks, "clip", "look", [1.0, 0, -0.6], "a phone face up among the flowers, the clip paused at the knee, the comments still loading");
  spot(marks, "shutter", "look", [1.2, 0, -1.0], "the Saros' shutter, down; the dents in it at the height of a man's fist, from inside");
  marks.exits.push({ id: "bridge", at: [-11, 0, 0.0], note: "down Mill Street to the bridge" });
}

// Haldane Yard on the clearance day: the old yard's flats on two sides, the Haldane door with the order in its plastic
// sleeve, the van backed up the yard with its lightbar turning, tape across, barriers, the bailiffs' crates, a chair
// on the step. Key: first light, grey; the lightbar answers it blue.
export function dressHaldaneYard(W, L, marks) {
  // cobbles with a few shallow puddles of mud lying in them (the earlier ground cut pits that painted as black holes)
  // (plates pass 2026-10-24: one unbroken cobble field was 11% of the frame flat) a flagged footway along the houses, stone
  // drain channels down and across the yard, and a patch of tarmac where the cobbles were dug for a pipe break it up
  W.ground((x, y, z, T) => {
    const foot = z < -1.5, drain = (Math.abs(x - 0.9 - 0.08 * z) < 0.22 && z > -1.5) || (Math.abs(z - 3.4 - 0.05 * x) < 0.2 && x < 1.0) || (Math.abs(x + 5.6) < 0.2 && z > -1.5 && z < 3.4) || (Math.abs(x + 2.4 - 0.1 * z) < 0.2 && z > 3.4), patch = x > -4.6 && x < -2.2 && z > 0.6 && z < 2.6 + 0.4 * Math.sin(x * 2.1);
    T(box(x, y, z, 0, drain ? -0.13 : -0.1, 0, 30, 0.1, 30), foot ? ID.slab : drain ? ID.steps : patch ? ID.concrete : fb3(x * 0.3, 0, z * 0.3) > 0.66 ? ID.mud : ID.cobble);
  });
  terrace(W, L, -6.0, 4, { seed: 61, lit: 0.25, id: ID.brick4 });
  // the block of flats on the left (a concrete slab with lit and dark window panels) read as black and white blocks along
  // the plate's edge and was removed, 2026-10-24; a yard wall with a row of garages closes that side instead
  W.add({ name: "yard_wall_garages", bb: [-11, 0, -4, -8.6, 2.6, 8], f: (x, y, z, T) => { T(box(x, y, z, -9.8, 1.2, 2.0, 1.1, 1.2, 5.6), ID.brick4); const k = Math.round((z - 2.0) / 2.6); T(Math.abs(k) <= 1 ? box(x, y, z, -8.68, 1.0, 2.0 + k * 2.6, 0.02, 1.0, 1.15) : 1, ID.steel); T(box(x, y, z, -9.8, 2.45, 2.0, 1.25, 0.06, 5.75), ID.tar); } });
  W.add(panel("clearance_order", -2.4 + 0.4, 1.4, -2.55, 0.3, 0.42, ID.paper, { face: "z", frame: ID.glass }));
  const vv = van(3.2, 0.6, { a: Math.PI * 0.08, I: 9 }); lamp(W, L, vv);
  W.add(tape([-7, -0.6], [7, -0.2])); for (const x of [-5.5, -3.0, 5.5]) W.add(barrier(x, 1.6));
  for (const [x, z] of [[0.6, -1.4], [1.3, -1.6], [0.9, -0.9]]) W.add(K.crate(x, 0, z, 0.3, x * 0.4, ID.crate));
  W.add(prop("kitchen_chair_on_step", bbc(-1.4, 0.5, -2.1, 0.3, 0.5, 0.3), (px, py, pz, T) => { T(box(px, py, pz, -1.4, 0.45, -2.1, 0.22, 0.02, 0.22), ID.darkwood); T(box(px, py, pz, -1.4, 0.75, -2.3, 0.22, 0.28, 0.02), ID.darkwood); for (const [sx, sz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) T(cap(px, py, pz, [-1.4 + sx, 0, -2.1 + sz], [-1.4 + sx, 0.45, -2.1 + sz], 0.015), ID.darkwood); }));
  W.add(wheelie(-4.6, -2.2, { id: ID.slate })); W.add(binBag(-4.0, -1.9, { s: 0.7 }));
  L.push({ pos: [-150, 40, 200], type: 3, I: 60000, reach: 600, key: "sun", soft: 40, group: "sky" }); // first light, low in the east
  spot(marks, "order", "read", [-2.0, 0, -1.2], "the clearance order on the Haldane door, in its plastic sleeve, four drawing pins");
  spot(marks, "van", "look", [2.0, 0, 2.2], "the van up the yard, back doors open, the lightbar turning slow over the brick");
  spot(marks, "tape", "talk", [0.0, 0, 0.6], "the tape across the yard; the tenants on one side, the escort on the other");
  marks.exits.push({ id: "street", at: [10, 0, 1.0], note: "out of the yard to the street" });
}

// Exchange Square: the car park over the cobbles, the council bench on the old scale's stone base with its plaque, the
// bronze sheaf on its plinth under a tarpaulin, roped, the villages' names showing at the foot. Key: the sodium on the
// car park's corner; the square's old houses behind.
export function dressSquare5(W, L, marks) {
  W.ground((x, y, z, T) => tarmac(x, y, z, T, { kerbZ: -3.2, bays: true }));
  terrace(W, L, -9.0, 6, { seed: 77, z: -6.2, h: 6.0, lit: 0.3, id: ID.brick });
  W.add(prop("scale_base", bbc(-2.0, 0.25, 2.6, 1.2, 0.3, 1.2), (px, py, pz, T) => T(box(px, py, pz, -2.0, 0.22, 2.6, 1.1, 0.22, 1.1) + 0.01 * fb3(px * 9, py * 9, pz * 9), ID.slab)));
  W.add(prop("council_bench", bbc(-2.0, 0.7, 2.6, 0.9, 0.45, 0.35), (px, py, pz, T) => { T(box(px, py, pz, -2.0, 0.88, 2.6, 0.8, 0.025, 0.2), ID.timber); T(box(px, py, pz, -2.0, 1.15, 2.42, 0.8, 0.12, 0.02), ID.timber); for (const s of [-0.7, 0.7]) T(box(px, py, pz, -2.0 + s, 0.65, 2.6, 0.03, 0.22, 0.2), ID.iron); }));
  W.add(panel("bench_plaque", -2.0, 0.3, 3.71, 0.3, 0.12, ID.brass, { face: "z" }));
  W.add(prop("sheaf_plinth", bbc(3.0, 1.0, 1.0, 0.9, 1.0, 0.9), (px, py, pz, T) => T(box(px, py, pz, 3.0, 0.75, 1.0, 0.75, 0.75, 0.75), ID.slab)));
  W.add(prop("bronze_sheaf", bbc(3.0, 2.4, 1.0, 0.8, 0.95, 0.8), (px, py, pz, T) => { const r = Math.hypot(px - 3.0, pz - 1.0); T(Math.max(r - 0.35 - 0.25 * Math.max(0, py - 2.6) + 0.05 * Math.sin(Math.atan2(pz - 1, px - 3) * 14), Math.abs(py - 2.35) - 0.85) + 0.02 * fb3(px * 10, py * 10, pz * 10), ID.coal); T(Math.max(r - 0.62, Math.abs(py - 2.4) - 0.9, -(r - 0.58)) + 0.03 * n3(px * 6, py * 6, pz * 6), ID.canvas); }));
  W.add(panel("village_names", 3.0, 0.4, 1.76, 1.2, 0.25, lettering("e5villages", ["OSBY HALDANE ARLEN"], { o: [2.47, 0.47, 1.77], u: [1, 0, 0], v: [0, -1, 0], cell: 0.0095, ink: ["lw bone", 0.7], ground: ["lw slate", 0.4] }), { face: "z" }));
  for (const [x, z, id, a] of [[-6.5, -1.2, ID.slate, 0], [-3.9, -1.3, ID.red, 0.03], [6.6, -1.2, ID.bone, -0.02], [9.2, -1.1, ID.navy, 0]]) W.add(car(x, z, { a: a + Math.PI / 2, id }));
  W.add(prop("pay_machine", bbc(-8.6, 0.8, -2.5, 0.3, 0.8, 0.2), (px, py, pz, T) => { T(box(px, py, pz, -8.6, 0.8, -2.5, 0.22, 0.8, 0.14), ID.steel); T(box(px, py, pz, -8.6, 1.3, -2.36, 0.12, 0.08, 0.006), ID.whitelamp); }));
  // key: the corner post aimed on the sheaf and its plinth (plates pass 2026-10-24: at full spread both posts lit the terrace
  // fronts brighter than the memorial)
  const corner = K.sodiumPost(8.0, 0, 3.4, 6, Math.PI); lit(W, L, corner, 12); L.push(aimLight(corner.light.pos, [3.0, 1.0, 1.0], { type: 0, I: 90, reach: 24, key: "sheaf_key", group: "sodium" }));
  lit(W, L, K.sodiumPost(-0.5, 0, -2.8, 6, 0), 16);
  spot(marks, "memorial", "look", [3.0, 0, 2.6], "the bronze sheaf under its tarpaulin, roped; the villages' names at the foot where the rope slipped");
  spot(marks, "bench", "look", [-2.0, 0, 4.0], "the council bench on the scale's base; the plaque gives the wrong year");
  marks.exits.push({ id: "street", at: [-11, 0, 1.0], note: "to Exchange Street" });
}

// The churchyard under the tower (rebuilt 2026-10-24: the first plate was a bare tower on an empty field): the tower with
// its buttresses, string courses and the bell openings empty, the phone mast standing out of the top with its dishes and red
// light, the compound at its foot with the cable tray up the wall; the old ground inside a rubble wall, mounds and stones in
// rows (round heads, crosses, a ledger, a chest tomb, some leaning), two yews, the gravel path from the gate to the tower
// door; the survey pegs strung through the stones, the paint marks on the ones to be moved, the site fence along one side;
// the terrace behind the far wall. Key: the lamp on its bracket at the gate, warm on the path, against an April dusk.
export function dressTower5(W, L, marks) {
  const mounds = [], path = [[-0.6, 5.8], [-0.4, 1.0], [0.0, -3.4]];
  const free = (x, z) => !(x > -3.9 && x < 3.6 && z > -9.6 && z < -1.8) && Math.abs(x + 0.5) > 1.2 && Math.hypot(x + 6.4, z + 1.2) > 2.0 && Math.hypot(x - 7.0, z - 0.6) > 1.7 && z < 5.0 - Math.max(0, x - 3) && x > -10.3 && x < 10.3 && z > -9.2;
  let g = 0;
  for (let i = 0; i < 11; i++) for (let j = 0; j < 9; j++) {
    const x = -9.8 + i * 1.95 + (hash(i, j, 1) - 0.5) * 0.4, z = -8.4 + j * 1.65 + (hash(i, j, 2) - 0.5) * 0.3;
    if (!free(x, z) || hash(i, j, 9) < 0.1) continue;
    const u = hash(i, j, 3), kind = u < 0.6 ? "round" : u < 0.78 ? "cross" : u < 0.9 ? "ledger" : "chest";
    const mark = kind !== "cross" && kind !== "chest" && x < -1 && z > -6 && hash(i, j, 5) < 0.4;
    W.add(grave(x, z - 0.9, { kind, a: (hash(i, j, 4) - 0.5) * 0.25, tilt: (hash(i, j, 6) - 0.5) * (u < 0.3 ? 0.5 : 0.15), h: 0.75 + 0.35 * hash(i, j, 7), mark, name: kind === "chest" ? "chest_tomb" : "headstone" }));
    if (kind !== "ledger" && kind !== "chest") mounds.push([x, z, 1.7]); g++;
  }
  const yard = [[-11, -10], [-11, 5.6], [3, 5.6], [11, -2.4], [11, -10], [-11, -10]];
  W.ground(churchGround({ mounds, path, pathW: 1.0, yard }));
  W.add({ name: "tower", bb: [-3.2, 0, -9.2, 3.2, 13.6, -2.8], f: (x, y, z, T) => {
    const c = box(x, y, z, 0, 6.5, -6.0, 2.4, 6.5, 2.4), open = Math.min(box(x, y, z, 0, 11.4, -3.6, 0.55, 1.1, 0.5), box(x, y, z, -2.4, 11.4, -6.0, 0.5, 1.1, 0.55), box(x, y, z, 2.4, 11.4, -6.0, 0.5, 1.1, 0.55));
    const arch = (cx, cz, ax) => Math.min(box(x, y, z, cx, 11.2, cz, ax ? 0.5 : 0.52, 0.9, ax ? 0.52 : 0.5), Math.hypot(ax ? z - cz : x - cx, y - 12.1) - 0.52);
    T(Math.max(c, -Math.min(open, arch(0, -3.6, false), arch(-2.4, -6.0, true), arch(2.4, -6.0, true)), -box(x, y, z, 0, 1.1, -3.6, 0.55, 1.1, 0.12)), ID.brick4);
    for (const yy of [4.2, 8.6, 12.9]) T(box(x, y, z, 0, yy, -6.0, 2.5, 0.09, 2.5), ID.slab);
    T(box(x, y, z, 0, 13.25, -6.0, 2.65, 0.12, 2.65), ID.slab);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) T(Math.max(box(x, y, z, sx * 2.5, 2.4, -6.0 + sz * 2.5, 0.32, 2.4, 0.32), y - 4.4 + 0.8 * (Math.abs(x - sx * 2.5) + Math.abs(z + 6.0 - sz * 2.5))), ID.slab);
    T(Math.max(box(x, y, z, 0, 1.1, -3.55, 0.48, 1.1, 0.04), Math.hypot(x, Math.max(0, y - 1.7)) - 0.48), ID.oxblood);
    T(box(x, y, z, 0, 11.0, -3.75, 0.5, 0.75, 0.02), ID.tar);
  } });
  lamp(W, L, mast(0, 13.35, -6.0, { h: 7 }));
  W.add(compound(-3.6, -4.2, -2.6, -2.2, { trayTo: [-2.44, 13.3, -3.4] }));
  W.add(rubbleWall(yard, { gaps: [[-0.6, 5.6, 0.75]] }));
  W.add(gate(-0.6, 5.6, { w: 1.4, a: 1.1 }));
  W.add(yew(-6.4, -1.2, { h: 4.6, r: 1.9 })); W.add(yew(7.0, 0.6, { h: 3.8, r: 1.5 }));
  W.add(pegLine(-10.0, -6.5, -1.6, 3.4, { n: 12 }));
  W.add(meshFence(-10.4, 4.9, -1.8, 4.9));
  W.add(notice(-2.4, 1.3, 4.92, { w: 0.6, h: 0.78, name: "clearance_notice" }));
  terrace(W, L, 4.0, 6, { seed: 91, z: -14.5, h: 6.0, lit: 0.4, id: ID.brick4 }); terrace(W, L, -27.0, 4, { seed: 95, z: -14.5, h: 5.6, lit: 0.35, id: ID.brick });
  W.add(car(-6.0, 9.0, { a: Math.PI / 2 + 0.02, id: ID.navy })); W.add(wheelie(1.8, 6.6, { id: ID.slate }));
  W.add(prop("bench", bbc(-1.9, 0.5, 2.0, 0.35, 0.5, 0.9), (px, py, pz, T) => { T(box(px, py, pz, -1.9, 0.45, 2.0, 0.22, 0.03, 0.8), ID.timber); T(box(px, py, pz, -2.1, 0.75, 2.0, 0.02, 0.15, 0.8), ID.timber); for (const s of [-0.7, 0.7]) T(box(px, py, pz, -1.95, 0.3, 2.0 + s, 0.2, 0.3, 0.03), ID.iron); }));
  const gl = bracketLamp(0.8, 6.0, { h: 3.8, a: -2.4, kind: 0, I: 70, reach: 22, name: "gate_lamp" }); W.add(gl.p); L.push(gl.l);
  L.push({ pos: [-140, 120, 190], type: 3, I: 55000, reach: 600, key: "sun", soft: 60, group: "sky" }); // the overcast, brightest low in the west over the lane
  spot(marks, "mast", "look", [1.5, 0, -2.4], "the mast where the bell hung: grey lattice, dishes, the red light that blinks all night");
  spot(marks, "pegs", "look", [-4.0, 0, 0.6], "survey pegs with orange tops, strung in a line through the old stones; orange paint on the ones to be moved");
  spot(marks, "gate", "look", [-0.6, 0, 4.6], "the churchyard gate under its lamp, the clearance notice cable-tied to the site fence");
  marks.exits.push({ id: "square", at: [10, 0, -1.0], note: "the path to Exchange Square" });
}

// The ring road verge over the burial corner (rebuilt 2026-10-24: the first plate was a murky slope with a fence and four
// stones): the carriageway on its embankment with its lines and the crash barrier, the verge falling to the old ground,
// the railings moved ten yards back with the burial corner's stones and a yew's stump behind them, a council notice on the
// rail, a hawthorn. One stone come up through the turf at a wrong angle, its lip of torn turf, a jar of daffodils and a
// tea light someone left at its foot; a knocked cone, a can, a bag in the grass. Key: the footpath lamp at the foot of the
// bank, its pool on the stone and the path; the road's columns along the top, and a thin moon for the cool side.
export function dressRingVerge(W, L, marks) {
  const bank = (x, z) => 1.6 * Math.max(0, Math.min(1, (-z - 1.0) / 3.0)) * (1 + 0.03 * Math.sin(x * 0.4));
  // a footpath worn along the foot of the bank to the gap in the rail, and the verge's turf over the old mounds
  const verge = churchGround({ mounds: [[-2.6, 4.4, 1.4], [-0.4, 4.6, 1.4], [2.0, 4.3, 1.4], [4.6, 4.5, 1.4], [-5.0, 4.4, 1.4]], slope: bank, path: [[-12, 1.6], [-4, 1.9], [-1.2, 2.3], [3.0, 2.0], [12, 2.3]], pathW: 0.7 });
  W.ground((x, y, z, T) => {
    if (z < -4.2) { const d = -z - 4.2, line = Math.abs(d - 0.3) < 0.05 || (Math.abs(d - 3.8) < 0.06 && ((x % 3) + 3) % 3 < 1.8); T(y - 1.6 - 0.004 * n3(x * 3, 0, z * 3), line ? ID.bone : TARMAC); return; }
    verge(x, y, z, T);
  });
  W.add(prop("kerb", bbc(0, 1.6, -4.15, 15, 0.15, 0.1), (px, py, pz, T) => T(box(px, py, pz, 0, 1.6, -4.15, 15, 0.1, 0.08), ID.steps)));
  W.add(prop("crash_barrier", bbc(0, 2.0, -4.3, 15, 0.5, 0.2), (px, py, pz, T) => { T(box(px, py, pz, 0, 2.05, -4.3, 15, 0.16, 0.03 + 0.02 * Math.cos(py * 25)), ID.steel); const k = Math.round(px / 2); T(box(px, py, pz, k * 2, 1.8, -4.35, 0.04, 0.3, 0.04), ID.steel); }));
  W.add(K.railing([[-12, 3.0], [12, 3.0]], 0, 1.2, 1.8, ID.iron));
  W.add(notice(-1.6, 0.85, 3.04, { w: 0.42, h: 0.56, name: "council_notice_on_rail", seed: 5 }));
  for (const [bx, c] of [[-0.6, ID.pink], [-0.3, ID.mustard], [0.1, ID.bone], [2.8, ID.red]]) W.add(prop("bouquet_on_rail", bbc(bx, 0.8, 3.0, 0.16, 0.32, 0.12), (px, py, pz, T) => { T(Math.max(Math.hypot(px - bx, pz - 2.96) - 0.03 - 0.1 * Math.max(0, py - 0.55) / 0.5, Math.abs(py - 0.8) - 0.28) + 0.01 * n3(px * 30, py * 30, pz * 30), ID.glass); T(sph(px, py, pz, bx, 1.02, 2.95, 0.09) + 0.02 * n3(px * 25, py * 25, pz * 25), c); }));
  W.add(panel("photo_in_sleeve", 0.45, 0.95, 3.03, 0.16, 0.2, ID.paper, { face: "z", frame: ID.glass }));
  W.add(grave(0.6, 0.8, { kind: "round", tilt: 0.55, a: 0.4, h: 0.95, name: "the_stone" }));
  W.add(prop("turf_lip", bbc(0.7, 0.05, 0.85, 0.7, 0.12, 0.5), (px, py, pz, T) => T(Math.hypot(px - 0.85, (py + 0.03) * 2.2, pz - 0.85) - 0.42 + 0.04 * fb3(px * 16, py * 16, pz * 16), ID.mud)));
  W.add(jarFlowers(1.25, 1.35)); const tl = jarCandle(1.05, 1.5, { I: 0.8 }); W.add(tl.p); L.push(tl.l);
  for (const [sx, sz, t, k] of [[-5.0, 4.1, 0.0, "cross"], [-3.2, 4.0, 0.08, "round"], [-0.8, 4.3, -0.06, "cross"], [1.6, 3.9, 0.12, "round"], [4.0, 4.2, 0.0, "ledger"], [6.2, 3.9, -0.2, "round"]]) W.add(grave(sx, sz, { kind: k, tilt: t, a: 0.05, h: 0.8, name: "old_stone_behind_fence" }));
  W.add(prop("yew_stump", bbr(-6.8, 0, 4.6, 0.6, 0.6, 0.6), (px, py, pz, T) => T(Math.max(Math.hypot(px + 6.8, pz - 4.6) - 0.45 - 0.08 * Math.sin(Math.atan2(pz - 4.6, px + 6.8) * 7) - 0.15 * Math.max(0, 0.12 - py) * 4, py - 0.5 - 0.06 * n3(px * 8, 0, pz * 8), -py - 0.1), ID.rust)));
  W.add(yew(7.6, 4.0, { h: 2.4, r: 1.3, name: "hawthorn" }));
  for (const x of [-7.5, -2.5, 2.5, 7.5]) W.add(prop("marker_post", bbc(x, 2.2, -3.95, 0.08, 0.6, 0.08), (px, py, pz, T) => { T(box(px, py, pz, x, 2.15, -3.95, 0.05, 0.55, 0.05), ID.bone); T(box(px, py, pz, x, 2.55, -3.9, 0.04, 0.06, 0.01), ID.red); }));
  W.add(prop("litter_bin", bbc(-3.6, 0.55, 2.4, 0.3, 0.6, 0.3), (px, py, pz, T) => { T(Math.max(Math.abs(Math.hypot(px + 3.6, pz - 2.4) - 0.2) - 0.015, Math.abs(py - 0.75) - 0.3), ID.green); T(cyl(px, py, pz, -3.6, 0.3, 2.62, 0.04, 0.3), ID.iron); }));
  W.add(prop("drain_cover", bbc(3.6, 0.0, 1.0, 0.35, 0.05, 0.35), (px, py, pz, T) => T(box(px, py, pz, 3.6, -0.0, 1.0, 0.3, 0.03 + (Math.abs(((px * 12) % 1 + 1) % 1 - 0.5) < 0.12 ? 0 : 0.01), 0.3), ID.iron)));
  W.add(cone(-2.6, 0.2, { a: 0.7 })); W.add(can(2.6, 1.8, { a: 1.2 })); W.add(can(-4.4, 1.2, { a: 0.2, id: ID.bone })); W.add(binBag(4.8, 2.4, { s: 0.45, name: "litter" })); W.add(bottle(-1.2, 0.02, 2.6));
  const main = bracketLamp(2.6, -0.5, { h: 4.6, a: -0.91, kind: 0, I: 26, reach: 14, name: "footpath_lamp" }); W.add(main.p); L.push(main.l);
  for (const x of [-9, 1.2, 11]) { lit(W, L, K.sodiumPost(x, 1.55, -3.9, 7, 0), 26); }
  L.push({ pos: [140, 160, 170], type: 3, I: 9000, reach: 600, key: "moon", soft: 40, group: "sky" }); // a thin moon behind cloud: the cool side of every shape
  spot(marks, "stone", "look", [1.4, 0, 2.0], "one stone come up through the verge at a wrong angle, the name worn off its face; daffodils in a jar at its foot");
  spot(marks, "notice", "read", [-1.6, 0, 3.0], "a council notice cable-tied to the rail: remains in this corner were moved to the new cemetery, year 112");
  marks.exits.push({ id: "fence", at: [-10, 0, 2.5], note: "along the moved fence to the road" });
}

// Hartley's antique shop on the hill: the bow window dressed for commemoration week, the door table with the goat on
// its leg, five old bowls with resin gruel, the steam from a humidifier, a card; the shop's own spotlights inside.
// Key: the window's spots, warm, on an evening street.
export function dressShop(W, L, marks) {
  W.ground((x, y, z, T) => street(x, y, z, T, { kerbZ: -1.6 }));
  W.add({ name: "shop_front", bb: [-6, 0, -6, 6, 6, -2.2], f: (x, y, z, T) => { T(Math.max(box(x, y, z, 0, 2.8, -4.4, 6, 2.8, 2.0), -box(x, y, z, 0, 1.4, -2.4, 1.9, 0.95, 1.2)), ID.limewash); T(box(x, y, z, 0, 2.6, -2.36, 2.2, 0.22, 0.05), ID.navy); T(box(x, y, z, 3.0, 1.1, -2.38, 0.5, 1.1, 0.04), ID.navy); T(box(x, y, z, 0, 0.42, -2.36, 2.0, 0.04, 0.06), ID.darkwood); } });
  W.add(panel("fascia_lettering", 0, 2.6, -2.3, 3.6, 0.28, lettering("e5hartley", ["HARTLEY ANTIQUES"], { o: [-1.45, 2.68, -2.29], u: [1, 0, 0], v: [0, -1, 0], cell: 0.024, ink: ["lw brass", 0.75], ground: ["lw navy", 0.3] }), { face: "z" }));
  W.add(prop("window_glazing_bars", bbc(0, 1.4, -2.34, 1.95, 1.0, 0.05), (px, py, pz, T) => { const k = Math.round(px / 0.95); T(Math.min(box(px, py, pz, k * 0.95, 1.4, -2.34, 0.025, 0.95, 0.025), box(px, py, pz, 0, 1.95, -2.34, 1.9, 0.02, 0.025)), ID.darkwood); }));
  W.add(formicaTable(0.0, -3.1, { hx: 0.8, hz: 0.42, h: 0.74, name: "door_table" }));
  for (let k = 0; k < 5; k++) { const bx = -0.6 + k * 0.3; W.add(prop("old_bowl", bbc(bx, 0.8, -3.0, 0.1, 0.06, 0.1), (px, py, pz, T) => { T(Math.max(Math.hypot(px - bx, pz + 3.0) - 0.09, Math.abs(py - 0.79) - 0.04, -(Math.hypot(px - bx, pz + 3.0) - 0.075) + Math.max(0, 0.82 - py) * 0), ID.clay); T(Math.max(Math.hypot(px - bx, pz + 3.0) - 0.075, Math.abs(py - 0.815) - 0.006), ID.bone); })); }
  W.add(panel("tableau_card", 1.1, 0.6, -2.5, 0.3, 0.2, ID.paper, { face: "z" })); W.add(prop("humidifier_steam", bbc(0.0, 1.05, -3.0, 0.7, 0.3, 0.3), (px, py, pz, T) => T(Math.hypot(px, (py - 1.0) * 1.4, pz + 3.0) - 0.45 + 0.12 * fb3(px * 4, py * 6, pz * 4), ID.bonecloth)));
  W.add(prop("goat_carving", bbc(0.75, 0.4, -2.72, 0.06, 0.12, 0.04), (px, py, pz, T) => T(Math.hypot(px - 0.75, (py - 0.45) * 0.8, pz + 2.72) - 0.05, ID.timber)));
  for (const x of [-1.2, 1.2]) L.push({ pos: [x, 2.1, -3.0], type: 1, I: 22, reach: 6, key: `window_spot_${x}`, group: "lantern", cone: [0, -1, 0.2], mode: 2 });
  // the street post is weaker (plates pass 2026-10-24: it lit the limewash above the window brighter than the window)
  W.add(binBag(4.0, -1.2, { s: 0.5 })); lit(W, L, K.sodiumPost(-5.0, 0, -1.2, 4.6, 0), 9);
  spot(marks, "window", "look", [0.0, 0, -0.6], "the window dressed for commemoration week: the table, five bowls, gruel cast in resin, steam");
  spot(marks, "table", "look", [0.8, 0, -0.8], "the door table, ticketed farmhouse, rustic, period; the goat still on the leg");
  marks.exits.push({ id: "hill", at: [-9, 0, 0.5], note: "down the hill" });
}

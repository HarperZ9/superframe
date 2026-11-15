// Era 4 exteriors (year 70, late autumn; design/eras/era4.md): the station platform the Saros come in on, the mill yard
// and its gate with HALVARD painted over ORME & SON, the Row (the Vell terrace by the race) with the poster, and
// Exchange Street at night with CHAFFERS OUT on the exchange sign. Every exterior is lit by sodium, the era's new light.
// Original code (plates agent, 2026-10-22).
import { ID, box, cyl, cap, slab, hash, prop, bbc, fb3 } from "./prim.mjs";
import { lettering, halftone } from "./e4_kinds.mjs";
import { binBag, bottle, panel } from "./e4_kit.mjs";
import * as K from "../kit/props.mjs";
import { sack, hoist } from "./gear.mjs";
import { barrel } from "./wood.mjs";
import { pallet } from "./mill.mjs";

const spot = (marks, id, verb, at, note) => marks.spots.push({ id, verb, at, note });
const lit = (W, L, p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `sodium${L.length}` }); };
// cobbles in setts with a kerb and a flagstone pavement along -z; wet from the autumn
export const street = (x, y, z, T, { kerbZ = -2.0, w = 30 }) => {
  const g = box(x, y, z, 0, -0.1, 0, w, 0.1, w);
  T(g, z < kerbZ ? ID.slab : ID.cobble); T(box(x, y, z, 0, 0.06, kerbZ - 0.08, w, 0.06, 0.08), ID.steps); if (z < kerbZ) T(box(x, y, z, 0, 0.06, kerbZ - 2, w, 0.06, 2), ID.slab);
};
// a suitcase, strapped
const suitcase = (x, z, { a = 0, s = 1, id = ID.leather, name = "suitcase", y = 0 } = {}) => prop(name, bbc(x, y + 0.25 * s, z, 0.45 * s, 0.3 * s, 0.45 * s), (px, py, pz, T) => { const [lx, lz] = K.rot ? K.rot(px, pz, x, z, a) : [px, pz]; T(slab(lx, py, lz, [x, y + 0.2 * s, z], [0.33 * s, 0.2 * s, 0.11 * s], 0.02), id); T(slab(lx, py, lz, [x, y + 0.2 * s, z], [0.335 * s, 0.025, 0.115 * s], 0.005), ID.tar); T(cap(lx, py, lz, [x - 0.08, y + 0.43 * s, z], [x + 0.08, y + 0.43 * s, z], 0.015), ID.tar); });

// The station platform: the platform edge over the rails, the canopy on iron columns with its valance, a bench, the
// Saros' bags, the name board, the waiting room's lit window. Key: sodium under the canopy at dusk.
export function dressStation(W, L, marks) {
  W.ground((x, y, z, T) => { T(box(x, y, z, 0, -0.1, -1.0, 30, 0.1, 6), ID.slab); T(box(x, y, z, 0, -0.55, 6.0, 30, 0.1, 2), ID.shingle); T(box(x, y, z, 0, 0.0, 4.85, 30, 0.08, 0.15), ID.bone); for (const rz of [5.6, 7.0]) T(box(x, y, z, 0, -0.38, rz, 30, 0.06, 0.04), ID.iron); const k = Math.round(x / 0.7); T(box(x, y, z, k * 0.7, -0.45, 6.3, 0.12, 0.04, 1.1), ID.timber); });
  W.add({ name: "station_building", bb: [-14, 0, -6, 14, 6, -3.8], f: (x, y, z, T) => { T(Math.max(box(x, y, z, 0, 2.4, -5, 14, 2.4, 1.0), -box(x, y, z, 2.0, 1.3, -3.98, 0.9, 1.0, 0.2), -box(x, y, z, -3.0, 1.1, -3.98, 0.6, 1.1, 0.2)), ID.brick4); T(box(x, y, z, 2.0, 1.3, -4.08, 0.85, 0.95, 0.02), ID.window); T(box(x, y, z, -3.0, 1.1, -4.08, 0.55, 1.05, 0.03), ID.darkwood); } });
  W.add({ name: "canopy_frame", bb: [-14, 0, -4.5, 14, 4.2, 3.5], f: (x, y, z, T) => { for (let r = -13; r <= 13; r += 2) T(box(x, y, z, r, 3.6, -0.6, 0.06, 0.06, 3.8), ID.iron); const k = Math.round(x / 0.25); T(Math.max(box(x, y, z, 0, 3.35, 3.15, 14, 0.25, 0.02), y - 3.35 + 0.25 - 0.12 * Math.abs(x / 0.25 - k)), ID.cobalt); for (let c = -12; c <= 12; c += 4) T(cyl(x, y, z, c, 1.8, 1.8, 0.09, 1.8), ID.iron); } });
  W.add(panel("name_board", 0.0, 2.7, 1.84, 2.6, 0.45, lettering("e4edrin", ["EDRIN"], { o: [-0.9, 2.84, 1.85], u: [1, 0, 0], v: [0, -1, 0], cell: 0.042, ink: ["lw bone", 0.8], ground: ["lw navy", 0.3] }), { face: "z", frame: ID.iron }));
  W.add({ name: "platform_bench", bb: [-6.0, 0, -3.8, -3.8, 1.0, -3.0], f: (x, y, z, T) => { T(box(x, y, z, -4.9, 0.45, -3.4, 1.0, 0.03, 0.2), ID.darkwood); T(box(x, y, z, -4.9, 0.75, -3.6, 1.0, 0.12, 0.02), ID.darkwood); for (const s of [-0.85, 0.85]) T(box(x, y, z, -4.9 + s, 0.3, -3.45, 0.03, 0.3, 0.2), ID.iron); } });
  for (const [x, z, a, s, id] of [[0.6, 1.2, 0.3, 1, ID.leather], [1.3, 1.4, -0.2, 0.85, ID.oxblood], [0.95, 1.1, 0.1, 0.7, ID.navy]]) W.add(suitcase(x, z, { a, s, id }));
  W.add(sack(1.8, 0, 0.9, { s: 0.32, seed: 9, name: "bundle" })); W.add(sack(2.1, 0, 1.3, { s: 0.28, seed: 4, name: "bundle" }));
  W.add(panel("timetable", 4.0, 1.6, -3.98, 1.0, 1.2, ID.paper, { face: "z", frame: ID.iron })); W.add(binBag(6.0, -3.4, { s: 0.6, name: "litter_bin" }));
  for (const x of [-8, -2, 4]) { L.push({ pos: [x, 3.3, 0.2], type: 0, I: 26, reach: 12, key: `canopy${x}`, group: "sodium" }); W.add(prop("canopy_lamp", bbc(x, 3.3, 0.2, 0.3, 0.3, 0.3), (px, py, pz, T) => { T(Math.hypot(px - x, (py - 3.25) * 1.6, pz - 0.2) - 0.18, ID.sodium); T(cap(px, py, pz, [x, 3.3, 0.2], [x, 3.6, 0.2], 0.012), ID.iron); })); }
  spot(marks, "bags", "look", [1.0, 0, 2.6], "the Saros' bags: three cases and two bundles tied in cloth, set down together");
  marks.exits.push({ id: "town", at: [-3.0, 0, -3.2], note: "through the booking hall to the town" });
}

// The mill yard and gate: the mill's brick flank with its windows, the gate posts with the painted board (HALVARD over
// ORME & SON), the hoist over the loading door, pallets and bales, the picket's brazier. Key: the gate's sodium lamp.
export function dressMillYard(W, L, marks) {
  W.ground((x, y, z, T) => { T(box(x, y, z, 0, -0.1, 0, 30, 0.1, 30), ID.cobble); T(Math.max(box(x, y, z, 0, 0.002, 0, 30, 0.004, 30), 0.3 - fb3(x * 0.7, 0, z * 0.7)), ID.pool); });
  W.add({ name: "mill_flank", bb: [-14, 0, -8, 14, 12, -3.8], f: (x, y, z, T) => { let d = box(x, y, z, 0, 6, -5.5, 14, 6, 1.6); for (let c = -12; c <= 12; c += 3) for (const wy of [2.2, 5.4, 8.6]) d = Math.max(d, -box(x, y, z, c, wy, -3.9, 0.6, 1.0, 0.1)); d = Math.max(d, -box(x, y, z, 3.0, 1.5, -3.9, 1.4, 1.5, 0.3)); T(d, ID.brick4); for (let c = -12; c <= 12; c += 3) for (const wy of [2.2, 5.4, 8.6]) T(box(x, y, z, c, wy, -3.98, 0.58, 0.98, 0.02), hash(c, wy * 10, 3) < 0.25 ? ID.windowdim : ID.glass); T(box(x, y, z, 3.0, 1.5, -4.0, 1.38, 1.48, 0.03), ID.darkwood); } });
  W.add({ name: "chimney_stack", bb: [9, 0, -10, 11, 26, -8], f: (x, y, z, T) => T(cyl(x, y, z, 10, 13, -9, 0.9 - y * 0.01, 13), ID.brick4) });
  W.add(hoist(3.0, 4.2, -3.6, { drop: 1.6 }));
  for (const gx of [-5.5, -1.5]) W.add(timber4("gate_post", [gx, 1.4, 2.0], [0.25, 1.4, 0.25]));
  const sign = lettering("e4ormesign", ["HALVARD", "ORME & SON"], { o: [-5.0, 3.15, 2.27], u: [1, 0, 0], v: [0, -1, 0], cell: 0.07, ink: ["lw bone", 0.8], ground: ["lw navy", 0.25], rough: 0.25, gap: 2 });
  W.add({ name: "gate_sign", bb: [-5.6, 2.0, 2.1, -1.4, 3.4, 2.4], f: (x, y, z, T) => T(box(x, y, z, -3.5, 2.7, 2.22, 2.0, 0.6, 0.04), sign) });
  W.add({ name: "gate_leaf", bb: [-1.6, 0, 2.0, 1.0, 2.2, 4.0], f: (x, y, z, T) => { const u = x + 1.5; for (let k = 0; k < 10; k++) T(cap(x, y, z, [-1.5 + Math.cos(0.9) * k * 0.25, 0.1, 2.0 + Math.sin(0.9) * k * 0.25], [-1.5 + Math.cos(0.9) * k * 0.25, 2.0, 2.0 + Math.sin(0.9) * k * 0.25], 0.02), ID.iron); void u; T(cap(x, y, z, [-1.5, 1.9, 2.0], [-1.5 + Math.cos(0.9) * 2.4, 1.9, 2.0 + Math.sin(0.9) * 2.4], 0.03), ID.iron); } });
  for (const [x, z] of [[5.5, -2.8], [6.6, -2.7]]) W.add(pallet(x, z, 0.55, 0.5)); for (const [x, z, s] of [[5.5, -2.8, 0.34], [6.5, -2.7, 0.3], [6.0, -2.0, 0.32]]) W.add(sack(x, 0.12, z, { s, seed: Math.round(x * 9), name: "cotton_bale_sack" }));
  W.add(barrel(-3.5, 0, 4.0, { r: 0.28, h: 0.8, name: "brazier_drum" })); W.add(prop("brazier_fire", bbc(-3.5, 0.95, 4.0, 0.3, 0.2, 0.3), (px, py, pz, T) => T(Math.hypot(px + 3.5, (py - 0.85) * 2, pz - 4.0) - 0.22 + 0.04 * fb3(px * 12, py * 12, pz * 12), ID.stovefire)));
  L.push({ pos: [-3.5, 1.2, 4.0], type: 1, I: 6, reach: 6, key: "brazier", group: "lantern" });
  W.add(panel("picket_board", -6.6, 1.2, 3.0, 0.9, 0.6, lettering("e4picket", ["NO", "SALE"], { o: [-6.95, 1.4, 3.01], u: [1, 0, 0], v: [0, -1, 0], cell: 0.028, ink: ["lw tar", 0.25], ground: ["lw paper", 0.7], rough: 0.3 }), { face: "z" }));
  W.add(bottle(-4.2, 0, 4.4)); W.add(binBag(7.5, 1.0, { s: 0.7 }));
  lit(W, L, K.sodiumPost(-6.2, 0, 1.6, 4.6, Math.PI / 2)); lit(W, L, K.sodiumPost(5.0, 0, -3.2, 5.2, 0));
  spot(marks, "gate_sign", "read", [-3.5, 0, 4.8], "the gate board: HALVARD painted over ORME & SON, the old letters ghosting through");
  spot(marks, "picket", "talk", [-3.0, 0, 5.2], "the picket at the brazier: four men, a board, a bottle going round");
  marks.exits.push({ id: "floor", at: [3.0, 0, -2.8], note: "the loading door onto the floor" });
}
const timber4 = (name, c, h) => prop(name, bbc(c[0], c[1], c[2], h[0] + 0.05, h[1] + 0.05, h[2] + 0.05), (x, y, z, T) => T(slab(x, y, z, c, h, 0.02), ID.brick4));

// a terraced front: K.house with brick, set along -z facing +z
const terrace = (W, L, x0, n, { seed = 1, z = -5.0, h = 5.4, lit = 0.45 } = {}) => { for (let i = 0; i < n; i++) { const hs = K.house(x0 + i * 3.6, z, 1.75, 2.4, h, { id: ID.brick4, face: 1, seed: seed + i, lit, roofId: ID.roof }); W.add(hs); for (const [wx, wy, kd] of hs.wins) if (kd === "lit") L.push(K.windowSpill(wx, wy, z + 2.45, 1, 1.0)); } };

// The Row: Vell houses on a terrace by the race, a railing on the race wall, washing across, bins, a sodium post; the
// poster fly-posted on the end wall. Key: the sodium post at the end of the Row.
export function dressRow(W, L, marks) {
  W.ground((x, y, z, T) => { street(x, y, z, T, { kerbZ: -2.2 }); T(box(x, y, z, 0, -1.0, 4.4, 30, 0.5, 1.4), ID.pool); T(box(x, y, z, 0, -0.5, 3.0, 30, 0.6, 0.1), ID.wall); });
  terrace(W, L, -7.2, 5, { seed: 41 });
  W.add(K.railing([[-12, 2.9], [12, 2.9]], 0, 1.0, 1.6));
  W.add({ name: "washing_line", bb: [-6, 2.2, -2.6, 2, 3.0, -2.2], f: (x, y, z, T) => { const s = 2.8 - 0.25 * Math.cos((x + 2) / 8 * Math.PI) ; T(Math.hypot(y - s, z + 2.4) - 0.008, ID.rope); const k = Math.round((x + 6) / 0.9); if (k > 0 && k < 9) T(Math.max(Math.abs(x - (-6 + k * 0.9)) - 0.25, Math.abs(y - s + 0.3) - 0.3, Math.abs(z + 2.4) - 0.01), hash(k, 3, 1) < 0.4 ? ID.bone : hash(k, 3, 2) < 0.5 ? ID.cobalt : ID.mustard); } });
  W.add({ name: "end_wall", bb: [10.3, 0, -7.5, 11.2, 6.2, -2.4], f: (x, y, z, T) => T(box(x, y, z, 10.7, 3.0, -5.0, 0.4, 3.0, 2.6), ID.brick4) });
  // pass 2 (2026-10-23): the bill is fly-posted big on the blank outer flank of the end wall, the one surface on the Row
  // the camera sees square-on, lit by the next sodium post along (off the plate) (the first, 0.8 m, sat behind the sodium post and painted out; a 1.3 m bill on a house front
  // came out 67 px wide). Paper white, the face in coarse dots, the slogan in black block capitals
  const face = halftone("e4posterface", (a0, b0) => { const a = a0 / 2, b = b0 / 2, r = Math.hypot(a - 0.0, (b - 0.32) * 0.8); return 0.85 - 1.3 * Math.max(0, 0.3 - r) - 0.4 * Math.max(0, 0.1 - Math.abs(b - 0.6)) + 0.25 * Math.sin(a * 20) * 0.2; }, { o: [11.115, 3.05, -4.0], u: [0, 0, -1], v: [0, -1, 0], pitch: 0.07, ink: ["lw tar", 0.1], ground: ["lw paper", 0.95] });
  L.push({ pos: [13.2, 4.4, -2.6], type: 0, I: 26, reach: 9, key: "poster_sodium", group: "sodium", cone: [-0.8, -0.55, -0.4], mode: 2 });
  W.add(panel("poster_image", 11.115, 2.55, -4.0, 1.6, 1.1, face, { face: "x" })); W.add(panel("poster_text", 11.115, 1.4, -4.0, 1.6, 1.0, lettering("e4poster", ["EDRIN", "FOR", "EDRINERS"], { o: [11.12, 1.85, -3.28], u: [0, 0, -1], v: [0, -1, 0], cell: 0.03, ink: ["lw tar", 0.1], ground: ["lw paper", 0.92] }), { face: "x" }));
  for (const [x, z] of [[-6.2, -2.3], [-2.6, -2.4], [4.4, -2.3]]) W.add(prop("dustbin", bbc(x, 0.4, z, 0.3, 0.45, 0.3), (px, py, pz, T) => { T(cyl(px, py, pz, x, 0.38, z, 0.25, 0.38), ID.steel); T(cyl(px, py, pz, x, 0.79, z, 0.28, 0.03), ID.steel); }));
  W.add(binBag(-1.8, -1.9, { s: 0.7 })); W.add(bottle(1.0, 0, -1.4));
  lit(W, L, K.sodiumPost(6.6, 0, -1.8, 4.6, -Math.PI / 2)); lit(W, L, K.sodiumPost(-9.0, 0, 2.4, 4.6, Math.PI));
  spot(marks, "poster", "read", [12.0, 0, -3.0], "the poster on the end wall: a face in coarse halftone over EDRIN FOR EDRINERS");
  spot(marks, "row", "look", [0.0, 0, 0.4], "the Row: Vell names on the doors, washing out late, the race loud under the rail");
  marks.exits.push({ id: "mill", at: [-11, 0, 0.5], note: "along the race to the mill" });
}

// Exchange Street at night: the exchange's front with the sign board (CHAFFERS OUT painted across it), the Furrowe
// door's terrace, the pavement, two sodium posts. Key: the post by the exchange.
export function dressExchangeStreet(W, L, marks) {
  W.ground((x, y, z, T) => street(x, y, z, T, { kerbZ: -2.0 }));
  terrace(W, L, 2.0, 3, { seed: 71, lit: 0.35 });
  W.add({ name: "exchange_front", bb: [-12, 0, -8, -0.2, 9, -3.6], f: (x, y, z, T) => { let d = box(x, y, z, -6, 4.2, -5.6, 5.8, 4.2, 2.0); for (const c of [-10, -7.6, -4.4, -2.0]) d = Math.max(d, -box(x, y, z, c, 2.0, -3.65, 0.55, 1.2, 0.1)); T(d, ID.wall); for (const c of [-10, -7.6, -4.4, -2.0]) T(box(x, y, z, c, 2.0, -3.7, 0.53, 1.18, 0.03), ID.glass); for (let k = 0; k < 4; k++) T(box(x, y, z, -6, 0.1 + k * 0.17, -3.3 + k * 0.0 - 0.0 + (3 - k) * 0.3, 1.4, 0.085, 0.15 + 0.0), ID.steps); T(box(x, y, z, -6, 8.3, -3.55, 6.0, 0.15, 0.1), ID.timber); } });
  const sign = lettering("e4chaffers", ["CHAFFERS OUT"], { o: [-9.6, 5.8, -3.47], u: [1, 0, 0], v: [0, -1, 0], cell: 0.1, ink: ["lw bone", 0.85], ground: ["lw mustard", 0.38], rough: 0.85 });
  W.add({ name: "exchange_sign", bb: [-10.2, 4.6, -3.6, -1.8, 6.2, -3.4], f: (x, y, z, T) => T(box(x, y, z, -6.0, 5.35, -3.5, 4.0, 0.62, 0.03), sign) });
  W.add(prop("paint_tin", bbc(-5.0, 0.12, -2.6, 0.15, 0.15, 0.15), (px, py, pz, T) => { T(cyl(px, py, pz, -5.0, 0.1, -2.6, 0.09, 0.1), ID.steel); T(Math.max(Math.hypot(px + 4.6, pz + 2.4) - 0.3, Math.abs(py - 0.003) - 0.003), ID.bone); }));
  W.add(K.ladder ? K.ladder([-4.2, 0, -3.2], [-4.4, 5.0, -3.5]) : binBag(-4.2, -3.0));
  W.add(binBag(6.0, -2.4, { s: 0.7 }));
  lit(W, L, K.sodiumPost(-1.2, 0, -1.6, 4.8, 0)); lit(W, L, K.sodiumPost(9.0, 0, -1.6, 4.8, 0));
  spot(marks, "sign", "read", [-6.0, 0, -0.6], "the exchange sign: CHAFFERS OUT across it in white house paint, still wet, run in drips");
  marks.exits.push({ id: "square", at: [-11, 0, 0.0], note: "on to Exchange Square" });
}

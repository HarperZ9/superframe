// Three era 1 interiors of The Quota (design/eras/era1.md: year 0, harvest to the first frost), package W3-C,
// 2026-10-22. Near walls cut away (shell). Original block-outs. The year is full: sacks stand to the beams, the
// hay is in, the supper table is laid for the whole district. What era 2 strips bare is here first, so the
// winter reads as loss.
//   backstore(): Orme's back store at the mill. Sacks stacked to the beams on both far walls, the beam scale with
//     its weights, the high desk with the ledger open and a lamp, a hand cart, the small window low in the west.
//   hayloft(): Abel Furrowe's hayloft over the horse. A low pitched roof on rafters, the hay heaped to the eaves,
//     the ladder up through the hatch, the loading door open on the evening, a fork in the hay, one lantern.
//   barn(): Orme's barn laid for the harvest supper. A long trestle table under a cloth down the middle, benches,
//     loaves, jugs, the cut sheaf tied at the head of the table, two lanterns on the tie-beam, bales round the walls.
import { box, cyl, ell, cap, sph } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";
import { dressBackstore } from "../props/room_backstore.mjs";
import { dressCensus } from "../props/room_census.mjs";
import { dressBoard } from "../props/room_board.mjs";
import { dressExchange } from "../props/room_exchange.mjs";
import { dressYard } from "../props/room_yard.mjs";
import { dressLoft } from "../props/room_loft.mjs";
import { dressBarn } from "../props/room_supper.mjs";
import { distinct } from "../props/shell.mjs";

const marksNew = () => ({ spots: [], hides: [], exits: [], lamps: [] });
// the lights every era 1 room shares: its own lamps, the low sun through its window, a soft fill from the camera side
const roomLights = (L, sunFrom) => (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).concat(
  V.sun ? [{ pos: V.sun.pos || sunFrom, type: 3, I: V.sun.I, reach: 400, key: "sun", soft: V.sun.soft ?? 12 }] : [],
  V.fill ? [{ pos: [0.6, 2.4, 1.6], type: 1, I: V.fill, reach: 9, key: "fill", soft: 2 }] : []);
const lantern = (W, L, x, y, z, I = 9, hang = 0) => {
  W.add(K.shape([x - 0.12, y - 0.16, z - 0.12, x + 0.12, y + 0.2 + hang, z + 0.12], (px, py, pz, T) => {
    T(cyl(px, py, pz, x, y, z, 0.07, 0.11), ID.lantern); T(cyl(px, py, pz, x, y + 0.13, z, 0.08, 0.02), ID.iron);
    if (hang) T(cap(px, py, pz, [x, y + 0.15, z], [x, y + 0.15 + hang, z], 0.008), ID.rope);
  }));
  L.push({ pos: [x, y, z], type: 1, I, reach: 7, key: `lamp${L.length}`, group: "lantern" });
};

// The back store is built in stages from the authored prop library (render/props/room_backstore.mjs); LW_STAGE picks how far.
export function backstore() {
  const W = makeWorld({ cell: 1.2, margin: 0.35 }), L = [], marks = marksNew();
  dressBackstore(W, L, marks, { HX: 2.8, HZ: 2.2, H: 2.7, stage: +process.env.LW_STAGE || 5 });
  return { world: W.build(), marks, lights: roomLights(L, [-220, 30, -60]), distinct: distinct(W), props: W.props.length };
}

// The hayloft and the barn are dressed from the authored prop library (render/props/, 2026-10-23): board walls, framing,
// hay with strand relief, bound bales, linen, bread, hooked lanterns. The shared lights follow the room's key.
export function hayloft() {
  const W = makeWorld({ cell: 1.2, margin: 0.35 }), L = [], marks = marksNew();
  dressLoft(W, L, marks, { HX: 2.6, HZ: 2.0 });
  const lights = roomLights(L, [-200, 40, 70]);
  // a cool leak of sky through the open seams of the roof boards, small beside the low sun
  return { world: W.build(), marks, lights: (V = {}) => lights(V).concat(V.fillx ? [{ pos: [4.2, 2.0, 0.2], type: 1, I: V.fillx, reach: 9, key: "fillx", soft: 2 }] : [], V.leak ? [{ pos: [10, 220, -90], type: 3, I: V.leak, reach: 400, key: "leak", soft: 2 }] : []), distinct: distinct(W), props: W.props.length };
}

export function barn() {
  const W = makeWorld({ cell: 1.5, margin: 0.4 }), L = [], marks = marksNew();
  dressBarn(W, L, marks, { HX: 4.4, HZ: 2.8, H: 3.6, TZ: -0.3 });
  const lights = roomLights(L, [-220, 18, 40]);
  // the last blue through the open yard door: a cool white spill on the boards inside it
  return { world: W.build(), marks, lights: (V = {}) => lights(V).concat(V.dusk ? [{ pos: [-4.6, 1.5, 0.6], type: 2, I: V.dusk, reach: 5, key: "dusk", soft: 2 }] : []), distinct: distinct(W), props: W.props.length };
}

// The registrar's two rooms, built from the authored library (render/props/room_census.mjs, room_board.mjs); LW_STAGE picks how far.
export function census() {
  const W = makeWorld({ cell: 1.2, margin: 0.35 }), L = [], marks = marksNew();
  dressCensus(W, L, marks, { HX: 3.0, HZ: 2.2, H: 2.8, stage: +process.env.LW_STAGE || 4 });
  return { world: W.build(), marks, lights: roomLights(L, [-200, 50, -40]), distinct: distinct(W), props: W.props.length };
}
export function board() {
  const W = makeWorld({ cell: 1.2, margin: 0.35 }), L = [], marks = marksNew();
  dressBoard(W, L, marks, { HX: 3.2, HZ: 2.4, H: 2.9, stage: +process.env.LW_STAGE || 4 });
  return { world: W.build(), marks, lights: roomLights(L, [-60, 50, -200]), distinct: distinct(W), props: W.props.length };
}

// The exchange hall (render/props/room_exchange.mjs); LW_STAGE picks how far.
export function exchange() {
  const W = makeWorld({ cell: 1.5, margin: 0.4 }), L = [], marks = marksNew();
  dressExchange(W, L, marks, { HX: 4.2, HZ: 3.0, H: 3.8, stage: +process.env.LW_STAGE || 4 });
  return { world: W.build(), marks, lights: roomLights(L, [-200, 45, -30]), distinct: distinct(W), props: W.props.length };
}

// The supper-night yard (render/props/room_yard.mjs): an exterior, so its lights add the moon and a fill as the other exteriors do.
export function yard() {
  const W = makeWorld({ cell: 2.5, margin: 0.6 }), L = [], marks = marksNew();
  dressYard(W, L, marks, { stage: +process.env.LW_STAGE || 4 });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).concat(V.moon ? [{ pos: V.moon.pos, type: 2, I: V.moon.I, reach: 400, key: "moon", soft: 30 }] : [], V.fill ? [{ pos: [0, 6, 6], type: 1, I: V.fill, reach: 20, key: "fill", soft: 2 }] : []), distinct: distinct(W), props: W.props.length };
}

function spot(marks, id, verb, at, note) { marks.spots.push({ id, verb, at, note }); }

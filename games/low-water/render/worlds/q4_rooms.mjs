// Era 4's places of The Quota (year 70, the closure; design/eras/era4.md), plates agent 2026-10-22. The rooms and streets
// are dressed from render/props/e4_*.mjs (shell, fittings and the era's surfaces); the tower and the Sheaf are era 2's
// worlds with era 4's dressing passed in (square({ dress }), sheaf({ dress })), so era 2 builds none of it.
import { makeWorld } from "../kit/world.mjs";
import * as K from "../kit/props.mjs";
import { ID } from "../props/e4_kinds.mjs";
import { dressMillOffice, dressBoard, dressPolice, dressFurrowe, dressBrack } from "../props/e4_rooms.mjs";
import { dressJoss, dressSaro, dressMillFloor, dressWellFloor, dressStair } from "../props/e4_rooms2.mjs";
import { dressStation, dressMillYard, dressRow, dressExchangeStreet } from "../props/e4_outside.mjs";
import { jukebox, ashtray, pint, panel, bottle, clock } from "../props/e4_kit.mjs";
import { square } from "./square.mjs";
import { sheaf as sheafRoom } from "./q_rooms.mjs";
import { distinct } from "../props/shell.mjs";

const marksNew = () => ({ spots: [], hides: [], exits: [], lamps: [] });
// the lights a room shares: its own lamps by group (V.emit switches or scales a group), a soft fill from the camera side
const lightsOf = (L) => (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => (V.emit && V.emit[l.group] != null ? { ...l, I: l.I * V.emit[l.group] } : l)).concat(V.fill ? [{ pos: [0.6, 2.4, 1.6], type: 1, I: V.fill, reach: 9, key: "fill", soft: 2 }] : [], V.moon ? [{ pos: V.moon.pos, type: 3, I: V.moon.I, reach: 600, key: "moon", soft: 30 }] : []);
const build = (dress, { cell = 1.2, margin = 0.35 } = {}) => () => {
  const W = makeWorld({ cell, margin }), L = [], marks = marksNew(); dress(W, L, marks);
  return { world: W.build(), marks, lights: lightsOf(L), distinct: distinct(W), props: W.props.length };
};
export const millOffice = build(dressMillOffice), board = build(dressBoard), police = build(dressPolice), furroweHouse = build(dressFurrowe), brackFlat = build(dressBrack);
export const jossFlat = build(dressJoss), saroFlat = build(dressSaro), millFloor = build(dressMillFloor, { cell: 1.5, margin: 0.4 }), wellFloor = build(dressWellFloor), estateStair = build(dressStair);
export const station = build(dressStation, { cell: 2, margin: 0.5 }), millYard = build(dressMillYard, { cell: 2, margin: 0.5 }), row = build(dressRow, { cell: 2, margin: 0.5 }), exchangeStreet = build(dressExchangeStreet, { cell: 2, margin: 0.5 });

// The tower view in year 70: the square with the first sodium on its corners and the mill's stack over the roofs
// where era 3 hung washing (design/CINEMATICS.md, the era 3 to 4 transition).
export function tower() {
  // late autumn (2026-10-24): the wet winter cobbles painted as camouflage blotches (noise-shaped puddles); the autumn
  // setts are evenly wet instead
  return square({ train: false, season: "autumn", dress: ({ W, L, add }) => {
    for (const [x, z, a] of [[-18, -12, 0], [17, -12, 0], [-18, 12, Math.PI], [17, 12, Math.PI], [0, 13, Math.PI], [0, -13, 0]]) { const p = K.sodiumPost(x, 0, z, 6, a); (add || W.add.bind(W))(p); L.push({ ...p.light, I: 90, reach: 30, key: `sodium_${x}_${z}` }); }
    (add || W.add.bind(W))(K.shape([20, 0, -40, 28, 34, -32], (x, y, z, T) => { T(Math.hypot(x - 24, z + 36) - (2.2 - y * 0.03), ID.brick4); T(Math.max(Math.abs(Math.hypot(x - 24, z + 36) - (2.25 - y * 0.03)) - 0.08, Math.abs(y - 31) - 0.4), ID.iron); }));
  } });
}
// The Sheaf in year 70: era 2's room with a jukebox against the back wall, pint glasses and full ashtrays on the
// back table, a darts board. Its key stays the bar lamp; the jukebox's arch glows beside it.
export function sheaf4() {
  return sheafRoom({ dress: ({ W, L, HX, HZ }) => {
    const j = jukebox(HX - 0.7, -HZ + 0.45, { a: 0 }); W.add(j.p); L.push(j.l);
    W.add(panel("dartboard", 0.4, 1.7, -HZ + 0.02, 0.45, 0.45, ID.coal, { frame: ID.oxblood })); W.add(clock(-1.6, 2.2, -HZ + 0.03));
    for (const [x, z] of [[1.2, -0.9], [1.45, -0.7], [0.9, -0.6]]) W.add(pint(x, 0.76, z));
    W.add(ashtray(1.2, 0.76, -0.55, { n: 9 })); W.add(bottle(2.4, 0, 1.6, { name: "dropped_bottle" }));
  } });
}

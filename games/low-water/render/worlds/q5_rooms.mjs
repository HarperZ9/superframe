// Era 5's places of The Quota (year 115, three weeks in April, the clearance; design/eras/era5.md), plates agent
// 2026-10-23. Every room and street is dressed from render/props/e5_*.mjs (shells, fittings, screens, the era's
// things) on the same small world builder era 4 uses; no era 2, 3 or 4 world is touched.
import { makeWorld } from "../kit/world.mjs";
import { dressFurroweKitchen, dressBrackKitchen, dressChannel, dressSaroFlat, dressMaraFlat, dressMortuary } from "../props/e5_rooms.mjs";
import { dressCouncil, dressArchive, dressWellHouse, dressPolice5, dressSyndicate } from "../props/e5_rooms2.mjs";
import { dressMillStreet, dressHaldaneYard, dressSquare5, dressTower5, dressRingVerge, dressShop } from "../props/e5_outside.mjs";
import { distinct } from "../props/shell.mjs";

const marksNew = () => ({ spots: [], hides: [], exits: [], lamps: [] });
// a room's lights: its own lamps by group (V.emit switches or scales a group), plus a soft fill from the camera side
const lightsOf = (L) => (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => (V.emit && V.emit[l.group] != null ? { ...l, I: l.I * V.emit[l.group] } : l)).concat(V.fill ? [{ pos: [0.6, 2.4, 1.6], type: 1, I: V.fill, reach: 9, key: "fill", soft: 2 }] : []);
const build = (dress, { cell = 1.2, margin = 0.35 } = {}) => () => {
  const W = makeWorld({ cell, margin }), L = [], marks = marksNew(); dress(W, L, marks);
  return { world: W.build(), marks, lights: lightsOf(L), distinct: distinct(W), props: W.props.length };
};
const OUT = { cell: 2, margin: 0.5 };
export const furroweKitchen = build(dressFurroweKitchen), brackKitchen = build(dressBrackKitchen), channel = build(dressChannel), saroFlat = build(dressSaroFlat), maraFlat = build(dressMaraFlat), mortuary = build(dressMortuary);
export const council = build(dressCouncil, { cell: 1.5, margin: 0.4 }), archive = build(dressArchive), wellHouse = build(dressWellHouse), police = build(dressPolice5), syndicate = build(dressSyndicate);
export const millStreet = build(dressMillStreet, OUT), haldaneYard = build(dressHaldaneYard, OUT), square = build(dressSquare5, OUT), tower = build(dressTower5, OUT), ringVerge = build(dressRingVerge, OUT), shop = build(dressShop, OUT);

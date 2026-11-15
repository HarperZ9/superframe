// The slice's sound design as four listening scenes, each placed by place.mjs with the lens it is heard
// from: the square from the tower (wide), the Haldane kitchen (narrow), the returns room (near), the road
// post (near). These are demonstrations of the beds and the one-shots; in the game each sound is triggered
// by its own event and placed from the camera and the light each frame.
import { ev } from "./kit.mjs";
import { n } from "../theory.mjs";

const TOWER = [0, 30, 0], TABLE = [0, 1.2, 0], DESK = [0, 1.2, 0], POST = [0, 1.6, 0];
const WINTER_DAWN = { hour: 7, snow: 0.8, atmosphere: { fog: 0.3 } };
const at = (stem, t, dur, inst, where, listener, lens, v, extra = {}) => ev(stem, t, dur, inst, extra.p ?? 0, v, { ...extra, place: { at: where, listener, lens, light: WINTER_DAWN } });
const scene = (id, title, lens, stems, compose) => ({ id, title, lens, bpm: 60, meter: 4, bars: 15, loop: false, harmonies: ["true"], target: -20, game: 0, stems,
  compose, adapt: () => Object.fromEntries(Object.keys(stems).map((k) => [k, 0])), listen: { passes: 1, script: [{ bar: 0, set: Object.fromEntries(Object.keys(stems).map((k) => [k, 0])), bars: 0 }] } });

export const square = scene("sfx-square", "The square from the tower, dawn", "wide",
  { air: { group: "amb", room: "tower", send: 0, gain: -9 }, town: { group: "amb", room: "square", send: 0 } },
  () => {
    const out = [ev("air", 0, 60, "wind", 0, 0.8, { opt: { rate: 0.1, whistle: 1250 } }), ev("air", 0, 60, "frost", 0, 0.5, { opt: { rate: 2 } })];
    out.push(at("town", 0, 60, "queue", [20, 0, 40], TOWER, "wide", 1, { opt: { length: 0.9, sick: 0.6 } }));
    out.push(at("town", 2, 20, "train", [-120, 0, 80], TOWER, "wide", 0.9, { opt: { mode: "idle" } }), at("town", 22, 36, "train", [-120, 0, 80], TOWER, "wide", 1, { opt: { mode: "depart", top: 6 } }));
    for (let k = 0; k < 6; k++) out.push(at("town", 8 + k * 4, 4.2, "cart", [-60 + k * 22, 0, 30], TOWER, "wide", 0.9, { opt: { speed: 0.6 } }));
    for (const t of [12, 36]) out.push(at("town", t, 10, "churchbell", [150, 0, -60], TOWER, "wide", 0.6, { p: n("A3") }));
    return out;
  });

export const kitchen = scene("sfx-kitchen", "The Haldane kitchen, close: five bowls, then four", "narrow",
  { room: { group: "amb", room: "kitchen", send: 0 }, wall: { group: "amb", room: "kitchen", send: 0.1, lp: 650, gain: -14 } },
  () => {
    const out = [at("room", 0, 60, "stove", [1, 0.8, 0.4], TABLE, "narrow", 0.5, { opt: { fire: 0.35 } }), ev("wall", 0, 60, "wind", 0, 0.9, { opt: { rate: 0.08 } })];
    [0, 3, 7, 5, 2].forEach((iv, i) => out.push(at("room", 3 + i * 1.1, 2, "bowlset", [-0.6 + i * 0.3, 0.8, 0.35], TABLE, "narrow", 0.55, { p: n("D6") + iv, gain: 10 })));
    out.push(at("room", 11, 1, "spoon", [0.2, 0.8, 0.3], TABLE, "narrow", 0.5, { gain: 8 }), at("room", 14, 1, "spoon", [-0.3, 0.8, 0.3], TABLE, "narrow", 0.4, { gain: 8 }));
    [0, 3, 5, 2].forEach((iv, i) => out.push(at("room", 34 + i * 1.3, 2, "bowlset", [-0.6 + i * 0.4, 0.8, 0.35], TABLE, "narrow", 0.5, { p: n("D6") + iv, gain: 10 })));
    return out;
  });

export const office = scene("sfx-office", "The returns room: the ledger pen, the press through the wall", "near",
  { desk: { group: "amb", room: "office", send: 0 }, wall: { group: "amb", room: "office", send: 0.2, lp: 900, gain: -4 } },
  () => {
    const out = [ev("wall", 0, 60, "murmur", 0, 0.5, { opt: { count: 6, muffle: 900 } })];
    for (let t = 1; t < 56; t += 5.5) out.push(ev("wall", t, 2, "press", 0, 0.7));
    for (let t = 4; t < 54; t += 6) out.push(at("desk", t, 2.4, "pen", [0.4, 0.8, 0.2], DESK, "near", 0.8, { opt: { dip: t % 12 < 6 } }));
    return out;
  });

export const post = scene("sfx-post", "The road post: the lamps, the cart turned back, frost", "near",
  { air: { group: "amb", room: "road", send: 0 }, road: { group: "amb", room: "road", send: 0 } },
  () => {
    const out = [ev("air", 0, 60, "wind", 0, 0.9, { opt: { rate: 0.14, whistle: 1700 } }), ev("air", 0, 60, "frost", 0, 0.6, { opt: { rate: 3 } })];
    out.push(at("road", 0, 60, "lamphum", [3, 2.5, 1], POST, "near", 0.8, { opt: { near: 0.7 } }));
    for (let k = 0; k < 5; k++) out.push(at("road", 4 + k * 3, 3.2, "cart", [-30 + k * 7, 0, 6], POST, "near", 0.9, { opt: { speed: 0.5 } }));
    for (let k = 0; k < 5; k++) out.push(at("road", 34 + k * 3.5, 3.6, "cart", [-2 - k * 7, 0, 6], POST, "near", 0.8, { opt: { speed: 0.45 } }));
    for (let t = 2; t < 30; t += 0.62) out.push(at("road", t, 0.4, "snowstep", [-28 + t * 0.9, 0, 5], POST, "near", 0.5));
    return out;
  });

// The Gut: the fish-market lane between smokehouses, at night. Brine vats and the open gutter run
// violet and cycle (the palette's void ramp); smokehouse fire-doors glow; eel and kelp strings hang
// over the stalls; one paraffin lamp swings over the lane. For the palette-locked lighting pass,
// which knows seven classes: ground, stone, wood, foliage, void, window, lamp.
import { box, cyl, sph, ell, cap, gable, lean, figure, vnoise, fbm } from "../sdf.mjs";

const CLS = { ground: 0, stone: 1, wood: 2, foliage: 3, void: 4, window: 5, lamp: 6 };
export const ID = { lane: 1, wallL: 2, wallR: 3, roof: 4, chimney: 5, door: 6, stall: 7, rack: 8, eel: 9, vat: 10, brine: 11, gutter: 12, lamp: 13, coat: 14, skin: 15, crate: 16, sign: 17 };
let cur = 0; export const idOf = () => cur;
const LAMP = [0.4, 4.1, 1.0];
const WIFE = { pos: [2.2, 0, 3.6], a: Math.PI, h: 1.6, head: 0.3, stoop: 0.55, girth: 0.5, neck: 0.12, arms: 1.4 };
const MAN = { pos: [-1.9, 0, -2.6], a: 0.2, h: 2.3, head: 0.2, stoop: 0.3, girth: 0.26, neck: 0.5, hat: 1.4 };
const tmp = { d: 0, part: 0 };

export function map(x, y, z) {
  let d = Infinity, id = 0;
  const T = (t, i) => { if (t < d) { d = t; id = i; } };
  // the lane falls gently toward the harbour (+z); the gutter is cut down its middle
  const ly = -0.04 * z, gut = Math.max(Math.abs(x - 0.2 - 0.25 * Math.sin(z * 0.4)) - 0.45, -(y - ly + 0.14));
  T(Math.max(y - ly, -gut), ID.lane); T(y - ly + 0.09, ID.gutter);
  // smokehouses on both sides, leaning into the lane, tall bent chimneys
  for (const [side, wid] of [[-1, ID.wallL], [1, ID.wallR]]) for (let k = 0; k < 4; k++) {
    const cz = -9 + k * 5.2, cx = side * 5.3, hh = 3.6 + 1.2 * Math.sin(k * 2.1 + side), k2 = -side * (0.06 + 0.03 * Math.sin(k)), lx = lean(x, y, 0.5, k2);
    const b = box(lx, y, z, cx, hh / 2, cz, 1.6, hh / 2, 2.4); if (b > 3) { T(b, wid); continue; }
    T(b, wid); T(gable(lx, y, z, cx, hh, cz, 1.8, 2.6, 1.2), ID.roof);
    const ch = cap(lx, y, z, [cx + side * 0.6, hh + 1, cz - 0.8], [cx + side * 0.2 - 0.6 * side, hh + 3.8, cz - 1.2], 0.32); T(ch, ID.chimney);
    T(box(lx, y, z, cx - side * 1.62, 0.95, cz + 0.4, 0.06, 0.95, 0.6), k % 2 ? ID.door : ID.wallL);
  }
  // stalls with racks, strings of eels and kelp hung over them
  for (const [sx, sz] of [[-2.4, -6], [-2.4, 1.5], [2.6, -3], [2.6, 5.5]]) {
    const lb = Math.hypot(x - sx, z - sz) - 2.6; if (lb > 0.6) { T(lb, ID.stall); continue; }
    T(box(x, y, z, sx, 0.85, sz, 0.8, 0.08, 1.6), ID.stall); for (const dz of [-1.4, 1.4]) T(box(x, y, z, sx, 1.45, sz + dz, 0.06, 1.45, 0.06), ID.stall);
    T(box(x, y, z, sx, 2.85, sz, 0.08, 0.06, 1.6), ID.rack);
    for (let e = 0; e < 7; e++) { const ez = sz - 1.3 + e * 0.43, len = 1.1 + 0.6 * vnoise(e, sx), sway = 0.12 * Math.sin(e * 2 + sx); T(cap(x, y, z, [sx, 2.8, ez], [sx + sway, 2.8 - len, ez + sway], 0.1 - 0.02 * (e % 2)), ID.eel); }
    T(box(x, y, z, sx + Math.sign(sx) * 0.2, 1.05, sz + 0.2, 0.55, 0.12, 0.9), ID.eel); // the day's catch on the board
  }
  // brine vats
  for (const [vx, vz, r] of [[-2.9, 4.6, 0.85], [3.4, -7.4, 1.0], [-3.1, -1.6, 0.7]]) {
    const lb = Math.hypot(x - vx, z - vz) - r - 0.3; if (lb > 0.5) { T(lb, ID.vat); continue; }
    T(Math.max(cyl(x, y, z, vx, 0.5, vz, r, 0.5), -cyl(x, y, z, vx, 0.75, vz, r - 0.1, 0.5)), ID.vat); T(cyl(x, y, z, vx, 0.5, vz, r - 0.1, 0.38), ID.brine);
  }
  for (const [cx, cz] of [[1.4, -8.6], [1.0, 7.8], [-1.6, 6.8]]) T(box(x, y, z, cx, 0.35, cz, 0.38, 0.35, 0.38), ID.crate);
  // the lamp on a wire across the lane
  T(cap(x, y, z, [-3, 5.6, 1], [3, 5.6, 1], 0.025), ID.rack); T(cap(x, y, z, [LAMP[0], 5.6, LAMP[2]], [LAMP[0], LAMP[1] + 0.2, LAMP[2]], 0.02), ID.rack); T(sph(x, y, z, LAMP[0], LAMP[1], LAMP[2], 0.2), ID.lamp);
  for (const f of [WIFE, MAN]) { const q = figure(x, y, z, f, tmp); if (q < d) { d = q; id = tmp.part === 1 ? ID.skin : ID.coat; } }
  cur = id; return d;
}
export function cls(id, P) {
  const n = fbm(P[0] * 1.5 + P[1], P[2] * 1.5);
  switch (id) {
    case ID.lane: return { cls: CLS.ground, a: 0.55 + 0.45 * n };
    case ID.gutter: case ID.brine: return { cls: CLS.void, a: 1, phase: (0.55 * vnoise(P[0] * 0.8, P[2] * 0.8) + 0.45 * vnoise(P[2] * 2.1, P[0] * 2.1 + 3) + 0.08 * P[2] + 10) % 1 };
    case ID.wallL: case ID.wallR: case ID.chimney: return { cls: CLS.stone, a: 0.5 + 0.5 * n };
    case ID.roof: return { cls: CLS.stone, a: 0.35 + 0.3 * n };
    case ID.door: return { cls: CLS.window, a: 0.4 + 0.6 * n };
    case ID.stall: case ID.rack: case ID.crate: case ID.vat: return { cls: CLS.wood, a: 0.6 + 0.4 * n };
    case ID.eel: return { cls: CLS.foliage, a: 0.6 + 0.4 * n };
    case ID.lamp: return { cls: CLS.lamp, a: 1 };
    case ID.coat: return { cls: CLS.wood, a: 0.35 }; case ID.skin: return { cls: CLS.ground, a: 0.95 };
    default: return { cls: CLS.stone, a: 0.5 };
  }
}
export const lightsPL = () => ({ moonDir: (() => { const v = [0.55, 0.62, -0.4], l = Math.hypot(...v); return v.map((c) => c / l); })(), lamp: LAMP, glows: [
  { pos: [-3.4, 0.9, -3.4], radius: 4.5, core: 0.8, intensity: 1.6, wrap: 0.5 }, { pos: [-3.4, 0.9, 7.0], radius: 4.5, core: 0.8, intensity: 1.6, wrap: 0.5 },
  { pos: [3.4, 0.9, 1.8], radius: 4.5, core: 0.8, intensity: 1.4, wrap: 0.5 }] });
export default { map, idOf, cls, lightsPL };

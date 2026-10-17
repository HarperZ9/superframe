// The weigh-house at 21:38: the Guild of the Gut votes by smell, blindfolded, in the dark, round the
// town balance; a fish on each pan; the shop steward's hand on the quay switch. Mother's last sweep
// comes through the louvre. A cutaway room (the near walls removed), for the 1-bit dither pass.
import { box, cyl, sph, ell, cap, figure, vnoise, fbm } from "../sdf.mjs";

export const ID = { floor: 1, wall: 2, louvre: 3, post: 4, beam: 5, pan: 6, fish: 7, coat: 8, skin: 9, blind: 10, switchbox: 11, candle: 12, flame: 13, board: 14, crate: 15, hook: 16 };
let cur = 0; export const idOf = () => cur;
const RING = Array.from({ length: 7 }, (_, k) => { const a = (k / 7) * Math.PI * 2 + 0.3, r = 3.0 + 0.25 * Math.sin(k * 2.3); return { pos: [Math.cos(a) * r, 0, Math.sin(a) * r], a: Math.atan2(-Math.sin(a), -Math.cos(a)) + Math.PI / 2 * 0 , h: 1.7 + 0.35 * Math.sin(k * 1.7), head: 0.21 + 0.04 * Math.cos(k), stoop: 0.7, girth: 0.3 + 0.05 * Math.sin(k * 3), neck: 0.45 }; });
// face the scale: figure() faces +x in its local frame rotated by a; we want local +x toward the centre
for (const f of RING) f.a = Math.atan2(f.pos[2], -f.pos[0]) * 1 + 0;
const MARROW = { pos: [2.6, 0, -4.2], a: Math.PI / 2 + 0.3, h: 2.15, head: 0.3, stoop: 0.2, girth: 0.42, neck: 0.25 };
const tmp = { d: 0, part: 0 };
const PLATE = typeof process !== "undefined" && process.env && process.env.LW_PLATE === "1";

export function map(x, y, z) {
  let d = Infinity, id = 0;
  const T = (t, i) => { if (t < d) { d = t; id = i; } };
  T(y + 0.0 * vnoise(x * 2, z * 2), ID.floor);
  // back walls (x = -6 and z = -5), a louvre in the x wall
  const wx = box(x, y, z, -6.3, 2.6, 0, 0.3, 2.6, 5.6), lou = box(x, y, z, -6.3, 2.7, 0.5, 0.5, 0.9, 1.2);
  T(Math.max(wx, -lou), ID.wall); T(box(x, y, z, 0, 2.6, -5.3, 6.6, 2.6, 0.3), ID.wall);
  for (let k = 0; k < 5; k++) T(box(x, y, z, -6.3, 1.95 + 0.38 * k, 0.5, 0.06, 0.04, 1.2), ID.louvre);
  // the town balance
  T(cyl(x, y, z, 0, 1.5, 0, 0.14, 1.5), ID.post); T(cap(x, y, z, [-2.0, 3.1, 0.2], [2.0, 2.9, -0.2], 0.09), ID.beam);
  for (const [px, py, pz] of [[-2.0, 1.55, 0.2], [2.0, 1.35, -0.2]]) {
    for (const s of [-1, 1]) T(cap(x, y, z, [px, py + 1.5, pz], [px + 0.5 * s, py + 0.08, pz], 0.02), ID.hook);
    T(Math.max(ell(x, y, z, px, py, pz, 0.75, 0.22, 0.75), y - py - 0.05), ID.pan);
    T(ell(x, y, z, px, py + 0.22, pz, 0.62, 0.17, 0.2), ID.fish);
  }
  T(cyl(x, y, z, 0, 3.2, 0, 0.05, 0.12), ID.candle); T(ell(x, y, z, 0, 3.42, 0, 0.05, 0.1, 0.05), ID.flame);
  // the tally board and the switch box on the back wall
  T(box(x, y, z, -2.5, 2.8, -4.95, 1.3, 0.8, 0.05), ID.board);
  T(box(x, y, z, 3.4, 1.6, -4.9, 0.35, 0.45, 0.12), ID.switchbox); T(cap(x, y, z, [3.4, 1.6, -4.75], [3.15, 1.95, -4.6], 0.04), ID.hook);
  T(box(x, y, z, -4.8, 0.45, -3.9, 0.5, 0.45, 0.5), ID.crate); T(box(x, y, z, -4.6, 0.35, -2.8, 0.4, 0.35, 0.4), ID.crate);
  for (const f of PLATE ? RING : [...RING, MARROW]) {
    const q = figure(x, y, z, f, tmp); if (q < d) { d = q; id = tmp.part === 1 ? ID.skin : ID.coat; }
    // blindfolds: a band round the head of every voter (not the steward)
    if (f !== MARROW) { const hx = f.pos[0], hz = f.pos[2], ca = Math.cos(f.a), sa = Math.sin(f.a), hd = f.stoop * 0.5 + f.neck * 0.6 + f.head * 0.4, hy = f.h * 0.78 + f.neck + f.head * 0.82;
      const cx = hx + hd * ca, cz = hz - hd * sa; T(Math.max(Math.abs(Math.hypot(x - cx, z - cz) - f.head * 1.08) - 0.03, Math.abs(y - hy) - 0.06), ID.blind); }
  }
  cur = id; return d;
}
const TONE = { [ID.floor]: 0.32, [ID.wall]: 0.42, [ID.louvre]: 0.2, [ID.post]: 0.22, [ID.beam]: 0.3, [ID.pan]: 0.5, [ID.fish]: 0.85, [ID.coat]: 0.3, [ID.skin]: 0.6, [ID.blind]: 0.95, [ID.switchbox]: 0.55, [ID.candle]: 0.9, [ID.board]: 0.12, [ID.crate]: 0.35, [ID.hook]: 0.4 };
export const albedo = (id, P) => (TONE[id] ?? 0.4) * (id === ID.floor ? 0.8 + 0.4 * fbm(P[0] * 3, P[2] * 0.6) : id === ID.wall ? 0.85 + 0.3 * fbm(P[1] * 4, (P[0] + P[2]) * 0.5) : 1);
export const emissive = (id) => id === ID.flame;
export const sky = () => 0.0;
let ENG = null;
export async function init() { ENG = await import(new URL("../rn.mjs", import.meta.url).href).then((m) => import(m.rn("web/shaders/ditherlight/lights.mjs"))); }
await init();
export function lights() {
  return [
    ENG.makeRadial({ pos: [0, 3.5, 0], radius: 9.5, core: 2.8, intensity: 6.0, wrap: 0.35 }),
    ENG.makeBeam({ pos: [-16, 4.4, 6.6], dir: [1, -0.16, -0.6], outerDeg: 4.5, innerDeg: 2.0, range: 34, intensity: 3.2, wrap: 0.1 }),
    ENG.makeRadial({ pos: [3.3, 2.1, -4.3], radius: 2.2, core: 0.5, intensity: 2.5, wrap: 0.5 }), // the switch box's pilot lamp
  ];
}
// Light scattered by pipe smoke along the louvre beam.
export function haze(o, d, tEnd, spec, L) {
  let s = 0; const n = 28, t1 = Math.min(tEnd, 140);
  for (let k = 0; k < n; k++) { const t = ((k + 0.5) / n) * t1, P = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]; if (P[1] < 0 || P[1] > 5.2 || P[0] < -6 || Math.abs(P[2]) > 5.5) continue; s += ENG.maskAt(L[1], P) * (t1 / n); }
  return Math.min(1, 0.035 * s);
}
export default { map, idOf, albedo, emissive, sky, lights, haze };

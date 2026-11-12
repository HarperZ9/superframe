// The Flats at low water, near dawn, fog off the bay: the drowned lamp leaning out of the mud with a
// lantern in its broken base, a line of boot prints the rain has half taken, the assessor standing
// at the end of them; Mother, relit, sweeping the fog from the mole. For the four-tone dither pass.
import { box, cyl, sph, ell, cap, figure, vnoise, fbm } from "../sdf.mjs";

export const ID = { mud: 1, pool: 2, drowned: 3, rubble: 4, coat: 5, skin: 6, hat: 7, lantern: 8, mole: 9, tower: 10, head: 11, print: 12, stake: 13, net: 14 };
let cur = 0; export const idOf = () => cur;
const mudY = (x, z) => 0.22 * (fbm(x * 0.15, z * 0.15) - 0.5) + 0.06 * Math.sin(x * 0.7 + z * 0.3);
const D = [0, 0, 0]; D[1] = mudY(0, 0);
const LAMB = { pos: [5.5, 0, 6.5], a: 2.5, h: 1.95, head: 0.25, stoop: 0.15, girth: 0.33, neck: 0.3, hat: 1 }; LAMB.pos[1] = mudY(5.5, 6.5);
const MERROW = { pos: [-1.6, 0, 2.2], a: -0.6, h: 1.8, head: 0.3, stoop: 0.55, girth: 0.42, neck: 0.18, arms: 1.3 }; MERROW.pos[1] = mudY(-1.6, 2.2);
const MOTHER = [-30, 0, -26];
const tmp = { d: 0, part: 0 };
// boot prints from the drowned lamp to the assessor: shallow dents, every 0.7 m, alternating
const PRINTS = Array.from({ length: 12 }, (_, k) => { const t = k / 11, x = 0.9 + 4.2 * t + 0.25 * (k % 2 ? 1 : -1) * 0.5, z = 1.5 + 4.6 * t + 0.25 * (k % 2 ? -1 : 1) * 0.5; return [x, mudY(x, z), z, 1 - 0.55 * t]; });

export function map(x, y, z) {
  let d = Infinity, id = 0;
  const T = (t, i) => { if (t < d) { d = t; id = i; } };
  let m = (y - mudY(x, z)) * 0.8, inPrint = false;
  for (const [px, py, pz, depth] of PRINTS) { const e = ell(x, y, z, px, py + 0.02, pz, 0.16, 0.06 * depth + 0.01, 0.32); if (e < 0.4 && -e > m) { m = -e; inPrint = true; } else if (e < 0.03) inPrint = true; }
  T(m, inPrint ? ID.print : fbm(x * 0.2 + 7, z * 0.2) < 0.38 ? ID.pool : ID.mud);
  // the drowned lamp: an older tower, leaning, its top broken off, a hole in its base
  { const lb = Math.hypot(x, z) - 3.2; if (lb < 1) {
    const ca = Math.cos(0.3), sa = Math.sin(0.3), lx = x, ly = y - D[1], rx = lx * ca - ly * sa, ry = lx * sa + ly * ca;
    const r = 1.35 - 0.05 * ry, tower = Math.max(Math.hypot(rx, z) - r, -Math.hypot(rx, z) + r - 0.25, ry - 4.2 - 0.9 * vnoise(rx * 2.5, z * 2.5), -ry - 1.2) * 0.85;
    const hole = box(rx, ry, z, 0.2, 0.55, 1.1, 0.45, 0.6, 0.6);
    T(Math.max(tower, -hole), ID.drowned);
    T(sph(rx, ry, z, 0.1, 0.35, 0.6, 0.12), ID.lantern);
    for (let k = 0; k < 6; k++) { const a = k * 1.1, rr = 2.0 + 0.4 * Math.sin(k * 3); T(ell(x, y, z, Math.cos(a) * rr, D[1] + 0.05, Math.sin(a) * rr, 0.35, 0.18, 0.28), ID.rubble); }
  } else T(lb, ID.drowned); }
  // mooring stakes and a hung net, for the near ground
  for (const [sx, sz] of [[8.5, 1.5], [9.8, 2.6], [-6, 8], [-4.5, 9.5]]) T(cyl(x, y, z, sx, 0.7, sz, 0.09, 1.1), ID.stake);
  T(Math.max(Math.abs(x + 5.25) * 0.2 + Math.abs(z - 8.75) * 0.2 - 0.6, Math.abs((x + 5.25) - (z - 8.75)) - 0.02, Math.abs(y - 1.0) - 0.7) , ID.net);
  // the assessor, and the salvor kneeling at the hole
  { const q = figure(x, y, z, LAMB, tmp); if (q < d) { d = q; id = tmp.part === 1 ? ID.skin : tmp.part === 2 ? ID.hat : ID.coat; } }
  T(sph(x, y, z, LAMB.pos[0] - 0.35, LAMB.pos[1] + 0.55, LAMB.pos[2] + 0.35, 0.12), ID.lantern);
  { const q = figure(x, y, z, MERROW, tmp); if (q < d) { d = q; id = tmp.part === 1 ? ID.skin : ID.coat; } }
  // Mother, far off on the mole, her swollen head lit
  { const lb = Math.hypot(x - MOTHER[0], z - MOTHER[2]) - 4; if (lb < 1) {
    T(box(x, y, z, MOTHER[0] + 9, 0.3, MOTHER[2], 12, 1, 1.4), ID.mole);
    const r = 1.4 - 0.06 * Math.max(0, y) + 0.5 * Math.exp(-((y - 6.3) ** 2) / 1.2);
    T(Math.max(Math.hypot(x - MOTHER[0], z - MOTHER[2]) - r, y - 9.4, -y) * 0.8, ID.tower);
    T(ell(x, y, z, MOTHER[0], 11.1, MOTHER[2], 1.8, 1.7, 1.8), ID.head);
  } else T(lb, ID.tower); }
  cur = id; return d;
}
const TONE = { [ID.mud]: 0.42, [ID.pool]: 0.15, [ID.drowned]: 0.55, [ID.rubble]: 0.4, [ID.coat]: 0.18, [ID.skin]: 0.6, [ID.hat]: 0.1, [ID.mole]: 0.3, [ID.tower]: 0.3, [ID.stake]: 0.15, [ID.net]: 0.25, [ID.print]: 0.08, [ID.head]: 1.0, [ID.lantern]: 1.0 };
export const albedo = (id, P) => (TONE[id] ?? 0.4) * (id === ID.mud ? 0.75 + 0.5 * fbm(P[0] * 1.3, P[2] * 1.3) : id === ID.drowned ? 0.7 + 0.5 * fbm(P[1] * 3, P[0] + P[2]) : 1);
export const emissive = (id) => id === ID.lantern || id === ID.head;
export const sky = (d) => 0.9;
const ENG = await import(new URL("../rn.mjs", import.meta.url).href).then((m) => import(m.rn("web/shaders/ditherlight/lights.mjs")));
export function lights(spec = {}) {
  const a = spec.beamAngle ?? -0.35;
  return [
    ENG.makeRadial({ pos: [0.3, D[1] + 0.6, 1.2], radius: 7, core: 1.2, intensity: 2.6, wrap: 0.3 }),
    ENG.makeBeam({ pos: [MOTHER[0], 11.1, MOTHER[2]], dir: [Math.cos(a), -0.2, Math.sin(a) + 0.85], outerDeg: 10, innerDeg: 4, range: 90, intensity: 2.4, wrap: 0.1 }),
    ENG.makeRadial({ pos: [LAMB.pos[0] - 0.35, LAMB.pos[1] + 0.6, LAMB.pos[2] + 0.35], radius: 5, core: 0.9, intensity: 1.6, wrap: 0.3 }),
  ];
}
// fog lit by the beam along the view ray
export function haze(o, d, tEnd, spec, L) {
  let s = 0; const n = 36, t1 = Math.min(tEnd, 160);
  for (let k = 0; k < n; k++) { const t = ((k + 0.5) / n) * t1, P = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]; if (P[1] < -1 || P[1] > 16) continue; s += ENG.maskAt(L[1], P) * (t1 / n); }
  return Math.min(1, 0.05 * s);
}
export default { map, idOf, albedo, emissive, sky, lights, haze };

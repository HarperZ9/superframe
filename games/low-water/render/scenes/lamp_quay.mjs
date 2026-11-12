// Lamp Quay at low water, 23:04 on Low Night. Original block-out for the Low Water key frames.
// y up; the quay top is y = 0; the exposed harbour floor is y = -3.2. The quay edge runs along x at
// z = 0; the harbour floor is z > 0. Mother (the great lamp) stands on the mole at the right.
import { box, rbox, cyl, sph, ell, cap, tcap, gable, lean, fbm, vnoise, figure, sat } from "../sdf.mjs";

export const ID = { quay: 1, wall: 2, mud: 3, pool: 4, steps: 5, houseA: 6, houseB: 7, houseC: 8, houseD: 9, roof: 10, win: 11, winDark: 12, hull: 13, porthole: 14, brineDoor: 15, weigh: 16, beam: 17, post: 18, sodium: 19, mole: 20, tower: 21, band: 22, lens: 23, dome: 24, boat: 25, mast: 26, keelCoat: 27, skin: 28, walker: 29, lantern: 30, drowned: 31, merrowLamp: 32, fish: 33, weed: 34, chimney: 35, hat: 36, sign: 37, crate: 38, prismG: 39, rag: 40, cap: 41 };
// the colour test: the same three things under the sodium lamp and in the Brine's doorway
const SETS = [[-9.3, 0.6], [-6.25, 0.15]];
// LW_PLATE=1: the game's plate. People who move or talk are drawn by the game, not baked.
const PLATE = typeof process !== "undefined" && process.env && process.env.LW_PLATE === "1";
const FLOOR = -3.2, MX = 20.5, MZ = -2.0;
let cur = 0;
export const idOf = () => cur;

// Mud height with ripples; pools sit where the noise dips.
const mudY = (x, z) => FLOOR + 0.18 * (fbm(x * 0.18, z * 0.18) - 0.5) - 0.06 * Math.max(0, z - 2) / 8;
const poolAt = (x, z) => fbm(x * 0.21 + 11, z * 0.21 + 4) < 0.4;
const SODIUM = [[-9.5, 4.6, -0.7], [-0.5, 4.9, -0.7], [7.5, 4.4, -0.7]];
const WALKERS = [{ pos: [-5.5, 0, 6.5], a: 0.4, h: 1.75, lamp: [-5.05, 0.95, 6.75] }, { pos: [-3.6, 0, 9.2], a: -0.6, h: 2.05, lamp: [-3.2, 1.05, 9.0] }, { pos: [2.5, 0, 7.8], a: 2.4, h: 1.65, lamp: [2.1, 0.9, 7.6] }, { pos: [5.2, 0, 10.5], a: 3.0, h: 1.9, lamp: [4.8, 1.0, 10.3] }, { pos: [-9.6, 0, 9.9], a: -0.9, h: 2.2, lamp: [-9.2, 1.1, 9.5] }];
for (const w of WALKERS) { w.pos[1] = mudY(w.pos[0], w.pos[2]); w.lamp[1] += w.pos[1]; }
const KEEL = { pos: [-2.2, 0, -0.9], a: 1.1, h: 2.35, head: 0.27, stoop: 0.35, girth: 0.36, neck: 0.42, hat: 1 };
const DROWNED = [-12.5, 0, 9.5]; DROWNED[1] = mudY(DROWNED[0], DROWNED[2]);
const tmp = { d: 0, part: 0 };

export function map(x, y, z) {
  let d = Infinity, id = 0;
  const T = (t, i) => { if (t < d) { d = t; id = i; } };
  // quay slab (with a weed band on its face) and the harbour floor
  if (y > FLOOR - 1) {
    const q = box(x, y, z, -6, -1.8, -15, 24, 1.8, 15);
    if (q < 0.5) T(q, y < -2.1 && z > -0.3 ? ID.weed : z > -0.15 && y < -0.05 ? ID.wall : ID.quay); else T(q, ID.quay);
  }
  { const m = (y - mudY(x, z)) * 0.8; if (m < 1) T(m, poolAt(x, z) || x < -27 ? ID.pool : ID.mud); else T(m, ID.mud); }
  // steps down from the quay edge
  if (x > -4.2 && x < -1.2 && z > -0.2 && z < 6 && y < 0.3) for (let k = 0; k < 7; k++) T(box(x, y, z, -2.7, -0.23 - 0.46 * k, 0.4 + 0.42 * k, 1.4, 0.23 + 0.0 * k, 0.21 + (k === 6 ? 0.5 : 0)), ID.steps);
  // the back row: four crooked houses leaning on each other
  if (z < -4 && y < 14) {
    const rows = [[-11.5, 2.6, 6.6, 0.07, ID.houseA], [-6.2, 2.4, 8.2, -0.05, ID.houseB], [-1.0, 2.3, 7.4, 0.06, ID.houseC], [4.0, 2.2, 9.0, -0.08, ID.houseD], [8.9, 2.4, 6.0, 0.05, ID.houseA]];
    for (const [cx, hx, hh, k, hid] of rows) {
      const lx = lean(x, y, 1, k), hb = box(lx, y, z, cx, hh / 2, -9.5, hx, hh / 2, 2.2);
      if (hb > 2.6) { T(hb, hid); continue; }
      T(hb, hid); T(gable(lx, y, z, cx, hh, -9.5, hx + 0.2, 2.5, 1.9 + 0.3 * Math.sin(cx)), ID.roof);
      T(box(lx, y, z, cx + hx * 0.4, hh + 2.0, -10, 0.28, 1.2, 0.28), ID.chimney);
      // windows on the front face: lit or dark by a fixed pattern
      for (let r = 0; r < Math.floor(hh / 2.1); r++) for (const s of [-1, 1]) {
        const wx = cx + s * hx * 0.45, wy = 1.6 + r * 2.05, lit = (Math.floor(cx * 3) + r * 7 + (s > 0 ? 3 : 0)) % 5 < 2;
        T(box(lx, y, z, wx, wy, -7.28, 0.36, 0.55, 0.05), lit ? ID.win : ID.winDark);
      }
    }
  }
  // the town climbing Chancel Hill behind: terraces of narrow houses, cheap boxes with roofs
  if (z < -12.5) {
    const hill = box(x, y, z, -6, -1 + 0.5 * Math.max(0, -z - 12) , -30, 26, 1 + 0.5 * Math.max(0, -z - 12), 17.5) * 0.7; T(hill, ID.quay);
    const cz = Math.floor((-z - 13) / 4.2), czc = -13 - 4.2 * (cz + 0.5), base = 0.5 * Math.max(0, -czc - 12) * 2 - 0.2;
    const cx = Math.floor((x + 40) / 3.1), cxc = -40 + 3.1 * (cx + 0.5), hr = (cx * 7 + cz * 13) % 5, hh = 3 + hr * 0.9;
    if (cz >= 0 && cz < 5 && cxc > -32 && cxc < 22) {
      const lx = lean(x, y, base, ((cx * 3 + cz) % 3 - 1) * 0.06);
      T(box(lx, y, z, cxc, base + hh / 2, czc, 1.35, hh / 2, 1.6) * 0.8, [ID.houseA, ID.houseB, ID.houseC, ID.houseD][(cx + cz) & 3]);
      T(gable(lx, y, z, cxc, base + hh, czc, 1.5, 1.8, 1.4) * 0.8, ID.roof);
      if ((cx * 5 + cz * 3) % 4 === 0) T(box(lx, y, z, cxc + 0.5, base + hh * 0.6, czc + 1.62, 0.25, 0.35, 0.04), ID.win);
    }
    // never step past a cell wall: the neighbouring cell may hold a nearer house
    const bx = Math.min(x - (-40 + 3.1 * cx), -40 + 3.1 * (cx + 1) - x), bz = Math.min((-z - 13) - 4.2 * cz, 4.2 * (cz + 1) - (-z - 13));
    const bound = Math.max(0.04, Math.min(bx, bz) + 0.04); if (bound < d) d = bound;
  }
  // the Brine: an upturned hull with a door cut in its side
  { const lb = Math.hypot(x + 6.5, z + 3.2) - 6.5; if (lb < 1) {
    const hull = Math.max(ell(x, y, z, -6.5, 0, -3.2, 4.8, 3.3, 2.2), -y);
    const door = box(x, y, z, -6.2, 0.95, -1.1, 0.55, 0.95, 0.8);
    T(Math.max(hull, -door), ID.hull); T(box(x, y, z, -6.2, 0.95, -1.35, 0.5, 0.92, 0.04), ID.brineDoor);
    for (const px of [-9, -7.7, -4.6, -3.4]) T(cyl(x, z, y, px, -1.15, 1.6, 0.26, 0.2), ID.porthole);
    T(cap(x, y, z, [-5.2, 2.6, -3.3], [-5.0, 4.4, -3.5], 0.18), ID.chimney);
    // the sign: a pickled fish hung from a bracket, too large
    T(cap(x, y, z, [-3.0, 3.2, -1.6], [-2.1, 3.2, -1.2], 0.05), ID.post);
    T(ell(x, y, z, -2.3, 2.45, -1.15, 0.85, 0.32, 0.16), ID.sign);
  } else T(lb, ID.hull); }
  // the weigh-house with the town balance on its roof
  { const lb = Math.hypot(x - 3.2, z + 4.2) - 5.5; if (lb < 1) {
    T(box(x, y, z, 3.2, 1.6, -4.4, 2.4, 1.6, 2.0), ID.weigh); T(gable(x, y, z, 3.2, 3.2, -4.4, 2.6, 2.2, 1.2), ID.roof);
    T(cyl(x, y, z, 3.2, 5.0, -4.4, 0.12, 0.9), ID.beam);
    T(cap(x, y, z, [0.6, 5.9, -4.4], [5.8, 6.1, -4.4], 0.11), ID.beam);
    for (const [px, py] of [[0.7, 4.7], [5.7, 5.0]]) { T(cap(x, y, z, [px, py + 1.2, -4.4], [px, py + 0.1, -4.4], 0.03), ID.post); T(Math.max(ell(x, y, z, px, py, -4.4, 0.75, 0.3, 0.75), -(py + 0.05 - y)), ID.beam); }
    T(box(x, y, z, 1.1, 1.5, -2.33, 0.3, 0.4, 0.1), ID.post); // the switch box
    T(box(x, y, z, 3.6, 1.0, -2.36, 0.6, 1.0, 0.05), ID.brineDoor);
  } else T(lb, ID.weigh); }
  // swan-neck sodium posts
  for (const [lx, ly, lz] of SODIUM) {
    const lb = Math.hypot(x - lx, z - lz - 0.6) - 1.6; if (lb > 0.5) { T(lb, ID.post); continue; }
    T(cyl(x, y, z, lx, (ly - 0.6) / 2, lz + 0.8, 0.08, (ly - 0.6) / 2), ID.post);
    T(cap(x, y, z, [lx, ly - 0.6, lz + 0.8], [lx, ly + 0.15, lz + 0.3], 0.07), ID.post);
    T(ell(x, y, z, lx, ly, lz, 0.38, 0.16, 0.24), ID.sodium);
  }
  // the mole and Mother at its end
  { const mo = box(x, y, z, 18.5, -1.4, -2.0, 2.6, 1.6, 1.5); T(mo, ID.mole); }
  { const lb = Math.hypot(x - MX, z - MZ) - 3.6; if (lb < 1) {
    const r = 1.45 - 0.06 * Math.max(0, y) + 0.55 * Math.exp(-((y - 6.3) ** 2) / 1.2) + 0.25 * Math.exp(-((y - 2) ** 2) / 3), tw = Math.max(Math.hypot(x - MX, z - MZ) - r, y - 9.4, -y - 0.4) * 0.8;
    T(tw, y > 6.9 && y < 7.6 ? ID.band : ID.tower);
    T(cyl(x, y, z, MX, 9.55, MZ, 1.6, 0.12), ID.band);
    T(ell(x, y, z, MX + 0.15, 11.2, MZ, 1.85, 1.75, 1.8) + 0.04 * vnoise(y * 9, (x + z) * 9), ID.lens); // the swollen lens, dark
    T(Math.max(ell(x, y, z, MX, 12.4, MZ, 1.15, 1.2, 1.15), 12.4 - y), ID.dome);
    T(cap(x, y, z, [MX, 13.5, MZ], [MX + 0.1, 14.3, MZ - 0.1], 0.05), ID.post);
    T(box(x, y, z, MX - 1.58, 0.9, MZ, 0.06, 0.9, 0.45), ID.brineDoor);
  } else T(lb, ID.tower); }
  // the stranded boat on the floor, heeled over
  { const lb = Math.hypot(x - 8, z - 6) - 5; if (lb < 1) {
    const ca = Math.cos(0.35), sa = Math.sin(0.35), by = mudY(8, 6), ry = (y - by - 0.4) * ca - (z - 6) * sa, rz = (y - by - 0.4) * sa + (z - 6) * ca;
    T(Math.max(ell(x, ry, rz, 8, 0, 0, 3.4, 1.1, 1.3), ry - 0.35), ID.boat);
    T(cap(x, ry, rz, [8.4, 0.3, 0], [8.4, 4.4, 0], 0.07), ID.mast);
  } else T(lb, ID.boat); }
  // the drowned lamp: an older tower, leaning and half sunk, a light low in its base
  { const lb = Math.hypot(x - DROWNED[0], z - DROWNED[2]) - 3; if (lb < 1) {
    const ca = Math.cos(-0.22), sa = Math.sin(-0.22), lx = x - DROWNED[0], ly = y - DROWNED[1];
    const rx = lx * ca - ly * sa, ry = lx * sa + ly * ca;
    T(Math.max(Math.hypot(rx, z - DROWNED[2]) - (1.3 - 0.05 * ry), ry - 3.6 - 0.5 * vnoise(rx * 3, z * 3), -ry - 1) * 0.85, ID.drowned);
    T(box(rx, ry, z, 0, 0.7, DROWNED[2] + 1.18, 0.35, 0.55, 0.2), ID.merrowLamp);
  } else T(lb, ID.drowned); }
  // what the sea gave back: a fish the size of a cart, on its side in the mud, gathered round
  { const fx = -7.6, fz = 7.6, fy = mudY(fx, fz); const lb = Math.hypot(x - fx, z - fz) - 5.4; if (lb < 0.6) {
    const ca = Math.cos(0.5), sa = Math.sin(0.5), lx = (x - fx) * ca - (z - fz) * sa, lz = (x - fx) * sa + (z - fz) * ca, ly = y - fy - 0.55;
    let b = ell(lx, ly, lz, 0, 0.25, 0, 3.8, 1.15, 1.6);
    b = Math.min(b, Math.max(Math.abs(lz) - 0.07, Math.abs(lx - 4.3) + Math.abs(ly - 0.25) * 0.8 - 1.3) * 0.8); // tail fan
    b = Math.min(b, Math.max(Math.abs(lz) - 0.05, Math.abs(lx + 0.3) * 1.2 + Math.abs(ly - 1.45) - 0.8) * 0.8); // dorsal
    T(b, ID.fish);
    T(sph(lx, ly, lz, -2.8, 0.4, 1.12, 0.3), ID.porthole); // the eye catches the lanterns
  } else T(lb, ID.fish); }
  // the colour test props: a crate with a bottle-glass prism, a red rag, a Municipal cap
  for (const [sx, sz] of SETS) {
    if (Math.hypot(x - sx, z - sz) > 1.2) { const b = Math.hypot(x - sx, z - sz) - 0.9; if (b < d) d = b; continue; }
    T(box(x, y, z, sx, 0.32, sz, 0.36, 0.32, 0.3), ID.crate);
    T(Math.max(Math.abs(x - sx + 0.2) + Math.abs(z - sz + 0.05) * 1.4 - 0.13, Math.abs(y - 0.78) - 0.14), ID.prismG);
    T(Math.min(ell(x, y, z, sx - 0.05, 0.66, sz + 0.18, 0.2, 0.03, 0.13), box(x, y, z, sx - 0.05, 0.45, sz + 0.31, 0.16, 0.2, 0.012)) + 0.01 * Math.sin(x * 40), ID.rag);
    T(Math.min(cyl(x, y, z, sx + 0.2, 0.74, sz - 0.12, 0.13, 0.08), cyl(x, y, z, sx + 0.2, 0.67, sz - 0.05, 0.17, 0.012)), ID.cap);
  }
  // people: the harbourmaster at the top of the steps; Low Night walkers with lanterns on the floor
  if (!PLATE) { const f = figure(x, y, z, KEEL, tmp); T(f, tmp.part === 1 ? ID.skin : tmp.part === 2 ? ID.hat : ID.keelCoat); }
  T(ell(x, y, z, -2.0, 0.0, -0.75, 0.9, 0.02, 0.7), ID.pool); // his puddle
  for (const w of WALKERS) {
    if (Math.hypot(x - w.pos[0], z - w.pos[2]) > 2.2) { T(Math.hypot(x - w.pos[0], z - w.pos[2]) - 1.8, ID.walker); continue; }
    const f = figure(x, y, z, { ...w, head: 0.22, stoop: 0.2 + 0.1 * Math.sin(w.a), girth: 0.3 }, tmp); T(f, tmp.part === 1 ? ID.skin : ID.walker);
    T(sph(x, y, z, w.lamp[0], w.lamp[1], w.lamp[2], 0.13), ID.lantern);
  }
  cur = id;
  return d;
}

export const materials = [
  { name: "lw oxblood", q: [0, 10, -6.0], peak: 0.55 }, { name: "lw mustard", q: [0, 13, -5.2], peak: 0.62 }, { name: "lw teal", q: [-50, 27.5, -2.58], peak: 0.5 },
  { name: "lw bone", q: [0, 2, -0.1], peak: 0.72 }, { name: "lw slate", q: [0, -6, 1.2], peak: 0.16 }, { name: "lw mud", q: [0, 3, -1.2], peak: 0.2 },
  { name: "lw weed", q: [-60, 45, -6.94], peak: 0.22 }, { name: "lw water", flat: 0.03 }, { name: "lw tar", flat: 0.035 }, { name: "lw hull", q: [0, -12, 3.6], peak: 0.42 },
  { name: "lw bottle", q: [-60, 45, -6.94], peak: 0.4 }, { name: "lw flesh", q: [0, 6, -2.2], peak: 0.55 }, { name: "lw oilskin", q: [0, 14, -4.6], peak: 0.72 },
  { name: "lw navy", q: [0, -12, 3.6], peak: 0.22 }, { name: "lw violet", q: [40, -36, 6.9], peak: 0.45 },
];
const S = (mat, scale = 1, wet = 0, emit = null) => ({ mat, scale, wet, emit });
export function surf(id, P, N) {
  const n = fbm(P[0] * 1.7, P[2] * 1.7 + P[1]);
  switch (id) {
    case ID.quay: return S("stone", 0.8 + 0.4 * n, sat(0.12 + 0.5 * sat((P[2] + 1.5) / 1.5)));
    case ID.wall: return S("stone", 0.6 + 0.3 * n);
    case ID.weed: return S("lw weed", 0.7 + 0.6 * n, 0.6);
    case ID.mud: return S("lw mud", 0.7 + 0.5 * n, 0.55 + 0.3 * n);
    case ID.pool: return S("lw water", 1, 1);
    case ID.steps: return S("stone", 0.7 + 0.3 * n, 0.6);
    case ID.houseA: return S("lw oxblood", 0.9 + 0.2 * n); case ID.houseB: return S("lw mustard", 0.9 + 0.2 * n);
    case ID.houseC: return S("lw teal", 0.9 + 0.2 * n); case ID.houseD: return S("lw bone", 0.85 + 0.2 * n);
    case ID.roof: return S("lw slate", 1 + 0.4 * n, 0.2); case ID.chimney: return S("brick", 0.8);
    case ID.win: return S("lw bone", 0, 0, { type: "window", I: 2.2 + 1.5 * vnoise(P[0] * 3, P[1] * 3) });
    case ID.winDark: return S("glass", 1, 0.5);
    case ID.hull: return S("lw tar", 1 + n, 0.1); case ID.porthole: return S("lw bone", 0, 0, { type: "window", I: 3.2 });
    case ID.brineDoor: return S("lw oxblood", 0.6);
    case ID.weigh: return S("brick", 0.9 + 0.3 * n); case ID.beam: return S("metal", 1.2);
    case ID.post: return S("lw tar", 1.5); case ID.sodium: return S("grey", 0, 0, { type: "sodium", I: 120 });
    case ID.mole: return S("stone", 0.7 + 0.4 * n, 0.45);
    case ID.tower: return S("lw bone", 0.55 + 0.25 * n, 0.2); case ID.band: return S("lw oxblood", 1.0);
    case ID.lens: return S("lw bottle", 0.9, 0.9); case ID.dome: return S("lw teal", 0.8);
    case ID.boat: return S("lw hull", 0.9 + 0.3 * n, 0.3); case ID.mast: return S("lw tar", 1.4);
    case ID.keelCoat: return S("lw navy", 1.1, 0.95); case ID.skin: return S("lw flesh", 1, 0.3); case ID.hat: return S("lw tar", 1.2, 0.9);
    case ID.walker: return S("lw oilskin", 0.9 + 0.2 * n, 0.4); case ID.lantern: return S("lw bone", 0, 0, { type: "window", I: 16 });
    case ID.drowned: return S("stone", 0.5 + 0.3 * n, 0.7); case ID.merrowLamp: return S("lw bone", 0, 0, { type: "window", I: 6 });
    case ID.sign: return S("lw mustard", 1.2);
    case ID.fish: return S("grey", 0.45 + 0.3 * n, 0.85);
    case ID.crate: return S("lw mustard", 0.55 + 0.2 * n); case ID.prismG: return S("lw bottle", 1.8, 0.6); case ID.rag: return S("red paint", 1.1); case ID.cap: return S("blue van", 1.1);
    default: return S("grey", 1);
  }
}
export function lights(time = 0) {
  // time >= 100: the daylight export a painter paints over (sun and sky only; grade adds the night)
  if (time >= 100) return [{ pos: [160, 140, 60], type: 3, I: 120000, cone: [0, 0, 0], mode: 0, reach: 400 }, { pos: [-120, 90, 140], type: 3, I: 22000, cone: [0, 0, 0], mode: 0, reach: 400 }];
  const L = SODIUM.map((p) => ({ pos: [p[0], p[1] - 0.25, p[2]], type: 0, I: 85, cone: [0, 0, 0], mode: 0, reach: 30 }));
  for (const w of WALKERS.slice(0, 4)) L.push({ pos: w.lamp, type: 1, I: 4, cone: [0, 0, 0], mode: 0, reach: 9 });
  L.push({ pos: [-6.2, 1.3, -0.75], type: 1, I: 30, cone: [0, 0, 1], mode: 2, reach: 12 }); // the Brine's door
  L.push({ pos: [DROWNED[0] + 0.6, DROWNED[1] + 0.8, DROWNED[2] + 1.6], type: 1, I: 2.5, cone: [0, 0, 0], mode: 0, reach: 8 });
  L.push({ pos: [70, 60, -90], type: 2, I: 9000, cone: [0, 0, 0], mode: 0, reach: 400 }); // the moon behind cloud, cold, for edges
  return L;
}
export const sky = (d) => 0.012 + 0.03 * Math.max(0, 1 - Math.abs(d[1]) * 3);
export const ripple = (P) => [0.04 * (vnoise(P[0] * 2.3, P[2] * 2.3) - 0.5), 0.04 * (vnoise(P[0] * 2.3 + 9, P[2] * 2.3) - 0.5)];
// Painter ids: give each surface kind its own region so strokes stop at silhouettes.
export const paintId = (id) => id;
export default { map, idOf, materials, surf, lights, sky, ripple, paintId };

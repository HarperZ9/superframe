// Chancel Hill: the Congregation of the Filament at prayer inside a disused gasholder frame. The Old
// Bulb (Mother's lamp, retired twelve years ago) hangs over the altar, its filament broken; the
// faithful kneel with glass bell jars over their heads; candles in jars; the hill's white street
// lamps outside. For the spectral pass with paint-over and the lens suite.
import { box, cyl, sph, ell, cap, tcap, figure, vnoise, fbm, sat } from "../sdf.mjs";

export const ID = { ground: 1, path: 2, column: 3, girder: 4, floor: 5, altar: 6, bulb: 7, neck: 8, base: 9, filament: 10, coat: 11, skin: 12, jar: 13, candle: 14, flame: 15, post: 16, lampW: 17, house: 18, roof: 19, win: 20, chain: 21, deacon: 22 };
let cur = 0; export const idOf = () => cur;
const R = 7.5, B = [0, 6.2, 0];
const FAITH = Array.from({ length: 9 }, (_, k) => { const a = -0.3 + (k / 8) * Math.PI * 1.3 + 0.9, r = 3.3 + 0.5 * (k % 2); return { pos: [Math.cos(a) * r, 0.25, Math.sin(a) * r], a: Math.atan2(Math.sin(a), -Math.cos(a)), h: 1.25, head: 0.2, stoop: 0.5, girth: 0.33, neck: 0.25 }; });
const DEACON = { pos: [-0.2, 1.05, -1.6], a: -Math.PI / 2, h: 2.4, head: 0.22, stoop: 0.1, girth: 0.3, neck: 0.55, arms: 0.6 };
const CANDLES = Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2 + 0.2; return [Math.cos(a) * 1.9, 1.15, Math.sin(a) * 1.9 - 0.2]; });
const tmp = { d: 0, part: 0 };

export function map(x, y, z) {
  let d = Infinity, id = 0;
  const T = (t, i) => { if (t < d) { d = t; id = i; } };
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  T(y - 0.08 * fbm(x * 0.2, z * 0.2) + 0.03 * Math.max(0, r - 10), r > 8 ? ID.ground : ID.floor);
  T(Math.max(Math.abs(x - 6 - 0.3 * Math.sin(z * 0.3)) - 1.0, y - 0.03, -y - 0.5, z - 30), ID.path);
  // the gasholder frame: columns and lattice rings
  if (r > R - 1 && r < R + 1 && y < 13) {
    const seg = (2 * Math.PI) / 12, aa = ((a % seg) + seg) % seg - seg / 2;
    T(Math.max(Math.abs(aa * r) - 0.16, Math.abs(r - R) - 0.16, y - 12.5), ID.column);
    for (const yy of [4.2, 8.4, 12.4]) T(Math.max(Math.abs(r - R) - 0.12, Math.abs(y - yy) - 0.18), ID.girder);
    // diagonal braces between columns
    const u = aa * r, br = Math.min(Math.abs(u - (y % 4.2) * 0.9 + 1.9), Math.abs(u + (y % 4.2) * 0.9 - 1.9)) - 0.04;
    T(Math.max(br, Math.abs(r - R) - 0.07, y - 12.4), ID.girder);
  } else if (r > R + 1) { const bnd = r - R - 1; if (bnd < d && y < 13) d = Math.max(bnd, 0.02); }
  // the altar and the Old Bulb hung from chains
  T(box(x, y, z, 0, 0.5, -0.3, 1.4, 0.5, 0.9), ID.altar);
  { const lb = Math.hypot(x - B[0], y - B[1], z - B[2]) - 3.4; if (lb < 0.5) {
    const bulb = Math.min(sph(x, y, z, B[0], B[1], B[2], 2.0), tcap(x, y, z, [B[0], B[1] + 1.4, B[2]], [B[0], B[1] + 2.6, B[2]], 1.25, 0.75));
    T(Math.max(bulb, -(sph(x, y, z, B[0], B[1], B[2], 1.94))), ID.bulb); // a shell: the broken filament shows through
    T(cyl(x, y, z, B[0], B[1] + 3.0, B[2], 0.78, 0.45) + 0.03 * Math.sin(y * 30), ID.base);
    T(Math.max(cap(x, y, z, [B[0] - 0.5, B[1] - 0.2, B[2]], [B[0] - 0.1, B[1] + 1.3, B[2]], 0.03), 0), ID.filament);
    T(cap(x, y, z, [B[0] + 0.5, B[1] - 0.5, B[2]], [B[0] + 0.15, B[1] + 1.3, B[2]], 0.03), ID.filament);
    T(cap(x, y, z, [B[0] - 0.5, B[1] - 0.2, B[2]], [B[0] - 0.05, B[1] - 0.35, B[2] + 0.1], 0.03), ID.filament);
    // a crack across the glass
    const ck = Math.abs(y - B[1] - 0.6 * Math.sin(a * 3)) - 0.015; if (ck < 0.05 && Math.abs(Math.hypot(x - B[0], y - B[1], z - B[2]) - 2.0) < 0.06) T(-0.0005 + 0.0 * ck, ID.filament);
  } else if (lb < d) d = lb; }
  for (const s of [-1, 1]) T(cap(x, y, z, [B[0] + s * 0.5, B[1] + 3.4, B[2]], [s * 5.5, 12.4, 0], 0.035), ID.chain);
  // candles in a ring on the altar step
  for (const [cx, cy, cz] of CANDLES) { if (Math.hypot(x - cx, z - cz) > 0.5) continue; T(cyl(x, y, z, cx, cy - 0.35, cz, 0.07, 0.3), ID.candle); T(ell(x, y, z, cx, cy + 0.02, cz, 0.04, 0.09, 0.04), ID.flame); }
  // the faithful, bell jars over their heads; the deacon on the altar step
  for (const f of FAITH) {
    if (Math.hypot(x - f.pos[0], z - f.pos[2]) > 1.6) { T(Math.hypot(x - f.pos[0], z - f.pos[2]) - 1.2, ID.coat); continue; }
    const q = figure(x, y, z, f, tmp); if (q < d) { d = q; id = tmp.part === 1 ? ID.skin : ID.coat; }
    const ca = Math.cos(f.a), sa = Math.sin(f.a), hd = f.stoop * 0.5 + f.neck * 0.6 + f.head * 0.4, hx = f.pos[0] + hd * ca, hz = f.pos[2] - hd * sa, hy = f.pos[1] + f.h * 0.78 + f.neck + f.head * 0.7;
    T(Math.max(Math.abs(Math.hypot(x - hx, y - hy + 0.05, z - hz) - 0.42) - 0.02, hy - 0.3 - y), ID.jar);
  }
  { const q = figure(x, y, z, DEACON, tmp); if (q < d) { d = q; id = tmp.part === 1 ? ID.skin : ID.deacon; } }
  // the hill: white street lamps and a few houses up the slope
  for (const [lx, lz] of [[8.2, 6], [8.6, 14], [9.2, 22]]) {
    if (Math.hypot(x - lx, z - lz) > 1.2) continue;
    T(cyl(x, y, z, lx, 2.2, lz, 0.08, 2.2), ID.post); T(cap(x, y, z, [lx, 4.4, lz], [lx - 0.8, 4.6, lz], 0.06), ID.post); T(ell(x, y, z, lx - 0.85, 4.45, lz, 0.3, 0.13, 0.2), ID.lampW);
  }
  for (const [hx, hz, hh] of [[4, -14, 7], [-6, -13, 8.5], [12, -9, 6], [-14, -2, 7.5], [-12, 8, 6]]) {
    if (Math.hypot(x - hx, z - hz) > 4.5) { const b = Math.hypot(x - hx, z - hz) - 4; if (b < d) d = b; continue; }
    T(box(x, y, z, hx, hh / 2, hz, 2, hh / 2, 2.4), ID.house); T(Math.max(box(x, y, z, hx, hh + 1, hz, 2.2, 1, 2.6), Math.abs(z - hz) * 0.9 + (y - hh) * 1.2 - 2.4), ID.roof);
    T(box(x, y, z, hx - 2.02, hh * 0.55, hz + 0.6, 0.04, 0.4, 0.3), ID.win);
  }
  cur = id; return d;
}
export const materials = [{ name: "lw slate", q: [0, -6, 1.2], peak: 0.16 }, { name: "lw prism", flat: 0.85 }, { name: "lw brass", q: [0, 10, -4.4], peak: 0.7 }, { name: "lw navy", q: [0, -12, 3.6], peak: 0.22 }, { name: "lw flesh", q: [0, 6, -2.2], peak: 0.55 }, { name: "lw bone", q: [0, 2, -0.1], peak: 0.72 }, { name: "lw oxblood", q: [0, 10, -6.0], peak: 0.55 }, { name: "lw tar", flat: 0.035 }, { name: "lw teal", q: [-50, 27.5, -2.58], peak: 0.5 }, { name: "lw violet", q: [40, -36, 6.9], peak: 0.45 }];
const S = (mat, scale = 1, wet = 0, emit = null) => ({ mat, scale, wet, emit });
export function surf(id, P) {
  const n = fbm(P[0] * 1.5 + P[1], P[2] * 1.5);
  switch (id) {
    case ID.ground: return S("lw slate", 1.6 + n, 0.3); case ID.floor: return S("stone", 0.7 + 0.4 * n, 0.25); case ID.path: return S("stone", 0.8 + 0.3 * n, 0.5);
    case ID.column: case ID.girder: case ID.chain: return S("lw teal", 0.8 + 0.3 * n);
    case ID.altar: return S("lw bone", 0.8); case ID.bulb: return S("lw prism", 1.3, 0.9); case ID.base: return S("lw brass", 1.1, 0.4);
    case ID.filament: return S("lw tar", 3); case ID.candle: return S("lw bone", 1);
    case ID.flame: return S("grey", 0, 0, { type: "window", I: 22 });
    case ID.coat: return S("lw violet", 0.8 + 0.3 * n); case ID.deacon: return S("lw bone", 0.9); case ID.skin: return S("lw flesh", 1);
    case ID.jar: return S("lw prism", 0.6, 0.9);
    case ID.post: return S("lw tar", 2); case ID.lampW: return S("grey", 0, 0, { type: "led", I: 90 });
    case ID.house: return S("lw oxblood", 0.8 + 0.3 * n); case ID.roof: return S("lw slate", 1.2); case ID.win: return S("grey", 0, 0, { type: "window", I: 3 });
    default: return S("grey", 1);
  }
}
export function lights() {
  const L = [0, 2, 4, 6, 8].map((k) => ({ pos: [CANDLES[k][0], CANDLES[k][1] + 0.15, CANDLES[k][2]], type: 1, I: 1.4, cone: [0, 0, 0], mode: 0, reach: 10 }));
  L.push({ pos: [0, 4.0, 0], type: 1, I: 6, cone: [0, 0, 0], mode: 0, reach: 14 }); // candle glow gathered under the bulb
  L.push({ pos: [3.2, 6.6, 3.0], type: 1, I: 7, cone: [0, 0, 0], mode: 0, reach: 9 }); // the candles' light caught on the near face of the glass
  for (const [lx, lz] of [[8.2, 6], [8.6, 14]]) L.push({ pos: [lx - 0.85, 4.3, lz], type: 2, I: 40, cone: [0, 0, 0], mode: 0, reach: 22 });
  L.push({ pos: [-40, 50, -50], type: 3, I: 4000, cone: [0, 0, 0], mode: 0, reach: 120 });
  return L;
}
export const sky = (d) => 0.015 + 0.04 * Math.max(0, d[1]);
export const ripple = (P) => [0.05 * (vnoise(P[0] * 3, P[2] * 3) - 0.5), 0.05 * (vnoise(P[0] * 3 + 5, P[2] * 3) - 0.5)];
export default { map, idOf, materials, surf, lights, sky, ripple };

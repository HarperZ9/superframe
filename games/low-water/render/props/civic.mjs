// Civic and office props, general so later eras can reuse them. Every prop is prop(name, bb, f) from prim.mjs; x, z are floor
// positions in metres, y is up, a is a yaw in radians about the prop's own centre. Surface kinds come from kinds.mjs.
//   counter(x, z, {len=3, depth=0.55, h=1.02, name})          a long panelled counter facing +z: top, front panels, brass foot rail
//   pigeonholes(x, y, z, {w=2, h=1.4, cols=7, rows=5, seed})  wall shelving on a -z wall, papers stuffed in most cells; (x, y) is the bottom centre
//   chair(x, z, {a=0, seat=0.46, name})                       a ladder-back chair
//   longTable(x, z, hx, hz, {h=0.76, name})                   a board table on turned legs with an apron
//   stove(x, z, {r=0.22, h=0.85, name})                       a cold iron stove with a stack to the ceiling
//   fireplace(x, z, {H, lit=true})                            a stone breast on the -x wall with a hearth, logs and a flame (an emitter)
//   decanter(x, y, z), glass(x, y, z)                          blown glass on a surface at height y
//   paperStack(x, y, z, {n=6, a=0, id})                       sheets, each a little askew
//   noticeBoard(x, y, z, {w=1, h=0.7, face="z", lines=6, seed}) a slate board with chalked lines, wall at -z (face "z") or -x ("x")
//   rug(x, z, hx, hz, {a=0})                                  a rug with a border
//   casement(x, y, z, {w=0.8, h=0.9, face="x", open=0.9})     a window frame with a leaf swung open; face is the wall it sits in
//   wallClock(x, y, z, {face="z"})                            a round clock
//   coatRack(x, z)                                            a pole with hooks and two coats
//   queueRail(pts, {h=0.95})                                  posts at each point and a sagging rope between them
//   priceBoard(x, y, z, {w, h, seed})                         a tall chalk board on legs, the prices in columns
import { prop, bbc, bbr, rot, box, cyl, cap, ell, slab, lathe, chain, n3, fb3, hash, sstep, ID, sat } from "./prim.mjs";

export function counter(x, z, { len = 3, depth = 0.55, h = 1.02, name = "service_counter" } = {}) {
  return prop(name, bbc(x, h / 2, z, len / 2 + 0.1, h / 2 + 0.1, depth / 2 + 0.1), (px, py, pz, T) => {
    const dx = px - x, fu = (dx / 0.62) - Math.floor(dx / 0.62), pan = 0.012 * (1 - sstep(0.04, 0.1, Math.min(fu, 1 - fu)));
    T(slab(px, py, pz, [x, h - 0.025, z], [len / 2 + 0.03, 0.025, depth / 2 + 0.04], 0.008) - (n3(px * 8, py, pz * 8) - 0.5) * 0.003, ID.oakx);
    T(slab(px, py, pz, [x, (h - 0.05) / 2, z + depth / 2 - 0.03], [len / 2, (h - 0.05) / 2, 0.025], 0.005) + pan, ID.oakx);
    T(slab(px, py, pz, [x, (h - 0.05) / 2, z - depth / 2 + 0.03], [len / 2, (h - 0.05) / 2, 0.02], 0.005), ID.oakx);
    for (const s of [-1, 1]) T(slab(px, py, pz, [x + s * len / 2, (h - 0.05) / 2, z], [0.025, (h - 0.05) / 2, depth / 2], 0.005), ID.oakz);
    T(cap(px, py, pz, [x - len / 2 + 0.05, 0.15, z + depth / 2 + 0.07], [x + len / 2 - 0.05, 0.15, z + depth / 2 + 0.07], 0.016), ID.brass);
    T(slab(px, py, pz, [x, h * 0.62, z + 0.02], [len / 2 - 0.05, 0.012, depth / 2 - 0.06], 0.004), ID.oakx);
  });
}
export function pigeonholes(x, y, z, { w = 2, h = 1.4, cols = 7, rows = 5, seed = 1, name = "pigeonholes" } = {}) {
  const cw = w / cols, ch = h / rows, dp = 0.3;
  return prop(name, [x - w / 2 - 0.05, y - 0.05, z - 0.02, x + w / 2 + 0.05, y + h + 0.05, z + dp + 0.05], (px, py, pz, T) => {
    const c = Math.min(cols - 1, Math.max(0, Math.floor((px - (x - w / 2)) / cw))), r = Math.min(rows - 1, Math.max(0, Math.floor((py - y) / ch)));
    const cx = x - w / 2 + (c + 0.5) * cw, cy = y + (r + 0.5) * ch, outer = box(px, py, pz, x, y + h / 2, z + dp / 2, w / 2, h / 2, dp / 2);
    T(Math.max(outer, -box(px, py, pz, cx, cy, z + dp / 2 + 0.012, cw / 2 - 0.011, ch / 2 - 0.011, dp / 2)) * 0.9, ID.oakx);
    if (hash(c, r, seed) < 0.72) { const fill = 0.35 + 0.5 * hash(c, r, seed + 4); T(box(px, py, pz, cx, y + r * ch + 0.011 + (ch * fill) / 2, z + dp / 2 + 0.03, cw / 2 - 0.02, (ch * fill) / 2, dp / 2 - 0.05) - (n3(px * 40, py * 40, pz * 40) - 0.5) * 0.006, ID.paper); }
  });
}
export function chair(x, z, { a = 0, seat = 0.46, name = "ladderback_chair" } = {}) {
  return prop(name, bbr(x, 0, z, 0.27, 1.0, 0.27), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a);
    T(slab(lx, py, lz, [x, seat, z], [0.21, 0.02, 0.2], 0.008), ID.oakx);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) T(cap(lx, py, lz, [x + sx * 0.18, seat, z + sz * 0.17], [x + sx * 0.2, 0, z + sz * 0.19], 0.017), ID.oaky);
    for (const sx of [-1, 1]) T(cap(lx, py, lz, [x + sx * 0.18, seat, z - 0.18], [x + sx * 0.17, seat + 0.5, z - 0.2], 0.016), ID.oaky);
    for (let k = 0; k < 3; k++) T(slab(lx, py, lz, [x, seat + 0.2 + k * 0.12, z - 0.19], [0.17, 0.025, 0.012], 0.004), ID.oakx);
  });
}
export function longTable(x, z, hx, hz, { h = 0.76, name = "board_table" } = {}) {
  return prop(name, bbc(x, h / 2, z, hx + 0.05, h / 2 + 0.03, hz + 0.05), (px, py, pz, T) => {
    T(slab(px, py, pz, [x, h - 0.03, z], [hx, 0.03, hz], 0.01) - (fb3(px * 5, py * 5, pz * 5) - 0.5) * 0.004, ID.oakx);
    T(slab(px, py, pz, [x, h - 0.09, z], [hx - 0.12, 0.05, hz - 0.1], 0.006), ID.oakz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) T(lathe(px, py, pz, x + sx * (hx - 0.18), 0, z + sz * (hz - 0.15), h - 0.06, (t) => 0.04 + 0.02 * Math.sin(t * 18) * (t > 0.2 && t < 0.8 ? 1 : 0.3) + (t > 0.9 ? 0.02 : 0)), ID.oaky);
  });
}
export function stove(x, z, { r = 0.22, h = 0.85, name = "iron_stove" } = {}) {
  return prop(name, [x - r - 0.1, 0, z - r - 0.1, x + r + 0.1, 3.0, z + r + 0.1], (px, py, pz, T) => {
    T(lathe(px, py, pz, x, 0.12, z, 0.12 + h, (t) => r * (1 + 0.1 * Math.sin(t * 3.1))), ID.iron); T(cap(px, py, pz, [x, 0.12 + h, z], [x, 2.9, z], 0.04), ID.iron);
    for (const s of [-1, 1]) T(cap(px, py, pz, [x + s * 0.16, 0.12, z + 0.1], [x + s * 0.17, 0, z + 0.12], 0.025), ID.iron); T(box(px, py, pz, x + r - 0.01, 0.5, z, 0.012, 0.12, 0.09), ID.brass);
  });
}
export function fireplace(x, z, { H = 2.8, lit = true, name = "stone_fireplace" } = {}) {
  return prop(name, [x - 0.1, 0, z - 0.95, x + 0.75, H, z + 0.95], (px, py, pz, T) => {
    const breast = Math.max(box(px, py, pz, x + 0.3, H / 2, z, 0.3, H / 2, 0.8), -box(px, py, pz, x + 0.52, 0.46, z, 0.26, 0.46, 0.5)) - (fb3(px * 6, py * 6, pz * 6) - 0.5) * 0.02;
    T(breast, ID.wall); T(slab(px, py, pz, [x + 0.45, 1.08, z], [0.42, 0.04, 0.9], 0.01), ID.oakx); T(slab(px, py, pz, [x + 0.45, 0.02, z], [0.5, 0.02, 0.85], 0.006), ID.slab);
    for (let k = 0; k < 3; k++) T(cap(px, py, pz, [x + 0.4, 0.09 + 0.07 * (k % 2), z - 0.3 + k * 0.3], [x + 0.62, 0.1, z - 0.25 + k * 0.3], 0.05), ID.timber);
    if (lit) { T(ell(px, py, pz, x + 0.5, 0.2, z, 0.04, 0.06, 0.1), ID.candle); T(ell(px, py, pz, x + 0.5, 0.26, z - 0.15, 0.03, 0.06, 0.04), ID.candle); }
  });
}
export const decanter = (x, y, z) => prop("decanter", bbc(x, y + 0.14, z, 0.06, 0.16, 0.06), (px, py, pz, T) => { T(lathe(px, py, pz, x, y, z, y + 0.25, (t) => (t < 0.55 ? 0.07 - 0.015 * t : 0.025 + 0.012 * (1 - t)) + (t > 0.97 ? 0.006 : 0)) * 0.9, ID.glass); T(ell(px, py, pz, x, y + 0.27, z, 0.022, 0.025, 0.022), ID.glass); });
export const glass = (x, y, z) => prop("wine_glass", bbc(x, y + 0.06, z, 0.04, 0.07, 0.04), (px, py, pz, T) => { T(Math.max(lathe(px, py, pz, x, y, z, y + 0.11, (t) => (t < 0.35 ? 0.004 + 0.002 * t : 0.03 + 0.012 * t)), -(py > y + 0.05 ? cyl(px, py, pz, x, y + 0.12, z, 0.026, 0.065) : 1)), ID.glass); T(cyl(px, py, pz, x, y + 0.003, z, 0.025, 0.003), ID.glass); });
export function paperStack(x, y, z, { n = 6, a = 0, id = ID.paper, name = "paper_stack" } = {}) {
  return prop(name, bbr(x, y, z, 0.2, y + n * 0.004 + 0.05, 0.2), (px, py, pz, T) => { for (let k = 0; k < n; k++) { const [lx, lz] = rot(px, pz, x, z, a + (hash(k, 3, 1) - 0.5) * 0.25); T(box(lx, py, lz, x + (hash(k, 5, 1) - 0.5) * 0.03, y + 0.002 + k * 0.004, z + (hash(k, 7, 1) - 0.5) * 0.03, 0.105, 0.002, 0.148), id); } });
}
export function noticeBoard(x, y, z, { w = 1, h = 0.7, face = "z", lines = 6, seed = 1, name = "notice_board" } = {}) {
  return prop(name, bbc(x, y, z, face === "z" ? w / 2 + 0.1 : 0.12, h / 2 + 0.1, face === "z" ? 0.12 : w / 2 + 0.1), (px, py, pz, T) => {
    const u = face === "z" ? px - x : pz - z, d = face === "z" ? pz - z : px - x;
    T(box(u, py, d, 0, y, 0.02, w / 2, h / 2, 0.016), ID.slate);
    T(Math.max(box(u, py, d, 0, y, 0.03, w / 2 + 0.03, h / 2 + 0.03, 0.02), -box(u, py, d, 0, y, 0.03, w / 2, h / 2, 0.03)), ID.oakx);
    for (let k = 0; k < lines; k++) { const ly = y + h / 2 - 0.08 - k * (h - 0.14) / lines, ln = (0.3 + 0.6 * hash(k, seed, 2)) * w, sx = -w / 2 + 0.05 + (k % 2 ? 0.06 : 0); T(box(u, py, d, sx + ln / 2, ly, 0.038, ln / 2, 0.006 + 0.004 * (k === 0), 0.003), ID.chalk); }
  });
}
export function rug(x, z, hx, hz, { a = 0, name = "woven_rug" } = {}) {
  return prop(name, bbr(x, 0, z, hx, 0.04, hz), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), fl = Math.max(Math.abs(py - 0.008) - 0.008, Math.abs(lx - x) - hx, Math.abs(lz - z) - hz) - 0.0, inner = Math.max(Math.abs(lx - x) - hx + 0.14, Math.abs(lz - z) - hz + 0.14);
    T(Math.max(fl, -inner), ID.clay); T(Math.max(fl, inner), ID.navy);
  });
}
export function casement(x, y, z, { w = 0.8, h = 0.9, face = "x", open = 0.9, name = "casement_window" } = {}) {
  return prop(name, bbc(x, y, z, face === "x" ? 0.45 : w / 2 + 0.4, h / 2 + 0.1, face === "x" ? w / 2 + 0.4 : 0.45), (px, py, pz, T) => {
    const u = face === "x" ? pz - z : px - x, d = face === "x" ? px - x : pz - z;
    T(Math.max(box(u, py, d, 0, y, 0, w / 2 + 0.06, h / 2 + 0.06, 0.07), -box(u, py, d, 0, y, 0, w / 2, h / 2, 0.1)), ID.oakx);
    T(box(u, py, d, 0, y, 0, 0.014, h / 2, 0.02), ID.oaky); T(box(u, py, d, 0, y, 0, w / 2, 0.014, 0.02), ID.oakx);
    const c = Math.cos(open), s = Math.sin(open), lu = (u - w / 2) * c + d * s, ld = -(u - w / 2) * s + d * c;
    T(Math.max(box(lu, py, ld, -w / 4, y, 0, w / 4, h / 2 - 0.02, 0.015), -box(lu, py, ld, -w / 4, y, 0, w / 4 - 0.03, h / 2 - 0.05, 0.03)), ID.oakx);
    T(box(u, py, d, 0, y - h / 2 - 0.055, 0.0, w / 2 + 0.1, 0.02, 0.12), ID.oakz);
  });
}
export function wallClock(x, y, z, { face = "z", name = "wall_clock" } = {}) {
  return prop(name, bbc(x, y, z, 0.25, 0.25, 0.25), (px, py, pz, T) => {
    const u = face === "z" ? px - x : pz - z, d = face === "z" ? pz - z : px - x;
    T(cyl(u, d, py, 0, 0.03, y, 0.22, 0.03), ID.oakx); T(cyl(u, d, py, 0, 0.065, y, 0.18, 0.012), ID.bone);
    T(cap(u, py, d, [0, y, 0.08], [0.04, y + 0.12, 0.08], 0.006), ID.iron); T(cap(u, py, d, [0, y, 0.08], [-0.07, y + 0.02, 0.08], 0.006), ID.iron);
  });
}
export function coatRack(x, z, { name = "coat_rack" } = {}) {
  return prop(name, bbc(x, 0.95, z, 0.35, 0.95, 0.3), (px, py, pz, T) => {
    T(cap(px, py, pz, [x, 0.02, z], [x, 1.75, z], 0.025), ID.oaky); T(cyl(px, py, pz, x, 0.03, z, 0.18, 0.03), ID.oakx);
    for (let k = 0; k < 4; k++) { const t = k * 1.57 + 0.4; T(cap(px, py, pz, [x, 1.62, z], [x + Math.cos(t) * 0.12, 1.7, z + Math.sin(t) * 0.12], 0.008), ID.brass); }
    for (const [s, id] of [[1, ID.navy], [-1, ID.oilskin]]) T(Math.max(ell(px, py, pz, x + s * 0.12, 1.2, z + 0.02, 0.1, 0.4, 0.08), 0) * 0.9, id);
  });
}
export function queueRail(pts, { h = 0.95, name = "queue_rail" } = {}) {
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return prop(name, [Math.min(...xs) - 0.2, 0, Math.min(...zs) - 0.2, Math.max(...xs) + 0.2, h + 0.1, Math.max(...zs) + 0.2], (px, py, pz, T) => {
    for (const [x, z] of pts) { T(lathe(px, py, pz, x, 0, z, h, (t) => 0.025 + 0.01 * Math.sin(t * 6)), ID.brass); T(cyl(px, py, pz, x, 0.01, z, 0.1, 0.01), ID.iron); T(ell(px, py, pz, x, h + 0.02, z, 0.032, 0.03, 0.032), ID.brass); }
    for (let i = 0; i + 1 < pts.length; i++) { const a = [pts[i][0], h - 0.04, pts[i][1]], b = [pts[i + 1][0], h - 0.04, pts[i + 1][1]], m = [(a[0] + b[0]) / 2, h - 0.17, (a[2] + b[2]) / 2]; T(chain(px, py, pz, [a, m, b], 0.014), ID.red); }
  });
}
export function priceBoard(x, y, z, { w = 1.6, h = 1.1, seed = 1, name = "price_board" } = {}) {
  return prop(name, bbc(x, y + h / 2, z, w / 2 + 0.1, h / 2 + 0.1, 0.2), (px, py, pz, T) => {
    T(box(px, py, pz, x, y + h / 2, z, w / 2, h / 2, 0.02), ID.slate); T(Math.max(box(px, py, pz, x, y + h / 2, z, w / 2 + 0.04, h / 2 + 0.04, 0.035), -box(px, py, pz, x, y + h / 2, z, w / 2, h / 2, 0.05)), ID.oakx);
    for (const s of [-1, 1]) T(cap(px, py, pz, [x + s * (w / 2 - 0.05), y, z - 0.02], [x + s * (w / 2 + 0.1), 0, z - 0.2], 0.03), ID.oaky);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 6; r++) T(box(px, py, pz, x - w / 2 + 0.2 + c * (w / 3.1) + 0.12 * hash(r, c, seed), y + h - 0.12 - r * (h - 0.2) / 6, z + 0.025, 0.1 + 0.05 * hash(c, r, seed + 1), 0.006, 0.003), ID.chalk);
  });
}
void sat;

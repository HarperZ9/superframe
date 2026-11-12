// Set dressing for Low Water places: each builder returns a prop { bb, f(x, y, z, T) } for
// kit/world.mjs, with surface kinds from kit/ids.mjs. Block-out shapes only; the painter carries
// the detail (look bible section 7). Original code (Low Water look work, 2026-10-17).
import { box, rbox, cyl, sph, ell, cap, tcap, gable, smin, vnoise, fbm } from "../sdf.mjs";
import { ID } from "./ids.mjs";
import { rnd } from "./world.mjs";

const bbOf = (cx, cy, cz, hx, hy, hz) => [cx - hx, cy - hy, cz - hz, cx + hx, cy + hy, cz + hz];
// rotate (x, z) about (cx, cz) by angle a (radians, about +y)
const rot = (x, z, cx, cz, a) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dz = z - cz; return [cx + dx * c + dz * s, cz - dx * s + dz * c]; };
const R = (a) => Math.hypot(a, a); // half-diagonal growth for rotated boxes
export { rot };

// A free shape: f(x, y, z, T) with an explicit bounding box.
export const shape = (bb, f) => ({ bb, f });

export function crate(x, y, z, s = 0.36, a = 0, id = ID.crate) {
  return { bb: bbOf(x, y + s * 0.9, z, R(s), s, R(s)), f: (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); T(rbox(lx, py, lz, x, y + s * 0.88, z, s, s * 0.88, s * 0.85, 0.02), id); T(box(lx, py, lz, x, y + s * 0.88, z, s + 0.012, 0.035, s * 0.85 + 0.012), ID.timber); } };
}
export function barrel(x, y, z, r = 0.32, h = 0.9, lying = false, a = 0) {
  if (!lying) return { bb: bbOf(x, y + h / 2, z, r + 0.05, h / 2, r + 0.05), f: (px, py, pz, T) => { const bulge = r * (1 + 0.12 * (1 - ((py - y - h / 2) / (h / 2)) ** 2)); T(cyl(px, py, pz, x, y + h / 2, z, bulge, h / 2) * 0.9, ID.barrel); for (const k of [0.18, 0.82]) T(cyl(px, py, pz, x, y + h * k, z, bulge + 0.012, 0.025), ID.iron); } };
  return { bb: bbOf(x, y + r, z, h / 2 + r, r + 0.05, h / 2 + r), f: (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); T(cyl(lx, lz, py, x, z, y + r, r, h / 2) * 0.9, ID.barrel); } };
}
export function bollard(x, y, z, r = 0.2, h = 0.6) {
  return { bb: bbOf(x, y + h / 2 + 0.1, z, r + 0.1, h / 2 + 0.12, r + 0.1), f: (px, py, pz, T) => { T(smin(cyl(px, py, pz, x, y + h / 2, z, r, h / 2), sph(px, py, pz, x, y + h, z, r * 1.25), 0.06), ID.iron); } };
}
// A coil of rope on the ground.
export function coil(x, y, z, r = 0.4) {
  return { bb: bbOf(x, y + 0.1, z, r + 0.08, 0.12, r + 0.08), f: (px, py, pz, T) => { const q = Math.hypot(px - x, pz - z), t = Math.hypot(q - r * 0.62, py - y - 0.07) - 0.07 - 0.02 * Math.sin(Math.atan2(pz - z, px - x) * 9); T(t, ID.rope); } };
}
// A rope (or chain, or wire) hanging between two points with a sag.
export function rope(a, b, sag = 0.3, r = 0.025, id = ID.rope) {
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2], q1 = [(a[0] + mid[0]) / 2, (a[1] + mid[1]) / 2 - sag * 0.25, (a[2] + mid[2]) / 2], q2 = [(mid[0] + b[0]) / 2, (mid[1] + b[1]) / 2 - sag * 0.25, (mid[2] + b[2]) / 2];
  const pts = [a, q1, mid, q2, b];
  const bb = [Math.min(a[0], b[0]) - 0.1, Math.min(a[1], b[1]) - sag - 0.1, Math.min(a[2], b[2]) - 0.1, Math.max(a[0], b[0]) + 0.1, Math.max(a[1], b[1]) + 0.1, Math.max(a[2], b[2]) + 0.1];
  return { bb, f: (px, py, pz, T) => { let d = Infinity; for (let i = 0; i < 4; i++) d = Math.min(d, cap(px, py, pz, pts[i], pts[i + 1], r)); T(d, id); } };
}
// A heap of net with floats.
export function netHeap(x, y, z, r = 0.9, seed = 1) {
  return { bb: bbOf(x, y + 0.3, z, r + 0.2, 0.4, r + 0.2), f: (px, py, pz, T) => { const n = vnoise(px * 3 + seed, pz * 3); T(ell(px, py, pz, x, y, z, r, 0.42 + 0.1 * n, r * 0.8) * 0.8, ID.net); for (let k = 0; k < 4; k++) { const a = k * 1.7 + seed; T(sph(px, py, pz, x + Math.cos(a) * r * 0.7, y + 0.25, z + Math.sin(a) * r * 0.55, 0.09), k & 1 ? ID.red : ID.oilskin); } } };
}
export function sack(x, y, z, s = 0.3, a = 0) {
  return { bb: bbOf(x, y + s, z, s * 1.3, s * 1.1, s * 1.3), f: (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); T(smin(ell(lx, py, lz, x, y + s * 0.55, z, s * 1.05, s * 0.6, s * 0.75), ell(lx, py, lz, x, y + s * 1.05, z, s * 0.4, s * 0.35, s * 0.35), 0.1), ID.sack); } };
}
export function fishbox(x, y, z, a = 0, full = true) {
  return { bb: bbOf(x, y + 0.2, z, 0.6, 0.25, 0.6), f: (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); const outer = box(lx, py, lz, x, y + 0.13, z, 0.42, 0.13, 0.28), inner = box(lx, py, lz, x, y + 0.17, z, 0.38, 0.13, 0.24); T(Math.max(outer, -inner), ID.fishbox); if (full) for (let k = 0; k < 3; k++) T(ell(lx, py, lz, x - 0.22 + k * 0.22, y + 0.2, z + (k - 1) * 0.04, 0.2, 0.05, 0.06), ID.fish); } };
}
// A stack of crates, deterministic by seed.
export function crateStack(x, y, z, n = 4, seed = 1, a = 0) {
  const parts = []; let k = 0;
  for (let i = 0; i < n; i++) { const lay = i < 3 ? 0 : 1, s = 0.3 + 0.08 * rnd(seed, i), ox = (i % 3 - 1) * 0.72 + (lay ? 0.36 : 0), oz = (rnd(seed, i, 2) - 0.5) * 0.2; if (lay && i - 3 >= 2) break; const [cx, cz] = rot(x + ox, z + oz, x, z, -a); parts.push(crate(cx, y + lay * 0.66, cz, s, a + (rnd(seed, i, 3) - 0.5) * 0.3, rnd(seed, i, 4) < 0.25 ? ID.timber : ID.crate)); k++; }
  const bb = parts.reduce((m, p) => [Math.min(m[0], p.bb[0]), Math.min(m[1], p.bb[1]), Math.min(m[2], p.bb[2]), Math.max(m[3], p.bb[3]), Math.max(m[4], p.bb[4]), Math.max(m[5], p.bb[5])], [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  return { bb, f: (px, py, pz, T) => { for (const p of parts) p.f(px, py, pz, T); } };
}
// A swan-neck sodium post; the head faces direction a (radians about y; 0 = +z).
export function sodiumPost(x, y, z, h = 4.6, a = Math.PI) {
  const hx = x + Math.sin(a) * 0.55, hz = z + Math.cos(a) * 0.55;
  return { bb: [Math.min(x, hx) - 0.5, y, Math.min(z, hz) - 0.5, Math.max(x, hx) + 0.5, y + h + 0.5, Math.max(z, hz) + 0.5], light: { pos: [hx, y + h - 0.25, hz], type: 0, I: 48, reach: 24, group: "sodium" },
    f: (px, py, pz, T) => { T(cyl(px, py, pz, x, y + (h - 0.6) / 2, z, 0.075, (h - 0.6) / 2), ID.iron); T(cyl(px, py, pz, x, y + 0.18, z, 0.15, 0.18), ID.iron); T(cap(px, py, pz, [x, y + h - 0.6, z], [hx, y + h + 0.12, hz], 0.065), ID.iron); T(ell(px, py, pz, hx, y + h, hz, 0.36, 0.15, 0.24), ID.sodium); T(ell(px, py, pz, hx, y + h + 0.1, hz, 0.4, 0.1, 0.28), ID.iron); } };
}
// A paraffin lamp on a bracket from a wall (wall normal direction a), or on a post when post = true.
export function paraffin(x, y, z, a = 0, post = false, I = 10, group = "lantern") {
  const lx = x + Math.sin(a) * (post ? 0 : 0.45), lz = z + Math.cos(a) * (post ? 0 : 0.45), ly = post ? y + 3.0 : y;
  return { bb: [Math.min(x, lx) - 0.4, post ? y : ly - 0.5, Math.min(z, lz) - 0.4, Math.max(x, lx) + 0.4, ly + 0.6, Math.max(z, lz) + 0.4], light: { pos: [lx, ly - 0.05, lz], type: 1, I, reach: 14, group },
    f: (px, py, pz, T) => {
      if (post) { T(cyl(px, py, pz, x, y + 1.4, z, 0.07, 1.4), ID.iron); T(cyl(px, py, pz, x, y + 0.1, z, 0.14, 0.1), ID.iron); }
      else T(cap(px, py, pz, [x, ly + 0.35, z], [lx, ly + 0.35, lz], 0.03), ID.iron);
      T(cap(px, py, pz, [lx, ly + 0.35, lz], [lx, ly + 0.22, lz], 0.015), ID.iron);
      const cage = Math.max(box(px, py, pz, lx, ly, lz, 0.15, 0.2, 0.15), -box(px, py, pz, lx, ly, lz, 0.12, 0.17, 0.2), -box(px, py, pz, lx, ly, lz, 0.2, 0.17, 0.12));
      T(cage, ID.iron); T(box(px, py, pz, lx, ly + 0.23, lz, 0.18, 0.03, 0.18), ID.iron); T(ell(px, py, pz, lx, ly - 0.02, lz, 0.1, 0.15, 0.1), ID.lantern);
    } };
}
// A white trial arc lamp on a tall post (Chancel Hill), head toward a.
export function arcPost(x, y, z, h = 5, a = 0, I = 60) {
  const hx = x + Math.sin(a) * 0.4, hz = z + Math.cos(a) * 0.4;
  return { bb: [Math.min(x, hx) - 0.45, y, Math.min(z, hz) - 0.45, Math.max(x, hx) + 0.45, y + h + 0.6, Math.max(z, hz) + 0.45], light: { pos: [hx, y + h - 0.3, hz], type: 3, I, reach: 26, group: "white" },
    f: (px, py, pz, T) => { T(cyl(px, py, pz, x, y + h / 2, z, 0.07, h / 2), ID.iron); T(cap(px, py, pz, [x, y + h, z], [hx, y + h, hz], 0.05), ID.iron); T(cyl(px, py, pz, hx, y + h - 0.12, hz, 0.22, 0.14), ID.iron); T(sph(px, py, pz, hx, y + h - 0.3, hz, 0.15), ID.whitelamp); } };
}
// A candle (in a jam jar when jar = true); flame emitter.
export function candle(x, y, z, h = 0.22, jar = true, I = 6) {
  return { bb: bbOf(x, y + h / 2 + 0.06, z, 0.1, h / 2 + 0.1, 0.1), light: { pos: [x, y + h + 0.06, z], type: 1, I, reach: 5, group: "candle" },
    f: (px, py, pz, T) => { T(cyl(px, py, pz, x, y + h / 2, z, 0.025, h / 2), ID.wax); T(ell(px, py, pz, x, y + h + 0.04, z, 0.015, 0.035, 0.015), ID.candle); if (jar) T(Math.max(cyl(px, py, pz, x, y + 0.08, z, 0.06, 0.08), -cyl(px, py, pz, x, y + 0.1, z, 0.05, 0.1)), ID.glass); } };
}
// A ladder from a to b (feet to top), rails 0.45 apart across direction side (radians).
export function ladder(a, b, side = 0, id = ID.timber) {
  const sx = Math.cos(side) * 0.22, sz = -Math.sin(side) * 0.22, L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.floor(L / 0.3);
  const bb = [Math.min(a[0], b[0]) - 0.35, Math.min(a[1], b[1]) - 0.05, Math.min(a[2], b[2]) - 0.35, Math.max(a[0], b[0]) + 0.35, Math.max(a[1], b[1]) + 0.05, Math.max(a[2], b[2]) + 0.35];
  return { bb, f: (px, py, pz, T) => { for (const s of [-1, 1]) T(cap(px, py, pz, [a[0] + sx * s, a[1], a[2] + sz * s], [b[0] + sx * s, b[1], b[2] + sz * s], 0.03), id);
    for (let i = 1; i < n; i++) { const t = i / n, c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; T(cap(px, py, pz, [c[0] - sx, c[1], c[2] - sz], [c[0] + sx, c[1], c[2] + sz], 0.018), id); } } };
}
// A railing along a polyline at height h, posts every step metres.
export function railing(pts, y, h = 1.0, step = 1.4, id = ID.iron) {
  const bb = [Infinity, y, Infinity, -Infinity, y + h + 0.05, -Infinity];
  for (const p of pts) { bb[0] = Math.min(bb[0], p[0] - 0.1); bb[2] = Math.min(bb[2], p[1] - 0.1); bb[3] = Math.max(bb[3], p[0] + 0.1); bb[5] = Math.max(bb[5], p[1] + 0.1); }
  const posts = []; for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]), n = Math.max(1, Math.round(L / step)); for (let k = 0; k <= n; k++) { const t = k / n; posts.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]); } }
  return { bb, f: (px, py, pz, T) => {
    for (let i = 0; i < pts.length - 1; i++) { T(cap(px, py, pz, [pts[i][0], y + h, pts[i][1]], [pts[i + 1][0], y + h, pts[i + 1][1]], 0.035), id); T(cap(px, py, pz, [pts[i][0], y + h * 0.5, pts[i][1]], [pts[i + 1][0], y + h * 0.5, pts[i + 1][1]], 0.02), id); }
    for (const p of posts) if (Math.abs(px - p[0]) < 0.3 && Math.abs(pz - p[1]) < 0.3) T(cyl(px, py, pz, p[0], y + h / 2, p[1], 0.03, h / 2), id); else T(Math.hypot(px - p[0], pz - p[1]) - 0.05, id);
  } };
}
// A flight of steps rising from (x, y, z) along direction a, n steps of rise r and tread t, width w.
export function stairs(x, y, z, a, n, w = 1.4, r = 0.18, t = 0.3, id = ID.steps) {
  const L = n * t, ex = x + Math.sin(a) * L, ez = z + Math.cos(a) * L;
  return { bb: [Math.min(x, ex) - w, y - 0.05, Math.min(z, ez) - w, Math.max(x, ex) + w, y + n * r + 0.05, Math.max(z, ez) + w], f: (px, py, pz, T) => {
    const c = Math.cos(a), s = Math.sin(a), dx = px - x, dz = pz - z, u = dx * s + dz * c, v = dx * c - dz * s; // u along, v across
    const k = Math.max(0, Math.min(n - 1, Math.floor(u / t)));
    let d = Infinity; for (let j = Math.max(0, k - 1); j <= Math.min(n - 1, k + 1); j++) d = Math.min(d, box(u, py, v, (j + 0.5) * t + (n - 1 - j) * t / 2, y + (j + 1) * r / 2, 0, (n - j) * t / 2 + t / 2, (j + 1) * r / 2, w / 2));
    T(d * 0.9, id);
  } };
}
// A door set in a wall facing direction a (0 = +z): frame, leaf, step. lit: light behind (ajar).
export function door(x, y, z, a = 0, w = 0.9, h = 2.0, id = ID.oxblood, step = true) {
  return { bb: bbOf(x, y + h / 2, z, w, h / 2 + 0.2, w), f: (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); T(box(lx, py, lz, x, y + h / 2, z + 0.02, w / 2, h / 2, 0.05), id); T(Math.max(box(lx, py, lz, x, y + h / 2 + 0.05, z + 0.05, w / 2 + 0.1, h / 2 + 0.1, 0.06), -box(lx, py, lz, x, y + h / 2, z + 0.05, w / 2, h / 2, 0.2)), ID.timber); T(sph(lx, py, lz, x + w * 0.35, y + h * 0.48, z + 0.09, 0.035), ID.brass); if (step) T(box(lx, py, lz, x, y + 0.08, z + 0.3, w / 2 + 0.15, 0.08, 0.25), ID.steps); } };
}
// A window in a wall facing a: lit (emitter), dark glass, or shuttered; with a sill.
export function windowAt(x, y, z, a = 0, w = 0.7, h = 1.0, kind = "lit") {
  const id = kind === "lit" ? ID.window : kind === "dim" ? ID.windowdim : kind === "shut" ? ID.timber : ID.glass;
  return { bb: bbOf(x, y, z, w * 0.75, h * 0.6, w * 0.75), f: (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); T(box(lx, py, lz, x, y, z, w / 2, h / 2, 0.04), id); T(Math.max(box(lx, py, lz, x, y, z + 0.03, w / 2 + 0.06, h / 2 + 0.06, 0.05), -box(lx, py, lz, x, y, z + 0.03, w / 2, h / 2, 0.2)), ID.timber); T(box(lx, py, lz, x, y, z + 0.06, 0.015, h / 2, 0.02), ID.timber); T(box(lx, py, lz, x, y - h / 2 - 0.05, z + 0.08, w / 2 + 0.1, 0.04, 0.1), ID.wall); } };
}
// A crooked terraced house: box body leaning by k, gable roof, chimney, windows on the face toward
// +z (face = 1) or -z (face = -1); windows lit by pattern unless given.
export function house(x, z, hx, hz, h, { y = 0, k = 0, id = ID.oxblood, face = 1, seed = 1, lit = 0.4, door: hasDoor = true, roofId = ID.roof, floors = null } = {}) {
  const fz = z + face * hz, rows = floors || Math.max(1, Math.floor((h - 0.6) / 2.1)), wins = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < Math.max(1, Math.floor(hx / 0.9)); c++) {
    const n = Math.max(1, Math.floor(hx / 0.9)), wx = x - hx + (c + 0.5) * (2 * hx / n), wy = y + 1.5 + r * 2.1;
    if (r === 0 && hasDoor && c === Math.floor(n / 2)) continue;
    const u = rnd(seed, r, c); wins.push([wx, wy, u < lit ? (u < lit * 0.35 ? "dim" : "lit") : u < lit + 0.15 ? "shut" : "dark"]);
  }
  const wp = wins.map(([wx, wy, kd]) => windowAt(wx, wy, fz + face * 0.03, face > 0 ? 0 : Math.PI, 0.62, 0.95, kd));
  const dp = hasDoor ? door(x, y, fz + face * 0.02, face > 0 ? 0 : Math.PI, 0.95, 2.05, rnd(seed, 9) < 0.5 ? ID.oxblood : ID.teal) : null;
  const lean = (px, py) => px - Math.max(0, py - y - 1) * k;
  return { bb: [x - hx - 0.5 - Math.abs(k) * h, y, z - hz - 0.7, x + hx + 0.5 + Math.abs(k) * h, y + h + 3.4, z + hz + 0.8], wins, f: (px, py, pz, T) => {
    const lx = lean(px, py);
    T(box(lx, py, pz, x, y + h / 2, z, hx, h / 2, hz), id);
    T(gable(lx, py, pz, x, y + h, z, hx + 0.2, hz + 0.3, 1.6 + 0.4 * rnd(seed, 3)), roofId);
    T(box(lx, py, pz, x + hx * 0.55, y + h + 1.6, z - hz * 0.3, 0.26, 1.1, 0.26), ID.chimney);
    T(box(lx, py, pz, x, y + 0.25, fz + face * 0.03, hx + 0.03, 0.25, 0.06), ID.wall); // plinth
    for (let r = 1; r <= rows; r++) T(box(lx, py, pz, x, y + 0.45 + r * 2.1 - 0.35, fz + face * 0.04, hx + 0.04, 0.05, 0.05), ID.timber); // string courses
    T(box(lx, py, pz, x, y + h - 0.12, fz + face * 0.08, hx + 0.12, 0.12, 0.1), ID.timber); // the cornice under the eaves
    T(cyl(lx, py, pz, x + hx - 0.12, y + h / 2, fz + face * 0.1, 0.05, h / 2), ID.iron); // a drainpipe at the party wall
    if (rnd(seed, 21) < 0.45) T(box(lx, py, pz, x, y + 2.45, fz + face * 0.1, hx * 0.8, 0.17, 0.04), rnd(seed, 22) < 0.5 ? ID.sign : ID.tar); // a fascia board
    for (const w of wp) w.f(lx, py, pz, T);
    if (dp) dp.f(lx, py, pz, T);
  } };
}
// A lit window's spill on the ground in front of it (for the light list).
export const windowSpill = (wx, wy, wz, face, I = 1.4) => ({ pos: [wx, wy, wz + face * 0.4], type: 1, I, reach: 6, cone: [0, 0, face], mode: 2, group: "window" });
// A mooring ring set in a wall face.
export function ring(x, y, z, a = 0) {
  return { bb: bbOf(x, y, z, 0.25, 0.25, 0.25), f: (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); const q = Math.hypot(lx - x, py - y) - 0.14; T(Math.hypot(q, lz - z - 0.06) - 0.02, ID.iron); } };
}
// A simple bench or table: legs and top.
export function table(x, y, z, hx = 0.7, hz = 0.4, h = 0.78, a = 0, id = ID.timber) {
  return { bb: bbOf(x, y + h / 2, z, R(hx) + 0.05, h / 2 + 0.05, R(hx) + 0.05), f: (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); T(box(lx, py, lz, x, y + h - 0.03, z, hx, 0.03, hz), id); for (const sx of [-1, 1]) for (const sz of [-1, 1]) T(box(lx, py, lz, x + sx * (hx - 0.08), y + (h - 0.06) / 2, z + sz * (hz - 0.08), 0.035, (h - 0.06) / 2, 0.035), id); } };
}
export function stool(x, y, z, r = 0.18, h = 0.5) { return { bb: bbOf(x, y + h / 2, z, r + 0.05, h / 2 + 0.03, r + 0.05), f: (px, py, pz, T) => { T(cyl(px, py, pz, x, y + h - 0.03, z, r, 0.03), ID.timber); T(cyl(px, py, pz, x, y + (h - 0.06) / 2, z, 0.04, (h - 0.06) / 2), ID.timber); } }; }
// A small boat on its side on mud: tilted hull, mast, oars.
export function beachedBoat(x, y, z, a = 0, L = 3.4, heel = 0.35, id = ID.boat, mast = true) {
  return { bb: bbOf(x, y + 1.2, z, L + 0.8, 2.6, L + 0.8), f: (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), c = Math.cos(heel), s = Math.sin(heel), ry = (py - y - 0.4) * c - (lz - z) * s, rz = (py - y - 0.4) * s + (lz - z) * c;
    const shell = ell(lx, ry, rz, x, 0, 0, L, 0.95, 1.15), inner = ell(lx, ry - 0.08, rz, x, 0, 0, L - 0.08, 0.9, 1.07);
    T(Math.max(shell, ry - 0.3), id); T(Math.max(inner, ry - 0.31, -(ry - 0.25)) * -1 > 0 ? Infinity : Infinity, id);
    T(Math.max(Math.abs(ry - 0.3) - 0.04, Math.max(shell, -inner)), ID.timber); // the gunwale
    for (const k of [-0.9, 0.3]) T(box(lx, ry, rz, x + k * L * 0.6, 0.12, 0, 0.12, 0.04, 0.95), ID.timber); // thwarts
    if (mast) T(cap(lx, ry, rz, [x + 0.3, 0.1, 0], [x + 0.3, 4.0, 0], 0.06), ID.tar);
  } };
}
// A barge lying on its side (the Spit): a long box hull heeled about its keel line.
export function barge(x, y, z, a, L = 9, B = 3, D = 1.8, heel = 0.7, id = ID.hull) {
  return { bb: bbOf(x, y + 1.6, z, L / 2 + B + 1, 3, L / 2 + B + 1), f: (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), c = Math.cos(heel), s = Math.sin(heel), ry = (py - y) * c - (lz - z) * s, rz = (py - y) * s + (lz - z) * c;
    const ends = Math.abs(lx - x) - L / 2 + (ry < D * 0.5 ? 0 : 0) - Math.max(0, (D - ry)) * 0.25 * 0;
    const hullOut = Math.max(ends, Math.abs(rz) - B / 2, -ry, ry - D) * 0.85, hullIn = Math.max(Math.abs(lx - x) - L / 2 + 0.12, Math.abs(rz) - B / 2 + 0.12, -(ry - 0.15));
    T(Math.max(hullOut, -hullIn), id);
    T(Math.max(Math.abs(lx - x) - L / 2 + 0.15, Math.abs(rz) - B / 2 + 0.15, Math.abs(ry - D + 0.25) - 0.05), ID.plank); // deck strip
    for (const hx of [-L * 0.25, L * 0.15]) T(Math.max(box(lx, ry, rz, x + hx, D - 0.15, 0, 0.9, 0.18, B / 2 - 0.4), -box(lx, ry, rz, x + hx, D, 0, 0.75, 0.3, B / 2 - 0.55)), ID.timber); // hatch coamings
    T(cap(lx, ry, rz, [x + L / 2, 0.2, 0], [x + L / 2 + 0.3, D + 0.4, 0], 0.12), ID.timber); // rudder stock
  } };
}
// A cask for salvage scenes.
export const cask = (x, y, z, a = 0, lying = true) => barrel(x, y, z, 0.28, 0.75, lying, a);
// A lamp-room style lens (beehive): rings of glass, some green; emitter when lit.
export function beehive(x, y, z, r = 1.2, h = 2.6, greenRings = [2, 5, 6], lit = true) {
  return { bb: bbOf(x, y + h / 2, z, r + 0.3, h / 2 + 0.4, r + 0.3), f: (px, py, pz, T) => {
    const t = (py - y) / h, rr = r * (0.7 + 0.45 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)))), q = Math.hypot(px - x, pz - z);
    const ringI = Math.floor(t * 12), ridge = Math.abs(((t * 12) % 1) - 0.5) * 0.06;
    const shell = Math.max(q - rr - ridge, -(q - rr + 0.18), py - y - h, y - py);
    T(shell * 0.8, greenRings.includes(ringI) ? ID.bottle : lit ? ID.arc : ID.glass);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; T(cap(px, py, pz, [x + Math.cos(a) * (r + 0.05), y, z + Math.sin(a) * (r + 0.05)], [x + Math.cos(a) * (r + 0.05), y + h, z + Math.sin(a) * (r + 0.05)], 0.035), ID.brass); }
  } };
}
// A switch box on a wall facing a, with a lever: on = up.
export function switchBox(x, y, z, a = 0, on = true) {
  return { bb: bbOf(x, y, z, 0.5, 0.6, 0.5), f: (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); T(rbox(lx, py, lz, x, y, z + 0.1, 0.28, 0.38, 0.1, 0.02), ID.iron); const tip = on ? [x + 0.12, y + 0.3, z + 0.32] : [x + 0.12, y - 0.3, z + 0.32]; T(cap(lx, py, lz, [x + 0.12, y, z + 0.22], tip, 0.025), ID.red); T(box(lx, py, lz, x - 0.1, y + 0.18, z + 0.21, 0.12, 0.06, 0.01), ID.paper); } };
}
// A sluice gate in a channel running along direction a: frame, gate (open raises it), wheel.
export function sluice(x, y, z, a = 0, w = 1.4, open = false) {
  return { bb: bbOf(x, y + 1.0, z, w + 0.4, 1.6, w + 0.4), f: (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); for (const s of [-1, 1]) T(box(lx, py, lz, x + s * w / 2, y + 0.9, z, 0.1, 0.9, 0.12), ID.timber); T(box(lx, py, lz, x, y + 1.85, z, w / 2 + 0.15, 0.08, 0.12), ID.timber); T(box(lx, py, lz, x, y + (open ? 1.2 : 0.45), z, w / 2 - 0.05, 0.45, 0.05), ID.rust); const q = Math.hypot(lx - x, py - y - 2.3) - 0.28; T(Math.hypot(q, lz - z) - 0.03, ID.iron); T(cap(lx, py, lz, [x, y + 1.9, z], [x, y + 2.3, z], 0.03), ID.iron); } };
}
// A bell jar (the Congregation): a glass dome a head can sit in.
export function bellJar(x, y, z, r = 0.24, h = 0.42) { return { bb: bbOf(x, y + h / 2, z, r + 0.05, h / 2 + 0.05, r + 0.05), f: (px, py, pz, T) => { const e = ell(px, py, pz, x, y, z, r, h, r); T(Math.max(e, -(e + 0.012), y - py), ID.glass); T(sph(px, py, pz, x, y + h + 0.02, z, 0.03), ID.brass); } }; }
// Washing on a line between two points (day): cloth rectangles hanging off a rope.
export function washing(a, b, n = 6, seed = 1) {
  const r = rope(a, b, 0.25, 0.012), items = [];
  for (let i = 1; i <= n; i++) { const t = i / (n + 1), sag = 0.25 * 4 * t * (1 - t), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t]; items.push([p, 0.18 + 0.12 * rnd(seed, i), 0.3 + 0.35 * rnd(seed, i, 1), [ID.red, ID.bonecloth, ID.red, ID.cobalt, ID.oilskin, ID.red][(i + seed) % 6]]); }
  const ang = Math.atan2(b[0] - a[0], b[2] - a[2]);
  return { bb: [Math.min(a[0], b[0]) - 0.4, Math.min(a[1], b[1]) - 1.2, Math.min(a[2], b[2]) - 0.4, Math.max(a[0], b[0]) + 0.4, Math.max(a[1], b[1]) + 0.1, Math.max(a[2], b[2]) + 0.4], f: (px, py, pz, T) => { r.f(px, py, pz, T); for (const [p, w, h, id] of items) { const [lx, lz] = rot(px, pz, p[0], p[2], ang); T(box(lx, py, lz, p[0], p[1] - h / 2, p[2], 0.01 + 0.02 * Math.sin(py * 9), h / 2, w) - 0.005, id); } } };
}

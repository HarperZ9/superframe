// Era 5 props (The Clearance, year 115, three weeks in April; design/eras/era5.md sections 5, 7 and 11, look L5):
// the things of a town that has phones. Handsets and screens lit cold, a ring light, flat-pack kitchens, a mortuary
// trolley, council benches, archive boxes on steel shelving, the police van with its lightbar, tape, barriers, the
// bronze sheaf, the phone mast where the bell hung, a tilted stone. Screens are lit white (ID.whitelamp) so the shell
// can lay its glyph over them (L14). Built on the authored library's helpers; a new file, nobody else's props are
// edited. Plates agent, 2026-10-23. Original code.
import { prop, bbc, bbr, rot, box, cyl, cap, ell, sph, slab, n3, fb3, hash, sstep, ID } from "./prim.mjs";

// a phone face up (or propped): a black slab, its screen lit; returns { p, l } with a small cold glow
export function handset(x, y, z, { a = 0, name = "phone", lit = true, cracked = false, up = false } = {}) {
  const p = prop(name, bbr(x, y, z, 0.1, y + (up ? 0.17 : 0.02), 0.1), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a);
    if (up) { T(slab(lx, py, lz, [x, y + 0.08, z], [0.036, 0.075, 0.005], 0.004), ID.tar); T(slab(lx, py, lz, [x, y + 0.08, z + 0.004], [0.032, 0.07, 0.002], 0.002), lit ? ID.whitelamp : ID.coal); return; }
    T(slab(lx, py, lz, [x, y + 0.005, z], [0.037, 0.005, 0.077], 0.004), ID.tar);
    const crack = cracked && Math.abs(lx - x - 0.4 * (lz - z) - 0.006 * Math.sin(lz * 300)) < 0.0015;
    T(slab(lx, py, lz, [x, y + 0.009, z], [0.033, 0.002, 0.072], 0.002), crack ? ID.chalk : lit ? ID.whitelamp : ID.coal);
  });
  return { p, l: lit ? { pos: [x, y + 0.12, z], type: 2, I: 0.35, reach: 1.4, key: `${name}_${x}_${z}`, group: "screen" } : null };
}
// a flat screen on a foot (or on a wall: wall = true), lit; w x h metres
export function screenOn(x, y, z, { w = 0.55, h = 0.33, face = "z", wall = false, name = "monitor", I = 1.2, lit = true } = {}) {
  const fz = face === "z", hx = fz ? w / 2 : 0.03, hz = fz ? 0.03 : w / 2;
  const p = prop(name, bbc(x, y + (wall ? 0 : h / 2 + 0.06), z, hx + 0.08, h / 2 + 0.12, hz + 0.08), (px, py, pz, T) => {
    const cy = y + (wall ? 0 : h / 2 + 0.1);
    T(box(px, py, pz, x, cy, z, hx + 0.012, h / 2 + 0.012, hz), ID.tar);
    T(box(px, py, pz, x + (fz ? 0 : 0.012), cy, z + (fz ? 0.012 : 0), fz ? w / 2 - 0.01 : 0.004, h / 2 - 0.01, fz ? 0.004 : w / 2 - 0.01), lit ? ID.whitelamp : ID.coal);
    if (!wall) { T(cyl(px, py, pz, x, y + 0.05, z, 0.012, 0.05), ID.steel); T(slab(px, py, pz, [x, y + 0.006, z], [0.09, 0.006, 0.07], 0.004), ID.tar); }
  });
  return { p, l: lit ? { pos: [x + (fz ? 0 : 0.4), y + h / 2, z + (fz ? 0.4 : 0)], type: 2, I, reach: 3.5, key: `${name}_${x}_${z}`, group: "screen" } : null };
}
// Ellie's ring light: a white torus on a tripod stand, its phone clamped in the middle; the room's key
export function ringLight(x, z, { h = 1.55, a = 0, I = 9, name = "ring_light" } = {}) {
  const p = prop(name, bbr(x, 0, z, 0.45, h + 0.3, 0.45), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a);
    for (const k of [0, 1, 2]) { const t = k * 2.094; T(cap(lx, py, lz, [x, 0.75, z], [x + 0.32 * Math.cos(t), 0.0, z + 0.32 * Math.sin(t)], 0.01), ID.tar); }
    T(cap(lx, py, lz, [x, 0.7, z], [x, h, z], 0.014), ID.steel);
    T(Math.hypot(Math.hypot(lx - x, py - h - 0.02) - 0.22, lz - z) - 0.022, ID.whitelamp);
    T(slab(lx, py, lz, [x, h + 0.02, z], [0.035, 0.07, 0.005], 0.004), ID.tar);
  });
  return { p, l: { pos: [x + 0.1, h, z + 0.25], type: 2, I, reach: 5, key: name, group: "ring", soft: 0.8 } };
}
// a laptop open on a desk
export const laptop = (x, y, z, { a = 0, name = "laptop", lit = true } = {}) => prop(name, bbr(x, y, z, 0.24, y + 0.26, 0.24), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, y + 0.008, z + 0.05], [0.16, 0.008, 0.11], 0.004), ID.steel);
  const q = (py - y) * 0.26 + (lz - z + 0.06) * 0.97; T(Math.max(Math.abs(lx - x) - 0.16, Math.abs(q) - 0.006, py - y - 0.22, y - py), lit ? ID.whitelamp : ID.tar);
});
// a flat-pack kitchen run along the back wall (z = wz) from x0 to x1: base units, worktop, wall units, a sink and hob
export function kitchenRun(x0, x1, wz, { name = "kitchen_run", top = ID.formica, door = ID.bone, sinkAt = null, hobAt = null, wall = true } = {}) {
  return prop(name, [x0 - 0.05, 0, wz, x1 + 0.05, 2.3, wz + 0.68], (px, py, pz, T) => {
    const cx = (x0 + x1) / 2, hx = (x1 - x0) / 2;
    T(box(px, py, pz, cx, 0.43, wz + 0.31, hx, 0.43, 0.29), door);
    const k = Math.round((px - x0) / 0.6 - 0.5); T(box(px, py, pz, x0 + (k + 1) * 0.6, 0.45, wz + 0.605, 0.006, 0.38, 0.006), ID.tar);
    T(box(px, py, pz, cx, 0.89, wz + 0.31, hx + 0.02, 0.02, 0.31), top);
    for (let i = 0; i < Math.floor(hx * 2 / 0.6); i++) T(cap(px, py, pz, [x0 + 0.5 + i * 0.6, 0.72, wz + 0.62], [x0 + 0.5 + i * 0.6, 0.62, wz + 0.62], 0.008), ID.steel);
    if (wall) { T(box(px, py, pz, cx, 1.85, wz + 0.17, hx, 0.35, 0.16), door); T(box(px, py, pz, cx, 1.2, wz + 0.004, hx, 0.3, 0.004), ID.tile4); }
    if (sinkAt != null) { T(Math.max(box(px, py, pz, sinkAt, 0.86, wz + 0.33, 0.25, 0.05, 0.21), -box(px, py, pz, sinkAt, 0.9, wz + 0.33, 0.22, 0.06, 0.18)), ID.steel); T(cap(px, py, pz, [sinkAt, 0.9, wz + 0.1], [sinkAt, 1.08, wz + 0.1], 0.012), ID.steel); T(cap(px, py, pz, [sinkAt, 1.08, wz + 0.1], [sinkAt, 1.08, wz + 0.24], 0.01), ID.steel); }
    if (hobAt != null) for (const [dx, dz] of [[-0.12, 0.2], [0.12, 0.2], [-0.12, 0.42], [0.12, 0.42]]) T(Math.max(Math.abs(Math.hypot(px - hobAt - dx, pz - wz - dz) - 0.06) - 0.012, Math.abs(py - 0.915) - 0.008), ID.coal);
  });
}
// a fridge, white, with magnets and a child's drawing on it
export const fridge = (x, z, { name = "fridge", h = 1.7, seed = 1 } = {}) => prop(name, bbc(x, h / 2, z, 0.32, h / 2 + 0.02, 0.33), (px, py, pz, T) => {
  T(slab(px, py, pz, [x, h / 2, z], [0.3, h / 2, 0.31], 0.02), ID.bone); T(box(px, py, pz, x, h * 0.62, z + 0.312, 0.29, 0.005, 0.004), ID.slate);
  T(cap(px, py, pz, [x + 0.24, h * 0.7, z + 0.33], [x + 0.24, h * 0.9, z + 0.33], 0.01), ID.steel);
  for (let k = 0; k < 5; k++) { const mx = x - 0.2 + hash(k, seed, 1) * 0.35, my = h * 0.66 + hash(k, seed, 2) * h * 0.3; T(box(px, py, pz, mx, my, z + 0.315, 0.05 + 0.04 * hash(k, seed, 3), 0.06, 0.002), [ID.paper, ID.teal, ID.mustard, ID.paper, ID.pink][k]); }
});
// a two-seat sofa, fabric worn at the arms, a throw over one end
export const sofa = (x, z, { a = 0, id = ID.navy, name = "sofa", throwId = ID.mustard } = {}) => prop(name, bbr(x, 0, z, 0.95, 0.95, 0.95), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, 0.22, z], [0.8, 0.18, 0.4], 0.06), id); T(slab(lx, py, lz, [x, 0.55, z - 0.32], [0.8, 0.3, 0.1], 0.06), id);
  for (const s of [-1, 1]) T(slab(lx, py, lz, [x + s * 0.76, 0.42, z], [0.1, 0.2, 0.4], 0.06), id);
  T(slab(lx, py, lz, [x + 0.45, 0.62 - 0.1 * sstep(-0.3, 0.3, lz - z), z], [0.3, 0.32, 0.42], 0.02) + 0.01 * n3(lx * 20, py * 20, lz * 20), throwId);
});
// a mortuary trolley: steel top, the sheet over a shape, the drain and the wheels
export const trolley = (x, z, { a = 0, name = "mortuary_trolley", covered = true } = {}) => prop(name, bbr(x, 0, z, 1.1, 1.2, 1.1), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, 0.84, z], [0.95, 0.015, 0.32], 0.01), ID.steel);
  for (const [sx, sz] of [[-0.85, -0.25], [0.85, -0.25], [-0.85, 0.25], [0.85, 0.25]]) { T(cap(lx, py, lz, [x + sx, 0.1, z + sz], [x + sx, 0.83, z + sz], 0.014), ID.steel); T(cyl(lx, py, lz, x + sx, 0.05, z + sz, 0.05, 0.02), ID.tar); }
  T(slab(lx, py, lz, [x, 0.3, z], [0.9, 0.01, 0.28], 0.01), ID.steel);
  if (covered) T(ell(lx, py, lz, x, 0.9, z, 0.85, 0.12 + 0.02 * Math.cos((lx - x) * 4), 0.27) + 0.006 * fb3(lx * 12, py * 12, lz * 12), ID.bonecloth);
});
// steel archive shelving along the wall z = wz: uprights, shelves, grey boxes with white labels
export function archiveShelves(x0, x1, wz, { h = 2.2, depth = 0.4, name = "archive_shelving", seed = 1, face = 1 } = {}) {
  return prop(name, [x0 - 0.05, 0, Math.min(wz, wz + face * depth) - 0.02, x1 + 0.05, h + 0.02, Math.max(wz, wz + face * depth) + 0.02], (px, py, pz, T) => {
    const cz = wz + face * depth / 2;
    for (let ux = x0; ux <= x1 + 1e-6; ux += 0.9) T(box(px, py, pz, ux, h / 2, cz, 0.015, h / 2, depth / 2), ID.steel);
    for (let s = 0; s < 6; s++) {
      const sy = 0.1 + s * (h - 0.15) / 5; T(box(px, py, pz, (x0 + x1) / 2, sy, cz, (x1 - x0) / 2, 0.01, depth / 2), ID.steel);
      if (s === 5) continue; const k = Math.floor((px - x0) / 0.27), bx = x0 + (k + 0.5) * 0.27;
      if (k < 0 || hash(k, s, seed) < 0.12) continue; const bh = 0.26 + 0.04 * hash(k, s, seed + 1);
      T(box(px, py, pz, bx, sy + 0.01 + bh / 2, cz, 0.125, bh / 2, depth / 2 - 0.03), hash(k, s, seed + 2) < 0.15 ? ID.sack : ID.slate);
      T(box(px, py, pz, bx, sy + bh * 0.6, cz + face * (depth / 2 - 0.028), 0.06, 0.03, 0.003), ID.paper);
    }
  });
}
// an archive box open on a table, a book in it scorched along the bottom edge
export const archiveBox = (x, y, z, { name = "archive_box", book = true } = {}) => prop(name, bbc(x, y + 0.14, z, 0.26, 0.15, 0.2), (px, py, pz, T) => {
  T(Math.max(box(px, py, pz, x, y + 0.12, z, 0.22, 0.12, 0.16), -box(px, py, pz, x, y + 0.14, z, 0.21, 0.12, 0.15)), ID.slate);
  if (book) { T(box(px, py, pz, x, y + 0.06, z, 0.16, 0.05, 0.12), py < y + 0.03 + 0.01 * n3(px * 60, 0, pz * 60) ? ID.coal : ID.leather); T(box(px, py, pz, x, y + 0.111, z, 0.15, 0.002, 0.11), ID.paper); }
});
// council bench row: a long desk with a microphone per seat and a name card, chairs behind
export function councilDesk(x, z, { hx = 2.4, name = "council_desk", n = 5, a = 0 } = {}) {
  return prop(name, bbr(x, 0, z, hx + 0.1, 1.15, hx + 0.1), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a);
    T(box(lx, py, lz, x, 0.74, z, hx, 0.025, 0.35), ID.darkwood); T(box(lx, py, lz, x, 0.4, z + 0.33, hx, 0.35, 0.02), ID.darkwood);
    for (let i = 0; i < n; i++) { const mx = x - hx + (i + 0.5) * (2 * hx / n); T(cap(lx, py, lz, [mx, 0.77, z + 0.15], [mx, 0.95, z - 0.02], 0.006), ID.tar); T(sph(lx, py, lz, mx, 0.96, z - 0.03, 0.018), ID.tar); T(Math.max(Math.abs(lx - mx - 0.18) - 0.09, Math.abs(py - 0.8 - 0.4 * (lz - z - 0.2)) - 0.004, Math.abs(lz - z - 0.2) - 0.04), ID.paper); }
  });
}
// the police van: a white panel van with the blue-and-yellow band, the lightbar, back doors open or shut
export function van(x, z, { a = 0, name = "police_van", open = true, bar = true, I = 6 } = {}) {
  const p = prop(name, bbr(x, 0, z, 3.0, 2.7, 3.0), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a);
    const body = Math.max(slab(lx, py, lz, [x, 1.35, z], [2.6, 0.95, 0.98], 0.12), -(open ? box(lx, py, lz, x - 2.6, 1.3, z, 0.25, 0.8, 0.85) : 1));
    const band = Math.abs(py - 1.05) < 0.14 ? (Math.floor((lx - x) / 0.25) & 1 ? ID.blue : ID.mustard) : ID.bone;
    T(body, band); T(slab(lx, py, lz, [x + 2.3, 1.7, z], [0.3, 0.4, 0.92], 0.08), ID.windowdim);
    for (const [wx, wz] of [[-1.6, 1], [-1.6, -1], [1.7, 1], [1.7, -1]]) T(Math.max(Math.hypot(lx - x - wx, py - 0.38) - 0.36, Math.abs(lz - z - wz * 0.9) - 0.13), ID.tar);
    if (open) for (const s of [-1, 1]) T(slab(lx, py, lz, [x - 2.75 - 0.3, 1.3, z + s * 1.15], [0.35, 0.8, 0.03], 0.02), ID.bone);
    if (bar) { T(slab(lx, py, lz, [x + 1.4, 2.4, z], [0.15, 0.06, 0.6], 0.03), ID.tar); T(slab(lx, py, lz, [x + 1.4, 2.42, z], [0.12, 0.05, 0.55], 0.02), ID.whitelamp); }
  });
  return { p, l: bar ? { pos: [x + 1.4, 2.6, z], type: 3, I, reach: 14, key: `${name}_bar`, group: "blue" } : null };
}
// police tape between two points at waist height, sagging, in bands
export function tape(a, b, { name = "police_tape", y = 0.95, sag = 0.12 } = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
  return prop(name, [Math.min(a[0], b[0]) - 0.1, y - sag - 0.1, Math.min(a[1], b[1]) - 0.1, Math.max(a[0], b[0]) + 0.1, y + 0.1, Math.max(a[1], b[1]) + 0.1], (px, py, pz, T) => {
    const t = Math.max(0, Math.min(1, ((px - a[0]) * ux + (pz - a[1]) * uz) / L)), cx = a[0] + ux * t * L, cz = a[1] + uz * t * L, cy = y - sag * 4 * t * (1 - t);
    T(Math.max(Math.hypot(px - cx, pz - cz) - 0.004, Math.abs(py - cy) - 0.025), Math.floor(t * L / 0.3) & 1 ? ID.blue : ID.bone);
  });
}
// a crowd barrier: a steel frame with uprights, feet
export const barrier = (x, z, { a = 0, name = "crowd_barrier" } = {}) => prop(name, bbr(x, 0, z, 1.2, 1.15, 1.2), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  for (const y of [0.2, 1.05]) T(cap(lx, py, lz, [x - 1.1, y, z], [x + 1.1, y, z], 0.02), ID.steel);
  for (let k = -10; k <= 10; k += 2) T(cap(lx, py, lz, [x + k * 0.1, 0.2, z], [x + k * 0.1, 1.05, z], 0.008), ID.steel);
  for (const s of [-1, 1]) T(cap(lx, py, lz, [x + s * 1.0, 0.02, z - 0.3], [x + s * 1.0, 0.02, z + 0.3], 0.025), ID.steel);
});
// a wheelie bin, lid down
export const wheelie = (x, z, { a = 0, id = ID.green, name = "wheelie_bin" } = {}) => prop(name, bbr(x, 0, z, 0.45, 1.1, 0.45), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, 0.5, z], [0.28 - 0.03 * (1 - py), 0.48, 0.33], 0.03), id); T(slab(lx, py, lz, [x, 1.0, z + 0.03], [0.3, 0.03, 0.37], 0.02), id);
  T(Math.max(Math.hypot(py - 0.1, lz - z + 0.33) - 0.1, Math.abs(Math.abs(lx - x) - 0.25) - 0.04), ID.tar);
});
// a car parked, for the square's car park: a low body, glass, wheels; colour by id
export const car = (x, z, { a = 0, id = ID.slate, name = "parked_car" } = {}) => prop(name, bbr(x, 0, z, 2.4, 1.5, 2.4), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, 0.6, z], [2.0, 0.3, 0.85], 0.15), id); T(slab(lx, py, lz, [x - 0.2, 1.05, z], [1.1, 0.22, 0.78], 0.15), id); T(slab(lx, py, lz, [x - 0.2, 1.02, z], [1.12, 0.14, 0.8], 0.1), ID.coal);
  for (const [wx, wz] of [[-1.3, 1], [-1.3, -1], [1.3, 1], [1.3, -1]]) T(Math.max(Math.hypot(lx - x - wx, py - 0.32) - 0.32, Math.abs(lz - z - wz * 0.78) - 0.11), ID.tar);
});
// a lattice phone mast where the bell hung: three legs, cross-bracing, dishes, a red light on the top
export function mast(x, y, z, { h = 9, name = "phone_mast" } = {}) {
  const p = prop(name, [x - 1.4, y, z - 1.4, x + 1.4, y + h + 0.6, z + 1.4], (px, py, pz, T) => {
    const r = (q) => 0.9 - 0.6 * (q - y) / h, legs = [0, 2.094, 4.189].map((t) => [Math.cos(t), Math.sin(t)]);
    for (const [cx, sz] of legs) T(cap(px, py, pz, [x + 0.9 * cx, y, z + 0.9 * sz], [x + 0.3 * cx, y + h, z + 0.3 * sz], 0.05), ID.steel);
    const k = Math.floor((py - y) / 1.0); if (k >= 0 && k < h) { const y0 = y + k, y1 = y0 + 1; for (let i = 0; i < 3; i++) { const A = legs[i], B = legs[(i + 1) % 3]; T(cap(px, py, pz, [x + r(y0) * A[0], y0, z + r(y0) * A[1]], [x + r(y1) * B[0], y1, z + r(y1) * B[1]], 0.02), ID.steel); } }
    for (const [dy, t] of [[h - 1.2, 0.5], [h - 2.0, 2.6], [h - 1.6, 4.4]]) T(Math.max(Math.abs(Math.hypot(px - x - 0.55 * Math.cos(t), py - y - dy, pz - z - 0.55 * Math.sin(t)) - 0.42) - 0.02, (px - x) * Math.cos(t) + (pz - z) * Math.sin(t) - 0.62), ID.bone);
    T(sph(px, py, pz, x, y + h + 0.15, z, 0.09), ID.red);
  });
  return { p, l: { pos: [x, y + h + 0.3, z], type: 1, I: 0.25, reach: 1.5, key: "mast_red", group: "mast" } };
}
// a headstone at an angle in the verge; tilt in radians toward +x
export const stone = (x, z, { tilt = 0, a = 0, name = "headstone", worn = 0.6 } = {}) => prop(name, bbr(x, -0.2, z, 0.5, 1.1, 0.5), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a), c = Math.cos(tilt), s = Math.sin(tilt), qx = (lx - x) * c - py * s, qy = (lx - x) * s + py * c;
  T(Math.max(slab(qx, qy, lz - z, [0, 0.4, 0], [0.26, 0.45, 0.06], 0.02), Math.hypot(qx, qy - 0.65) - 0.32 - (qy < 0.65 ? 9 : 0)) + 0.012 * worn * fb3(lx * 14, py * 14, lz * 14), ID.slate);
});
// survey pegs with orange tops through the grass, in a line
export function pegs(x0, z0, x1, z1, { n = 8, name = "survey_pegs" } = {}) {
  return prop(name, [Math.min(x0, x1) - 0.1, -0.1, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, 0.5, Math.max(z0, z1) + 0.1], (px, py, pz, T) => {
    const t = Math.max(0, Math.min(1, ((px - x0) * (x1 - x0) + (pz - z0) * (z1 - z0)) / ((x1 - x0) ** 2 + (z1 - z0) ** 2))), k = Math.round(t * (n - 1)) / (n - 1);
    const cx = x0 + (x1 - x0) * k, cz = z0 + (z1 - z0) * k; T(box(px, py, pz, cx, 0.2, cz, 0.022, 0.25, 0.022), py > 0.38 ? ID.mustard : ID.timber);
  });
}
// a tea mug, with a flag on it (or plain)
export const mug5 = (x, y, z, { name = "mug", id = ID.bone, band = null } = {}) => prop(name, bbc(x, y + 0.05, z, 0.06, 0.06, 0.06), (px, py, pz, T) => {
  T(Math.max(Math.abs(Math.hypot(px - x, pz - z) - 0.04) - 0.005, Math.abs(py - y - 0.05) - 0.05), band && Math.abs(py - y - 0.06) < 0.015 ? band : id); T(box(px, py, pz, x, y + 0.004, z, 0.04, 0.004, 0.04), id);
  T(Math.max(Math.abs(Math.hypot(px - x - 0.05, py - y - 0.05) - 0.022) - 0.005, Math.abs(pz - z) - 0.005), id);
});
// takeaway cartons and a carrier bag on a worktop
export const carrier = (x, y, z, { name = "carrier_bag", id = ID.bone } = {}) => prop(name, bbc(x, y + 0.2, z, 0.2, 0.22, 0.14), (px, py, pz, T) => {
  T(slab(px, py, pz, [x, y + 0.15, z], [0.16 - 0.03 * sstep(0.1, 0.3, py - y), 0.15, 0.09], 0.03) + 0.008 * n3(px * 30, py * 30, pz * 30), id);
  T(Math.max(Math.abs(Math.hypot(px - x, py - y - 0.3) - 0.06) - 0.006, Math.abs(pz - z) - 0.01, y + 0.3 - py), id);
});
// a meshed window (the Well House): a frame, glass, and a steel mesh screwed over the outside
export const meshWindow = (x, y, wz, { w = 0.9, h = 1.1, name = "meshed_window" } = {}) => prop(name, bbc(x, y, wz, w / 2 + 0.06, h / 2 + 0.06, 0.08), (px, py, pz, T) => {
  T(Math.max(box(px, py, pz, x, y, wz, w / 2 + 0.05, h / 2 + 0.05, 0.05), -box(px, py, pz, x, y, wz, w / 2, h / 2, 0.06)), ID.darkwood);
  const fx = (((px - x) / 0.06) % 1 + 1) % 1, fy = (((py - y) / 0.06) % 1 + 1) % 1, g = Math.min(fx, 1 - fx, fy, 1 - fy);
  T(box(px, py, pz, x, y, wz + 0.01, w / 2, h / 2, 0.006), g < 0.1 ? ID.steel : ID.windowdim);
});
// a flat sheet lying on a surface at height y: a plate, a ledger page, a rug; w along x, d along z
export const flat = (name, x, y, z, w, d, id, { th = 0.004 } = {}) => prop(name, bbc(x, y + th, z, w / 2 + 0.02, th + 0.02, d / 2 + 0.02), (px, py, pz, T) => T(box(px, py, pz, x, y + th, z, w / 2, th, d / 2), id));

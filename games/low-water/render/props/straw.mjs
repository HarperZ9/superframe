// Straw and hay props: a heaped, slumped hay mound from a heightfield of cones at the angle of repose, bound bales with
// twine, the tied sheaf, loose wisps, the fork and the rake. Surface detail comes from kinds.mjs (strand bands) and
// from the displacement here (tufts and strand relief), so the hay has structure in its normals as well as its colour.
import { prop, bbc, bbr, rot, box, cyl, cap, ell, tcap, slab, chain, lathe, n3, fb3, hash, sstep, smax, ID, sat } from "./prim.mjs";

// A heightfield pile. cones: [x, z, height, run-per-rise slope, softness]; bb: its region; clip(x,y,z) bounds it
// (the roof); hollow: [cx, cy, cz, rx, ry, rz] a cavity cut into it (the hiding place).
export function hayMound(name, bb, cones, { clip = null, hollow = null, tuft = 0.05, floor = 0, id = ID.hay, soft = 0.32, terrace = 0, cuts = [], tunnel = null } = {}) {
  const Hh = (x, z) => {
    let h = -1e9;
    for (const [cx, cz, ch, sl] of cones) h = smax(h, ch - sl * Math.hypot(x - cx, z - cz), soft);
    if (terrace) { const s = h / terrace, f = s - Math.floor(s); h = (Math.floor(s) + sstep(0.35, 0.65, f)) * terrace; }
    return h + 0.5 * tuft * Math.max(0, Math.sin(x * 4.1 + 1.7 * Math.sin(z * 2.3)) * Math.sin(z * 3.3 - x)) + (fb3(x * 2.6, 0, z * 2.6) - 0.5) * tuft * 2 + (n3(x * 9, 0.5, z * 9) - 0.5) * tuft * 0.3;
  };
  return prop(name, bb, (x, y, z, T) => {
    const h = Hh(x, z);
    let d = (y - h) * 0.62 - (n3(x * 31, y * 31, z * 31) - 0.5) * 0.004;
    if (hollow) { const [cx, cy, cz, rx, ry, rz] = hollow, lx = (x - cx) / rx, ly = (y - cy) / ry, lz = (z - cz) / rz, q = (Math.hypot(lx, ly, lz) - 1) * Math.min(rx, ry, rz) * 0.9 + (n3(x * 7, y * 7, z * 7) - 0.5) * 0.05; d = Math.max(d, -q); }
    for (const c of cuts) d = Math.max(d, -box(x, y, z, ...c) + (n3(x * 9, y * 9, z * 9) - 0.5) * 0.03);
    if (tunnel) { let q = 1e9; for (let i = 0; i + 1 < tunnel.pts.length; i++) q = Math.min(q, cap(x, y, z, tunnel.pts[i], tunnel.pts[i + 1], tunnel.r)); d = Math.max(d, -(q * 0.9 + (n3(x * 7, y * 7, z * 7) - 0.5) * 0.04)); }
    if (terrace) d *= 0.72;
    d = Math.max(d, floor - y, box(x, y, z, (bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2, (bb[3] - bb[0]) / 2, (bb[4] - bb[1]) / 2, (bb[5] - bb[2]) / 2));
    if (clip) d = Math.max(d, clip(x, y, z));
    T(d, id);
  });
}

// A bound bale: 0.9 x 0.45 x 0.36 m, pillowed, two loops of twine, one end a little loose. Long straw runs along x.
export function bale(x, y, z, { a = 0, hx = 0.45, hy = 0.225, hz = 0.18, name = "bale", seed = 1 } = {}) {
  const cy = y + hy;
  return prop(name, bbr(x, y - 0.02, z, hx + 0.05, y + 2 * hy + 0.05, hz + 0.05), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), dx = lx - x, dy = py - cy, dz = lz - z;
    const pil = 1 - 0.07 * (dy / hy) ** 2 - 0.05 * (dz / hz) ** 2, loose = dx > hx * 0.8 ? 0.03 * (n3(dy * 14, dz * 14, seed) - 0.3) : 0;
    const body = slab(lx, py, lz, [x, cy, z], [hx * pil + loose, hy, hz], 0.035) - (fb3(lx * 26 + seed, py * 26, lz * 26) - 0.5) * 0.016;
    T(body * 0.8, ID.bale);
    for (const s of [-0.2, 0.2]) { const ring = Math.max(Math.abs(dx - s) - 0.013, Math.abs(Math.max(Math.abs(dy) - hy + 0.03, Math.abs(dz) - hz + 0.03) + 0.03 - 0.038) - 0.01); T(ring, ID.rope); }
  });
}

// A bale that has burst at one end: the bale and a spill of loose straw running out from it.
export function brokenBale(x, y, z, o = {}) {
  return [bale(x, y, z, { ...o, name: "broken_bale" }), hayMound("straw_spill", [x - 0.2, 0, z - 0.4, x + 1.1, 0.3, z + 0.9], [[x + 0.45, z + 0.3, 0.2, 0.55], [x + 0.9, z + 0.1, 0.09, 0.4]], { tuft: 0.045, soft: 0.1 })];
}

// The last sheaf: a wheatsheaf tied with red cord, butt on the boards, ears in a fan at the top.
export function sheaf(x, y, z, { h = 0.95, name = "last_sheaf", lean = 0 } = {}) {
  return prop(name, [x - 0.4, y, z - 0.4, x + 0.4, y + h + 0.1, z + 0.4], (px, py, pz, T) => {
    const t = (py - y) / h, sx = px - x - lean * t * t, sz = pz - z, ang = Math.atan2(sz, sx);
    const r = (t < 0.4 ? 0.1 + 0.02 * t : 0.108 - 0.08 * (t - 0.4)) + (t > 0.4 ? 0.3 * (t - 0.4) ** 1.3 * (1 - 0.7 * Math.max(0, (t - 0.88) / 0.12)) : 0);
    const rr = r * (1 + 0.1 * Math.sin(ang * 13 + t * 3) + 0.06 * Math.sin(ang * 29 + 2)) , dd = Math.max((Math.hypot(sx, sz) - rr) * 0.8, y - py, py - (y + h));
    if (t < 0.8) T(dd, ID.stalk); else T(dd, ID.ear);
    const cord = Math.max(Math.abs(py - (y + 0.4 * h)) - 0.022, Math.abs(Math.hypot(sx, sz) - 0.108) - 0.008); T(cord, ID.red);
    T(cap(px, py, pz, [x + 0.09, y + 0.43 * h, z], [x + 0.19, y + 0.36 * h, z + 0.05], 0.007), ID.red);
  });
}

// A corn dolly: the woven harvest figure hung from a post: a plaited spiral of straw with ears at the head.
export function cornDolly(x, y, z, name = "corn_dolly") {
  return prop(name, [x - 0.2, y - 0.4, z - 0.2, x + 0.2, y + 0.1, z + 0.2], (px, py, pz, T) => {
    const t = (y - py) / 0.4, rr = 0.03 + 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 0.7, tw = Math.sin(Math.atan2(pz - z, px - x) * 4 + t * 26) * 0.012;
    T(Math.max((Math.hypot(px - x, pz - z) - rr - tw) * 0.8, py - y, y - 0.4 - py), ID.stalk);
    T(cap(px, py, pz, [x, y + 0.02, z], [x, y + 0.08, z], 0.004), ID.rope);
  });
}

// A drift of loose hay or chaff on the boards: a low pile, strands in its relief.
export const drift = (name, x, z, rx, rz, h, id = ID.hay) => hayMound(name, [x - rx, 0, z - rz, x + rx, h + 0.15, z + rz], [[x, z, h, h / Math.min(rx, rz) * 1.3]], { tuft: 0.02, id });

// Wisps: a scatter of single straws lying on the floor, each a thin capsule with its own length.
export function wisps(name, cx, cz, n, spread, seed = 1) {
  const items = [];
  for (let i = 0; i < n; i++) { const a = hash(i, seed, 1) * 6.283, r = Math.sqrt(hash(i, seed, 2)) * spread, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, t = hash(i, seed, 3) * 6.283, l = 0.1 + 0.16 * hash(i, seed, 4); items.push([[x - Math.cos(t) * l, 0.006 + 0.004 * hash(i, seed, 5), z - Math.sin(t) * l], [x + Math.cos(t) * l, 0.006 + 0.004 * hash(i, seed, 6), z + Math.sin(t) * l]]); }
  return prop(name, [cx - spread - 0.4, 0, cz - spread - 0.4, cx + spread + 0.4, 0.05, cz + spread + 0.4], (x, y, z, T) => { if (y > 0.2) return; for (const [a, b] of items) T(cap(x, y, z, a, b, 0.0045), ID.hay); });
}

// A three-tine hay fork stood or stuck: shaft of ash, iron collar and tines. base: foot point, tip: top of the shaft.
export function fork(base, top, name = "hay_fork", tines = 3) {
  const bb = [Math.min(base[0], top[0]) - 0.25, Math.min(base[1], top[1]) - 0.4, Math.min(base[2], top[2]) - 0.25, Math.max(base[0], top[0]) + 0.25, Math.max(base[1], top[1]) + 0.1, Math.max(base[2], top[2]) + 0.25];
  const ax = [top[0] - base[0], top[1] - base[1], top[2] - base[2]], L = Math.hypot(...ax), u = ax.map((q) => q / L);
  return prop(name, bb, (x, y, z, T) => {
    T(cap(x, y, z, base, top, 0.016) * 0.9, ID.oaky);
    const c = [base[0] - u[0] * 0.02, base[1] - u[1] * 0.02, base[2] - u[2] * 0.02];
    T(cap(x, y, z, base, [base[0] + u[0] * 0.1, base[1] + u[1] * 0.1, base[2] + u[2] * 0.1], 0.022), ID.iron);
    for (let i = 0; i < tines; i++) { const s = (i - (tines - 1) / 2) * 0.07, p0 = [c[0] + s, c[1], c[2]], p1 = [c[0] + s * 1.15, c[1] - u[1] * 0.32, c[2] - u[2] * 0.32]; T(cap(x, y, z, p0, p1, 0.007), ID.iron); }
    T(cap(x, y, z, [c[0] - 0.1, c[1], c[2]], [c[0] + 0.1, c[1], c[2]], 0.01), ID.iron);
  });
}

// A wooden hay rake leaned against something: long shaft, head bar with wooden teeth.
export function rake(base, top, name = "hay_rake") {
  const bb = [Math.min(base[0], top[0]) - 0.45, Math.min(base[1], top[1]) - 0.05, Math.min(base[2], top[2]) - 0.15, Math.max(base[0], top[0]) + 0.45, Math.max(base[1], top[1]) + 0.1, Math.max(base[2], top[2]) + 0.15];
  return prop(name, bb, (x, y, z, T) => {
    T(cap(x, y, z, base, top, 0.015) * 0.9, ID.oaky);
    const h0 = [base[0] - 0.4, base[1], base[2]], h1 = [base[0] + 0.4, base[1], base[2]]; T(cap(x, y, z, h0, h1, 0.018), ID.oakx);
    for (let i = 0; i < 9; i++) { const px = base[0] - 0.36 + i * 0.09; T(cap(x, y, z, [px, base[1], base[2]], [px, base[1] - 0.12, base[2] + 0.02], 0.007), ID.oaky); }
  });
}

void ell; void tcap; void chain; void lathe; void sstep; void sat; void cyl; void bbc;

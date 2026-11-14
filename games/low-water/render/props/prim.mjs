// Shared helpers for authored props: the prop record, yaw, revolved solids, rounded slabs. Original code (2026-10-23).
import { box, cyl, cap } from "../sdf.mjs";
import { rot } from "../kit/props.mjs";
export { rot };
export { box, cyl, cap, ell, sph, rbox, tcap } from "../sdf.mjs";
export { n3, fb3, hash, sstep, smax, smin } from "./noise.mjs";
export { ID } from "./kinds.mjs";

// A named prop: bb is [x0, y0, z0, x1, y1, z1]; f(x, y, z, T) records candidate surfaces through T(dist, id).
export const prop = (name, bb, f) => ({ name, bb, f });
export const bbc = (cx, cy, cz, hx, hy, hz) => [cx - hx, cy - hy, cz - hz, cx + hx, cy + hy, cz + hz];
// Rotated extent: a bb grown for a prop of half sizes (hx, hz) turned by any yaw.
export const bbr = (cx, y0, cz, hx, y1, hz) => { const r = Math.hypot(hx, hz); return [cx - r, y0, cz - r, cx + r, y1, cz + r]; };
// A solid of revolution about the y axis: radius prof(t) for t in 0..1 from y0 to y1 (a conservative distance).
export const lathe = (x, y, z, cx, y0, cz, y1, prof) => { const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0))); return Math.max((Math.hypot(x - cx, z - cz) - prof(t)) * 0.85, y0 - y, y - y1); };
// A thin sheet bent into folds: distance to a surface y = base + fold(u) of thickness th.
export const sheet = (y, base, th) => Math.abs(y - base) - th;
// A slab with rounded edges, axis-aligned, centre c, half sizes h.
export const slab = (x, y, z, c, h, r = 0.01) => { const qx = Math.abs(x - c[0]) - h[0] + r, qy = Math.abs(y - c[1]) - h[1] + r, qz = Math.abs(z - c[2]) - h[2] + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r; };
// A line of capsules through points (a chain, a rope, a bent rod).
export const chain = (x, y, z, pts, r) => { let d = 1e9; for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, cap(x, y, z, pts[i], pts[i + 1], r)); return d; };
export const sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export { cyl as cylinder };
export const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// local frame of a prop yawed by a about (cx, cz): returns [lx, lz]
export const yaw = (x, z, cx, cz, a) => rot(x, z, cx, cz, a);
void box;

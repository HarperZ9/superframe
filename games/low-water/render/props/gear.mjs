// Farm gear and hangings: the hooked lantern, sacks with folds, the rope coil, harness on a peg, the flail, the winnowing
// basket, the scythe, cobwebs, the pulley and hoist rope, a horse blanket. Original code (2026-10-23).
import { prop, bbc, bbr, rot, box, cyl, cap, ell, tcap, sph, slab, lathe, chain, n3, fb3, hash, sstep, ID, sat } from "./prim.mjs";

// A lantern hung on a chain from a hook: iron cage, glass chimney as an emitter, a cap and a ring. The light itself is
// pushed to the room's lamp list by the caller. drop: chain length above the cage.
export function hookLantern(x, y, z, { drop = 0.5, name = "hooked_lantern" } = {}) {
  return prop(name, [x - 0.16, y - 0.2, z - 0.16, x + 0.16, y + 0.2 + drop, z + 0.16], (px, py, pz, T) => {
    T(cyl(px, py, pz, x, y, z, 0.062, 0.1), ID.lantern);
    T(cyl(px, py, pz, x, y - 0.115, z, 0.085, 0.016), ID.iron);
    T(Math.max(tcap(px, py, pz, [x, y + 0.12, z], [x, y + 0.17, z], 0.09, 0.03), y + 0.1 - py), ID.iron);
    for (let i = 0; i < 4; i++) { const a = i * 1.5708 + 0.78, cx = x + Math.cos(a) * 0.072, cz = z + Math.sin(a) * 0.072; T(cap(px, py, pz, [cx, y - 0.11, cz], [cx, y + 0.115, cz], 0.0055), ID.iron); }
    T(Math.max(Math.abs(Math.hypot(px - x, py - (y + 0.17)) - 0.04) - 0.006, Math.abs(pz - z) - 0.006), ID.iron);
    let ch = 1e9; for (let k = 0; k < Math.floor(drop / 0.045); k++) { const yy = y + 0.21 + k * 0.045, q = k % 2 ? Math.hypot(px - x, pz - z - 0) : 0; void q; ch = Math.min(ch, k % 2 ? Math.max(Math.abs(Math.hypot(py - yy, pz - z) - 0.014) - 0.004, Math.abs(px - x) - 0.004) : Math.max(Math.abs(Math.hypot(py - yy, px - x) - 0.014) - 0.004, Math.abs(pz - z) - 0.004)); } T(ch, ID.iron);
  });
}
// An iron wall hook or a roof hook the lantern's chain ends in.
export const hook = (x, y, z, name = "iron_hook") => prop(name, bbc(x, y, z, 0.07, 0.07, 0.07), (px, py, pz, T) => T(chain(px, py, pz, [[x, y + 0.05, z], [x, y, z], [x + 0.03, y - 0.04, z], [x + 0.06, y - 0.02, z]], 0.007), ID.iron));
// A sack: a belly that sags, a tied or rolled neck, folds across, ears at the corners. open: rolled top showing grain.
export function sack(x, y, z, { s = 0.3, a = 0, open = false, seed = 1, name = "grain_sack", id = ID.sack } = {}) {
  return prop(name, bbr(x, y - 0.01, z, s * 1.05, y + s * 1.9, s * 0.85), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), dx = lx - x, dz = lz - z, t = (py - y) / (s * 1.7), sag = 1 - 0.16 * (2 * t - 1) ** 2;
    const fold = 0.014 * Math.sin(dx * 24 / s * 0.3 + t * 6 + seed) * (1 - t) + 0.01 * (n3(dx * 9, py * 9, dz * 9) - 0.5);
    let d = (Math.hypot(dx / (s * 0.95 * sag), dz / (s * 0.62 * sag)) - 1) * s * 0.55 - fold; d = Math.max(d, y - py, py - y - s * 1.55 * (open ? 0.8 : 1));
    if (t > 0.78) d = Math.max(Math.hypot(dx, dz) - (s * 0.3 + 0.2 * s * (1 - t) * 3 + s * 1.2 * Math.max(0, t - 0.93)) * 1 - 0.004 * Math.sin(Math.atan2(dz, dx) * 5), y - py, py - y - s * 1.7) * 0.8;
    T(d, id);
    if (!open && t > 0.8 && t < 0.95) T(Math.max(Math.abs(Math.hypot(dx, dz) - s * 0.25) - 0.012, Math.abs(py - y - s * 1.5) - 0.02), ID.rope);
  });
}
// A coil of rope lying on the boards: a stack of rings with a free end.
export function ropeCoil(x, y, z, { r = 0.16, n = 5, name = "rope_coil" } = {}) {
  return prop(name, bbc(x, y + 0.04, z, r + 0.2, 0.06, r + 0.2), (px, py, pz, T) => {
    const q = Math.hypot(px - x, pz - z);
    for (let i = 0; i < n; i++) T(Math.hypot(q - (r - i * 0.012), py - (y + 0.014 + (i % 2) * 0.012)) - 0.0125, ID.rope);
    T(cap(px, py, pz, [x + r - 0.05, y + 0.012, z], [x + r + 0.15, y + 0.008, z + 0.12], 0.011), ID.rope);
  });
}
// Harness on a peg: a collar, traces and a bridle: leather loops hung from an iron peg against the wall (-x or -z side).
export function harness(x, y, z, { name = "harness_on_peg", face = "z" } = {}) {
  return prop(name, bbc(x, y - 0.3, z, 0.3, 0.4, 0.3), (px, py, pz, T) => {
    const [u, w] = face === "z" ? [px - x, pz - z] : [pz - z, px - x];
    T(box(u, py, w, 0, y, 0.04, 0.012, 0.012, 0.05), ID.iron);
    T(Math.max(Math.abs(Math.hypot(u, py - (y - 0.28)) - 0.17) - 0.045, Math.abs(w - 0.07) - 0.045 * (1 + 0.3 * Math.cos(u * 8))), ID.leather);
    T(chain(u, py, w, [[0.0, y, 0.07], [0.02, y - 0.35, 0.09], [-0.05, y - 0.6, 0.08]], 0.011), ID.leather);
    T(box(u, py, w, 0.0, y - 0.5, 0.09, 0.07, 0.01, 0.003), ID.brass);
  });
}
// A flail: the hand-staff, the swingle and the leather hinge between; lying on the floor.
export function flail(x, y, z, { a = 0.4, name = "threshing_flail" } = {}) {
  return prop(name, bbr(x, y, z, 0.95, y + 0.1, 0.2), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a);
    T(cap(lx, py, lz, [x - 0.7, y + 0.025, z], [x + 0.2, y + 0.025, z], 0.019) * 0.95, ID.oakx);
    T(cap(lx, py, lz, [x + 0.22, y + 0.02, z + 0.02], [x + 0.35, y + 0.02, z + 0.03], 0.007), ID.leather);
    T(cap(lx, py, lz, [x + 0.37, y + 0.025, z + 0.02], [x + 0.93, y + 0.025, z + 0.1], 0.025) * 0.95, ID.oakx);
  });
}
// A winnowing basket: a shallow wicker tray with a rim and a handle; a handful of grain in it.
export function winnowBasket(x, y, z, { a = 0, r = 0.34, name = "winnowing_basket" } = {}) {
  return prop(name, bbr(x, y, z, r + 0.08, y + 0.14, r + 0.08), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), dx = lx - x, dz = lz - z, rr = Math.hypot(dx, dz), t = sat((py - y) / 0.11), rOut = r * (0.7 + 0.3 * t);
    const outer = Math.max((rr - rOut) * 0.9, y - py, py - y - 0.11), inner = Math.max((rr - (rOut - 0.025)) * 0.9, y + 0.02 - py);
    T(Math.max(outer, -inner), ID.wicker);
    T(cap(lx, py, lz, [x - r * 0.95, y + 0.09, z - 0.07], [x - r * 1.08, y + 0.1, z + 0.07], 0.014), ID.wicker);
    T(Math.max(ell(lx, py, lz, x + 0.05, y + 0.04, z, r * 0.5, 0.04, r * 0.42), y + 0.02 - py) * 0.9, ID.ear);
  });
}
// A scythe hung blade-up from the wall: the snath (curved handle), the nibs, the blade.
export function scythe(x, y, z, { name = "hung_scythe", len = 1.5 } = {}) {
  return prop(name, bbc(x + len * 0.2, y, z, len * 0.55, 0.5, 0.15), (px, py, pz, T) => {
    const pts = [[x - len * 0.3, y - 0.35, z + 0.06], [x - len * 0.1, y - 0.15, z + 0.06], [x + len * 0.15, y, z + 0.06], [x + len * 0.45, y + 0.12, z + 0.06]];
    T(chain(px, py, pz, pts, 0.017), ID.oakx);
    T(box(px, py, pz, x + len * 0.22, y + 0.07, z + 0.075, len * 0.5, 0.03, 0.002), ID.iron);
    T(box(px, py, pz, x - len * 0.18, y - 0.22, z + 0.09, 0.012, 0.03, 0.012), ID.oaky);
  });
}
// A cobweb in an upper corner: radial threads out from the corner along two wall planes and a few cross strands.
export function cobweb(corner, ex, ez, { size = 0.5, name = "cobweb", seed = 1, sag = 0.12 } = {}) {
  const th = [], N = 5;
  for (let i = 0; i < N; i++) { const t = i / (N - 1), p = [corner[0] + ex[0] * size * t + ez[0] * size * (1 - t) * 0, corner[1] - size * (0.2 + 0.8 * hash(i, seed, 1)), corner[2] + ez[2] * size * t]; th.push([corner, [corner[0] + ex[0] * size * t, corner[1] - size * (0.4 + 0.6 * hash(i, seed, 2)), corner[2] + ez[2] * size * (1 - t)]]); void p; }
  return prop(name, [corner[0] - size - 0.1, corner[1] - size - 0.1, corner[2] - size - 0.1, corner[0] + size + 0.1, corner[1] + 0.1, corner[2] + size + 0.1], (x, y, z, T) => {
    let d = 1e9; for (const [a, b] of th) d = Math.min(d, cap(x, y, z, a, b, 0.0035));
    for (let i = 1; i < th.length; i++) { const a = th[i - 1][1], b = th[i][1], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag * size, (a[2] + b[2]) / 2]; d = Math.min(d, cap(x, y, z, a, m, 0.003), cap(x, y, z, m, b, 0.003)); }
    T(d, ID.web);
  });
}
// A pulley block hung from a hoist beam, with the rope running down to a hook: the loading door's lifting tackle.
export function hoist(x, y, z, { drop = 1.1, name = "hoist_pulley" } = {}) {
  return prop(name, [x - 0.2, y - drop - 0.15, z - 0.2, x + 0.2, y + 0.1, z + 0.2], (px, py, pz, T) => {
    T(box(px, py, pz, x, y - 0.1, z, 0.1, 0.1, 0.045) * 0.9, ID.oakx);
    T(cyl(px, pz, py, x, z, y - 0.1, 0.085, 0.022), ID.iron);
    T(cap(px, py, pz, [x, y - 0.1, z - 0.07], [x, y - 0.1, z + 0.07], 0.012), ID.iron);
    T(cap(px, py, pz, [x, y - 0.2, z], [x, y - drop, z], 0.012) - (n3(py * 60, 0, 0) - 0.5) * 0.004, ID.rope);
    T(chain(px, py, pz, [[x, y - drop, z], [x + 0.03, y - drop - 0.06, z], [x, y - drop - 0.1, z]], 0.008), ID.iron);
  });
}
// A folded horse blanket on a rail or the floor: layered, striped at the border.
export function blanket(x, y, z, { a = 0, name = "horse_blanket" } = {}) {
  return prop(name, bbr(x, y, z, 0.4, y + 0.14, 0.3), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), dx = lx - x, dz = lz - z, folds = 0.012 * Math.sin(dx * 30);
    T(Math.max(slab(lx, py, lz, [x, y + 0.045, z], [0.36, 0.045, 0.26], 0.02) - folds * 0.5 - (fb3(lx * 14, py * 14, lz * 14) - 0.5) * 0.01, y - 0.003 - py), Math.abs(dz) > 0.22 ? ID.red : ID.canvas);
  });
}
void bbr; void lathe; void sph; void sstep;

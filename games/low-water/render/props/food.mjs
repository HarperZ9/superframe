// Table props: bread, jugs, cups, plates, fruit, the linen cloth with its folds, candles. Each is a small authored solid
// with its own surface (crust split along a score, flour dust, fold shadows). Original code (2026-10-23).
import { prop, bbr, bbc, rot, box, cyl, cap, ell, sph, slab, lathe, n3, fb3, hash, sstep, ID, sat } from "./prim.mjs";

// A round loaf: a squashed dome with a crown of scoring slashes that split and rise, flour on the top.
export function loaf(x, y, z, { a = 0, r = 0.13, h = 0.085, name = "round_loaf", seed = 1 } = {}) {
  return prop(name, bbr(x, y - 0.01, z, r + 0.02, y + h * 2 + 0.03, r + 0.02), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), dx = lx - x, dz = lz - z, dy = py - (y + h * 0.55);
    let d = (Math.hypot(dx / r, dy / h, dz / (r * 0.92)) - 1) * h * 0.85 - (fb3(lx * 40 + seed, py * 40, lz * 40) - 0.5) * 0.006;
    const sl = (dx * 0.7 + dz * 0.7) / 0.06, fr = Math.abs(sl - Math.floor(sl) - 0.5) * 0.06;
    if (dy > 0.1 * h) d += 0.01 * (1 - sstep(0, 0.006, fr));
    T(Math.max(d, y - 0.004 - py), ID.crust);
  });
}
// A plaited loaf: long, with the plait as diagonal ridges.
export function plait(x, y, z, { a = 0, name = "plaited_loaf" } = {}) {
  return prop(name, bbr(x, y - 0.01, z, 0.24, y + 0.1, 0.24), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), dx = lx - x, dz = lz - z, w = 0.075 * (1 - (dx / 0.23) ** 2) ** 0.5 + 0.01;
    const braid = 0.012 * Math.sin(dx * 70 + dz * 55) * Math.sin(dx * 70 - dz * 55 + 1);
    const d = (Math.hypot(dz / 0.095, (py - y - 0.04) / 0.05) - 1) * 0.04 - braid + Math.max(0, Math.abs(dx) - 0.22) * 0.8;
    T(Math.max(d, y - 0.004 - py, Math.abs(dz) - w - 0.03), ID.crust);
  });
}
// A cut loaf on its board: crust, crumb face and two slices fallen over.
export function cutLoaf(x, y, z, { a = 0, name = "cut_loaf" } = {}) {
  return prop(name, bbr(x, y, z, 0.3, y + 0.14, 0.3), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), dx = lx - x, dz = lz - z, dy = py - y - 0.015;
    const body = (Math.hypot(dz / 0.085, dy / 0.065) - 1) * 0.06, loafD = Math.max(body, Math.abs(dx) - 0.14, y - py);
    T(loafD, Math.abs(dx - 0.14) < 0.012 ? ID.crumb : ID.crust);
    for (let i = 0; i < 2; i++) { const sx = 0.2 + i * 0.045, ang = 0.4 + 0.35 * i; T(Math.max((Math.hypot(dz / 0.08, (dy - 0.02 * i - 0.03) / 0.06) - 1) * 0.05, Math.abs(dx - sx - 0.02 * Math.sin(ang)) - 0.011), ID.crumb); }
  });
}
// A jug: belly, neck, lip, a looped handle; its mouth is open and dark inside.
export function jug(x, y, z, { s = 1, name = "clay_jug", a = 0 } = {}) {
  const h = 0.27 * s, prof = (t) => s * (t < 0.12 ? 0.045 + 0.4 * t : 0.05 + 0.05 * Math.sin(Math.min(1, (t - 0.1) / 0.55) * Math.PI) ** 0.8 * (t < 0.65 ? 1 : 0.0) + (t >= 0.65 ? Math.max(0.02, 0.05 - 0.035 * (t - 0.65) * 3) : 0) + (t > 0.93 ? 0.015 : 0));
  return prop(name, bbr(x, y, z, 0.16 * s, y + h + 0.03, 0.16 * s), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a); let d = lathe(lx, py, lz, x, y, z, y + h, prof);
    d = Math.max(d, -cyl(lx, py, lz, x, y + h, z, 0.025 * s, 0.03));
    T(d, ID.clay);
    const hp = [[x + 0.045 * s, y + h * 0.82, z], [x + 0.085 * s, y + h * 0.78, z], [x + 0.09 * s, y + h * 0.45, z], [x + 0.06 * s, y + h * 0.28, z]];
    let dh = 1e9; for (let i = 0; i < 3; i++) dh = Math.min(dh, cap(lx, py, lz, hp[i], hp[i + 1], 0.011 * s)); T(dh, ID.clay);
  });
}
// A pewter or wooden cup, tapering, hollow.
export function cup(x, y, z, { id = ID.pewter, name = "pewter_cup", s = 1 } = {}) {
  return prop(name, bbc(x, y + 0.05 * s, z, 0.07 * s, 0.06 * s, 0.07 * s), (px, py, pz, T) => {
    let d = lathe(px, py, pz, x, y, z, y + 0.095 * s, (t) => s * (0.032 + 0.016 * t + (t > 0.95 ? 0.004 : 0)));
    d = Math.max(d, -cyl(px, py, pz, x, y + 0.1 * s, z, 0.04 * s, 0.075 * s)); T(d, id);
    T(cap(px, py, pz, [x + 0.045 * s, y + 0.07 * s, z], [x + 0.07 * s, y + 0.045 * s, z], 0.006 * s), id);
  });
}
// A pewter plate, dished.
export function plate(x, y, z, { r = 0.13, name = "pewter_plate", id = ID.pewter } = {}) {
  return prop(name, bbc(x, y + 0.01, z, r + 0.01, 0.02, r + 0.01), (px, py, pz, T) => T(Math.max(cyl(px, py, pz, x, y + 0.008, z, r, 0.008), -sph(px, py, pz, x, y + 0.008 + 0.3, z, 0.3 - 0.008)), id));
}
// A wooden trencher with bread or cheese on it.
export function trencher(x, y, z, { a = 0, name = "wood_trencher" } = {}) {
  return prop(name, bbr(x, y, z, 0.25, y + 0.04, 0.17), (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); T(Math.max(slab(lx, py, lz, [x, y + 0.012, z], [0.23, 0.012, 0.15], 0.01), -sph(lx, py, lz, x, y + 0.5, z, 0.49) * 0) - 0, ID.oakx); });
}
// A wedge of cheese with a rind: a cylinder section cut by two planes.
export function cheese(x, y, z, { a = 0, name = "cheese_wedge" } = {}) {
  return prop(name, bbr(x, y, z, 0.14, y + 0.08, 0.14), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), dx = lx - x, dz = lz - z, ang = Math.atan2(dz, dx), r = Math.hypot(dx, dz);
    const d = Math.max(r - 0.12, Math.abs(py - y - 0.035) - 0.035, Math.abs(ang - 0.4) - 0.4);
    T(d * 0.8, r > 0.112 ? ID.mustard : ID.crumb);
  });
}
// A pear, whole, with a stalk; and wedge slices of one cut eight ways.
export function pear(x, y, z, { name = "pear", s = 1 } = {}) {
  return prop(name, bbc(x, y + 0.06 * s, z, 0.05 * s, 0.075 * s, 0.05 * s), (px, py, pz, T) => {
    T(lathe(px, py, pz, x, y, z, y + 0.11 * s, (t) => s * (0.012 + 0.047 * Math.sin(Math.PI * Math.pow(t, 0.62)) * (t < 0.85 ? 1 : 0.4))), ID.fruit);
    T(cap(px, py, pz, [x, y + 0.105 * s, z], [x + 0.01 * s, y + 0.135 * s, z], 0.0035 * s), ID.leather);
  });
}
export function pearSlices(x, y, z, { name = "pear_slices" } = {}) {
  return prop(name, bbc(x, y + 0.02, z, 0.12, 0.03, 0.08), (px, py, pz, T) => { for (let i = 0; i < 5; i++) { const sx = x - 0.08 + i * 0.04, tilt = 0.4 * (hash(i, 3, 1) - 0.5); T(Math.max((Math.hypot((px - sx) / 0.014, (py - y - 0.015) / 0.016, (pz - z - tilt * 0.05) / 0.04) - 1) * 0.012, y - py), i % 2 ? ID.crumb : ID.fruit); } });
}
// A table knife.
export const knife = (x, y, z, a = 0.5) => prop("table_knife", bbr(x, y, z, 0.12, y + 0.02, 0.12), (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); T(box(lx, py, lz, x + 0.03, y + 0.004, z, 0.065, 0.0025, 0.009), ID.iron); T(cyl(lx, py, lz, x - 0.065, y + 0.008, z, 0.011, 0.045) * 0 + box(lx, py, lz, x - 0.09, y + 0.009, z, 0.045, 0.009, 0.011), ID.oakx); });
// A bowl of apples: a turned wooden bowl and a heap of fruit.
export function appleBowl(x, y, z, { name = "apple_bowl" } = {}) {
  return prop(name, bbc(x, y + 0.07, z, 0.17, 0.09, 0.17), (px, py, pz, T) => {
    T(Math.max(lathe(px, py, pz, x, y, z, y + 0.07, (t) => 0.06 + 0.1 * t), -sph(px, py, pz, x, y + 0.2, z, 0.14)), ID.oakx);
    for (let i = 0; i < 7; i++) { const a = i * 2.4, r = i === 0 ? 0 : 0.06, ay = i === 0 ? 0.1 : 0.075 + 0.01 * (i % 2); T(sph(px, py, pz, x + Math.cos(a) * r, y + ay, z + Math.sin(a) * r, 0.038 + 0.004 * hash(i, 1, 1)) - (n3(px * 40, py * 40, pz * 40) - 0.5) * 0.004, ID.fruit); }
  });
}
// A candle in a pewter dish; the flame is a small emitter.
export function candle(x, y, z, { name = "candle_dish", lit = true } = {}) {
  return prop(name, bbc(x, y + 0.06, z, 0.06, 0.08, 0.06), (px, py, pz, T) => {
    T(Math.max(cyl(px, py, pz, x, y + 0.005, z, 0.05, 0.005), -sph(px, py, pz, x, y + 0.2, z, 0.195)), ID.pewter);
    T(cyl(px, py, pz, x, y + 0.04, z, 0.011, 0.035) - (py > y + 0.06 ? 0.002 : 0), ID.wax);
    if (lit) T(ell(px, py, pz, x, y + 0.092, z, 0.007, 0.016, 0.007), ID.candle);
  });
}
// The cloth: a linen sheet over a table top with a drop at each side, in vertical folds, a hem, and a corner that has
// been tugged. top: y of the table; half: [hx, hz]; drop: how far it hangs.
export function cloth(cx, top, cz, hx, hz, { drop = 0.2, name = "linen_cloth", seed = 1 } = {}) {
  return prop(name, [cx - hx - 0.1, top - drop - 0.05, cz - hz - 0.1, cx + hx + 0.1, top + 0.03, cz + hz + 0.1], (x, y, z, T) => {
    const dx = x - cx, dz = z - cz, th = 0.006;
    const fold = 0.014 * Math.sin(dx * 11 + 2 * n3(dx * 2, 0, seed)) + 0.008 * Math.sin(dx * 23 + dz * 3 + 1);
    // top sheet, gently wrinkled
    const wr = 0.004 * (fb3(dx * 6, 0, dz * 6) - 0.5) * 2 + 0.0035 * Math.sin(dz * 20 + dx * 4);
    const topD = Math.max(Math.abs(y - top - 0.007 - wr) - th, Math.abs(dx) - hx, Math.abs(dz) - hz);
    // side drops: z faces hang with folds, bulging out toward the bottom
    const sgn = dz > 0 ? 1 : -1, edge = hz + fold * (0.6 + (top - y) / drop) + 0.012 * sat((top - y) / drop), sideD = Math.max(Math.abs(Math.abs(dz) - edge) - th, y - top, top - drop - y, Math.abs(dx) - hx);
    // end drops, shorter, gathered
    const edgeX = hx + 0.5 * fold * (0.4 + (top - y) / drop), endD = Math.max(Math.abs(Math.abs(dx) - edgeX) - th, y - top, top - drop * 0.8 - y, Math.abs(dz) - hz);
    void sgn; T(Math.min(topD, sideD, endD) * 0.85, ID.cloth);
  });
}
// A runner of oxblood across the cloth, for one hot mark on the table.
export const runner = (cx, top, cz, hx, hz) => prop("cloth_runner", [cx - hx, top, cz - hz, cx + hx, top + 0.02, cz + hz], (x, y, z, T) => T(Math.max(Math.abs(y - top - 0.011 - 0.003 * Math.sin(x * 20)) - 0.004, Math.abs(x - cx) - hx, Math.abs(z - cz) - hz), ID.red));
void fb3; void ell;

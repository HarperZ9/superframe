// Mill and store props for Orme's back store: the beam scale and its weights, the high desk with the open ledger, the hand
// cart, spilled grain, Kel Tesk's boots, the foreman's strap on its nail, the window frame, a broom and a scoop, a pallet,
// a jar shelf. Original code (2026-10-23).
// Parameters (x, z floor positions in metres, y up, a a yaw in radians; every prop is prop(name, bb, f) from prim.mjs):
//   beamScale(x, z, {name})            post, cross beam, two chained brass pans; 1.6 m wide, 2 m high
//   weights(x, z, {name})              a stack of three iron weights and one standing beside it
//   highDesk(x, z, {name})             sloped-top desk 1.2 x 0.7 m, an open ledger with ribbon, inkwell and pen, a shelf under
//   handCart(x, z, {a=0.3, name})      plank bed, two spoked wheels, shafts (about 2.1 m long)
//   spilledGrain(x, z, r=0.4, name)    a low cone of grain kernels, radius r
//   boots(x, z, {name})                a pair, one fallen
//   strapOnNail(x, y, z, {name})       a leather strap hanging on a nail from a -z wall at height y
//   windowFrame(x, y, z, w=0.8, h=0.76, {name})   sill, jambs, mullion and a pushed-back shutter, set in a -x wall
//   broom(base, top, name)             base and top are [x, y, z] points of the handle; scoop(x, z, a)
//   pallet(x, z, hx, hz)               planks on two runners, half sizes hx, hz; jarShelf(x, y, z, {name}) four jars on a bracketed shelf at a -z wall
import { prop, bbc, bbr, rot, box, cyl, cap, ell, slab, lathe, chain, n3, fb3, hash, sstep, ID } from "./prim.mjs";
import { hayMound } from "./straw.mjs";

// The beam scale: a post, a cross beam on a pivot, two chains to two pans, iron weights stacked beside it.
export function beamScale(x, z, { name = "beam_scale" } = {}) {
  return prop(name, [x - 0.8, 0, z - 0.4, x + 0.8, 2.0, z + 0.4], (px, py, pz, T) => {
    T(slab(px, py, pz, [x, 0.9, z], [0.045, 0.9, 0.045], 0.01), ID.oaky); T(slab(px, py, pz, [x, 0.04, z], [0.22, 0.04, 0.16], 0.01), ID.oakx);
    T(slab(px, py, pz, [x, 1.78, z], [0.62, 0.022, 0.016], 0.006), ID.iron); T(cyl(px, pz, py, x, z, 1.78, 0.03, 0.03), ID.brass);
    for (const s of [-1, 1]) { const cx = x + s * 0.58; T(cap(px, py, pz, [cx, 1.76, z], [cx - s * 0.17, 0.74, z], 0.005), ID.iron); T(cap(px, py, pz, [cx, 1.76, z], [cx + s * 0.17, 0.74, z], 0.005), ID.iron); T(Math.max(cyl(px, py, pz, cx, 0.72, z, 0.2, 0.014), -(Math.hypot(px - cx, py - 0.95, pz - z) < 0.23 ? 0 : 1) * 0 - 0), ID.brass); }
  });
}
export function weights(x, z, { name = "iron_weights" } = {}) {
  return prop(name, bbc(x, 0.15, z, 0.2, 0.2, 0.2), (px, py, pz, T) => { for (let k = 0; k < 4; k++) { T(lathe(px, py, pz, x + (k > 2 ? 0.17 : 0), 0.015 + k * 0.075 * (k > 2 ? 0 : 1), z + (k > 2 ? 0.12 : 0), 0.015 + k * 0.075 * (k > 2 ? 0 : 1) + 0.07, (t) => 0.09 - k * 0.012 * (k > 2 ? 0 : 1) + 0.01 * Math.sin(t * 3.1)), ID.iron); } });
}
// The high desk: sloped top, legs, a stretcher; the ledger open on it with a ribbon, an inkwell, a pen.
export function highDesk(x, z, { name = "high_desk" } = {}) {
  return prop(name, [x - 0.8, 0, z - 0.5, x + 0.8, 1.45, z + 0.5], (px, py, pz, T) => {
    const dz = pz - z, tilt = 1.12 - dz * 0.12;
    T(Math.max(Math.abs(py - tilt) - 0.025, Math.abs(px - x) - 0.62, Math.abs(dz) - 0.36) * 0.9, ID.oakx);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) T(cap(px, py, pz, [x + sx * 0.56, 1.08 - sz * 0.04, z + sz * 0.3], [x + sx * 0.6, 0, z + sz * 0.33], 0.032), ID.oaky);
    T(slab(px, py, pz, [x, 0.35, z + 0.32], [0.58, 0.02, 0.03], 0.005), ID.oakx); T(slab(px, py, pz, [x, 0.5, z], [0.55, 0.015, 0.28], 0.005), ID.oakx);
    T(Math.max(Math.abs(py - (tilt + 0.034 + 0.01 * Math.sin(px * 9))) - 0.01, Math.abs(px - x + 0.1) - 0.3, Math.abs(dz) - 0.2) * 0.9, ID.paper); T(box(px, py, pz, x - 0.1, tilt + 0.036, z, 0.004, 0.012, 0.2), ID.oakz);
    T(box(px, py, pz, x + 0.3, tilt + 0.05, z - 0.18, 0.012, 0.025, 0.012), ID.red); T(cyl(px, py, pz, x + 0.46, tilt + 0.04, z + 0.12, 0.028, 0.025), ID.pewter);
    T(cap(px, py, pz, [x + 0.46, tilt + 0.06, z + 0.12], [x + 0.55, tilt + 0.2, z + 0.1], 0.004), ID.oakz);
    T(chain(px, py, pz, [[x - 0.45, tilt + 0.04, z - 0.1], [x - 0.5, tilt + 0.03, z + 0.05]], 0.004), ID.red);
  });
}
// A hand cart: plank bed, two spoked wheels, shafts.
export function handCart(x, z, { a = 0.3, name = "hand_cart" } = {}) {
  return prop(name, bbr(x, 0, z, 1.1, 1.0, 0.8), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a);
    T(slab(lx, py, lz, [x, 0.5, z], [0.6, 0.03, 0.4], 0.008), ID.oakx); for (const s of [-1, 1]) T(slab(lx, py, lz, [x, 0.6, z + s * 0.4], [0.6, 0.1, 0.015], 0.005), ID.oakx);
    T(slab(lx, py, lz, [x - 0.6, 0.62, z], [0.015, 0.1, 0.4], 0.005), ID.oakx);
    for (const s of [-1, 1]) { const wz = z + s * 0.47, q = Math.hypot(lx - x, py - 0.36); T(Math.max(Math.abs(q - 0.3) - 0.022, Math.abs(lz - wz) - 0.03), ID.iron); for (let k = 0; k < 6; k++) { const t = k * 1.047; T(cap(lx, py, lz, [x, 0.36, wz], [x + Math.cos(t) * 0.3, 0.36 + Math.sin(t) * 0.3, wz], 0.012), ID.oakx); } T(cyl(lz, lx, py, wz, x, 0.36, 0.045, 0.045), ID.oaky); }
    for (const s of [-1, 1]) T(cap(lx, py, lz, [x + 0.5, 0.5, z + s * 0.3], [x + 1.05, 0.62, z + s * 0.24], 0.022), ID.oakx);
  });
}
// Spilled grain: a low cone of kernels from a slit sack.
export const spilledGrain = (x, z, r = 0.4, name = "spilled_grain") => hayMound(name, [x - r, 0, z - r, x + r, 0.2, z + r], [[x, z, 0.1, 0.35]], { tuft: 0.012, soft: 0.12, id: ID.grain });
// Boots: a pair standing slightly apart, one fallen. Kel Tesk's, with sweepings in them.
export function boots(x, z, { name = "kels_boots" } = {}) {
  return prop(name, bbc(x, 0.15, z, 0.3, 0.17, 0.3), (px, py, pz, T) => {
    T(Math.max(Math.hypot((px - x) / 0.07, (pz - z) / 0.14, 0) - 1, py - 0.3) * 0.07, ID.leather); T(Math.max(cyl(px, py, pz, x, 0.18, z - 0.05, 0.06, 0.12) * 0.9, -cyl(px, py, pz, x, 0.34, z - 0.05, 0.045, 0.1)), ID.leather);
    T(box(px, py, pz, x, 0.03, z + 0.03, 0.065, 0.03, 0.14) * 0.9, ID.leather);
    T(Math.max(cyl(px, py, pz, x + 0.2, 0.06, z + 0.05, 0.055, 0.12) * 0.9, 0) * 0 + Math.max(Math.hypot(py - 0.06, pz - z - 0.05) - 0.06, Math.abs(px - x - 0.2) - 0.13), ID.leather);
    T(Math.max(Math.hypot(px - x, pz - z + 0.05) - 0.03, py - 0.36) * 0 + (hash(Math.floor(px * 60), Math.floor(pz * 60), 3) > 0.8 ? 0.01 : 1) * 0 + 1, ID.grain);
  });
}
// The foreman's strap on a nail on the back wall (z face), hanging in a loop.
export function strapOnNail(x, y, z, { name = "foremans_strap" } = {}) {
  return prop(name, bbc(x, y - 0.3, z + 0.05, 0.15, 0.4, 0.12), (px, py, pz, T) => {
    T(cap(px, py, pz, [x, y, z], [x, y, z + 0.06], 0.01), ID.iron); T(chain(px, py, pz, [[x - 0.03, y - 0.02, z + 0.07], [x - 0.08, y - 0.25, z + 0.07], [x, y - 0.5, z + 0.065], [x + 0.08, y - 0.25, z + 0.07], [x + 0.03, y - 0.02, z + 0.07]], 0.012), ID.leather);
    T(box(px, py, pz, x - 0.08, y - 0.5, z + 0.065, 0.02, 0.02, 0.006), ID.brass);
  });
}
// A window frame cut low in the west wall (x face): sill, jambs, one mullion and a shutter leaf pushed back.
export function windowFrame(x, y, z, w = 0.8, h = 0.76, { name = "mill_window_frame" } = {}) {
  return prop(name, bbc(x, y, z, 0.12, h / 2 + 0.1, w / 2 + 0.1), (px, py, pz, T) => {
    T(slab(px, py, pz, [x, y - h / 2 - 0.03, z], [0.12, 0.03, w / 2 + 0.07], 0.006), ID.oakz); T(slab(px, py, pz, [x, y + h / 2 + 0.03, z], [0.09, 0.03, w / 2 + 0.07], 0.006), ID.oakz);
    for (const s of [-1, 1]) T(slab(px, py, pz, [x, y, z + s * (w / 2 + 0.03)], [0.09, h / 2, 0.03], 0.006), ID.oaky); T(slab(px, py, pz, [x, y, z], [0.03, h / 2, 0.015], 0.004), ID.oaky);
    T(slab(px, py, pz, [x + 0.07, y, z - w / 2 - 0.2], [0.012, h / 2, 0.19], 0.004), ID.greyy);
  });
}
// A broom leaned against the wall and a grain scoop on the floor.
export function broom(base, top, name = "straw_broom") {
  return prop(name, bbc((base[0] + top[0]) / 2, 0.8, (base[2] + top[2]) / 2, 0.3, 0.95, 0.3), (px, py, pz, T) => {
    T(cap(px, py, pz, base, top, 0.014), ID.oaky); T(Math.max(ell(px, py, pz, base[0], base[1] + 0.12, base[2], 0.08, 0.17, 0.05), -(py - base[1] + 0.05)) * 0.8 - (fb3(px * 50, py * 50, pz * 50) - 0.5) * 0.01, ID.hay);
  });
}
export const scoop = (x, z, a = 0.5) => prop("grain_scoop", bbr(x, 0, z, 0.3, 0.1, 0.3), (px, py, pz, T) => { const [lx, lz] = rot(px, pz, x, z, a); T(Math.max(slab(lx, py, lz, [x, 0.05, z], [0.12, 0.05, 0.09], 0.01), -slab(lx, py, lz, [x, 0.075, z], [0.1, 0.05, 0.07], 0.01)), ID.oakx); T(cap(lx, py, lz, [x + 0.1, 0.07, z], [x + 0.3, 0.05, z], 0.014), ID.oakx); });
// A low pallet of planks the sacks stand on, off the damp.
export const pallet = (x, z, hx, hz) => prop("plank_pallet", bbc(x, 0.05, z, hx, 0.07, hz), (px, py, pz, T) => { for (let k = -2; k <= 2; k++) T(slab(px, py, pz, [x, 0.06, z + k * (hz / 2.5)], [hx, 0.012, hz / 5 - 0.008], 0.004), ID.greyx); for (const s of [-1, 1]) T(slab(px, py, pz, [x + s * (hx - 0.1), 0.025, z], [0.04, 0.025, hz], 0.004), ID.oakz); });
// A shelf of stone jars on two brackets on the back wall.
export function jarShelf(x, y, z, { name = "jar_shelf" } = {}) {
  return prop(name, bbc(x, y + 0.1, z + 0.1, 0.5, 0.2, 0.15), (px, py, pz, T) => {
    T(slab(px, py, pz, [x, y, z + 0.1], [0.45, 0.014, 0.1], 0.004), ID.oakx); for (const s of [-1, 1]) T(slab(px, py, pz, [x + s * 0.38, y - 0.06, z + 0.07], [0.012, 0.06, 0.07], 0.003), ID.iron);
    for (let k = 0; k < 4; k++) { const jx = x - 0.32 + k * 0.21, hh = 0.14 + 0.03 * (k % 2); T(lathe(px, py, pz, jx, y + 0.014, z + 0.1, y + 0.014 + hh, (t) => 0.055 + 0.03 * Math.sin(t * 3)), ID.clay); }
  });
}
void n3; void sstep;

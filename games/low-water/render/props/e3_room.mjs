// Era 3 props (Allocation, year 20; design/eras/era3.md sections 5 and 7), plates package, 2026-10-22. Rooms of a
// town rebuilt by allocation: bare bulbs on flex, iron hospital cots, folding screens, school desks with the
// schoolbook open, the allocation counter and its register shelf, pews, a pulpit, a hall mirror, chalked crosses,
// a rifle rack, the cut photograph. Built on the authored library's helpers (prim.mjs, kinds.mjs); new file, the
// environment agent's prop files are not edited. Original code.
import { prop, bbc, bbr, rot, box, cyl, cap, ell, sph, slab, chain, n3, fb3, hash, sstep, ID } from "./prim.mjs";

// A bare bulb on its flex from the ceiling, a brass holder, the glass a little sooted. Returns [prop, light].
export function bulb(x, top, y, z, { I = 9, name = "bare_bulb", reach = 7, group = "lantern" } = {}) {
  const p = prop(name, bbc(x, (top + y) / 2, z, 0.08, (top - y) / 2 + 0.08, 0.08), (px, py, pz, T) => {
    T(cap(px, py, pz, [x, top, z], [x + 0.01, y + 0.1, z], 0.005), ID.tar);
    T(cyl(px, py, pz, x + 0.01, y + 0.08, z, 0.022, 0.035), ID.brass);
    T(ell(px, py, pz, x + 0.01, y, z, 0.04, 0.055, 0.04), ID.lantern);
  });
  return [p, { pos: [x + 0.01, y - 0.04, z], type: 1, I, reach, key: `${name}@${x.toFixed(1)},${z.toFixed(1)}`, group }];
}
// A bentwood chair: round seat, splayed legs with a ring, a hooped back. a: the way the back faces (radians).
export function chair(x, z, { a = 0, name = "bentwood_chair", id = ID.darkwood } = {}) {
  return prop(name, bbr(x, 0, z, 0.3, 0.95, 0.3), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a);
    T(cyl(lx, py, lz, x, 0.45, z, 0.19, 0.018), id);
    for (let i = 0; i < 4; i++) { const t = i * 1.5708 + 0.785; T(cap(lx, py, lz, [x + Math.cos(t) * 0.14, 0.44, z + Math.sin(t) * 0.14], [x + Math.cos(t) * 0.19, 0, z + Math.sin(t) * 0.19], 0.014), id); }
    T(Math.abs(Math.hypot(lx - x, lz - z) - 0.16) - 0.008 + Math.max(0, Math.abs(py - 0.2) - 0.008), id);
    T(Math.max(Math.abs(Math.hypot(lx - x, (py - 0.72) * 0.8) - 0.17) - 0.012, Math.abs(lz - z + 0.17) - 0.012, 0.45 - py), id);
  });
}
// An iron hospital cot: tube frame with head and foot rails, a thin mattress, a grey blanket turned down, a pillow.
export function cot(x, z, { a = 0, name = "iron_cot", empty = false, seed = 1 } = {}) {
  return prop(name, bbr(x, 0, z, 1.1, 1.05, 1.1), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), L = 0.95, Wd = 0.42;
    for (const s of [-1, 1]) for (const e of [-1, 1]) T(cap(lx, py, lz, [x + s * Wd, 0, z + e * L], [x + s * Wd, e < 0 ? 0.95 : 0.75, z + e * L], 0.016), ID.iron);
    for (const e of [-1, 1]) { const top = e < 0 ? 0.95 : 0.75; T(cap(lx, py, lz, [x - Wd, top, z + e * L], [x + Wd, top, z + e * L], 0.016), ID.iron); for (let k = -2; k <= 2; k++) T(cap(lx, py, lz, [x + k * 0.16, 0.42, z + e * L], [x + k * 0.16, top, z + e * L], 0.008), ID.iron); }
    for (const s of [-1, 1]) T(cap(lx, py, lz, [x + s * Wd, 0.4, z - L], [x + s * Wd, 0.4, z + L], 0.014), ID.iron);
    T(slab(lx, py, lz, [x, 0.47, z], [Wd - 0.02, 0.06, L - 0.03], 0.04), ID.bonecloth);
    if (!empty) {
      const fold = z - L + 0.7 + 0.1 * hash(seed, 1, 2);
      T(slab(lx, py, lz, [x, 0.545 + 0.015 * n3(lx * 6, 0, lz * 6), (fold + z + L) / 2], [Wd + 0.02, 0.02, (z + L - fold) / 2], 0.02), ID.navy);
      T(slab(lx, py, lz, [x, 0.57, fold + 0.06], [Wd + 0.01, 0.03, 0.08], 0.025), ID.navy);
      T(ell(lx, py, lz, x, 0.58, z - L + 0.3, 0.3, 0.07, 0.15), ID.bone);
    }
  });
}
// A three-leaf folding screen: wood frames with stretched canvas, the leaves at angles.
export function screen(x, z, { a = 0, name = "ward_screen", h = 1.7 } = {}) {
  return prop(name, bbr(x, 0, z, 1.0, h + 0.05, 1.0), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a);
    const leaves = [[[-0.85, -0.25], [-0.3, 0]], [[-0.3, 0], [0.3, 0]], [[0.3, 0], [0.85, -0.25]]];
    for (const [[ax, az], [bx, bz]] of leaves) {
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, ang = Math.atan2(bz - az, bx - ax), half = Math.hypot(bx - ax, bz - az) / 2;
      const [ux, uz] = rot(lx, lz, x + mx, z + mz, ang);
      T(box(ux, py, uz, x + mx, h / 2 + 0.05, z + mz, half - 0.03, h / 2 - 0.05, 0.006), ID.canvas);
      T(Math.max(box(ux, py, uz, x + mx, h / 2 + 0.05, z + mz, half, h / 2, 0.02), -box(ux, py, uz, x + mx, h / 2 + 0.05, z + mz, half - 0.035, h / 2 - 0.035, 0.05)), ID.timber);
    }
  });
}
// A school desk with its bench joined: a sloped lid, an inkwell hole, iron end frames.
export function schoolDesk(x, z, { name = "school_desk", book = false } = {}) {
  return prop(name, bbc(x, 0.45, z, 0.62, 0.5, 0.45), (px, py, pz, T) => {
    const lid = slab(px, py, pz, [x, 0.72 + (pz - z + 0.12) * 0.12, z - 0.12], [0.58, 0.018, 0.2], 0.006); T(lid, ID.darkwood);
    T(cyl(px, py, pz, x + 0.45, 0.74, z - 0.28, 0.018, 0.012), ID.glass);
    T(slab(px, py, pz, [x, 0.42, z + 0.3], [0.56, 0.02, 0.12], 0.006), ID.darkwood);
    for (const s of [-1, 1]) { T(chain(px, py, pz, [[x + s * 0.52, 0, z - 0.25], [x + s * 0.52, 0.7, z - 0.2]], 0.014), ID.iron); T(chain(px, py, pz, [[x + s * 0.52, 0, z + 0.35], [x + s * 0.52, 0.4, z + 0.3], [x + s * 0.52, 0.2, z - 0.2]], 0.012), ID.iron); }
    if (book) { T(slab(px, py, pz, [x - 0.1, 0.75, z - 0.1], [0.17, 0.006, 0.12], 0.003), ID.paper); T(box(px, py, pz, x - 0.1, 0.752, z - 0.1, 0.003, 0.008, 0.12), ID.red); }
  });
}
// A blackboard on the wall at -z: slate in a timber frame, chalk words as pale strokes, a ledge with chalk.
export function blackboard(x, y, wz, { w = 1.6, h = 1.0, name = "blackboard", seed = 3 } = {}) {
  return prop(name, bbc(x, y, wz + 0.05, w / 2 + 0.06, h / 2 + 0.12, 0.08), (px, py, pz, T) => {
    T(box(px, py, pz, x, y, wz + 0.02, w / 2, h / 2, 0.012), ID.slate);
    T(Math.max(box(px, py, pz, x, y, wz + 0.03, w / 2 + 0.05, h / 2 + 0.05, 0.02), -box(px, py, pz, x, y, wz + 0.03, w / 2, h / 2, 0.05)), ID.timber);
    T(box(px, py, pz, x, y - h / 2 - 0.06, wz + 0.07, w / 2, 0.012, 0.05), ID.timber);
    const line = Math.floor((py - y + h / 2) / 0.16), fx = (px - x + w / 2) / w;
    if (line >= 1 && line <= 4 && fx > 0.08 && fx < 0.3 + 0.55 * hash(line, seed, 1) && Math.abs(((py - y + h / 2) / 0.16) % 1 - 0.5) < 0.18 && n3(px * 40, line, seed) > 0.35) T(box(px, py, pz, px, py, wz + 0.035, 0.02, 0.02, 0.004), ID.chalk);
  });
}
// The allocation counter: a long panelled counter with a flap, a brass rail, the register open, a pen in the well.
export function counter(x, z, hx, { name = "allocation_counter" } = {}) {
  return prop(name, bbc(x, 0.6, z, hx + 0.1, 0.65, 0.4), (px, py, pz, T) => {
    T(slab(px, py, pz, [x, 0.5, z], [hx, 0.5, 0.28], 0.01) - 0.006 * sstep(0.4, 0.6, Math.abs(((px - x) / 0.6) % 1 - 0.5) * 2) * (pz > z + 0.2 ? 1 : 0), ID.darkwood);
    T(slab(px, py, pz, [x, 1.02, z], [hx + 0.04, 0.025, 0.33], 0.01), ID.oakx);
    T(cap(px, py, pz, [x - hx, 1.14, z + 0.3], [x + hx, 1.14, z + 0.3], 0.011), ID.brass);
    for (const k of [-1, 0, 1]) T(cap(px, py, pz, [x + k * hx * 0.8, 1.04, z + 0.3], [x + k * hx * 0.8, 1.14, z + 0.3], 0.008), ID.brass);
    T(slab(px, py, pz, [x - hx * 0.35, 1.06, z - 0.05], [0.24, 0.012, 0.17], 0.004), ID.paper);
    T(box(px, py, pz, x - hx * 0.35, 1.065, z - 0.05, 0.004, 0.014, 0.17), ID.darkwood);
    T(cyl(px, py, pz, x + 0.2, 1.08, z - 0.12, 0.03, 0.03), ID.glass); T(cap(px, py, pz, [x + 0.2, 1.1, z - 0.12], [x + 0.32, 1.2, z - 0.05], 0.004), ID.tar);
    T(slab(px, py, pz, [x + hx * 0.5, 1.055, z], [0.08, 0.008, 0.05], 0.003), ID.slate);
  });
}
// A register shelf: three shelves on the wall at -z, ledgers spine-out, some leaning, a box of slips.
export function registerShelf(x, wz, { w = 1.8, name = "register_shelf", seed = 5 } = {}) {
  return prop(name, bbc(x, 1.3, wz + 0.2, w / 2 + 0.05, 1.3, 0.22), (px, py, pz, T) => {
    for (const sy of [0.5, 1.1, 1.7, 2.3]) T(slab(px, py, pz, [x, sy, wz + 0.17], [w / 2, 0.016, 0.16], 0.004), ID.timber);
    for (const s of [-1, 1]) T(slab(px, py, pz, [x + s * w / 2, 1.3, wz + 0.17], [0.018, 1.2, 0.16], 0.004), ID.timber);
    for (const sy of [0.5, 1.1, 1.7]) {
      const k = Math.floor((px - x + w / 2) / 0.07), u = (px - x + w / 2) / 0.07 - k, hh = 0.2 + 0.12 * hash(k, sy * 10, seed), gone = hash(k, sy * 10, seed + 1) < 0.12;
      if (!gone && k >= 0 && k * 0.07 < w - 0.05) T(Math.max(box(px, py, pz, px, sy + 0.016 + hh / 2, wz + 0.16, 0.06, hh / 2, 0.13), Math.abs(u - 0.5) * 0.07 - 0.03), [ID.oxblood, ID.navy, ID.darkwood, ID.slate][Math.floor(hash(k, sy * 10, seed + 2) * 4)]);
    }
  });
}
// A pew: a plank seat, a raked back, scrolled ends, a book ledge behind.
export function pew(x, z, hx, { name = "pew" } = {}) {
  return prop(name, bbc(x, 0.5, z, hx + 0.05, 0.52, 0.35), (px, py, pz, T) => {
    T(slab(px, py, pz, [x, 0.44, z], [hx, 0.02, 0.2], 0.006), ID.darkwood);
    T(slab(px, py, pz, [x, 0.72, z + 0.2 + (py - 0.72) * 0.12], [hx, 0.25, 0.016], 0.006), ID.darkwood);
    T(slab(px, py, pz, [x, 0.86, z + 0.3], [hx, 0.012, 0.08], 0.004), ID.darkwood);
    for (const s of [-1, 1]) T(Math.max(slab(px, py, pz, [x + s * hx, 0.48, z + 0.05], [0.025, 0.48, 0.27], 0.01), Math.hypot(py - 0.98, pz - z + 0.15) < 0.12 ? 0.02 : -1), ID.darkwood);
  });
}
// The pulpit: a raised octagonal drum on a post, a stair of four, a sloped book desk with the Bible open.
export function pulpit(x, z, { name = "pulpit" } = {}) {
  return prop(name, bbr(x, 0, z, 1.2, 2.6, 1.2), (px, py, pz, T) => {
    const r = Math.hypot(px - x, pz - z), ang = Math.atan2(pz - z, px - x), oct = r * Math.cos(((ang + Math.PI / 8) % (Math.PI / 4)) - Math.PI / 8);
    T(Math.max(Math.abs(oct - 0.48) - 0.03, Math.abs(py - 1.45) - 0.55, -(1.0 - py) * 0), ID.darkwood);
    T(Math.max(oct - 0.5, Math.abs(py - 0.92) - 0.03), ID.darkwood);
    T(cyl(px, py, pz, x, 0.45, z, 0.14, 0.45), ID.darkwood);
    for (let k = 0; k < 4; k++) T(box(px, py, pz, x + 0.65 + k * 0.0, 0.11 + k * 0.22, z + 0.55 + k * 0.26, 0.3, 0.11 + k * 0.11, 0.13), ID.darkwood);
    T(slab(px, py, pz, [x - 0.3, 2.02 + (px - x + 0.3) * 0.25, z], [0.16, 0.012, 0.25], 0.004), ID.darkwood);
    T(slab(px, py, pz, [x - 0.3, 2.06 + (px - x + 0.3) * 0.25, z], [0.12, 0.014, 0.2], 0.004), ID.paper);
  });
}
// A hall mirror in a heavy frame on the wall at -x, a shelf under it with a brush and a key.
export function hallMirror(wx, y, z, { name = "hall_mirror" } = {}) {
  return prop(name, bbc(wx + 0.08, y, z, 0.1, 0.55, 0.45), (px, py, pz, T) => {
    T(box(px, py, pz, wx + 0.02, y + 0.1, z, 0.008, 0.38, 0.27), ID.glass);
    T(Math.max(box(px, py, pz, wx + 0.03, y + 0.1, z, 0.03, 0.44, 0.33), -box(px, py, pz, wx + 0.03, y + 0.1, z, 0.06, 0.37, 0.26)), ID.brass);
    T(slab(px, py, pz, [wx + 0.09, y - 0.38, z], [0.09, 0.014, 0.3], 0.004), ID.darkwood);
    T(ell(px, py, pz, wx + 0.1, y - 0.35, z - 0.12, 0.03, 0.02, 0.08), ID.darkwood);
    T(cap(px, py, pz, [wx + 0.1, y - 0.36, z + 0.1], [wx + 0.12, y - 0.36, z + 0.17], 0.006), ID.iron);
  });
}
// Coat pegs on a rail on the wall at -z with coats, a cap, a militia greatcoat.
export function coatRail(x, wz, n = 4, { name = "coat_rail", seed = 2, ids = [ID.navy, ID.darkwood, ID.oilskin, ID.canvas] } = {}) {
  const w = n * 0.3;
  return prop(name, bbc(x, 1.3, wz + 0.15, w / 2 + 0.1, 0.7, 0.2), (px, py, pz, T) => {
    T(slab(px, py, pz, [x, 1.7, wz + 0.02], [w / 2, 0.04, 0.015], 0.005), ID.timber);
    for (let i = 0; i < n; i++) {
      const cx = x - w / 2 + 0.15 + i * 0.3; T(cap(px, py, pz, [cx, 1.7, wz + 0.02], [cx, 1.72, wz + 0.1], 0.01), ID.timber);
      if (hash(i, seed, 1) < 0.8) { const len = 0.7 + 0.35 * hash(i, seed, 2); T(Math.max(ell(px, py, pz, cx, 1.68 - len / 2, wz + 0.1, 0.17, len / 2, 0.07) - 0.02 * fb3(px * 8, py * 8, pz * 8), py - 1.7), ids[i % ids.length]); }
    }
  });
}
// A rifle rack on the wall at -x: a board with notches and a chain, rifles standing butt down.
export function rifleRack(wx, z, n = 5, { name = "rifle_rack" } = {}) {
  return prop(name, bbc(wx + 0.12, 0.7, z, 0.15, 0.75, n * 0.09 + 0.1), (px, py, pz, T) => {
    T(slab(px, py, pz, [wx + 0.05, 1.15, z], [0.03, 0.05, n * 0.09], 0.005), ID.timber); T(slab(px, py, pz, [wx + 0.06, 0.06, z], [0.06, 0.03, n * 0.09], 0.005), ID.timber);
    for (let i = 0; i < n; i++) {
      if (i === 2) continue; const rz = z - n * 0.09 + 0.09 + i * 0.18;
      T(slab(px, py, pz, [wx + 0.09, 0.2, rz], [0.025, 0.14, 0.04], 0.01), ID.darkwood);
      T(cap(px, py, pz, [wx + 0.09, 0.32, rz], [wx + 0.06, 1.28, rz], 0.012), ID.iron);
    }
    T(cap(px, py, pz, [wx + 0.13, 1.05, z - n * 0.09], [wx + 0.13, 1.05, z + n * 0.09], 0.006), ID.iron);
  });
}
// A cast-iron stove with a pipe up through the ceiling, a kettle; lit gives a small glow at the door.
export function potStove(x, z, top, { name = "pot_stove", lit = true } = {}) {
  const p = prop(name, bbc(x, top / 2, z, 0.35, top / 2 + 0.05, 0.35), (px, py, pz, T) => {
    T(Math.max(cyl(px, py, pz, x, 0.42, z, 0.24, 0.32), -(py - 0.1)) + 0.004 * Math.sin(py * 60), ID.iron);
    for (let i = 0; i < 3; i++) { const t = i * 2.09; T(cap(px, py, pz, [x + Math.cos(t) * 0.18, 0.1, z + Math.sin(t) * 0.18], [x + Math.cos(t) * 0.24, 0, z + Math.sin(t) * 0.24], 0.02), ID.iron); }
    T(cyl(px, py, pz, x, 0.76, z, 0.27, 0.02), ID.iron); T(cap(px, py, pz, [x, 0.78, z], [x, top, z], 0.06), ID.iron);
    T(box(px, py, pz, x + 0.24, 0.42, z, 0.012, 0.09, 0.08), lit ? ID.stovefire : ID.iron);
    T(ell(px, py, pz, x - 0.08, 0.86, z + 0.05, 0.11, 0.08, 0.11), ID.iron); T(cap(px, py, pz, [x + 0.02, 0.9, z + 0.05], [x + 0.1, 0.96, z + 0.05], 0.012), ID.iron);
  });
  return [p, lit ? { pos: [x + 0.4, 0.42, z], type: 1, I: 1.6, reach: 3, key: `${name}glow`, group: "stove" } : null];
}
// A chalk cross on a door or wall plane (x = const facing +x when axis "x", z = const facing +z when "z").
export function chalkCross(c, axis = "z", { s = 0.28, name = "quarantine_chalk" } = {}) {
  const [x, y, z] = c;
  return prop(name, bbc(x, y, z, s, s, s), (px, py, pz, T) => {
    const u = axis === "z" ? px - x : pz - z, w = axis === "z" ? pz - z : px - x, v = py - y, j = 0.006 * n3(px * 50, py * 50, pz * 50);
    T(Math.max(Math.min(Math.abs(u - v) , Math.abs(u + v)) * 0.7 - 0.016 - j, Math.abs(u) - s * 0.8, Math.abs(v) - s * 0.8, Math.abs(w) - 0.006), ID.chalk);
  });
}
// A framed photograph on the wall at -z; cut: a figure scissored out (a pale gap); cracked: a split in the glass.
export function photo(x, y, wz, { w = 0.42, h = 0.3, cut = false, cracked = false, name = "framed_photograph", n = 5 } = {}) {
  return prop(name, bbc(x, y, wz + 0.03, w / 2 + 0.04, h / 2 + 0.04, 0.04), (px, py, pz, T) => {
    T(Math.max(box(px, py, pz, x, y, wz + 0.02, w / 2 + 0.035, h / 2 + 0.035, 0.015), -box(px, py, pz, x, y, wz + 0.04, w / 2, h / 2, 0.02)), ID.darkwood);
    let id = ID.slate; const u = (px - x) / w + 0.5, k = Math.floor(u * n), fu = u * n - k, hd = Math.hypot(fu - 0.5, ((py - y) / h + 0.5 - 0.62) * 1.6);
    if (hd < 0.2 || (Math.abs(fu - 0.5) < 0.22 && (py - y) / h + 0.5 < 0.52)) id = ID.bone;
    if (cut && k === 1 && (Math.abs(fu - 0.5) < 0.3)) id = ID.paper;
    if (cracked && Math.abs(px - x - 0.4 * (py - y) - 0.02 * Math.sin(py * 70)) < 0.004) id = ID.chalk;
    T(box(px, py, pz, x, y, wz + 0.01, w / 2, h / 2, 0.006), id);
  });
}
// A notice pasted on a wall or board plane z = wz: printed lines, a red rule, a corner peeling.
export function notice(x, y, wz, { w = 0.42, h = 0.56, name = "printed_notice", seed = 1 } = {}) {
  return prop(name, bbc(x, y, wz + 0.02, w / 2 + 0.02, h / 2 + 0.02, 0.03), (px, py, pz, T) => {
    const v = (py - y) / h + 0.5, line = Math.floor(v * 14), peel = sstep(0.75, 1, (px - x) / w + 0.5) * sstep(0.8, 1, v);
    const ink = v > 0.8 ? Math.abs(px - x) < w * 0.35 : v < 0.72 && v > 0.1 && Math.abs((v * 14) % 1 - 0.5) < 0.2 && n3(px * 60, line, seed) > 0.3 && Math.abs(px - x) < w * 0.42;
    T(box(px, py, pz, x, y, wz + 0.006 + 0.02 * peel, w / 2, h / 2, 0.003), Math.abs(v - 0.76) < 0.012 ? ID.red : ink ? ID.tar : ID.paper);
  });
}
// A rolled mattress tied with string, for the ten families' front room.
export function rolledMattress(x, z, { a = 0, name = "rolled_mattress", id = ID.bonecloth } = {}) {
  return prop(name, bbr(x, 0, z, 0.55, 0.4, 0.55), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a);
    T(Math.max(Math.hypot(lz - z, py - 0.19) - 0.19 - 0.008 * Math.sin(Math.atan2(py - 0.19, lz - z) * 9), Math.abs(lx - x) - 0.45), id);
    for (const s of [-0.25, 0.25]) T(Math.max(Math.abs(Math.hypot(lz - z, py - 0.19) - 0.195) - 0.006, Math.abs(lx - x - s) - 0.008), ID.rope);
  });
}
// A tin bowl, stamped, for relief: shallow, a rolled rim; up=false turns it over.
export function tinBowl(x, y, z, { up = true, name = "relief_bowl" } = {}) {
  return prop(name, bbc(x, y + 0.04, z, 0.1, 0.05, 0.1), (px, py, pz, T) => {
    const b = ell(px, py, pz, x, up ? y + 0.05 : y, z, 0.09, 0.05, 0.09);
    T(up ? Math.max(b, -ell(px, py, pz, x, y + 0.062, z, 0.08, 0.044, 0.08), py - y - 0.05) : Math.max(b, -(py - y)), ID.iron);
  });
}

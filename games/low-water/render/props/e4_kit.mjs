// Era 4's furniture and fittings (year 70, the closure; design/eras/era4.md): the plaster room shell with skirting and
// picture rail, fluorescent tubes and bare bulbs, steel desks and filing cabinets, tubular chairs, the telephone and
// typewriter, the tea glass, the kettle, the cooker and sink, Formica tables, an armchair, radiators, notice boards,
// posters, the easel, the jukebox, curtains, ashtrays and bottles. Each returns a named prop (render/props/prim.mjs);
// lamps return { p, l } so the room can push the light. Original code (plates agent, 2026-10-22).
import { ID, box, cyl, cap, ell, sph, rot, prop, bbc, bbr, lathe, slab, hash, fb3 } from "./prim.mjs";
import "./e4_kinds.mjs";

// The cut-away plaster room: floor, far walls at -z and -x to full height, sills on the near sides, a skirting board
// and a picture rail on the far walls. cuts: boxes [cx, cy, cz, ex, ey, ez] from the walls (doors, windows).
export function plasterShell(T, x, y, z, { hx, hz, h, floor = ID.lino, wall = ID.paper4, wallLeft = wall, sill = 0.4, cuts = [], skirt = ID.darkwood }) {
  const cut = (d) => { for (const c of cuts) d = Math.max(d, -box(x, y, z, ...c)); return d; };
  T(box(x, y, z, 0, -0.1, 0, hx + 0.2, 0.1, hz + 0.2), floor);
  T(cut(box(x, y, z, 0, h / 2, -hz - 0.08, hx + 0.2, h / 2, 0.08)), wall);
  T(cut(box(x, y, z, -hx - 0.08, h / 2, 0, 0.08, h / 2, hz + 0.2)), wallLeft);
  T(cut(box(x, y, z, 0, sill / 2, hz + 0.08, hx + 0.2, sill / 2, 0.08)), wall);
  T(cut(box(x, y, z, hx + 0.08, sill / 2, 0, 0.08, sill / 2, hz + 0.2)), wallLeft);
  T(cut(Math.min(box(x, y, z, 0, 0.07, -hz + 0.01, hx + 0.2, 0.07, 0.015), box(x, y, z, -hx + 0.01, 0.07, 0, 0.015, 0.07, hz + 0.2))), skirt);
  T(cut(Math.min(box(x, y, z, 0, h - 0.35, -hz + 0.01, hx + 0.2, 0.02, 0.015), box(x, y, z, -hx + 0.01, h - 0.35, 0, 0.015, 0.02, hz + 0.2))), skirt);
}
// a fluorescent tube in its steel trough, along x (or z), hung on two chains; the light is white with its mercury cast
export function tube(x, y, z, { len = 1.2, along = "x", I = 7, name = "fluorescent_tube", drop = 0.3, flicker = 1 } = {}) {
  const ax = along === "x", hx = ax ? len / 2 : 0.07, hz = ax ? 0.07 : len / 2;
  const p = prop(name, bbc(x, y + drop / 2, z, hx + 0.05, drop / 2 + 0.08, hz + 0.05), (px, py, pz, T) => {
    T(Math.max(box(px, py, pz, x, y + 0.03, z, hx, 0.03, hz), -box(px, py, pz, x, y, z, hx - 0.02, 0.03, hz - 0.02)), ID.steel);
    T(ax ? cap(px, py, pz, [x - hx + 0.04, y - 0.01, z], [x + hx - 0.04, y - 0.01, z], 0.018) : cap(px, py, pz, [x, y - 0.01, z - hz + 0.04], [x, y - 0.01, z + hz - 0.04], 0.018), flicker ? ID.whitelamp : ID.glass);
    for (const s of [-1, 1]) T(cap(px, py, pz, [x + (ax ? s * hx * 0.7 : 0), y + 0.06, z + (ax ? 0 : s * hz * 0.7)], [x + (ax ? s * hx * 0.7 : 0), y + drop, z + (ax ? 0 : s * hz * 0.7)], 0.006), ID.iron);
  });
  return { p, l: flicker ? { pos: [x, y - 0.05, z], type: 2, I, reach: 8, key: `${name}_${x}_${z}`, group: "white", soft: 1.5 } : null };
}
// a bare bulb on a flex from a ceiling rose; warm
export function bulb(x, y, z, { drop = 0.6, I = 4, name = "bare_bulb", lit = true } = {}) {
  const p = prop(name, bbc(x, y + drop / 2, z, 0.08, drop / 2 + 0.08, 0.08), (px, py, pz, T) => {
    T(sph(px, py, pz, x, y, z, 0.045), lit ? ID.lantern : ID.glass); T(cyl(px, py, pz, x, y + 0.06, z, 0.018, 0.025), ID.bone); T(cap(px, py, pz, [x, y + 0.08, z], [x, y + drop, z], 0.005), ID.tar); T(cyl(px, py, pz, x, y + drop, z, 0.05, 0.015), ID.bone);
  });
  return { p, l: lit ? { pos: [x, y - 0.03, z], type: 1, I, reach: 7, key: `${name}_${x}_${z}`, group: "lantern" } : null };
}
// steel desk: a top over a pedestal of drawers on the right, a modesty panel, handles
export const steelDesk = (x, z, { hx = 0.7, hz = 0.38, h = 0.74, name = "steel_desk", a = 0 } = {}) => prop(name, bbr(x, 0, z, hx + 0.05, h + 0.03, hz + 0.05), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, h - 0.015, z], [hx, 0.015, hz], 0.005), ID.formica);
  T(slab(lx, py, lz, [x + hx - 0.22, (h - 0.03) / 2, z], [0.2, (h - 0.03) / 2, hz - 0.02], 0.006), ID.steel);
  T(slab(lx, py, lz, [x - hx + 0.03, (h - 0.03) / 2, z], [0.02, (h - 0.03) / 2, hz - 0.02], 0.004), ID.steel);
  T(slab(lx, py, lz, [x, h * 0.55, z - hz + 0.03], [hx - 0.03, h * 0.25, 0.01], 0.004), ID.steel);
  for (let k = 0; k < 3; k++) T(cap(lx, py, lz, [x + hx - 0.28, 0.16 + k * 0.2, z + hz - 0.01], [x + hx - 0.16, 0.16 + k * 0.2, z + hz - 0.01], 0.008), ID.brass);
});
// a tubular steel chair with a vinyl seat and back
export const chair = (x, z, { a = 0, name = "tubular_chair" } = {}) => prop(name, bbr(x, 0, z, 0.28, 0.92, 0.28), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, 0.45, z], [0.21, 0.025, 0.2], 0.015), ID.vinyl); T(slab(lx, py, lz, [x, 0.72, z - 0.19], [0.2, 0.1, 0.015], 0.012), ID.vinyl);
  for (const sx of [-1, 1]) { T(cap(lx, py, lz, [x + sx * 0.19, 0, z + 0.18], [x + sx * 0.19, 0.43, z + 0.18], 0.012), ID.steel); T(cap(lx, py, lz, [x + sx * 0.19, 0, z - 0.19], [x + sx * 0.19, 0.84, z - 0.19], 0.012), ID.steel); }
});
export const cabinet = (x, z, { a = 0, h = 1.32, name = "filing_cabinet", open = 0 } = {}) => prop(name, bbr(x, 0, z, 0.27, h + 0.02, 0.36 + open), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, h / 2, z], [0.23, h / 2, 0.3], 0.006), ID.steel);
  for (let k = 0; k < 4; k++) { const cy = h * (k + 0.5) / 4, o = k === 1 ? open : 0; T(slab(lx, py, lz, [x, cy, z + 0.3 + o / 2], [0.22, h / 8 - 0.012, 0.01 + o / 2], 0.004), ID.steel); T(slab(lx, py, lz, [x, cy + 0.06, z + 0.32 + o], [0.05, 0.012, 0.012], 0.004), ID.brass); }
  if (open) T(slab(lx, py, lz, [x, h * 0.375 + 0.12, z + 0.3 + open / 2], [0.2, 0.05, open / 2 - 0.02], 0.003), ID.paper);
});
export const phone = (x, y, z, { a = 0, name = "telephone" } = {}) => prop(name, bbr(x, y, z, 0.14, y + 0.12, 0.14), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, y + 0.04, z], [0.1, 0.04, 0.09], 0.025), ID.tar); T(cap(lx, py, lz, [x - 0.09, y + 0.1, z], [x + 0.09, y + 0.1, z], 0.022), ID.tar);
  T(cyl(lx, py, lz, x, y + 0.085, z + 0.03, 0.045, 0.006), ID.bone);
});
export const typewriter = (x, y, z, { a = 0, name = "typewriter" } = {}) => prop(name, bbr(x, y, z, 0.25, y + 0.2, 0.25), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, y + 0.05, z], [0.18, 0.05, 0.15], 0.02), ID.machine); T(cap(lx, py, lz, [x - 0.2, y + 0.12, z - 0.1], [x + 0.2, y + 0.12, z - 0.1], 0.03), ID.tar);
  T(slab(lx, py, lz, [x, y + 0.2, z - 0.12], [0.11, 0.08, 0.003], 0.002), ID.paper);
});
// papers: a loose stack with the top sheet turned, and a ledger
export const papers = (x, y, z, { a = 0, n = 6, name = "paper_stack" } = {}) => prop(name, bbr(x, y, z, 0.2, y + 0.006 * n + 0.02, 0.2), (px, py, pz, T) => {
  for (let k = 0; k < n; k++) { const [lx, lz] = rot(px, pz, x, z, a + (hash(k, 3, 1) - 0.5) * 0.3); T(slab(lx, py, lz, [x + (hash(k, 1, 2) - 0.5) * 0.03, y + 0.003 + k * 0.006, z], [0.105, 0.002, 0.148], 0.001), ID.paper); }
});
export const ashtray = (x, y, z, { n = 5, name = "full_ashtray" } = {}) => prop(name, bbc(x, y + 0.03, z, 0.09, 0.04, 0.09), (px, py, pz, T) => {
  T(Math.max(cyl(px, py, pz, x, y + 0.015, z, 0.07, 0.015), -cyl(px, py, pz, x, y + 0.025, z, 0.055, 0.012)), ID.glass);
  for (let k = 0; k < n; k++) { const t = k * 2.4, r = 0.03; T(cap(px, py, pz, [x + Math.cos(t) * 0.01, y + 0.022, z + Math.sin(t) * 0.01], [x + Math.cos(t) * (r + 0.02), y + 0.03, z + Math.sin(t) * (r + 0.02)], 0.004), k % 2 ? ID.bone : ID.mustard); }
});
export const mug = (x, y, z, { name = "enamel_mug", id = ID.bone } = {}) => prop(name, bbc(x, y + 0.05, z, 0.07, 0.06, 0.07), (px, py, pz, T) => { T(Math.max(cyl(px, py, pz, x, y + 0.045, z, 0.04, 0.045), -cyl(px, py, pz, x, y + 0.06, z, 0.034, 0.045)), id); T(Math.max(cap(px, py, pz, [x + 0.045, y + 0.07, z], [x + 0.045, y + 0.02, z], 0.018) - 0.0, -cap(px, py, pz, [x + 0.045, y + 0.07, z], [x + 0.045, y + 0.02, z], 0.008)), id); });
// the Vellmark tea glass: a tulip glass in a brass holder with a handle, tea to two-thirds
export const teaGlass = (x, y, z, { name = "tea_glass" } = {}) => prop(name, bbc(x, y + 0.06, z, 0.07, 0.07, 0.07), (px, py, pz, T) => {
  const prof = (t) => 0.024 + 0.008 * Math.sin(t * 3.0) - 0.006 * t;
  T(Math.max(lathe(px, py, pz, x, y + 0.012, z, y + 0.1, prof), -lathe(px, py, pz, x, y + 0.016, z, y + 0.11, (t) => prof(t) - 0.003)), ID.glass);
  T(lathe(px, py, pz, x, y + 0.016, z, y + 0.07, (t) => prof(t * 0.6) - 0.003), ID.rust);
  T(Math.max(cyl(px, py, pz, x, y + 0.03, z, 0.032, 0.02), -cyl(px, py, pz, x, y + 0.03, z, 0.028, 0.03)), ID.brass); T(cyl(px, py, pz, x, y + 0.006, z, 0.03, 0.006), ID.brass);
  T(cap(px, py, pz, [x + 0.032, y + 0.045, z], [x + 0.05, y + 0.03, z], 0.004), ID.brass);
});
export const kettle = (x, y, z, { name = "kettle" } = {}) => prop(name, bbc(x, y + 0.12, z, 0.16, 0.14, 0.12), (px, py, pz, T) => {
  T(lathe(px, py, pz, x, y, z, y + 0.18, (t) => 0.1 - 0.05 * t * t), ID.steel); T(cap(px, py, pz, [x + 0.08, y + 0.05, z], [x + 0.15, y + 0.14, z], 0.012), ID.steel);
  T(Math.abs(Math.hypot(px - x, py - (y + 0.2)) - 0.07) - 0.008 + Math.max(0, Math.abs(pz - z) - 0.006) + Math.max(0, y + 0.18 - py), ID.tar);
});
// a gas cooker: four rings, a grill slot, the oven door with a window; a pan on one ring
export const cooker = (x, z, { a = 0, name = "gas_cooker" } = {}) => prop(name, bbr(x, 0, z, 0.32, 1.0, 0.32), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, 0.45, z], [0.27, 0.45, 0.28], 0.01), ID.bone); T(slab(lx, py, lz, [x, 0.36, z + 0.28], [0.21, 0.2, 0.01], 0.006), ID.glass);
  T(slab(lx, py, lz, [x, 0.73, z + 0.28], [0.22, 0.04, 0.01], 0.004), ID.tar);
  for (const [ox, oz] of [[-0.13, -0.12], [0.13, -0.12], [-0.13, 0.12], [0.13, 0.12]]) T(Math.abs(Math.hypot(lx - x - ox, lz - z - oz) - 0.07) - 0.008 + Math.max(0, Math.abs(py - 0.915) - 0.01), ID.iron);
  T(Math.max(cyl(lx, py, lz, x + 0.13, 0.98, z + 0.12, 0.1, 0.06), -cyl(lx, py, lz, x + 0.13, 1.0, z + 0.12, 0.09, 0.06)), ID.steel); T(cap(lx, py, lz, [x + 0.22, 1.0, z + 0.12], [x + 0.4, 1.02, z + 0.12], 0.01), ID.tar);
});
export const sink = (x, z, { a = 0, name = "kitchen_sink" } = {}) => prop(name, bbr(x, 0, z, 0.5, 1.2, 0.35), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, 0.42, z], [0.45, 0.42, 0.28], 0.008), ID.formica); T(Math.max(slab(lx, py, lz, [x - 0.15, 0.85, z], [0.24, 0.06, 0.24], 0.02), -slab(lx, py, lz, [x - 0.15, 0.9, z], [0.21, 0.08, 0.21], 0.02)), ID.steel);
  T(slab(lx, py, lz, [x + 0.27, 0.86, z], [0.17, 0.01, 0.25], 0.004), ID.steel);
  for (const s of [-0.22, -0.08]) T(cap(lx, py, lz, [s + x, 0.9, z - 0.25], [s + x, 1.05, z - 0.25], 0.012), ID.steel);
  T(cap(lx, py, lz, [x - 0.15, 1.05, z - 0.25], [x - 0.15, 1.05, z - 0.12], 0.01), ID.steel);
});
export const formicaTable = (x, z, { hx = 0.6, hz = 0.4, h = 0.74, name = "formica_table" } = {}) => prop(name, bbc(x, h / 2, z, hx + 0.03, h / 2 + 0.02, hz + 0.03), (px, py, pz, T) => {
  T(slab(px, py, pz, [x, h - 0.02, z], [hx, 0.02, hz], 0.01), ID.formica); T(slab(px, py, pz, [x, h - 0.05, z], [hx - 0.04, 0.02, hz - 0.04], 0.004), ID.steel);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) T(cap(px, py, pz, [x + sx * (hx - 0.06), 0, z + sz * (hz - 0.06)], [x + sx * (hx - 0.06), h - 0.04, z + sz * (hz - 0.06)], 0.014), ID.steel);
});
export const armchair = (x, z, { a = 0, name = "armchair", id = ID.carpet } = {}) => prop(name, bbr(x, 0, z, 0.5, 1.0, 0.5), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, 0.25, z], [0.4, 0.17, 0.38], 0.08), id); T(slab(lx, py, lz, [x, 0.42, z + 0.04], [0.3, 0.07, 0.32], 0.06), id);
  T(slab(lx, py, lz, [x, 0.66, z - 0.32], [0.38, 0.32, 0.09], 0.08), id); for (const s of [-1, 1]) T(slab(lx, py, lz, [x + s * 0.36, 0.45, z], [0.07, 0.17, 0.36], 0.06), id);
  T(slab(lx, py, lz, [x, 0.98, z - 0.34], [0.2, 0.02, 0.06], 0.02), ID.bone);
});
export const sideboard = (x, z, { hx = 0.7, a = 0, name = "sideboard" } = {}) => prop(name, bbr(x, 0, z, hx + 0.05, 0.9, 0.3), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  T(slab(lx, py, lz, [x, 0.43, z], [hx, 0.36, 0.22], 0.01), ID.darkwood); for (const sx of [-1, 1]) T(cap(lx, py, lz, [x + sx * (hx - 0.05), 0, z + 0.17], [x + sx * (hx - 0.05), 0.08, z + 0.17], 0.015), ID.darkwood);
  for (let k = -1; k <= 1; k++) T(slab(lx, py, lz, [x + k * hx * 0.66, 0.42, z + 0.22], [hx * 0.3, 0.3, 0.008], 0.004), ID.oaky);
  for (let k = -1; k <= 1; k++) T(cyl(lx, py, lz, x + k * hx * 0.66 + hx * 0.2, 0.55, z + 0.235, 0.012, 0.008), ID.brass);
});
// a cast radiator on a wall facing +z (or +x when side = "x")
export const radiator = (x, z, { w = 0.9, side = "z", name = "radiator" } = {}) => prop(name, bbc(x, 0.45, z, side === "z" ? w / 2 + 0.05 : 0.12, 0.4, side === "z" ? 0.12 : w / 2 + 0.05), (px, py, pz, T) => {
  const u = side === "z" ? px - x : pz - z, v = side === "z" ? pz - z : px - x, k = Math.round(u / 0.06);
  T(Math.max(Math.hypot(u - k * 0.06, v) - 0.022, Math.abs(py - 0.45) - 0.3, Math.abs(u) - w / 2), ID.bone);
  T(Math.max(Math.abs(v) - 0.03, Math.abs(Math.abs(py - 0.45) - 0.28) - 0.02, Math.abs(u) - w / 2), ID.bone);
});
// a flat panel on a wall: face "z" lies on the -z wall facing +z, "x" on the -x wall facing +x; kind: its surface id
export const panel = (name, x, y, z, w, h, kind, { face = "z", th = 0.004, frame = null } = {}) => prop(name, bbc(x, y, z, face === "z" ? w / 2 + 0.04 : 0.04, h / 2 + 0.04, face === "z" ? 0.04 : w / 2 + 0.04), (px, py, pz, T) => {
  const u = face === "z" ? px - x : pz - z, v = face === "z" ? pz - z : px - x;
  T(Math.max(Math.abs(u) - w / 2, Math.abs(py - y) - h / 2, Math.abs(v) - th), kind);
  if (frame) T(Math.max(Math.max(Math.abs(u) - w / 2 - 0.025, Math.abs(py - y) - h / 2 - 0.025, Math.abs(v - 0.006) - th - 0.006), -Math.max(Math.abs(u) - w / 2, Math.abs(py - y) - h / 2)), frame);
});
// a notice board with pinned sheets at slight angles
export function noticeBoard(x, y, z, { w = 1.0, h = 0.7, face = "z", n = 7, name = "notice_board", seed = 1 } = {}) {
  return prop(name, bbc(x, y, z, face === "z" ? w / 2 + 0.05 : 0.05, h / 2 + 0.05, face === "z" ? 0.05 : w / 2 + 0.05), (px, py, pz, T) => {
    const u = face === "z" ? px - x : pz - z, v = face === "z" ? pz - z : px - x;
    T(Math.max(Math.abs(u) - w / 2, Math.abs(py - y) - h / 2, Math.abs(v) - 0.012), ID.cork ?? ID.rust);
    for (let k = 0; k < n; k++) { const cu = (hash(k, seed, 1) - 0.5) * (w - 0.25), cv = (hash(k, seed, 2) - 0.5) * (h - 0.25), t = (hash(k, seed, 3) - 0.5) * 0.25, a = (u - cu) * Math.cos(t) + (py - y - cv) * Math.sin(t), b = -(u - cu) * Math.sin(t) + (py - y - cv) * Math.cos(t);
      T(Math.max(Math.abs(a) - 0.075, Math.abs(b) - 0.1, Math.abs(v - 0.016) - 0.002), hash(k, seed, 4) < 0.2 ? ID.mustard : ID.paper); }
  });
}
export const easel = (x, z, { a = 0, h = 1.65, name = "easel" } = {}) => prop(name, bbr(x, 0, z, 0.45, h + 0.05, 0.45), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a);
  for (const s of [-1, 1]) T(cap(lx, py, lz, [x + s * 0.35, 0, z + 0.12], [x + s * 0.05, h, z - 0.02], 0.018), ID.darkwood);
  T(cap(lx, py, lz, [x, 0, z - 0.4], [x, h - 0.05, z - 0.05], 0.016), ID.darkwood); T(slab(lx, py, lz, [x, 0.72, z + 0.09], [0.4, 0.015, 0.04], 0.004), ID.darkwood);
});
// the jukebox: a rounded cabinet, the lit arch and the record window; the glow is its own light
export function jukebox(x, z, { a = 0, name = "jukebox", I = 2.2 } = {}) {
  const p = prop(name, bbr(x, 0, z, 0.5, 1.6, 0.45), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), body = Math.max(slab(lx, py, lz, [x, 0.6, z], [0.42, 0.6, 0.3], 0.03), -1e9), arch = Math.max(Math.hypot(lx - x, py - 1.2) - 0.42, Math.abs(lz - z) - 0.3);
    T(Math.min(body, arch), ID.darkwood);
    T(Math.max(Math.abs(Math.hypot(lx - x, py - 1.2) - 0.36) - 0.035, Math.abs(lz - z - 0.3) - 0.02, 1.15 - py), ID.lantern);
    T(Math.max(slab(lx, py, lz, [x, 0.95, z + 0.3], [0.28, 0.16, 0.01], 0.02), 0), ID.glass); T(slab(lx, py, lz, [x, 0.45, z + 0.305], [0.3, 0.2, 0.006], 0.004), ID.brass);
    for (let k = -3; k <= 3; k++) T(slab(lx, py, lz, [x + k * 0.08, 0.45, z + 0.31], [0.012, 0.18, 0.006], 0.003), ID.mustard);
  });
  return { p, l: { pos: [x + Math.sin(a) * 0.5, 1.2, z + Math.cos(a) * 0.5], type: 1, I, reach: 4, key: "jukebox", group: "lantern" } };
}
export const curtain = (x, y, z, { w = 0.6, h = 1.2, face = "z", id = ID.mustard, name = "curtain" } = {}) => prop(name, bbc(x, y - h / 2, z, face === "z" ? w / 2 + 0.05 : 0.08, h / 2 + 0.05, face === "z" ? 0.08 : w / 2 + 0.05), (px, py, pz, T) => {
  const u = face === "z" ? px - x : pz - z, v = face === "z" ? pz - z : px - x;
  T(Math.max(Math.abs(u) - w / 2, Math.abs(py - (y - h / 2)) - h / 2, Math.abs(v - 0.025 * Math.sin(u * 40)) - 0.012), id);
});
export const bottle = (x, y, z, { name = "bottle", id = ID.bottle, h = 0.26 } = {}) => prop(name, bbc(x, y + h / 2, z, 0.05, h / 2 + 0.01, 0.05), (px, py, pz, T) => T(lathe(px, py, pz, x, y, z, y + h, (t) => (t < 0.6 ? 0.035 : 0.035 - (t - 0.6) * 0.06)), id));
export const pint = (x, y, z, { name = "pint_glass", full = 0.7 } = {}) => prop(name, bbc(x, y + 0.08, z, 0.05, 0.09, 0.05), (px, py, pz, T) => { T(Math.max(lathe(px, py, pz, x, y, z, y + 0.15, (t) => 0.03 + 0.008 * t), -lathe(px, py, pz, x, y + 0.006, z, y + 0.16, (t) => 0.027 + 0.008 * t)), ID.glass); if (full) T(lathe(px, py, pz, x, y + 0.006, z, y + 0.15 * full, (t) => 0.027 + 0.006 * t), ID.rust); });
export const clock = (x, y, z, { face = "z", name = "wall_clock" } = {}) => prop(name, bbc(x, y, z, 0.18, 0.18, 0.18), (px, py, pz, T) => {
  const u = face === "z" ? px - x : pz - z, v = face === "z" ? pz - z : px - x, r = Math.hypot(u, py - y);
  T(Math.max(r - 0.15, Math.abs(v) - 0.025), ID.bone); T(Math.max(Math.abs(r - 0.15) - 0.012, Math.abs(v) - 0.03), ID.tar);
  T(Math.max(Math.abs(u * 0.98 + (py - y) * 0.17) - 0.006, Math.abs((py - y) - u * 0.2 - 0.05) - 0.06, Math.abs(v - 0.028) - 0.003), ID.tar);
});
// a black bin bag, knotted, slumped
export const binBag = (x, z, { s = 1, name = "bin_bag" } = {}) => prop(name, bbc(x, 0.3 * s, z, 0.35 * s, 0.32 * s, 0.35 * s), (px, py, pz, T) => T(ell(px, py, pz, x, 0.2 * s, z, 0.28 * s, 0.2 * s, 0.25 * s) - 0.02 * fb3(px * 9, py * 9, pz * 9) + 0 * 0, ID.tar));
export { ID };

// Things people owned and used, for authored props: household objects (carved spoons, a spoon jar, a spoon rack with its
// empty notches, a tin cup, a mug on a hook, a biscuit tin of papers, a round hat and a hat in a bag, a folded newspaper),
// work tools (a spike of slips, an open book, a spade, a blotter, a pamphlet, a stencil in an evidence bag), and personal
// belongings (a steel locker, a plaited thread ring). Game-agnostic: text, pictures and states are data; nothing here
// knows a story. Original code (world-layers pass, 2026-10-23).
// a is a turn about y; positions are the foot of the thing (its base at y).
import { prop, ID, box, cap, cyl, ell, sph, rot, bbc, bbr, lathe, slab, hash, n3 } from "./prim.mjs";
import { textKind } from "./letters.mjs";
import { planeOf, local, topLeft, imageKind, sheetBB } from "./plane.mjs";
import { PICTURES, goatStrokes } from "./layers_wall.mjs";

// A carved wooden spoon lying on its back along its turn a; finial: the handle's end carved (a small knob)
export const spoon = (x, y, z, { a = 0, id = ID.oakx, name = "carved_spoon", stain = null } = {}) => prop(name, bbr(x, y, z, 0.13, y + 0.04, 0.13), (px, py, pz, T) => {
  const [lx, lz] = rot(px, pz, x, z, a), bowl = Math.max(ell(lx, py, lz, x + 0.07, y + 0.012, z, 0.035, 0.014, 0.024), -ell(lx, py, lz, x + 0.07, y + 0.02, z, 0.028, 0.01, 0.018));
  T(bowl, stain ?? id); T(cap(lx, py, lz, [x + 0.035, y + 0.012, z], [x - 0.11, y + 0.018, z], 0.006), id); T(sph(lx, py, lz, x - 0.115, y + 0.02, z, 0.01), id);
});
// A jar of spoons standing handle-up by a cooker: n handles at slight angles
export const spoonJar = (x, y, z, { n = 5, name = "spoon_jar", id = ID.jar } = {}) => prop(name, bbc(x, y + 0.16, z, 0.09, 0.17, 0.09), (px, py, pz, T) => {
  T(Math.max(lathe(px, py, pz, x, y, z, y + 0.13, (t) => 0.055 + 0.01 * Math.sin(t * 3)), -lathe(px, py, pz, x, y + 0.01, z, y + 0.14, () => 0.047)), id);
  for (let k = 0; k < n; k++) { const an = k * 2.4 + 0.3, r = 0.022, tx = x + Math.cos(an) * r, tz = z + Math.sin(an) * r; T(cap(px, py, pz, [tx, y + 0.02, tz], [tx + Math.cos(an) * 0.03, y + 0.28, tz + Math.sin(an) * 0.03], 0.006), ID.oakx); T(sph(px, py, pz, tx + Math.cos(an) * 0.03, y + 0.29, tz + Math.sin(an) * 0.03, 0.009), ID.oakx); }
});
// A rack on a wall with n notches; hung: a list of booleans (a spoon in the notch); ghost: a cleaner shape round each
// empty notch where a spoon hung for years; stained: the index of a spoon with a stained bowl
export function spoonRack(name, x, y, z, { face = "z", n = 6, hung = [], ghost = true, stained = -1, stainId = ID.mustard } = {}) {
  const F = planeOf([x, y, z], face), w = 0.08 * n + 0.08;
  return prop(name, sheetBB({ ...F, c: [0, 1, 2].map((i) => F.c[i] + F.v[i] * 0.14) }, w, 0.36, 0.08), (px, py, pz, T) => {
    const [lu, lv, ln] = local([px, py, pz], F);
    T(Math.max(Math.abs(lu) - w / 2, Math.abs(lv) - 0.022, Math.abs(ln - 0.02) - 0.02), ID.darkwood);
    for (let k = 0; k < n; k++) {
      const cu = (k - (n - 1) / 2) * 0.08;
      if (hung[k]) { T(cap(px, py, pz, ...[[cu, -0.01], [cu, 0.21]].map(([u, v]) => [0, 1, 2].map((i) => F.c[i] + F.u[i] * u + F.v[i] * v + F.n[i] * 0.03)), 0.006), ID.oakx); const b = [0, 1, 2].map((i) => F.c[i] + F.u[i] * cu + F.v[i] * 0.25 + F.n[i] * 0.03); T(ell(px, py, pz, b[0], b[1], b[2], face === "z" ? 0.024 : 0.012, 0.036, face === "z" ? 0.012 : 0.024), k === stained ? stainId : ID.oakx); }
      else if (ghost) T(Math.max(Math.hypot(lu - cu, (lv - 0.14) * (lv > 0.2 ? 0.7 : 4)) - (lv > 0.2 ? 0.03 : 0.008), Math.abs(lv - 0.14) - 0.15, Math.abs(ln - 0.0008) - 0.0008), ID.bone);
    }
  });
}
// A tin cup, the right way up or turned over (up false)
export const tinCup = (x, y, z, { up = true, name = "tin_cup" } = {}) => prop(name, bbc(x, y + 0.05, z, 0.07, 0.06, 0.07), (px, py, pz, T) => {
  const c = cyl(px, py, pz, x, y + 0.045, z, 0.038, 0.045), inner = cyl(px, py, pz, x, up ? y + 0.055 : y + 0.035, z, 0.033, 0.045);
  T(Math.max(c, -inner), ID.iron); T(Math.max(Math.abs(Math.hypot(px - x - 0.052, py - y - 0.045) - 0.018) - 0.004, Math.abs(pz - z) - 0.004), ID.iron);
});
// An enamel mug on a hook on a wall, hanging the right way (handle on the hook) or turned bottom-out
export function mugOnHook(name, x, y, z, { face = "z", turned = false, id = ID.bone, band = ID.navy } = {}) {
  const F = planeOf([x, y, z], face), c = [0, 1, 2].map((i) => F.c[i] + F.n[i] * 0.06);
  return prop(name, bbc(c[0], y - 0.04, c[2], 0.09, 0.1, 0.09), (px, py, pz, T) => {
    T(cap(px, py, pz, [x, y + 0.02, z], [c[0], y + 0.04, c[2]], 0.004), ID.iron);
    const yy = turned ? y - 0.05 : y - 0.06, m = Math.max(cyl(px, py, pz, c[0], yy, c[2], 0.04, 0.045), -cyl(px, py, pz, c[0], turned ? yy - 0.012 : yy + 0.012, c[2], 0.034, 0.045));
    T(m, Math.abs(py - yy - 0.03) < 0.006 ? band : id);
  });
}
// A biscuit tin, lid off beside it, papers and a card inside; card: lines for the top card's text
export function biscuitTin(name, x, y, z, { a = 0, card = [], id = ID.teal } = {}) {
  const F = planeOf([x, y + 0.075, z], "y", a), cardKind = card.length ? textKind(`${name}_card`, card, { o: topLeft(F, 0.16, 0.1, 0.012), u: F.u, v: F.v, cell: 0.0042, ink: ["lw tar", 0.2], ground: ["lw paper", 0.75] }) : ID.paper;
  return prop(name, bbr(x, y, z, 0.32, y + 0.1, 0.32), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a);
    T(Math.max(slab(lx, py, lz, [x, y + 0.04, z], [0.1, 0.04, 0.07], 0.012), -slab(lx, py, lz, [x, y + 0.05, z], [0.094, 0.04, 0.064], 0.01)), id);
    T(slab(lx, py, lz, [x, y + 0.06, z], [0.088, 0.012, 0.06], 0.002), ID.paper); T(slab(lx, py, lz, [x, y + 0.074, z], [0.08, 0.0015, 0.05], 0.001), cardKind);
    T(slab(lx, py, lz, [x + 0.24, y + 0.006, z + 0.03], [0.105, 0.006, 0.075], 0.006), id);
  });
}
// A round hat with a band (a brass band if band is ID.brass); in a bag: a paper bag over it, the brim pushing out
export const roundHat = (x, y, z, { name = "round_hat", band = ID.brass, id = ID.tar, bag = false } = {}) => prop(name, bbc(x, y + 0.08, z, 0.17, 0.1, 0.17), (px, py, pz, T) => {
  if (bag) { T(Math.max(ell(px, py, pz, x, y + 0.07, z, 0.16, 0.1, 0.15) + 0.004 * n3(px * 60, py * 60, pz * 60), -(py - y)), ID.paper); T(Math.max(Math.abs(py - y - 0.165) - 0.012, Math.hypot(px - x, pz - z) - 0.06), ID.paper); return; }
  T(Math.max(Math.hypot(px - x, pz - z) - 0.15, Math.abs(py - y - 0.008) - 0.008), id);
  T(Math.max(ell(px, py, pz, x, y + 0.02, z, 0.095, 0.12, 0.105), -(py - y - 0.01)), id); T(Math.max(Math.abs(Math.hypot(px - x, pz - z) - 0.098) - 0.004, Math.abs(py - y - 0.035) - 0.012), band);
});
// A folded newspaper lying on a table, headline lines across its top half; picture: a PICTURES painter for its photograph
export function newspaper(name, x, y, z, { a = 0, lines = [], picture = PICTURES.people({ n: 2 }), w = 0.36, h = 0.28 } = {}) {
  const F = planeOf([x, y + 0.006, z], "y", a), head = textKind(`${name}_head`, lines, { o: topLeft(F, w, h, 0.014), u: F.u, v: F.v, cell: (w - 0.03) / (6 * Math.max(1, ...lines.map((l) => l.length))), ink: ["lw tar", 0.12], ground: ["lw paper", 0.66] });
  const img = imageKind(`${name}_photo`, { ...F, c: [0, 1, 2].map((i) => F.c[i] + F.v[i] * h * 0.22 - F.u[i] * w * 0.18) }, w * 0.5, h * 0.4, picture);
  return prop(name, bbr(x, y, z, w / 2 + 0.03, y + 0.02, h / 2 + 0.03), (px, py, pz, T) => {
    const [lu, lv, ln] = local([px, py, pz], F), inPhoto = lv > 0 && lv < h * 0.42 && lu < w * 0.08 && lu > -w * 0.43;
    const body = lv > 0 && !inPhoto && Math.abs(((lv * 90) % 1) - 0.5) < 0.2 && n3(lu * 40, lv * 90, 3) > 0.35;
    T(Math.max(Math.abs(lu) - w / 2, Math.abs(lv) - h / 2, Math.abs(ln) - 0.003 - 0.002 * (lu > 0 ? 1 : 0)), inPhoto ? img : body ? ID.slate : head);
  });
}
// A spike of slips on a block: n slips skewered; text: lines on the top slip
export function slipSpike(name, x, y, z, { n = 14, text = [] } = {}) {
  const F = planeOf([x, y + 0.02 + n * 0.0016 + 0.001, z], "y", 0.2), k = text.length ? textKind(`${name}_top`, text, { o: topLeft(F, 0.1, 0.07, 0.008), u: F.u, v: F.v, cell: 0.0028, ink: ["lw tar", 0.2], ground: ["lw paper", 0.72], hand: 0.4 }) : ID.paper;
  return prop(name, bbc(x, y + 0.1, z, 0.08, 0.11, 0.08), (px, py, pz, T) => {
    T(cyl(px, py, pz, x, y + 0.01, z, 0.04, 0.01), ID.darkwood); T(cap(px, py, pz, [x, y + 0.02, z], [x, y + 0.2, z], 0.002), ID.iron);
    for (let i = 0; i < n; i++) { const t = hash(i, 4, 1) * 0.6, [lx, lz] = rot(px, pz, x, z, t); T(Math.max(Math.abs(lx - x) - 0.05, Math.abs(lz - z) - 0.035, Math.abs(py - y - 0.022 - i * 0.0016) - 0.0006), i === n - 1 ? k : ID.paper); }
  });
}
// An open book lying flat: two pages of ruled lines (rows of a ledger or a survey); text: lines on the right page
export function openBook(name, x, y, z, { a = 0, w = 0.34, h = 0.24, text = [], cover = ID.oxblood, hand = 0.5 } = {}) {
  const F = planeOf([x, y + 0.014, z], "y", a), R = { ...F, c: [0, 1, 2].map((i) => F.c[i] + F.u[i] * w / 4) };
  const k = text.length ? textKind(`${name}_page`, text, { o: topLeft(R, w / 2, h, 0.012), u: F.u, v: F.v, cell: (w / 2 - 0.024) / (6 * Math.max(...text.map((l) => l.length))), ink: ["lw tar", 0.22], ground: ["lw paper", 0.74], hand }) : ID.paper;
  return prop(name, bbr(x, y, z, w / 2 + 0.04, y + 0.03, h / 2 + 0.04), (px, py, pz, T) => {
    const [lu, lv, ln] = local([px, py, pz], F), sag = 0.006 * Math.cos(lu / w * 3.14);
    T(Math.max(Math.abs(lu) - w / 2 - 0.008, Math.abs(lv) - h / 2 - 0.008, Math.abs(ln + 0.01) - 0.003), cover);
    const rule = lu < 0 && Math.abs(((lv * 60) % 1) - 0.5) < 0.12 && Math.abs(lu + w / 4) < w / 4 - 0.015;
    T(Math.max(Math.abs(lu) - w / 2, Math.abs(lv) - h / 2, Math.abs(ln - sag + 0.004) - 0.004), lu > 0 ? k : rule ? ID.slate : ID.paper);
  });
}
// A spade leaning on a wall: foot at (x, 0, z), handle top at `top`; clay: the blade and lower shaft crusted (an id)
export const spade = (x, z, top, { name = "spade", clay = null } = {}) => prop(name, [Math.min(x, top[0]) - 0.15, 0, Math.min(z, top[2]) - 0.15, Math.max(x, top[0]) + 0.15, top[1] + 0.06, Math.max(z, top[2]) + 0.15], (px, py, pz, T) => {
  const d = [top[0] - x, top[1], top[2] - z], L = Math.hypot(...d), u = d.map((v) => v / L), b = [x + u[0] * 0.3, 0.3 * u[1], z + u[2] * 0.3];
  T(cap(px, py, pz, b, top, 0.016), py < 0.55 && clay ? clay : ID.timber); T(cap(px, py, pz, [top[0] - 0.07, top[1], top[2]], [top[0] + 0.07, top[1], top[2]], 0.014), ID.timber);
  T(Math.max(Math.hypot(px - x - u[0] * 0.15, pz - z - u[2] * 0.15) - 0.1, Math.abs(py - 0.15) - 0.15, Math.abs((px - x) * u[2] - (pz - z) * u[0]) - 0.004), clay ?? ID.iron);
});
// A blotter on a desk: a green pad in leather corners; lines: text blotted into it, so mirror-reversed and broken
export function blotter(name, x, y, z, { a = 0, lines = [], w = 0.46, h = 0.32 } = {}) {
  const F = planeOf([x, y + 0.004, z], "y", a), M = { ...F, u: F.u.map((v) => -v) }, o = [0, 1, 2].map((i) => F.c[i] + F.u[i] * (w / 2 - 0.04) - F.v[i] * (h / 2 - 0.05));
  const k = textKind(`${name}_ink`, lines, { o, u: M.u, v: F.v, cell: 0.0065, ink: ["lw navy", 0.3], ground: ["lw green paint", 0.32], rough: 0.7, hand: 0.5 });
  return prop(name, bbr(x, y, z, w / 2 + 0.03, y + 0.012, h / 2 + 0.03), (px, py, pz, T) => {
    const [lu, lv, ln] = local([px, py, pz], F), corner = Math.abs(lu) > w / 2 - 0.05 && Math.abs(lv) > h / 2 - 0.05;
    T(Math.max(Math.abs(lu) - w / 2, Math.abs(lv) - h / 2, Math.abs(ln) - 0.004), corner ? ID.leather : k);
  });
}
// A pamphlet lying on a table, its cover a picture (a PICTURES painter) and a title strip
export function pamphlet(name, x, y, z, { a = 0, picture = PICTURES.goatcut(), title = [], w = 0.15, h = 0.21 } = {}) {
  const F = planeOf([x, y + 0.004, z], "y", a), img = imageKind(`${name}_cover`, F, w, h, picture), tk = title.length ? textKind(`${name}_title`, title, { o: topLeft(F, w, h, 0.01), u: F.u, v: F.v, cell: (w - 0.02) / (6 * Math.max(...title.map((l) => l.length))), ink: ["lw tar", 0.12], ground: ["lw paper", 0.72] }) : img;
  return prop(name, bbr(x, y, z, w / 2 + 0.02, y + 0.012, h / 2 + 0.02), (px, py, pz, T) => {
    const [lu, lv, ln] = local([px, py, pz], F);
    T(Math.max(Math.abs(lu) - w / 2, Math.abs(lv) - h / 2, Math.abs(ln) - 0.003), lv < -h / 2 + h * 0.18 ? tk : img);
  });
}
// A clear bag lying flat with a cardboard stencil in it (strokes(u, v) cut out of the card), a label tied on
export function evidenceBag(name, x, y, z, { a = 0, w = 0.32, h = 0.26, strokes = (u, v) => goatStrokes(u, v, false), label = [] } = {}) {
  const F = planeOf([x, y + 0.003, z], "y", a), lk = label.length ? textKind(`${name}_label`, label, { o: topLeft({ ...F, c: [0, 1, 2].map((i) => F.c[i] + F.u[i] * (w / 2 + 0.03) - F.v[i] * (h / 2 - 0.04)) }, 0.08, 0.05, 0.005), u: F.u, v: F.v, cell: 0.0022, ink: ["lw tar", 0.2], ground: ["lw mustard", 0.55] }) : ID.mustard;
  return prop(name, bbr(x, y, z, w / 2 + 0.12, y + 0.015, h / 2 + 0.05), (px, py, pz, T) => {
    const [lu, lv, ln] = local([px, py, pz], F), cut = goatInside(lu / (w * 0.4), -lv / (w * 0.4), strokes);
    T(Math.max(Math.abs(lu) - w / 2 + 0.02, Math.abs(lv) - h / 2 + 0.02, Math.abs(ln - 0.002) - 0.0015, cut ? 0.01 : -1), Math.abs(lu) < w * 0.45 && Math.abs(lv) < h * 0.45 && n3(lu * 30, lv * 30, 4) > 0.62 ? ID.chalk : ID.canvas);
    T(Math.max(Math.abs(lu) - w / 2, Math.abs(lv) - h / 2, Math.abs(ln - 0.004) - 0.0006), ID.glass);
    T(Math.max(Math.abs(lu - w / 2 - 0.07) - 0.045, Math.abs(lv + h / 2 - 0.065) - 0.028, Math.abs(ln - 0.002) - 0.0008), lk);
  });
}
const goatInside = (u, v, strokes) => strokes(u, v) < 0.06;
// A steel locker standing on the floor, its door open by `open` radians; hook: things on the inside hook (a ring of
// thread when ring is set), photo: a small photograph taped inside the door
export function locker(name, x, z, { a = 0, open = 0.35, ring = false, ringId = ID.cobalt, id = ID.green, h = 1.8 } = {}) {
  return prop(name, bbr(x, 0, z, 0.55, h + 0.05, 0.55), (px, py, pz, T) => {
    const [lx, lz] = rot(px, pz, x, z, a), hw = 0.2, hd = 0.22;
    T(Math.max(slab(lx, py, lz, [x, h / 2, z], [hw, h / 2, hd], 0.008), -slab(lx, py, lz, [x, h / 2 + 0.02, z + 0.02], [hw - 0.012, h / 2 - 0.03, hd], 0.004)), id);
    T(slab(lx, py, lz, [x, h * 0.72, z], [hw - 0.02, 0.006, hd - 0.02], 0.002), id);
    const hx = x + hw, hz = z + hd, dx = lx - hx, dz = lz - hz, c = Math.cos(open), s = Math.sin(open), ux = -dx * c + dz * s, uz = -dx * s - dz * c;
    T(slab(ux, py, uz, [hw, h / 2, 0.005], [hw, h / 2 - 0.01, 0.006], 0.003), id);
    for (let k = 0; k < 4; k++) T(Math.max(Math.abs(ux - hw) - 0.08, Math.abs(py - h * 0.85 + k * 0.025) - 0.004, Math.abs(uz + 0.002) - 0.004), ID.tar);
    T(Math.max(Math.abs(ux - hw) - 0.05, Math.abs(py - h * 0.6) - 0.065, Math.abs(uz - 0.012) - 0.001), ID.slate);
    T(cap(lx, py, lz, [x, h * 0.66, z - hd + 0.02], [x, h * 0.66, z - hd + 0.06], 0.004), ID.iron);
    if (ring) T(Math.hypot(Math.hypot(lx - x, py - h * 0.66 + 0.035) - 0.03, lz - z + hd - 0.06) - 0.003, ringId);
  });
}
export { ID };
// A ring of thread or cord lying flat (flat) or hanging in the plane facing +z: radius r, thickness th
export const ring = (x, y, z, { r = 0.025, th = 0.0025, id = ID.cobalt, flat = true, name = "thread_ring" } = {}) => prop(name, bbc(x, y, z, r + 0.01, flat ? 0.01 : r + 0.01, r + 0.01), (px, py, pz, T) => {
  T(flat ? Math.hypot(Math.hypot(px - x, pz - z) - r, py - y - th) - th : Math.hypot(Math.hypot(px - x, py - y) - r, pz - z) - th, id);
});
// A plain shelf board on brackets on a wall
export function shelfBoard(name, x, y, z, { face = "z", w = 0.6, d = 0.16, id = ID.darkwood } = {}) {
  const F = planeOf([x, y, z], face);
  return prop(name, sheetBB(F, w, 0.2, d + 0.02), (px, py, pz, T) => {
    const [lu, lv, ln] = local([px, py, pz], F);
    T(Math.max(Math.abs(lu) - w / 2, Math.abs(lv) - 0.012, Math.abs(ln - d / 2) - d / 2), id);
    for (const s of [-1, 1]) T(Math.max(Math.abs(lu - s * (w / 2 - 0.06)) - 0.008, Math.abs(lv - 0.06) - 0.06, Math.abs(ln - d * 0.35) - d * 0.35), ID.iron);
  });
}

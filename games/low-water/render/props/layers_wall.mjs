// Walls that carry history, for authored props: sheets with text (notices, handbills, slips, a sampler, a carving),
// framed photographs (whole, cracked, or the cracked glass kept behind a new one), and material evidence: a pale patch
// where something hung, a tide line with newer plaster under it, pencil heights up a door frame, and a drawn or scratched
// mark (a figure in strokes) that can be fresh, old under paint, or scrubbed. Game-agnostic: text, pictures, strokes and
// sizes are data. Original code (world-layers pass, 2026-10-23).
// Every wall item takes face "z" (on the back wall, the plane z = given z, facing +z), "x" (the left wall, facing +x) or
// "y" (lying flat, with a for its turn); (x, y, z) is the centre of the item on that plane.
import { prop, ID, box, cap, hash, n3 } from "./prim.mjs";
import { textKind } from "./letters.mjs";
import { BY_ID } from "../kit/ids.mjs";
import { planeOf, local, sheetBB, topLeft, imageKind, seg2 } from "./plane.mjs";

// A sheet of paper (or card, cloth, wood) with lines of text; frame: an id for a moulded frame round it; pins: tacks or
// a nail at the top; peel: the bottom corner lifting. ink and ground as textKind; ground null lets `id` show.
export function sheet(name, x, y, z, { w = 0.3, h = 0.4, face = "z", a = 0, lines = [], cell = null, ink = ["lw tar", 0.25], ground = ["lw paper", 0.7], rough = 0, hand = 0, sevenBar = false, stitch = false, gap = 1.6, frame = null, pins = 2, peel = 0, th = 0.0025, id = ID.paper, margin = 0.025 } = {}) {
  const F = planeOf([x, y, z], face, a), longest = Math.max(1, ...lines.map((l) => l.length));
  const c = cell || Math.min((w - 2 * margin) / (6 * longest), (h - 2 * margin) / ((7 + gap) * Math.max(1, lines.length)));
  const kind = lines.length ? textKind(`${name}_text`, lines, { o: topLeft(F, w, h, margin), u: F.u, v: F.v, cell: c, ink, ground: ground || [BY_ID[id].mat, BY_ID[id].tone ?? 0.5], rough, hand, sevenBar, stitch, gap }) : id;
  return prop(name, sheetBB(F, w, h, frame ? 0.03 : 0.02), (px, py, pz, T) => {
    const [lu, lv, ln] = local([px, py, pz], F), lift = peel ? peel * Math.max(0, lu / w + lv / h - 0.4) ** 2 : 0;
    T(Math.max(Math.abs(lu) - w / 2, Math.abs(lv) - h / 2, Math.abs(ln - th - lift) - th), kind);
    if (frame != null) T(Math.max(Math.abs(lu) - w / 2 - 0.022, Math.abs(lv) - h / 2 - 0.022, Math.abs(ln - 0.012) - 0.012, -Math.max(Math.abs(lu) - w / 2 + 0.004, Math.abs(lv) - h / 2 + 0.004)), frame);
    for (let k = 0; k < pins; k++) { const pu = pins === 1 ? 0 : (k / (pins - 1) - 0.5) * (w - 0.04); T(Math.hypot(lu - pu, lv + h / 2 - 0.015, ln - th * 2) - 0.005, ID.iron); }
  });
}

// Pictures for framed photographs: s, t across and down, 0..1 -> [material, tone]
const sepia = (s, t) => ["lw paper", 0.52 - 0.12 * t + 0.04 * Math.sin(s * 9)];
const dark = (tone = 0.18) => ["lw tar", tone];
export const PICTURES = {
  // a row of people standing, n of them; cut: the index scissored out (paper shows)
  people: ({ n = 4, cut = -1 } = {}) => (s, t) => {
    const k = Math.min(n - 1, Math.floor(s * n)), fu = s * n - k, head = Math.hypot((fu - 0.5) * 1.1, (t - 0.32) * 2.2) < 0.17, body = Math.abs(fu - 0.5) < 0.2 + 0.12 * (t - 0.4) && t > 0.42 && t < 0.97;
    if (cut === k && Math.abs(fu - 0.5) < 0.34) return ["lw paper", 0.85];
    return head ? ["lw bone", 0.55] : body ? dark(0.16 + 0.05 * (k % 2)) : sepia(s, t);
  },
  // two people at a wedding: a pale veil on the left figure
  wedding: () => (s, t) => {
    const k = s < 0.5 ? 0 : 1, fu = (s - k * 0.5) * 2, head = Math.hypot((fu - 0.5) * 1.1, (t - 0.3) * 2.2) < 0.15, body = Math.abs(fu - 0.5) < 0.18 + 0.15 * (t - 0.4) && t > 0.4;
    if (k === 0 && (body || (Math.abs(fu - 0.5) < 0.24 && t > 0.15 && t < 0.6 && !head))) return ["lw bone", 0.62];
    return head ? ["lw bone", 0.55] : body ? dark(0.15) : sepia(s, t);
  },
  // one sitter, head and shoulders; long: a long narrow face
  portrait: ({ long = true } = {}) => (s, t) => {
    const face = Math.hypot((s - 0.5) / (long ? 0.13 : 0.17), (t - 0.36) / (long ? 0.22 : 0.18)) < 1, collar = Math.abs(s - 0.5) < 0.09 && t > 0.56 && t < 0.64;
    const coat = t > 0.6 && Math.abs(s - 0.5) < 0.12 + 0.5 * (t - 0.6);
    return collar ? ["lw bone", 0.7] : face ? ["lw bone", 0.5] : coat ? dark(0.14) : Math.hypot(s - 0.5, t - 0.3) < 0.24 ? dark(0.12) : sepia(s, t);
  },
  // a street in flood: a house front with a door, water to the sill, a rowing boat at the door
  flood: () => (s, t) => {
    const water = t > 0.62 + 0.012 * Math.sin(s * 40), house = s < 0.62 && t > 0.12, door = s > 0.22 && s < 0.36 && t > 0.38, win = (s > 0.06 && s < 0.17 || s > 0.44 && s < 0.56) && t > 0.22 && t < 0.4;
    const boat = Math.abs(t - 0.66) < 0.035 && s > 0.5 && s < 0.86 - 0.3 * Math.abs(t - 0.66), man = Math.abs(s - 0.68) < 0.025 && t > 0.55 && t < 0.65;
    if (boat || man) return dark(0.1);
    if (water) return ["lw slate", 0.42 + 0.08 * Math.sin(s * 70 + t * 30)];
    if (house) return door || win ? dark(0.12) : ["lw rope", 0.4];
    return ["lw paper", 0.62];
  },
  // a woodcut goat on a pamphlet cover; back: the head turned over the shoulder
  goatcut: ({ back = false } = {}) => (s, t) => {
    const u = s - 0.5, v = 0.55 - t, d = goatStrokes(u / 0.42, v / 0.42, back) * 0.42;
    return d < 0.018 ? dark(0.1) : t > 0.82 && Math.abs(s - 0.5) < 0.36 && Math.abs(((t - 0.82) * 40) % 1 - 0.5) < 0.18 ? dark(0.2) : ["lw paper", 0.72];
  },
};
// strokes of a goat in unit space (body about 1 wide): distance to the nearest stroke
export function goatStrokes(u, v, back = true) {
  const body = Math.abs(Math.hypot(u / 0.5, (v - 0) / 0.24) - 1) * 0.24;
  const legs = Math.min(seg2(u, v, [[-0.34, -0.18], [-0.37, -0.62]]), seg2(u, v, [[-0.18, -0.22], [-0.16, -0.62]]), seg2(u, v, [[0.2, -0.22], [0.23, -0.62]]), seg2(u, v, [[0.36, -0.18], [0.33, -0.62]]));
  const neck = seg2(u, v, [[0.38, 0.14], [0.52, 0.36]]), tail = seg2(u, v, [[-0.5, 0.04], [-0.6, 0.2]]);
  const head = back ? Math.min(seg2(u, v, [[0.52, 0.36], [0.32, 0.46], [0.28, 0.4]]), seg2(u, v, [[0.46, 0.42], [0.56, 0.62]]), seg2(u, v, [[0.4, 0.44], [0.44, 0.64]]))
    : Math.min(seg2(u, v, [[0.52, 0.36], [0.76, 0.26], [0.8, 0.3]]), seg2(u, v, [[0.56, 0.4], [0.5, 0.6]]), seg2(u, v, [[0.6, 0.38], [0.58, 0.58]]));
  return Math.min(body, legs, neck, tail, head);
}

// A framed photograph: picture is a PICTURES painter; glass "whole", "cracked" (a star from one corner) or "kept" (a
// second, older glass behind, so the frame stands deeper).
export function framedPhoto(name, x, y, z, { w = 0.3, h = 0.4, face = "z", a = 0, picture = PICTURES.people(), glass = "whole", frame = ID.darkwood } = {}) {
  const F = planeOf([x, y, z], face, a), img = imageKind(`${name}_img`, F, w, h, picture), deep = glass === "kept" ? 0.02 : 0;
  const crack = (lu, lv) => { const cu = w / 2 - 0.02, cv = -h / 2 + 0.02; let d = 1e9; for (let k = 0; k < 5; k++) { const an = 2.2 + k * 0.32, L = (0.5 + 0.5 * hash(k, 3, 1)) * Math.max(w, h); d = Math.min(d, seg2(lu, lv, [[cu, cv], [cu + Math.cos(an) * L * 0.5, cv - Math.sin(an) * L * 0.5 + 0.01 * k], [cu + Math.cos(an + 0.15) * L, cv - Math.sin(an + 0.1) * L]])); } return d; };
  return prop(name, sheetBB(F, w + 0.06, h + 0.06, 0.05 + deep), (px, py, pz, T) => {
    const [lu, lv, ln] = local([px, py, pz], F);
    T(Math.max(Math.abs(lu) - w / 2, Math.abs(lv) - h / 2, Math.abs(ln - 0.008 - deep) - 0.003), glass === "cracked" && crack(lu, lv) < 0.0025 ? ID.chalk : img);
    T(Math.max(Math.abs(lu) - w / 2 - 0.028, Math.abs(lv) - h / 2 - 0.028, Math.abs(ln - 0.012 - deep / 2) - 0.012 - deep / 2, -Math.max(Math.abs(lu) - w / 2 + 0.003, Math.abs(lv) - h / 2 + 0.003)), frame);
  });
}

// A pale patch where something hung: a paint layer a shade lighter, standing a hair proud; nest: an inner patch (a
// second thing hung inside the first, then that went too), its own id
export function palePatch(name, x, y, z, { w = 0.6, h = 0.45, face = "z", id = ID.bone, nest = null, nail = true } = {}) {
  const F = planeOf([x, y, z], face);
  return prop(name, sheetBB(F, w, h, 0.01), (px, py, pz, T) => {
    const [lu, lv, ln] = local([px, py, pz], F), edge = 0.004 * n3(px * 30, py * 30, pz * 30);
    T(Math.max(Math.abs(lu) - w / 2 - edge, Math.abs(lv) - h / 2 - edge, Math.abs(ln - 0.0012) - 0.0012), id);
    if (nest) T(Math.max(Math.abs(lu - (nest.du || 0)) - nest.w / 2, Math.abs(lv - (nest.dv || 0)) - nest.h / 2, Math.abs(ln - 0.0026) - 0.0012), nest.id ?? ID.paper);
    if (nail) T(Math.hypot(lu, lv + h / 2 - 0.03, ln - 0.004) - 0.005, ID.rust);
  });
}

// A tide line along a wall from a0 to a1 (x for face "z", z for face "x"), at height y: a brown band and, below it, newer
// plaster a shade too white (below: an id, or null for the band alone); rust: the band also stains anything iron there
export function tideLine(name, a0, a1, wall, y, { face = "z", band = 0.03, below = ID.plaster, bandId = ID.mud } = {}) {
  const fz = face === "z", lo = Math.min(a0, a1), hi = Math.max(a0, a1);
  const bb = fz ? [lo, 0, wall - 0.01, hi, y + band + 0.02, wall + 0.02] : [wall - 0.01, 0, lo, wall + 0.02, y + band + 0.02, hi];
  return prop(name, bb, (px, py, pz, T) => {
    const al = fz ? px : pz, out = (fz ? pz : px) - wall, wav = 0.012 * Math.sin(al * 5.3) + 0.008 * n3(al * 9, 0, 1);
    const along = Math.max(lo - al, al - hi);
    T(Math.max(along, Math.abs(py - y - wav) - band * (0.6 + 0.5 * n3(al * 20, py * 20, 2)), Math.abs(out - 0.0015) - 0.0015), bandId);
    if (below != null) T(Math.max(along, py - (y + wav - band), -py + 0.12, Math.abs(out - 0.0012) - 0.0012), below);
  });
}

// Pencil heights up a door frame: a frame post (frame id) at (x, z) on the wall face, ticks at the given heights; old
// ticks are fainter (painted over); each tick a short dark line on the post's face
export function heightMarks(name, x, z, { face = "z", ticks = [], old = [], post = ID.timber, h = 2.05 } = {}) {
  const F = planeOf([x, h / 2, z], face);
  return prop(name, sheetBB(F, 0.14, h, 0.05), (px, py, pz, T) => {
    const [lu, , ln] = local([px, py, pz], F);
    T(Math.max(Math.abs(lu) - 0.055, Math.abs(py - h / 2) - h / 2, Math.abs(ln - 0.022) - 0.022), post);
    for (const ty of ticks) T(Math.max(Math.abs(lu - 0.01) - 0.035, Math.abs(py - ty) - 0.0025, Math.abs(ln - 0.0445) - 0.0012), ID.tar);
    for (const ty of old) T(Math.max(Math.abs(lu - 0.005) - 0.03, Math.abs(py - ty) - 0.002, Math.abs(ln - 0.0445) - 0.0011), ID.slate);
  });
}

// A figure drawn in strokes on a wall (strokes(u, v) -> distance, in units of s): look "fresh" (white scratches), "old"
// (a soft line under paint), "chalk", or "scrubbed" (chalk with the top half wiped into a smear)
export function strokeMark(name, x, y, z, { face = "z", s = 0.12, look = "fresh", strokes = (u, v) => goatStrokes(u, v, true) } = {}) {
  const F = planeOf([x, y, z], face), wid = { fresh: 0.006, old: 0.008, chalk: 0.009, scrubbed: 0.009 }[look];
  const id = { fresh: ID.chalk, old: ID.bone, chalk: ID.chalk, scrubbed: ID.chalk }[look];
  return prop(name, sheetBB(F, s * 1.6, s * 1.6, 0.01), (px, py, pz, T) => {
    const [lu, lv, ln] = local([px, py, pz], F), u = lu / s, v = -lv / s;
    if (look === "scrubbed" && v > -0.15) { T(Math.max((Math.hypot(u / 0.9, (v - 0.15) / 0.5) - 1) * s * 0.4, Math.abs(ln - 0.001) - 0.001), ID.bone); return; }
    T(Math.max(strokes(u, v) * s - wid, Math.abs(ln - 0.0012) - 0.0012), id);
  });
}
export { ID };

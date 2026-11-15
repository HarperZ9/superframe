// Osby fair on the grass below the Tesks' hill, era 1 (year 0, harvest; content/quota/e1_frost.lwd). Passed to
// worlds/q_country.mjs hill({ dress }) by render/places/q1_osby.mjs (package W3-C addendum, 2026-10-22). Five
// trestle stalls under striped awnings beside the track, a crowd at them, bunting across the track, a hurdle pen
// of goats. Original code; the stall goods are the authored library's (food, gear, straw, wood).
import { prop, box, cyl, cap, ell, ID, hash } from "./prim.mjs";
import { figure } from "../sdf.mjs";
import { loaf, cheese, jug, appleBowl } from "./food.mjs";
import { sack } from "./gear.mjs";
import { sheaf, bale } from "./straw.mjs";
import { barrel } from "./wood.mjs";

// the stalls: centre, the side the counter faces (+1 toward +z, -1 toward -z), the awning's two stripe colours
// laid along the track (centre line z = (0.2 + 0.35 x) / 0.85) on alternate sides, clear of the fold
const STALLS = [
  { at: [-5.0, 0.8], face: -1, cloth: [ID.bonecloth, ID.red], goods: "bread" },
  { at: [1.8, -1.6], face: 1, cloth: [ID.bonecloth, ID.teal], goods: "cheese" },
  { at: [2.6, 3.6], face: -1, cloth: [ID.bonecloth, ID.mustard], goods: "apples" },
  { at: [7.0, 0.7], face: 1, cloth: [ID.bonecloth, ID.cobalt], goods: "grain" },
  { at: [8.4, 6.2], face: -1, cloth: [ID.bonecloth, ID.red], goods: "ale" },
];
const COATS = [ID.sack, ID.darkwood, ID.navy, ID.oxblood, ID.bone, ID.rust, ID.mustard, ID.canvas];

function stall(s, i, gy) {
  const [cx, cz] = s.at, f = s.face, y0 = gy(cx, cz), out = [];
  out.push(prop(`fair_stall_${i}`, [cx - 1.5, y0 - 0.3, cz - 1.1, cx + 1.5, y0 + 2.6, cz + 1.1], (x, y, z, T) => {
    for (const px of [cx - 1.25, cx + 1.25]) for (const pz of [cz - 0.6, cz + 0.6]) T(box(x, y, z, px, y0 + 0.95 + (pz - cz) * f * 0.35, pz, 0.045, 1.25 + (pz - cz) * f * 0.35, 0.045), ID.timber);
    T(box(x, y, z, cx, y0 + 0.86, cz + f * 0.35, 1.3, 0.035, 0.32), ID.plank);   // the counter board on its trestles
    T(box(x, y, z, cx, y0 + 0.45, cz + f * 0.62, 1.28, 0.38, 0.015), ID.sack);   // a cloth hung off the counter's front
    // the awning: canvas sloping down toward the counter side, in stripes across it
    const ay = y0 + 2.2 - (z - cz) * f * 0.35, stripe = Math.floor((x - cx + 1.6) / 0.4) % 2;
    T(Math.max(Math.abs(y - ay) - 0.02, Math.abs(x - cx) - 1.45, Math.abs(z - cz) - 0.95), s.cloth[stripe]);
  }));
  const top = y0 + 0.9, gz = cz + f * 0.3;
  if (s.goods === "bread") for (let k = 0; k < 6; k++) out.push(loaf(cx - 1.0 + k * 0.38, top, gz + (k % 2) * 0.12 * f, { seed: k + 3, name: `fair_loaf_${k}` }));
  if (s.goods === "cheese") for (let k = 0; k < 4; k++) out.push(cheese(cx - 0.9 + k * 0.55, top, gz, { a: k, name: `fair_cheese_${k}` }));
  if (s.goods === "apples") for (let k = 0; k < 4; k++) out.push(appleBowl(cx - 0.9 + k * 0.6, top, gz, { name: `fair_apples_${k}` }));
  if (s.goods === "grain") for (let k = 0; k < 3; k++) out.push(sack(cx - 0.8 + k * 0.8, y0, cz + f * 1.0, { s: 0.34, a: k * 0.7, seed: k + 1, name: `fair_sack_${k}` }));
  if (s.goods === "ale") { out.push(barrel(cx - 0.6, y0, cz - f * 0.2, { name: "fair_barrel_0", tap: true })); out.push(barrel(cx + 0.6, y0, cz - f * 0.2, { name: "fair_barrel_1" })); for (let k = 0; k < 3; k++) out.push(jug(cx - 0.6 + k * 0.6, top, gz, { name: `fair_jug_${k}` })); }
  return out;
}

// one fairgoer: the grotesque figure, coat, face and hands, a straw hat on some
function person(i, fx, fz, a, gy) {
  const r = (k) => hash(i * 7 + k, 911), y0 = gy(fx, fz), child = r(1) < 0.18, h = child ? 1.15 + 0.2 * r(2) : 1.62 + 0.22 * r(2);
  const f = { pos: [fx, y0, fz], h, a, head: child ? 0.17 : 0.2 + 0.03 * r(3), stoop: 0.08 + 0.18 * r(4), girth: (child ? 0.2 : 0.27) + 0.06 * r(5), neck: 0.2, arms: 0.8, hat: r(6) < 0.45 ? 1 : 0 };
  const coat = COATS[Math.floor(r(7) * COATS.length)], hat = r(8) < 0.6 ? ID.straw : ID.darkwood, o = { d: 0, part: 0 };
  return prop(`fair_person_${i}`, [fx - 1.5, y0 - 0.2, fz - 1.5, fx + 1.5, y0 + h + 0.6, fz + 1.5], (x, y, z, T) => {
    const d = figure(x, y, z, f, o); T(d, o.part === 1 ? ID.flesh : o.part === 2 ? hat : coat);
  });
}

export function dressFair(W, L, marks, { hgt, fold }) {
  const gy = (x, z) => hgt(x, z) - 0.06, add = (p) => W.add(p);
  STALLS.forEach((s, i) => stall(s, i, gy).forEach(add));
  // the crowd: a knot at each stall's counter, and people walking the track between
  let n = 0;
  STALLS.forEach((s, i) => {
    const k = 2 + (i % 3);
    for (let j = 0; j < k; j++) { const fx = s.at[0] - 0.9 + j * (1.8 / Math.max(1, k - 1)) + 0.25 * (hash(n, 3) - 0.5), fz = s.at[1] + s.face * (1.25 + 0.45 * hash(n, 5)); add(person(n++, fx, fz, s.face > 0 ? Math.PI / 2 : -Math.PI / 2, gy)); }
  });
  for (let j = 0; j < 12; j++) {
    const fx = -6.0 + j * 1.5 + 0.3 * hash(j, 17), fz = (0.2 + 0.35 * fx) / 0.85 + 0.9 * (hash(j, 19) - 0.5);
    if (Math.hypot(fx - fold[0], fz - fold[1]) < fold[2] + 0.8) continue;
    add(person(n++, fx, fz, hash(j, 23) < 0.5 ? 0.35 : 0.35 + Math.PI, gy));
  }
  // bunting across the track: two poles and a sagging line of pennants
  const P0 = [4.9, 0.4], P1 = [4.3, 3.9], b0 = gy(...P0), b1 = gy(...P1);
  add(prop("fair_bunting", [4.0, Math.min(b0, b1) - 0.3, 0.2, 5.2, Math.max(b0, b1) + 3.2, 4.1], (x, y, z, T) => {
    T(cyl(x, y, z, P0[0], b0 + 1.5, P0[1], 0.05, 1.6), ID.timber); T(cyl(x, y, z, P1[0], b1 + 1.5, P1[1], 0.05, 1.6), ID.timber);
    const t = Math.min(1, Math.max(0, (z - P0[1]) / (P1[1] - P0[1]))), lx = P0[0] + (P1[0] - P0[0]) * t, ly = b0 + 2.95 + (b1 - b0) * t - 0.45 * 4 * t * (1 - t);
    T(Math.max(Math.hypot(x - lx, y - ly) - 0.012, -t, t - 1), ID.rope);
    const k = Math.floor(t * 14), drop = ly - y, w = 0.11 * (1 - drop / 0.24);
    if (t > 0.02 && t < 0.98 && drop > 0 && drop < 0.24) T(Math.max(Math.abs(x - lx) - 0.008, Math.abs(z - (P0[1] + (k + 0.5) * (P1[1] - P0[1]) / 14)) - w), k % 2 ? ID.red : ID.bonecloth);
  }));
  // the hurdle pen and three goats for sale, with a bale for them
  const GX = 11.5, GZ = 2.2, g0 = gy(GX, GZ);
  add(prop("fair_goat_pen", [GX - 1.6, g0 - 0.3, GZ - 1.3, GX + 1.6, g0 + 1.2, GZ + 1.3], (x, y, z, T) => {
    const e = Math.max(Math.abs(x - GX) - 1.4, Math.abs(z - GZ) - 1.1), ring = Math.abs(e) - 0.03;
    for (const ry of [0.25, 0.5, 0.75]) T(Math.max(ring, Math.abs(y - g0 - ry) - 0.035), ID.timber);
    if (Math.abs(e) < 0.06 && ((Math.abs(x - GX) > 1.33 && Math.abs((z - GZ) % 0.7) < 0.05) || (Math.abs(z - GZ) > 1.03 && Math.abs((x - GX) % 0.7) < 0.05))) T(Math.max(ring, Math.abs(y - g0 - 0.45) - 0.45), ID.timber);
    [[-0.6, -0.3, 0.4, ID.bone], [0.3, 0.4, 2.2, ID.darkwood], [0.7, -0.5, 1.2, ID.bone]].forEach(([ox, oz, a, id]) => {
      const c = Math.cos(a), s = Math.sin(a), lx = (x - GX - ox) * c - (z - GZ - oz) * s, lz = (x - GX - ox) * s + (z - GZ - oz) * c, ly = y - g0;
      let d = ell(lx, ly, lz, 0, 0.5, 0, 0.36, 0.17, 0.15); d = Math.min(d, ell(lx, ly, lz, 0.4, 0.72, 0, 0.13, 0.09, 0.08));
      for (const [lgx, lgz] of [[-0.25, -0.08], [-0.25, 0.08], [0.22, -0.08], [0.22, 0.08]]) d = Math.min(d, cap(lx, ly, lz, [lgx, 0.45, lgz], [lgx, 0, lgz], 0.03));
      T(d, id);
    });
  }));
  add(bale(GX - 2.0, g0, GZ - 0.6, { a: 0.3, name: "fair_pen_bale" }));
  add(sheaf(-3.6, gy(-3.6, 4.0), 4.0, { name: "fair_sheaf_0", lean: 0.1 })); add(sheaf(-3.3, gy(-3.3, 4.3), 4.3, { name: "fair_sheaf_1", lean: -0.1 }));
  marks.spots.push({ id: "fair_stalls", verb: "look", at: [2.0, 0, 1.0], note: "the stalls: bread, cheese, apples, grain and ale under striped awnings" }, { id: "goat_pen", verb: "look", at: [10.0, 0, 2.6], note: "three goats in a hurdle pen, for sale" });
}

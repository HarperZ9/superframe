// Exchange Square from the bell tower, The Quota era 2 (the wide lens; design/quota/07-PRODUCTION.md). Edrin's
// Upper Town at dawn on day 41: the grain exchange's columned front on the north side with the public scale
// before it under its iron canopy; five-storey merchants' houses on the west and south sides (dark wool town:
// muted paints); the district office's door; the relief kitchen's cart. The queue is people, not paint: the crowd
// tier's cards (runtime/crowd.mjs) stand along marks.queue.path, as many as the street stocks say, inside
// marks.crowdMask (the open cobbles: not the buildings, the scale's plate, the siding or the hill). standins: n
// bakes n plain cloaked capsules instead, for stills and for a plate seen without the crowd tier; the export
// siding along the east side with its wagons and Halvard's sacks under guard; past the square the hill's
// shoulder with the burial ground's new rows. Snow on the roofs and the cobbles trodden black. The bell
// tower is the camera's place, so it is not drawn.
//   square({ train: true|false, standins: 0, dress: null, season: "winter" | "harvest" | "autumn" })
// season (2026-10-24): era 1's tower view (harvest) and era 3's square (autumn) read as snow at noon, the open cobbles one
// pale field; harvest and autumn lay setts (below). Winter (era 2) is the world as it was, byte for byte.
import { box, cyl, sph, ell, cap, gable, fbm } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID, KIND, BY_ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { seasonOf } from "./_season.mjs";
// the square's open ground by season: winter the cobbles alone (era 2's plates bake unchanged). Harvest and autumn lay
// setts with dark joints, each stone its own tone, so the square reads as paving in sun and not as one pale field; straw
// caught in the joints at harvest, leaves at autumn, banked toward the house fronts. The two kinds are registered only
// when a season asks for them, so era 2's ids never move.
const S = (mat, scale, wet = 0) => ({ mat, scale, wet, emit: null });
const h2 = (i, j, s) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function setts(P, warm, V = {}) {
  const w = V.wet || 0, Sw = (mat, scale) => S(mat, scale * (1 - 0.3 * w), 0.6 * w);   // wet: darker and evenly glossy (no puddle patches)
  const r = Math.floor(P[2] / 0.16), u = P[0] / 0.11 + (r & 1) * 0.5, c = Math.floor(u), fu = u - c, fv = P[2] / 0.16 - r, joint = Math.min(fu, 1 - fu) * 0.11 < 0.011 || Math.min(fv, 1 - fv) * 0.16 < 0.011;
  if (joint) return Sw("lw tar", 0.55);
  const k = h2(c, r, 5), edge = Math.max(0, Math.max(P[2] - 9, -18 - P[0], P[0] - 14)) / 4, litter = h2(c, r, 9) < (warm ? 0.035 : 0.05 + 0.25 * Math.min(1, edge));
  if (litter) return warm ? Sw("lw rope", 0.55) : Sw("lw rust", 0.42);
  return warm ? Sw(k < 0.5 ? "stone" : "lw sand", 0.24 + 0.16 * k) : k < 0.6 ? Sw("lw mud", 0.16 + 0.12 * k) : Sw("stone", 0.1 + 0.08 * k);
}
// slates by season: moss in the courses at harvest, leaves caught at autumn; registered like the setts
function roofOf(s) {
  if (s === "winter") return ID.roof;
  const name = `roof_${s}`;
  if (ID[name] == null) { const k = { id: BY_ID.length, name, mat: "lw slate", scale: 1.0, wet: 0, tone: 0.15, cls: 1, flags: "o", emit: null, detail: (P) => { const c = Math.floor(P[0] / 0.25), r = Math.floor(P[1] / 0.18), q = h2(c, r, 11), course = Math.abs((P[1] / 0.18) % 1 - 0.5) > 0.44; if (course) return S("lw tar", 0.6); if (q < (s === "harvest" ? 0.07 : 0.1)) return s === "harvest" ? S("lw weed", 0.5) : S("lw rust", 0.45); return S("lw slate", 0.8 + 0.4 * q); } }; KIND[name] = k; ID[name] = k.id; BY_ID[k.id] = k; }
  return ID[name];
}
function groundId(s) {
  if (s === "winter") return ID.cobble;
  const name = s === "harvest" ? "setts_harvest" : "setts_autumn";
  if (ID[name] == null) { const k = { id: BY_ID.length, name, mat: "stone", scale: 0.3, wet: 0, tone: 0.35, cls: 1, flags: "o", emit: null, detail: (P, N, V) => setts(P, s === "harvest", V) }; KIND[name] = k; ID[name] = k.id; BY_ID[k.id] = k; }
  return ID[name];
}

const TONES = [ID.oxblood, ID.bone, ID.limewash, ID.mustard, ID.plaster, ID.teal, ID.bone, ID.oxblood];
// the queue's line: from the relief cart at the south-east corner back along the south houses and up the west side
// where the crowd may stand: polygons in world x, z (the open square, the street mouths); the scale's plate cut out
export const CROWD_MASK = { open: [[[-19.5, -14], [-19.5, 13.5], [18.5, 13.5], [18.5, -14]]], closed: [[[-4.8, -11.8], [0.8, -11.8], [0.8, -8.2], [-4.8, -8.2]], [[8.8, 7.4], [13.2, 7.4], [13.2, 11.2], [8.8, 11.2]], [[15.8, -6.2], [20.6, -6.2], [20.6, 2.2], [15.8, 2.2]]] };
export function queuePath() { return [[10, 0, 9.5], [4, 0, 11], [-6, 0, 11], [-14, 0, 10], [-17, 0, 3], [-17.5, 0, -5]]; }
function along(path, t) {
  const seg = []; let tot = 0; for (let k = 1; k < path.length; k++) { const l = Math.hypot(path[k][0] - path[k - 1][0], path[k][2] - path[k - 1][2]); seg.push(l); tot += l; }
  let d = t * tot; for (let k = 1; k < path.length; k++) { if (d <= seg[k - 1]) { const u = d / seg[k - 1]; return [path[k - 1][0] + (path[k][0] - path[k - 1][0]) * u, 0, path[k - 1][2] + (path[k][2] - path[k - 1][2]) * u]; } d -= seg[k - 1]; }
  return path[path.length - 1];
}
export function square({ train = true, standins = 0, dress = null, season = "winter" } = {}) {
  const queue = standins, SN = seasonOf(season), GROUND = groundId(SN), ROOF = roofOf(SN);
  const W = makeWorld({ cell: 3, margin: 0.6 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [], queue: { path: queuePath(), spacing: 0.75 }, crowd: [], crowdMask: CROWD_MASK };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  W.ground((x, y, z, T) => {
    T(y - 0.03 * fbm(x * 0.4, z * 0.4), GROUND);
    // the hill's shoulder beyond the north-east, rising, with the burial ground's terraces
    const hill = y - Math.max(0, (-z - 26) * 0.35 + (x - 6) * 0.12);
    if (z < -24) T(Math.max(hill, -(z + 24)), ID.mud);
    // the siding's bed along the east side (x 20 to 24), rails
    T(Math.max(box(x, y, z, 22, 0.1, -2, 2.2, 0.15, 22), 0), ID.shingle);
    for (const rx of [21.3, 22.7]) T(box(x, y, z, rx, 0.27, -2, 0.05, 0.05, 22), ID.iron);
  });
  // the grain exchange: a columned front on the north side, a pediment, the doors
  add(K.shape([-12, 0, -26, 8, 15, -15], (x, y, z, T) => {
    T(box(x, y, z, -2, 6, -21.5, 9, 6, 4.5), ID.bone); T(gable(x, y, z, -2, 12, -21.5, 9.3, 4.8, 3.2), ID.roof);
    T(box(x, y, z, -2, 0.5, -16.4, 8, 0.5, 1.2), ID.steps);
    for (let k = 0; k < 8; k++) T(cyl(x, y, z, -8.8 + k * 1.95, 4.5, -16.0, 0.38, 3.5), ID.limewash);
    T(box(x, y, z, -2, 8.4, -16.0, 8.4, 0.5, 0.6), ID.limewash); T(Math.max(gable(x, y, z, -2, 8.9, -16.2, 8.4, 0.6, 2.2), -(z + 16.8)), ID.limewash);
    for (const dx of [-4, -2, 0]) T(box(x, y, z, dx, 2.0, -17.0, 0.6, 1.4, 0.06), ID.darkwood);
  }));
  spot("exchange", "enter", [-2, 0, -14.5], "the grain exchange's doors");
  // the public scale: an iron weighbridge plate, the beam on its frame under a canopy
  add(K.shape([-6, 0, -12.5, 2, 5, -7.5], (x, y, z, T) => {
    T(box(x, y, z, -2, 0.05, -10, 2.6, 0.05, 1.6), ID.iron);
    for (const [px, pz] of [[-4.6, -11.6], [0.6, -11.6], [-4.6, -8.4], [0.6, -8.4]]) T(cyl(x, y, z, px, 2.0, pz, 0.08, 2.0), ID.iron);
    T(Math.max(box(x, y, z, -2, 4.1, -10, 2.9, 0.08, 1.9) + 0.25 * Math.abs(z + 10) - 0.3, -(y - 3.9)), ID.iron);
    T(cap(x, y, z, [-3.6, 3.2, -10], [-0.4, 3.0, -10], 0.07), ID.brass); T(cap(x, y, z, [-2, 3.1, -10], [-2, 3.9, -10], 0.05), ID.iron);
  }));
  spot("scale", "read", [-2, 0, -7], "the public scale: the beam, the plate, the book chained to its post");
  // the merchants' houses: the west side (facing +x) and the south side (facing -z), five storeys, muted paints
  for (let i = 0; i < 6; i++) { const hz = 2.2 + rnd(i, 1, 4) * 0.8, cz = -14 + i * 5.2; add(K.house(-22.5, cz, 2.4, hz, 11 + 2.5 * rnd(i, 2, 4), { id: TONES[i % 8], seed: 140 + i, lit: 0.18, face: 1, k: 0, roofId: ROOF })); }
  for (let i = 0; i < 7; i++) { const hx = 2.0 + rnd(i, 3, 4) * 0.9, cx = -18 + i * 5.0; add(K.house(cx, 15.5, hx, 2.3, 10.5 + 3 * rnd(i, 5, 4), { id: TONES[(i + 3) % 8], seed: 160 + i, lit: 0.15, face: -1, k: 0, roofId: ROOF })); }
  // a row on the north side east of the exchange, its fronts toward the square and the tower (the light lead's note:
  // window decay must read from the tower, so more lit panes face it)
  for (let i = 0; i < 3; i++) { const hx = 2.1 + rnd(i, 7, 4) * 0.6, cx = 10 + i * 4.6; add(K.house(cx, -18.5, hx, 2.2, 10 + 2 * rnd(i, 8, 4), { id: TONES[(i + 5) % 8], seed: 180 + i, lit: 0.3, face: 1, k: 0, roofId: ROOF })); }
  // the district office: the house on the west side with the Directorate's banner over its door
  add(K.shape([-20.5, 2.6, -4.2, -19.8, 5.2, -1.8], (x, y, z, T) => T(box(x, y, z, -20.1, 3.9, -3.0, 0.03 + 0.03 * Math.sin(y * 4), 1.2, 0.8), ID.oxblood)));
  spot("district_office", "enter", [-18.8, 0, -3.0], "the district office's door, the banner over it");
  // the relief kitchen's cart at the south-east corner, its stove smoking, a lamp
  add(K.shape([9, 0, 7.5, 13, 3, 11], (x, y, z, T) => {
    T(box(x, y, z, 11, 0.9, 9.2, 1.4, 0.25, 0.8), ID.plank); for (const wx of [10, 12]) T(Math.max(Math.abs(Math.hypot(x - wx, y - 0.5) - 0.45) - 0.05, Math.abs(z - 8.3) - 0.05), ID.timber);
    T(cyl(x, y, z, 11.3, 1.55, 9.2, 0.42, 0.45), ID.iron); T(cyl(x, y, z, 11.3, 2.2, 9.2, 0.06, 0.6), ID.stove);
  }));
  add({ bb: [9.5, 1.5, 9.8, 10.1, 2.2, 10.4], light: { pos: [9.8, 1.9, 10.1], type: 1, I: 8, reach: 8, group: "lantern" }, f: (x, y, z, T) => T(ell(x, y, z, 9.8, 1.85, 10.1, 0.1, 0.14, 0.1), ID.lantern) });
  spot("relief", "queue", [8.5, 0, 9.5], "the relief kitchen's cart: the queue ends here");
  // the queue: plain stand-ins (a cloaked capsule and a head), so the plate carries its length in paint
  for (let k = 0; k < queue; k++) {
    const t = k / Math.max(60, queue), p = along(queuePath(), t), jx = (rnd(k, 7, 9) - 0.5) * 0.5, jz = (rnd(k, 8, 9) - 0.5) * 0.5, s = 0.85 + 0.25 * rnd(k, 9, 9), cx = p[0] + jx, cz = p[2] + jz, id = [ID.navy, ID.darkwood, ID.oxblood, ID.tar, ID.mud][k % 5];
    marks.crowd.push({ at: [cx, 0, cz], h: 1.7 * s });
    add(K.shape([cx - 0.4, 0, cz - 0.4, cx + 0.4, 1.9 * s, cz + 0.4], (x, y, z, T) => { T(Math.max(ell(x, y, z, cx, 0.75 * s, cz, 0.26 * s, 0.85 * s, 0.22 * s), -y), id); T(sph(x, y, z, cx, 1.62 * s, cz, 0.12 * s), k % 3 ? ID.navy : ID.canvas); }));
  }
  // the export siding: wagons, Halvard's sacks being loaded across a plank, guards' brazier (train state)
  if (train) {
    for (let k = 0; k < 5; k++) { const wz = -18 + k * 7; add(K.shape([20.2, 0, wz - 3.3, 23.8, 3.4, wz + 3.3], (x, y, z, T) => {
      T(box(x, y, z, 22, 1.9, wz, 1.45, 1.25, 3.0), ID.oxblood); T(box(x, y, z, 22, 3.25, wz, 1.55, 0.12, 3.1), ID.roof);
      for (const az of [wz - 2, wz + 2]) for (const ax of [20.75, 23.25]) T(Math.max(Math.hypot(y - 0.45, z - az) - 0.42, Math.abs(x - ax) - 0.05), ID.iron);
      if (k === 2) T(box(x, y, z, 20.52, 1.8, wz, 0.04, 1.0, 1.1), ID.coal);   // the open door being loaded
    })); }
    add(K.shape([16, 0, -6, 20.6, 2.2, 2], (x, y, z, T) => {
      T(cap(x, y, z, [17.6, 0.3, -4], [20.5, 1.2, -4], 0.12), ID.plank);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) T(ell(x, y, z, 16.8 + (i % 2) * 0.5, 0.25 + j * 0.4, -2.0 + i * 0.55 + (j % 2) * 0.2, 0.42, 0.2, 0.28), ID.sack);
      for (const gz of [-5.4, 0.8]) { T(Math.max(ell(x, y, z, 18.6, 0.85, gz, 0.26, 0.85, 0.22), -y), ID.navy); T(sph(x, y, z, 18.6, 1.75, gz, 0.13), ID.navy); T(cap(x, y, z, [18.75, 0.9, gz], [18.8, 2.0, gz + 0.1], 0.025), ID.darkwood); }
    }));
    spot("export", "read", [17.5, 0, -1], "the export train: Halvard's sacks loaded under guard while the queue watches");
  }
  // the burial ground's new rows on the hill's shoulder: short posts in lines, the old ones a few, the new many
  add(K.shape([-6, 0, -46, 22, 12, -27], (x, y, z, T) => {
    for (let r = 0; r < 6; r++) for (let c = 0; c < 22; c++) { const px = -3 + c * 1.1 + (r % 2) * 0.4, pz = -29 - r * 2.6, gy = Math.max(0, (-pz - 26) * 0.35 + (px - 6) * 0.12); if (r < 2 && c > 8) continue; T(box(x, y, z, px, gy + 0.35, pz, 0.05, 0.35, 0.05), r >= 2 ? ID.timber : ID.wall); }
  }));
  spot("burial", "read", [8, 0, -26], "the burial ground on the hill's shoulder: the new rows");
  marks.exits.push({ id: "mill_street", at: [14, 0, 14], note: "down Mill Street" }, { id: "haldane_yard", at: [-21, 0, 12], note: "the lane to Haldane Yard" });
  if (dress) dress({ W, L, marks, add });   // an era's own dressing (era 3's washing lines, 2026-10-22); era 2 passes none
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).concat(V.sun ? [{ pos: V.sun.pos, type: 3, I: V.sun.I, reach: 600, key: "sun", soft: V.sun.soft ?? 30 }] : []) };
}

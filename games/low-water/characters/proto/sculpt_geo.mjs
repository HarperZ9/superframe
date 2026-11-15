// Geometry of a built head for the bounds in characters/notes/HEAD-BOUNDS.md: landmarks from the mesh in
// bind space (skin, lip and eye vertices; hair, brows and hats left out), the front profile, the frontal
// half-width and the 40-degree far contour.   headGeo(M, B) -> { H, lm, profile, width, far, ... }
import { MATS } from "../rig/materials.mjs";
import { INDEX } from "../rig/skeleton.mjs";

const HAIR = new Set(["hair", "grey"].map((n) => MATS[n].id)), FACE = new Set(["skin", "flesh", "cheek", "jawcool", "hatline", "scar", "lip", "teeth"].map((n) => MATS[n].id)), EYE = new Set(["white", "eye", "iris", "sclera", "pupil", "catch"].map((n) => MATS[n].id));
export function headGeo(M, B, { yaw = 40 } = {}) {
  const hj = B[INDEX.head].p, hp = M.parts.indexOf("head"), V = [];
  for (let i = 0; i < M.pos.length / 3; i++) {
    if (M.part[i] !== hp) continue; const m = M.mat[i], y = M.pos[i * 3 + 1] - hj[1], z = M.pos[i * 3 + 2] - hj[2];
    // a moustache or beard stands in for the lip and chin it covers (below the nose's root, in front)
    const beard = HAIR.has(m) && y < 0.08 && z > 0.06;
    if (!FACE.has(m) && !EYE.has(m) && !beard) continue;
    V.push({ x: M.pos[i * 3] - hj[0], y: M.pos[i * 3 + 1] - hj[1], z: M.pos[i * 3 + 2] - hj[2], eye: EYE.has(m), lip: m === MATS.lip.id });
  }
  const skin = V.filter((v) => !v.eye), top = skin.reduce((a, v) => Math.max(a, v.y), -9), bin = 0.003;
  // the front profile: the largest z in a 6 mm strip about the midline, per 3 mm of height
  const prof = new Map(); for (const v of skin) if (Math.abs(v.x) < 0.006) { const k = Math.round(v.y / bin); prof.set(k, Math.max(prof.get(k) ?? -1, v.z)); }
  const ks = [...prof.keys()].sort((a, b) => b - a), P = ks.map((k) => [k * bin, prof.get(k)]);
  const zAt = (y) => { let best = null, d = 1e9; for (const [py, pz] of P) if (Math.abs(py - y) < d) { d = Math.abs(py - y); best = pz; } return best; };
  const eyes = V.filter((v) => v.eye && v.x > 0), cornea = eyes.reduce((a, v) => (v.z > a.z ? v : a), { z: -1, y: 0 });
  const within = (y0, y1) => P.filter(([y]) => y <= y0 && y >= y1);
  const argmax = (L) => L.reduce((a, p) => (p[1] > a[1] ? p : a), [0, -1]), argmin = (L) => L.reduce((a, p) => (p[1] < a[1] ? p : a), [0, 9]);
  // pronasale: the furthest point between the eyes and 9 cm below them
  const prn = argmax(within(cornea.y - 0.01, cornea.y - 0.09)), gl = argmax(within(cornea.y + 0.04, cornea.y + 0.005));
  const sn = argmin(within(prn[0] - 0.004, prn[0] - 0.03));
  const ls = argmax(within(sn[0] - 0.003, sn[0] - 0.025)), sto = argmin(within(ls[0] - 0.003, ls[0] - 0.02)), li = argmax(within(sto[0] - 0.002, sto[0] - 0.02));
  const pg = argmax(within(li[0] - 0.012, li[0] - 0.07));
  let me = pg; for (const p of within(pg[0], pg[0] - 0.06)) if (p[1] >= pg[1] - 0.06 * (top - pg[0] + 0.03) && p[0] < me[0]) me = p;
  const H = top - me[0];
  // breadth and length above the brow (the ears are below it)
  const upper = skin.filter((v) => v.y > gl[0] + 0.005), breadth = 2 * upper.reduce((a, v) => Math.max(a, Math.abs(v.x)), 0), length = upper.reduce((a, v) => Math.max(a, v.z), -9) - upper.reduce((a, v) => Math.min(a, v.z), 9);
  // ear: skin vertices outside the head's side (|x| beyond the breadth's 0.86) and behind the cheek, between brow and jaw
  // ears: tagged by the sculpted head in measure mode (material hatline); the old head's are its cheek-coloured ellipsoids out at the side
  const tagged = [], oldEar = [];
  for (let i = 0; i < M.pos.length / 3; i++) { if (M.part[i] !== hp) continue; const m = M.mat[i], x = M.pos[i * 3] - hj[0], y = M.pos[i * 3 + 1] - hj[1];
    if (m === MATS.hatline.id) tagged.push({ x, y }); else if (m === MATS.cheek.id && Math.abs(x) > 0.465 * breadth) oldEar.push({ x, y }); }
  const ear = (tagged.length ? tagged : oldEar).filter((v) => v.x > 0);
  const earLen = ear.length ? ear.reduce((a, v) => Math.max(a, v.y), -9) - ear.reduce((a, v) => Math.min(a, v.y), 9) : 0;
  // E-line: pronasale to pogonion; positive = behind the line
  const eLine = (p) => { const dy = pg[0] - prn[0], dz = pg[1] - prn[1], l = Math.hypot(dy, dz); return ((p[0] - prn[0]) * dz - (p[1] - prn[1]) * dy) / l * Math.sign(dy); };
  // descriptors over 24 heights, vertex to menton
  const Y = Array.from({ length: 24 }, (_, i) => top - (i + 0.5) * H / 24), band = H / 24;
  const width = Y.map((y) => { let w = 0; for (const v of skin) if (Math.abs(v.y - y) < band / 2 && v.z > -0.03) w = Math.max(w, Math.abs(v.x)); return w / H; });
  const c = Math.cos(yaw * Math.PI / 180), s = Math.sin(yaw * Math.PI / 180), proj = skin.map((v) => ({ y: v.y, u: v.x * c + v.z * s }));
  const far = Y.map((y) => { let u = -1; for (const p of proj) if (Math.abs(p.y - y) < band / 2) u = Math.max(u, p.u); return u / H; });
  const profile = Y.map((y) => (zAt(y) ?? 0) / H);
  return { H, top, lm: { gl, cornea: [cornea.y, cornea.z], prn, sn, ls, sto, li, pg, me }, breadth, length, earLen,
    profile, width, far, Y, proj, eLine: { ls: eLine(ls), li: eLine(li) } };
}

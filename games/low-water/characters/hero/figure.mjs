// One hero figure from a cast record (hero/cast.mjs) at a level of detail: the head and its eyes,
// lashes, brows and hair; the coat (body, sleeves, skirt), belt, collar, trousers, boots, gloves,
// hat; the case, lantern and rod. Each sculpted piece is meshed (hero/mesh.mjs), weighted to its
// bones (hero/rig.mjs), mapped (uvs in metres for the scanned cloth and leather) and painted per
// vertex: cloth (cavity, wet, dirt, seam), skin (thickness, flush, stubble, cavity).
//   buildFigure(rec, lod) -> { buckets, B, P, origin, stats }
import { prepare } from "../forge/mesher.mjs";
import { headShapes, headDisp, faceDefaults } from "./head.mjs";
import { bindPose, weigher, J } from "./rig.mjs";
import { torsoCoat, sleeve, skirt, belt, trousers, boot, glove, collar, hat, satchel } from "./garments.mjs";
import { eyes, tearLine, ribbons, growHair, growBrows, growLashes, dome, lantern, rod, surfaceHit, grad } from "./details.mjs";
import { meshBox, Buckets } from "./mesh.mjs";
import { INDEX } from "../rig/skeleton.mjs";

export const LOD = { 0: { k: 1, strands: 1 }, 1: { k: 2.6, strands: 0.3 }, 2: { k: 6.5, strands: 0 } };
const hyp = Math.hypot, cl = (v, a, b) => Math.max(a, Math.min(b, v)), ss = (a, b, t) => { const x = cl((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

export function buildFigure(rec, lod = 0) {
  const L = LOD[lod], P = rec.P, B = bindPose(P), W = weigher(B), face = faceDefaults(rec.face), out = new Buckets();
  const headJ = J(B, "head"), origin = [headJ[0], headJ[1] + P.head - 0.127 * face.s - 0.004, headJ[2] + 0.022];
  const head = { origin };
  const C = { ease: 0.02, hem: 0.38, flare: 0.55, bootTop: 0.36, ...rec.coat, bootTop: rec.bootTop ?? 0.36 };
  const Hat = rec.hat ? hat(head, rec.hat) : null;
  const pieceVerts = () => ({ pos: [], nrm: [], uv: [], col: [], jnt: [], wgt: [], mat: [] });
  const pushW = (V, ws) => { for (const [j, w] of ws) { V.jnt.push(j); V.wgt.push(w); } };

  // the head, shifted to its place; skin paint from the field; triangles under the hat dropped
  const HF = prepare(headShapes(face), { band: 0.01, disp: headDisp(face) });
  const hd = (x, y, z) => HF.d(x - origin[0], y - origin[1], z - origin[2]);
  {
    const V = pieceVerts(), tri = [], cell = 0.0019 * face.s * L.k;
    meshBox({ d: hd, mat: () => "skin" }, [origin[0] - 0.11, origin[1] - 0.27, origin[2] - 0.14], [origin[0] + 0.11, origin[1] + 0.15, origin[2] + 0.135], cell, (p, n) => {
      V.pos.push(...p); V.nrm.push(...n); V.mat.push("skin");
      const q = [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
      V.uv.push(Math.atan2(q[0], q[2]) * 0.09, q[1]);
      let thick = 0.012; for (const h of [0.002, 0.004, 0.007, 0.011]) if (hd(p[0] - n[0] * h, p[1] - n[1] * h, p[2] - n[2] * h) > 0) { thick = h; break; }
      const lips = Math.exp(-(((q[1] + 0.0625) / 0.0075) ** 2) - (q[0] / 0.023) ** 4) * ss(0.08, 0.09, q[2]);
      const flush = cl(lips + 0.5 * Math.exp(-((hyp(q[0], q[1] + 0.035, q[2] - 0.11) / 0.012) ** 2)) + 0.35 * ss(0.06, 0.075, Math.abs(q[0])) * ss(-0.05, -0.03, q[1]) + 0.25 * Math.exp(-((hyp(Math.abs(q[0]) - 0.042, q[1] + 0.035) / 0.022) ** 2)) * ss(0.03, 0.06, q[2]), 0, 1);
      const stub = (face.stubble ?? 0) * ss(-0.035, -0.06, q[1]) * ss(-0.03, 0.0, q[2]) * (1 - lips) * ss(-0.16, -0.12, q[1]) + (face.stubble ?? 0) * Math.exp(-(((q[1] + 0.052) / 0.006) ** 2) - (q[0] / 0.02) ** 4) * ss(0.075, 0.085, q[2]);
      let occ = 0; for (const [h, w] of [[0.002, 0.5], [0.005, 0.35], [0.01, 0.15]]) occ += w * cl((h - hd(p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h)) / h, 0, 1);
      V.col.push(thick / 0.012, flush, cl(stub, 0, 1), occ);
      pushW(V, W(p, ["head", "neck", "chest"], 0.02));
      return V.pos.length / 3 - 1;
    }, tri);
    const under = (v) => Hat && Hat.above(V.pos[v * 3], V.pos[v * 3 + 1] - 0.004, V.pos[v * 3 + 2]);
    out.addPiece(V, tri, (a, b, c) => !(under(a) && under(b) && under(c)));
  }
  const strandOut = (mat, Pp, N, U, Cc, T, tri, bones) => {
    const V = { pos: Pp, nrm: N, uv: U, col: Cc, tan: T, jnt: [], wgt: [], mat: [] };
    for (let i = 0; i < Pp.length / 3; i++) { V.mat.push(mat); pushW(V, bones.length === 1 ? [[INDEX[bones[0]], 1], [0, 0], [0, 0], [0, 0]] : W([Pp[i * 3], Pp[i * 3 + 1], Pp[i * 3 + 2]], bones, 0.03)); }
    out.addPiece(V, tri);
  };
  eyes(face, origin, strandOut, lod === 0 ? 64 : lod === 1 ? 28 : 12);
  if (lod < 2) tearLine(face, origin, strandOut);
  // hair, brows and lashes grown on the head field (head-local), shifted to the head
  const local = (x, y, z) => HF.d(x, y, z), shift = (S) => S.map((s) => ({ ...s, pts: s.pts.map((p) => [p[0] + origin[0], p[1] + origin[1], p[2] + origin[2]]) }));
  const stats = { strands: 0 };
  if (L.strands > 0 && rec.hair) {
    const H = rec.hair, hatLocal = Hat ? (p) => Hat.above(p[0] + origin[0], p[1] + origin[1] - 0.012, p[2] + origin[2]) : () => false;
    const root = (p) => p[1] > (H.line ?? -0.02) - (p[2] < -0.03 ? 0.06 : 0) && !(Math.abs(p[0]) > 0.06 && p[1] < 0.03 && p[1] > -0.06 && p[2] > -0.04 && p[2] < 0.02) && (p[2] < 0.03 || p[1] > 0.075) && !hatLocal(p);
    const comb = (p) => [Math.sign(p[0]) * 0.15 + (H.part ?? 0), -1, -0.45];
    const S = growHair(local, { count: Math.round((H.count ?? 5000) * L.strands), root, comb, len: (p) => (H.len ?? 0.035) * (p[2] < -0.05 ? 1.2 : 1), lift: H.lift ?? 0.0025, w: H.w ?? 0.0008, seed: H.seed ?? 7 });
    stats.strands += ribbons(shift(S), "hair", strandOut, ["head"]);
  }
  if (lod < 2 && rec.brows !== false) stats.strands += ribbons(shift(growBrows(local, face, { count: lod === 0 ? 170 : 60 })), "brow", strandOut, ["head"]);
  if (lod === 0) stats.strands += ribbons(shift(growLashes(face)), "lash", strandOut, ["head"]);
  if (L.strands > 0 && rec.beard) {
    const Bd = rec.beard, root = (p) => p[1] < -0.035 && p[2] > -0.035 && !(Math.abs(p[0]) < 0.026 && p[1] > -0.075 && p[1] < -0.05 && p[2] > 0.07) && p[1] > -0.125;
    const S = growHair(local, { count: Math.round((Bd.count ?? 3000) * L.strands), root, comb: (p) => [0, -1, 0.25], len: () => Bd.len ?? 0.025, lift: 0.002, w: 0.0007, curl: 0.5, seed: 21 });
    stats.strands += ribbons(shift(S), "hair", strandOut, ["head"]);
  }

  // the sculpted pieces
  const coat = torsoCoat(B, P, C), sk = skirt(B, P, C), pieces = [coat, sleeve(B, 1, C), sleeve(B, -1, C), sk, belt(B, coat, sk, C), trousers(B, 1, C), trousers(B, -1, C), boot(B, 1, C), boot(B, -1, C), glove(B, 1, C), glove(B, -1, C), collar(B, head)];
  if (Hat) pieces.push(Hat);
  if (rec.satchel) pieces.push(satchel(B, coat));
  let lightOffset = null;
  if (rec.lantern) { const Lt = lantern(B, "hangL"); for (const p of Lt.parts) pieces.push({ ...p, bones: ["hangL"], kind: "prop" }); lightOffset = Lt.light; }
  if (rec.rod) for (const p of rod(B, "R")) pieces.push({ ...p, kind: "prop" });
  const base = rec.cell ?? 0.0042;
  for (const pc of pieces) {
    const V = pieceVerts(), tri = [], cell = (pc.cell ?? base) * L.k;
    meshBox(pc, pc.lo, pc.hi, cell, (p, n, m) => {
      let mat = m || pc.mat(...p);
      if (pc.kind === "skirt") { const r = [p[0], 0, p[2] - J(B, "pelvis")[2]], l = Math.hypot(r[0], r[2]) || 1; mat = (n[0] * r[0] + n[2] * r[2]) / l < -0.2 ? C.liningMat || "lining" : C.mat || "wool"; }
      if (pc.kind === "hat" && mat === "band" && Math.abs(n[1]) > 0.55) mat = rec.hat.mat || "felt";
      V.pos.push(...p); V.nrm.push(...n); V.mat.push(mat);
      V.uv.push(...uvFor(pc, p, n, B, origin));
      let occ = 0; for (const [h, w] of [[0.004, 0.6], [0.012, 0.4]]) occ += w * cl((h - pc.d(p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h)) / h, 0, 1);
      const dirt = ss(0.5, 0.0, p[1]) * (pc.kind === "skirt" ? 0.8 : 0.5), wet = pc.kind === "skirt" ? ss(C.hem + 0.25, C.hem, p[1]) * 0.5 : pc.kind === "boot" ? 0.3 : 0;
      if (mat === "flame") V.col.push(1, 0.52, 0.18, 1.6); else if (mat === "glass") V.col.push(0, 0, 0, 0); else V.col.push(occ, wet, dirt, seamFor(pc, p, C));
      pushW(V, pc.kind === "skirt" ? skirtWeights(p, sk) : pc.bones.length === 1 ? [[INDEX[pc.bones[0]], 1], [0, 0], [0, 0], [0, 0]] : W(p, pc.bones, pc.sigma ?? 0.03));
      return V.pos.length / 3 - 1;
    }, tri);
    out.addPiece(V, tri);
  }
  // buttons: two rows down the lapped front, on the coat's surface
  if (rec.coat?.buttons !== false) {
    const ch = J(B, "chest"), sp = J(B, "spine");
    for (const x of [0.052, -0.052]) for (const y of [ch[1] + 0.09, ch[1] + 0.01, ch[1] - 0.07, sp[1] + 0.01]) {
      const p = surfaceHit(coat.d, [x, y, ch[2] + 0.25], [0, 0, -1]); if (!p) continue;
      const n = grad(coat.d, p), bw = W(p, ["spine", "chest"], 0.04);
      dome(p, n, 0.0105, (mat, Pp, N, U, Cc, T, tri) => { const V = { pos: Pp, nrm: N, uv: U, col: Cc, tan: T, jnt: [], wgt: [], mat: [] }; for (let i = 0; i < Pp.length / 3; i++) { V.mat.push(mat); pushW(V, bw); } out.addPiece(V, tri); }, ["chest"]);
    }
  }
  return { buckets: out, B, P, origin, lightOffset, stats: { ...stats, ...out.stats() } };
}

function skirtWeights(p, sk) {
  const t = cl((sk.top - p[1]) / (sk.top - sk.hem), 0, 1), wl = 0.5 + 0.5 * Math.tanh(p[0] / 0.05), pel = Math.pow(1 - t, 1.6), rem = 1 - pel;
  const ws = [[INDEX.pelvis, pel], [INDEX.skirtL, rem * wl * 0.62], [INDEX.skirtR, rem * (1 - wl) * 0.62], [INDEX.thighL, rem * wl * 0.38], [INDEX.thighR, rem * (1 - wl) * 0.38]].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const s = ws.reduce((a, w) => a + w[1], 0); return ws.map(([j, w]) => [j, w / s]);
}
// uvs in metres: round the body for the coat and skirt (the wrap at the back seam), round the
// limb for sleeves, legs and boots, by the facing axis elsewhere
function uvFor(pc, p, n, B, origin) {
  const k = pc.kind;
  if (k === "torso" || k === "skirt" || k === "belt" || k === "collar") return [Math.atan2(p[0], p[2] - (k === "collar" ? origin[2] : 0)) * 0.17, p[1]];
  if (k === "sleeve") { const [a, , w] = pc.axis, ax = [w[0] - a[0], w[1] - a[1], w[2] - a[2]], l = hyp(...ax), u = ax.map((v) => v / l), q = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], along = q[0] * u[0] + q[1] * u[1] + q[2] * u[2]; const r = [q[0] - u[0] * along, q[1] - u[1] * along, q[2] - u[2] * along]; return [Math.atan2(r[2], r[1] * Math.sign(u[0] || 1)) * 0.06, along]; }
  if (k === "leg" || k === "boot") { const S = pc.name.endsWith("L") ? "L" : "R", f = J(B, "foot" + S); return [Math.atan2(p[0] - f[0], p[2] - f[2]) * 0.06, p[1]]; }
  if (k === "hat") return Math.abs(n[1]) > 0.6 ? [p[0], p[2]] : [Math.atan2(p[0] - origin[0], p[2] - origin[2]) * 0.1, p[1]];
  const a = [Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2])];
  return a[0] > a[1] && a[0] > a[2] ? [p[2], p[1]] : a[1] > a[2] ? [p[0], p[2]] : [p[0], p[1]];
}
// seams and stitched edges (0..1), drawn by the cloth shader as a sunk, darker line of stitches
function seamFor(pc, p, C) {
  const line = (d, w = 0.0025) => Math.exp(-((d / w) ** 2));
  if (pc.kind === "torso") { const a = Math.abs(Math.atan2(p[0], p[2])); return Math.max(line((a - Math.PI / 2) * 0.17), line((Math.PI - a) * 0.17), line(p[1] - pc.beltY - 0.022)); }
  if (pc.kind === "skirt") return Math.max(line(p[1] - C.hem - 0.018), line(Math.abs(p[0]) - 0.012, 0.004) * (p[2] > 0 ? 1 : 0));
  if (pc.kind === "belt") return line(Math.abs(p[1] - pc.lo[1] - 0.04) - 0.016, 0.0015);
  if (pc.kind === "boot") return Math.max(line(p[1] - 0.026, 0.0015), line(p[1] - C.bootTop + 0.022, 0.002));
  return 0;
}

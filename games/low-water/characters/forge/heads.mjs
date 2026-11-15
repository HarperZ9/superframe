// The head sculptor's builder (ART-DIRECTION 7.1): a person's head sheet (forge/heads.cast.mjs)
// sculpted, detailed, painted and polygonised into a cast member's mesh, with its neck run down into
// its collar and the collar itself when the sheet draws it. cast/parts.mjs head() calls this for
// every person with a sheet, so the portraits, the play-size figures and the fights all get it.
//   sculptHead(M, B, P, id, { lod, expr }) -> { c, sheet }   (c: the old head centre the hats use)
//   headMesh(id, P, { lod, expr }) -> the head alone in head-local metres (bakes, maps, tests)
import { INDEX } from "../rig/skeleton.mjs";
import { MATS } from "../rig/materials.mjs";
import { headShapes } from "./headshapes.mjs";
import { hairShapes } from "./hair.mjs";
import { headPaint } from "./headpaint.mjs";
import { headDetail, HEAD_CELL } from "./detail.mjs";
import { prepare, polygonise } from "./mesher.mjs";
import { DEFAULTS } from "./headkeys.mjs";
import { SHEETS } from "./heads.cast.mjs";

// SCULPTED_HEADS: false puts every person back on the old parametric head (cast/parts.mjs) in one line.
// Override for tests and portraits: env LW_SCULPTED_HEADS=1 (node) or ?sculpted=1 (browser).
// The appeal test R3 (heads-test/PROTOCOL.md) preferred the old portraits about three to one, while the
// new heads are the distinct ones; which ships is the author's call.
const OVERRIDE = globalThis.process?.env?.LW_SCULPTED_HEADS ?? (typeof location !== "undefined" ? new URLSearchParams(location.search).get("sculpted") : null);
export const SCULPTED_HEADS = OVERRIDE != null ? OVERRIDE === "1" : false; // R3 lost the appeal test about 3 to 1 (abbce23); old heads until a round beats them
export const hasHead = (id) => SCULPTED_HEADS && !!(id && SHEETS[id]);
const sm = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

// the head's own height at s = 1 (crown to chin), for sizing it to the body's head length
function natural(h) { const { crown, chin } = headShapes({ ...h, s: 1 }); return crown - chin; }

// Everything about one head at one LOD, in head-local metres: the field, the bounds, the collar.
export function headModel(id, P, { lod = "near", expr = null, neckTo = 0.12 } = {}) {
  const sh = SHEETS[id]; if (!sh) throw new Error(`heads: no sheet for ${id}`);
  const h0 = { ...DEFAULTS, ...sh.head }, height = sh.height_m ?? P.head * (sh.size ?? 1.04);
  const s = sh.head.s ?? height / natural(h0), h = { ...h0, s };
  const { shapes, origin, crown, chin, P: HP } = headShapes(h, expr || {}, { neckTo });
  const pre = prepare(shapes, { band: 0.012 });
  const hair = hairShapes(HP, sh.hair, sh.beard, pre.skin);
  const { D, dropped } = headDetail(HP, sh.detail || [], lod);
  const F = prepare([...shapes, ...hair], { band: 0.012, disp: D });
  return { sh, s, F, HP, origin, crown, chin, dropped, paint: headPaint(HP, sh.paint), cell: HEAD_CELL[lod] };
}

// Built heads are cached per person, level of detail, expression and body proportions, and replayed
// into later meshes (the performance engineer, 2026-10-21: mesh builds rose from about 75 to 125 ms a
// figure, level of detail and tool, and every tool rebuilt the same head).
const HEAD_CACHE = new Map(), ARRS = ["pos", "nrm", "mat", "wj", "ww", "loc", "col"];
export function sculptHead(M, B, P, id, opts = {}) {
  const key = [id, opts.lod || "far", JSON.stringify(opts.expr || {}), JSON.stringify(P)].join("|"), hit = HEAD_CACHE.get(key);
  if (hit) return replayHead(M, hit);
  const v0 = M.pos.length / 3, t0 = M.tri.length, prev = M.cur, res = sculptHeadBuild(M, B, P, id, opts), rec = { res };
  for (const k of ARRS) rec[k] = M[k].slice(v0 * (M[k].length / (M.pos.length / 3)));
  rec.part = M.part.slice(v0).map((p) => M.parts[p]); rec.tri = M.tri.slice(t0).map((v) => v - v0);
  rec.maps = M.headMaps ? { ...M.headMaps, v0: M.headMaps.v0 - v0 } : null; rec.anchors = M.headAnchors; rec.neck = M.headNeck; rec.cur = M.parts[prev];
  if (HEAD_CACHE.size > 400) HEAD_CACHE.clear();
  HEAD_CACHE.set(key, rec); return res;
}
function replayHead(M, rec) {
  const base = M.pos.length / 3, prev = M.cur;
  for (const k of ARRS) { const dst = M[k], src = rec[k]; for (let i = 0; i < src.length; i++) dst.push(src[i]); }
  const ids = new Map(); for (const name of rec.part) if (!ids.has(name)) { M.begin(name); ids.set(name, M.cur); }
  for (const name of rec.part) M.part.push(ids.get(name));
  for (const v of rec.tri) M.tri.push(v + base);
  M.cur = prev;
  if (rec.maps) M.headMaps = { ...rec.maps, v0: rec.maps.v0 + base };
  M.headAnchors = rec.anchors; M.headNeck = rec.neck;
  return rec.res;
}
function sculptHeadBuild(M, B, P, id, { lod = "far", expr = null } = {}) {
  const hj = B[INDEX.head].p, nj = B[INDEX.neck].p, sh = SHEETS[id];
  // first pass for the placement: the crown at the top of the body's head length
  const probe = headModel(id, P, { lod, expr, neckTo: 0.1 });
  const off = [hj[0], hj[1] + P.head * (sh.crownAt ?? 1) - probe.crown, hj[2] + 0.03 * probe.s + (sh.fwd ?? 0)];
  const neckTopY = off[1] + probe.origin[1], neckTo = Math.max(0.03, neckTopY - nj[1] + (sh.neck?.into ?? 0.07));
  const m = headModel(id, P, { lod, expr, neckTo });
  const lo = [-0.2 * m.s, m.chin - 0.06 - neckTo, -0.2 * m.s], hi = [0.2 * m.s, m.crown + 0.06, 0.2 * m.s];
  const prev = M.cur; M.begin("head"); const headStart = M.pos.length / 3;
  const wHead = (y) => { const t = sm(nj[1] + 0.01, hj[1] + 0.04, y); return { head: t, neck: 1 - t }; };
  const local = []; M.headLocal = null;
  polygonise(m.F, { lo, hi, cell: m.cell, tri: M.tri, vert: (p, n, mat) => {
    local.push(p[0], p[1], p[2]);
    const q = [p[0] + off[0], p[1] + off[1], p[2] + off[2]], name = mat || "skin", mm = MATS[name];
    if (!mm) throw new Error(`heads: unknown material ${name} in ${id}`);
    M.paint = name === "skin" ? () => m.paint(p) : null; const v = M.vert(q, n, mm.id, wHead(q[1])); M.paint = null; return v;
  } });
  // per-vertex curvature and cavity for the painter (design/STATE.md, "two figure channels"): the
  // head's vertices are [v0, M.pos.length / 3); vertexMaps(M) spreads them over the whole mesh
  M.headLocal = local; M.headMaps = faceMaps(M, headStart, m.F.d); M.headLocal = null;
  if (sh.collar?.draw) collar(M, B, sh, m, off);
  // anchors in bind space for props that sit on the face (a pipe in the teeth, spectacles)
  const H = m.HP, at = (v) => [v[0] * m.s + off[0], v[1] * m.s + off[1], v[2] * m.s + off[2]];
  M.headAnchors = { mouth: at([0, H.mouth_y, H.mouth_z + 0.004]), mouthR: at([H.mouth_w * 0.8, H.mouth_y - 0.002, H.mouth_z - 0.004]), eyes: at([0, H.eye_y, H.eye_z + H.eye_r]), eyeX: H.eye_x * m.s, crown: [off[0], off[1] + m.crown, off[2]] };
  M.cur = prev;
  // the visible neck, chin to the top of what closes round it (the drawn collar, or the costume's
  // collar: the torso's top plus the sheet's collar.h, 3 cm when not given)
  const c = sh.collar || {}, collarTop = c.draw ? nj[1] - (c.below ?? 0.04) + (c.h ?? 0.06) : nj[1] + 0.02 + (c.h ?? 0.03);
  const neck = { visibleNeck: Math.max(0, off[1] + m.chin - collarTop), headHeight: m.crown - m.chin };
  M.headNeck = neck;
  return { sheet: sh, s: m.s, dropped: m.dropped, top: off[1] + m.crown, ...neck };
}

// The collars the sheet draws itself (the rest are the costume's, named in the sheet).
import { field } from "./sdf.mjs";
function collar(M, B, sh, m, off) {
  const c = sh.collar, nj = B[INDEX.neck].p, ch = B[INDEX.chest].p, r = (c.r ?? m.HP.neck_r * m.s + 0.012), hgt = c.h ?? 0.06, th = c.th ?? 0.01, y0 = nj[1] - (c.below ?? 0.04), zc = nj[2] + (c.z ?? 0.0);
  const shapes = [];
  if (c.kind === "standing" || c.kind === "wing") {
    shapes.push({ t: "cap", a: [nj[0], y0, zc], b: [nj[0], y0 + hgt, zc], r: [r + th * 1.3, r + th], mat: c.mat || "collar", k: 0.004 });
    shapes.push({ t: "cap", a: [nj[0], y0 - 0.05, zc], b: [nj[0], y0 + hgt + 0.05, zc], r: [r, r - th * 0.3], op: "sub", k: 0.003 });
    if (c.kind === "wing" || c.open) shapes.push({ t: "box", c: [nj[0], y0 + hgt * 0.7, zc + r], r: [c.gap ?? 0.018, hgt * 0.55, r * 0.6], op: "sub", k: 0.004 });
    if (c.kind === "wing") for (const x of [-1, 1]) shapes.push({ t: "ell", c: [nj[0] + x * 0.03, y0 + hgt * 0.55, zc + r + 0.004], r: [0.022, 0.016, 0.006], rot: [0, 0, x * 30], mat: c.mat || "collar", k: 0.004 });
  } else if (c.kind === "muffler" || c.kind === "band") {
    const R = r + (c.kind === "muffler" ? 0.02 : 0.004), tube = c.kind === "muffler" ? 0.032 : 0.012;
    shapes.push({ t: "tor", c: [nj[0], y0 + hgt * 0.4, zc], R, r: tube, mat: c.mat || "paper", k: 0.004 });
    if (c.kind === "muffler") shapes.push({ t: "ell", c: [nj[0] + 0.03, y0 - 0.02, zc + R + 0.01], r: [0.035, 0.07, 0.02], rot: [10, 0, 8], mat: c.mat || "paper", k: 0.01 });
  } else throw new Error(`heads: collar kind ${c.kind} is not drawn by the sculptor`);
  const F = prepare(shapes, { band: 0.01 }), pad = 0.08;
  M.begin("collar");
  polygonise(F, { lo: [nj[0] - r - pad, y0 - 0.12, zc - r - pad], hi: [nj[0] + r + pad, y0 + hgt + 0.06, zc + r + pad], cell: Math.max(0.005, m.cell * 1.5), tri: M.tri, vert: (p, n, mat) => M.vert(p, n, MATS[mat || c.mat || "collar"].id, { neck: 0.35, chest: 0.65 }) });
}
export { field };

// The head alone in head-local metres (no body, no placement): for the bake, the maps and the tests.
import { Mesh } from "../rig/body.mjs";
export function headAlone(id, P, { lod = "near", expr = null } = {}) {
  const m = headModel(id, P, { lod, expr, neckTo: 0.06 }), M = new Mesh(); M.begin("head");
  const lo = [-0.2 * m.s, m.chin - 0.14, -0.2 * m.s], hi = [0.2 * m.s, m.crown + 0.06, 0.2 * m.s];
  const stats = polygonise(m.F, { lo, hi, cell: m.cell, tri: M.tri, vert: (p, n, mat) => { M.paint = (mat || "skin") === "skin" ? () => m.paint(p) : null; const v = M.vert(p, n, MATS[mat || "skin"].id, { head: 1 }); M.paint = null; return v; } });
  return { M, model: m, stats };
}

// Curvature and cavity a vertex for the head just built, as bytes: curvature 128 + 127 tanh(H / 60)
// (H the mean curvature in 1/m, convex up), cavity 0 open .. 255 enclosed, read off the field at 3,
// 6 and 12 mm along the normal, inside the band where the head's ellipsoids are exact. The baked
// .lwmesh carries the mesh-exact versions (forge/maps.mjs); these are cheap enough to make at load.
export function faceMaps(M, v0, d) {
  const nv = M.pos.length / 3 - v0, curv = new Uint8Array(nv).fill(128), cav = new Uint8Array(nv), sum = new Float64Array(nv), cnt = new Uint32Array(nv);
  const P = (v, k) => M.pos[v * 3 + k], N = (v, k) => M.nrm[v * 3 + k];
  const edge = (i, j) => { if (i < v0 || j < v0) return; const dx = P(j, 0) - P(i, 0), dy = P(j, 1) - P(i, 1), dz = P(j, 2) - P(i, 2), l2 = dx * dx + dy * dy + dz * dz; if (!l2) return; const k = ((N(j, 0) - N(i, 0)) * dx + (N(j, 1) - N(i, 1)) * dy + (N(j, 2) - N(i, 2)) * dz) / l2; sum[i - v0] += k; cnt[i - v0]++; sum[j - v0] += k; cnt[j - v0]++; };
  for (let t = 0; t < M.tri.length; t += 3) if (M.tri[t] >= v0) { edge(M.tri[t], M.tri[t + 1]); edge(M.tri[t + 1], M.tri[t + 2]); edge(M.tri[t + 2], M.tri[t]); }
  const loc = M.headLocal;   // head-local positions (the field's frame), kept by sculptHead
  for (let i = 0; i < nv; i++) {
    if (cnt[i]) curv[i] = Math.max(0, Math.min(255, Math.round(128 + 127 * Math.tanh(sum[i] / cnt[i] / 60))));
    const p = loc ? [loc[i * 3], loc[i * 3 + 1], loc[i * 3 + 2]] : null; if (!p) continue;
    let occ = 0, ws = 0; [0.003, 0.006, 0.012].forEach((h, k) => { const w = 1 / (k + 1), q = d(p[0] + N(v0 + i, 0) * h, p[1] + N(v0 + i, 1) * h, p[2] + N(v0 + i, 2) * h); occ += w * Math.max(0, Math.min(1, (h - q) / h)); ws += w; });
    cav[i] = Math.round(255 * occ / ws);
  }
  return { v0, n: nv, curv, cav };
}
// Whole-mesh bytes for the rasteriser: 128 and 0 where there is no head.
export function vertexMaps(M) {
  if (M._maps && M._maps.n === M.pos.length / 3) return M._maps;
  const n = M.pos.length / 3, curv = new Uint8Array(n).fill(128), cav = new Uint8Array(n), h = M.headMaps;
  if (h) { curv.set(h.curv.subarray(0, Math.min(h.n, n - h.v0)), h.v0); cav.set(h.cav.subarray(0, Math.min(h.n, n - h.v0)), h.v0); }
  return (M._maps = { n, curv, cav });
}

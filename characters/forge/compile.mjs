// The character forge: a character sheet (JSON, characters/sheets/<who>.json) compiled into the same
// skinned mesh every renderer here consumes (runtime/actor.mjs, the fight drawer, the portrait bake).
// Our own code end to end; no outside modelling tools (author, 2026-10-17).
//
// Sheet: {
//   name, P: { proportions, as the cast modules }, palette?, info?,
//   base?: "<cast module>"          build the body with an existing costume script first, then...
//   drop?: ["part", ...]            ...remove its named parts (e.g. its head) before adding regions
//   regions: [{                     each region is one sculpted, skinned, painted surface
//     name, mat, part?,             material (rig/materials.mjs), part name (hideable)
//     bones: ["head"] | ["chest", "armL"], frame?: "bind" | "<joint>"   shapes are in the first bone's
//                                    bind frame (origin at the joint) unless frame is "bind"
//     shapes: [{ t, ..., op?: "add"|"sub"|"and", k?, mat? }],   per-shape material overrides the region's
//     disp?: [displacements],        folds, wrinkles, noise, pocks (forge/sdf.mjs)
//     paint?: [layers],              per-vertex colour (below)
//     cell?: metres,                 polygon size; small for faces and hands
//   }]
// }
// Paint layers multiply the material colour: { t: "noise", scale, amount, color? } mottling;
// { t: "grad", axis: [x,y,z], from, to, color } a wash along an axis (wet to the thigh, a darker hem);
// { t: "stripes", axis, period, width, color }; { t: "spots", scale, density, color } (stains, scales);
// { t: "dirt", amount, color } dirt in the creases (where the displacement goes in).
import { Mesh, bind } from "../rig/body.mjs";
import { INDEX, JOINTS } from "../rig/skeleton.mjs";
import { MATS } from "../rig/materials.mjs";
import { field, smin, smax, disp, noise, fbm } from "./sdf.mjs";
import { unpackMesh } from "./meshio.mjs";

const CORN = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const TETS = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

// A region's field (shapes, ops, displacement) and its material lookup, in bind space.
function regionField(R, offset) {
  const parts = R.shapes.map((s) => ({ s, f: field(s), op: s.op || "add", k: s.k ?? R.k ?? 0.015 }));
  const D = R.disp ? disp(R.disp) : null;
  const f = (x, y, z) => {
    x -= offset[0]; y -= offset[1]; z -= offset[2];
    let d = 1e9;
    for (const p of parts) { const e = p.f(x, y, z); d = p.op === "sub" ? smax(d, -e, p.k) : p.op === "and" ? smax(d, e, p.k) : smin(d, e, p.k); }
    return D ? d - D(x, y, z) : d;
  };
  const mat = (x, y, z) => {   // the nearest added shape with its own material wins; else the region's
    x -= offset[0]; y -= offset[1]; z -= offset[2]; let best = 1e9, m = R.mat;
    for (const p of parts) if (p.op === "add" && p.s.mat) { const e = p.f(x, y, z); if (e < best && e < 0.004) { best = e; m = p.s.mat; } }
    return m;
  };
  return { f, mat, D };
}
function bounds(R, offset) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], pad = 0.03 + Math.max(0, ...(R.disp || []).map((d) => d.amp || 0)) * 2;
  for (const s of R.shapes) {
    if (s.op === "sub") continue;
    const pts = s.t === "cap" ? [s.a, s.b] : [s.c], r = s.t === "cap" ? Math.max(...[].concat(s.r)) : s.t === "tor" ? s.R + s.r : Math.max(...s.r);
    for (const q of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k] + offset[k] - r - pad); hi[k] = Math.max(hi[k], q[k] + offset[k] + r + pad); }
  }
  return { lo, hi };
}
// Skin weights from distance to the region's bones (each bone a segment from its joint to its child).
function weightsFor(B, bones, p) {
  if (bones.length === 1) return { [bones[0]]: 1 };
  const w = {};
  for (const b of bones) {
    const i = INDEX[b], child = JOINTS.findIndex(([, par]) => par === b), a = B[i].p, c = child >= 0 ? B[child].p : a;
    const ab = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1, t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L2));
    const d = len([ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t]) + 0.02; w[b] = 1 / d ** 4;
  }
  return w;
}
function painter(layers, D, offset) {
  if (!layers || !layers.length) return null;
  return (p) => {
    const x = p[0] - offset[0], y = p[1] - offset[1], z = p[2] - offset[2]; let c = [1, 1, 1];
    const mix = (col, a) => { a = Math.max(0, Math.min(1, a)); c = c.map((v, k) => v * (1 - a) + v * (col ? col[k] : 1) * a); };
    for (const L of layers) {
      if (L.t === "noise") { const n = fbm(x / L.scale, y / L.scale, z / L.scale) * 2 * L.amount; c = c.map((v, k) => v * (1 + n * (L.color ? L.color[k] : 1))); }
      if (L.t === "grad") { const u = x * L.axis[0] + y * L.axis[1] + z * L.axis[2]; mix(L.color, (u - L.from) / (L.to - L.from)); }
      if (L.t === "stripes") { const u = x * L.axis[0] + y * L.axis[1] + z * L.axis[2]; if (((u / L.period) % 1 + 1) % 1 < (L.width || 0.5)) mix(L.color, 1); }
      if (L.t === "spots") { const n = noise(x / L.scale + 7, y / L.scale, z / L.scale); if (n > 1 - (L.density || 0.2)) mix(L.color, (n - (1 - (L.density || 0.2))) / (L.density || 0.2) * 2); }
      if (L.t === "dirt" && D) { const d = D(x, y, z); if (d < 0) mix(L.color || [0.5, 0.45, 0.4], -d * (L.amount || 200)); }
    }
    return c;
  };
}

// Polygonise one region into the mesh, skinned and painted.
function sculpt(M, B, R) {
  const bones = R.bones || ["chest"], offset = R.frame === "bind" ? [0, 0, 0] : B[INDEX[bones[0]]].p;
  const { f, mat, D } = regionField(R, offset), { lo, hi } = bounds(R, offset), cell = R.cell || 0.012;
  const nx = Math.ceil((hi[0] - lo[0]) / cell), ny = Math.ceil((hi[1] - lo[1]) / cell), nz = Math.ceil((hi[2] - lo[2]) / cell);
  if (nx * ny * nz > 6e6) throw new Error(`forge: region ${R.name} is too fine (${nx}x${ny}x${nz} cells); raise its cell`);
  const at = (i, j, k) => (k * (ny + 1) + j) * (nx + 1) + i, V = new Float32Array((nx + 1) * (ny + 1) * (nz + 1));
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) V[at(i, j, k)] = f(lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell);
  const P = (i, j, k) => [lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell], cache = new Map(), e = cell * 0.5;
  const grad = (x, y, z) => { const g = [f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)], l = len(g) || 1; return [g[0] / l, g[1] / l, g[2] / l]; };
  M.paint = painter(R.paint, D, offset); if (R.part) M.begin(R.part);
  const edge = (ia, ib, pa, pb) => {
    const key = ia < ib ? ia * 1e8 + ib : ib * 1e8 + ia; if (cache.has(key)) return cache.get(key);
    const da = V[ia], db = V[ib], t = da / (da - db), p = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t];
    const m = MATS[mat(...p)]; if (!m) throw new Error(`forge: unknown material in region ${R.name}`);
    const v = M.vert(p, grad(...p), m.id, weightsFor(B, bones, p)); cache.set(key, v); return v;
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = CORN.map(([a, b, c]) => at(i + a, j + b, k + c)); let any = 0; for (const q of idx) any |= V[q] < 0 ? 1 : 2; if (any !== 3) continue;
    const pos = CORN.map(([a, b, c]) => P(i + a, j + b, k + c));
    for (const T of TETS) {
      const ins = T.filter((c) => V[idx[c]] < 0), out = T.filter((c) => V[idx[c]] >= 0), E = (a, b) => edge(idx[a], idx[b], pos[a], pos[b]);
      if (ins.length === 1) M.tri.push(E(ins[0], out[0]), E(ins[0], out[1]), E(ins[0], out[2]));
      else if (ins.length === 3) M.tri.push(E(out[0], ins[0]), E(out[0], ins[1]), E(out[0], ins[2]));
      else if (ins.length === 2) { const a = E(ins[0], out[0]), b = E(ins[0], out[1]), c = E(ins[1], out[0]), d = E(ins[1], out[1]); M.tri.push(a, b, d, a, d, c); }
    }
  }
  M.paint = null; if (R.part) M.end();
}

// Drop a named part's triangles from a built mesh (vertices stay; they are not drawn).
function dropParts(M, names) {
  const ids = new Set(names.map((n) => M.parts.indexOf(n)).filter((i) => i >= 0)); if (!ids.size) return;
  const keep = []; for (let t = 0; t < M.tri.length; t += 3) if (!ids.has(M.part[M.tri[t]])) keep.push(M.tri[t], M.tri[t + 1], M.tri[t + 2]); M.tri = keep;
}

// A cast member from a sheet: { P, palette, info, build({ lod, tool }) } like the cast modules.
// packs { far, mid, near }: ArrayBuffers of baked .lwmesh files; when given, build() loads them instead of sculpting.
export function forged(sheet, baseModule = null, packs = null) {
  const scale = { near: 1, mid: 1.6, far: 2.8 };   // polygon size by level of detail
  return {
    P: sheet.P || baseModule.P, palette: { ...(baseModule?.palette || {}), ...(sheet.palette || {}) }, info: { ...(baseModule?.info || {}), ...(sheet.info || {}) }, style: baseModule?.style || null, sheet,
    build({ lod = "far", tool } = {}) {
      if (packs && packs[lod] && (tool == null || tool === (sheet.info?.tool ?? baseModule?.info?.tool))) return unpackMesh(packs[lod], sheet.P || baseModule.P);
      const built = baseModule ? baseModule.build({ lod, tool: tool ?? baseModule.info?.tool }) : { M: new Mesh(), B: bind(sheet.P), grips: { L: false, R: false }, hands: { L: "open", R: "open" } };
      if (sheet.drop) dropParts(built.M, sheet.drop);
      for (const R of sheet.regions || []) sculpt(built.M, built.B, { ...R, cell: (R.cell || 0.012) * (scale[lod] || 1) });
      return built;
    },
  };
}

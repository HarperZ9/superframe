// The walker in the traversal: Lamb, the player, built by the character forge, moved by the body and
// animated by the animator (world/play/), seen through the camera rig. This file is the browser
// host's half: it feeds the solids from what the page has built, skins the figure each frame and
// draws it with the built places' own shader (cloth and lamp materials), so it takes the same
// light, fog and lamps as the town around it.
import { build, P as LAMB, info as LAMB_INFO } from "/characters/cast/lamb.mjs";
import { MATS } from "/characters/rig/materials.mjs";
import { skin } from "/characters/rig/body.mjs";
import { INDEX } from "/characters/rig/skeleton.mjs";
import { makeLibrary } from "/characters/anim/library.mjs";
import { makeSolids, houseSolids } from "../play/solids.mjs";
import { makeTriangleGrid } from "../play/geocheck.mjs";
import { makeBody } from "../play/controller.mjs";
import { makeAnimator, toWorld } from "../play/animator.mjs";
import { makeCamera } from "../play/camera.mjs";
import { readIntent, mapMove } from "../play/input.mjs";
import { groundAt, waterAt } from "./data.mjs";
import { HUE } from "./lights.mjs";

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const BY_ID = Object.fromEntries(Object.entries(MATS).map(([k, m]) => [m.id, { name: k, ...m }]));
const WIND = (() => { const l = Math.hypot(0.0020, 0.0011); return [0.0020 / l, 0.0011 / l]; })();   // the way tree.wgsl bends the trees

export async function makePlayer({ dev, stage, world, scene, lights, at, mode = "follow" }) {
  const timing = await (await fetch("/characters/anim/timing.json")).json(), lib = makeLibrary(timing, {}, null, { lamb: LAMB });
  const fig = build({ lod: "mid" }), M = fig.M, nv = M.pos.length / 3;
  const ground = (x, z) => groundAt(world, x, z), water = (x, z) => waterAt(world, x, z);

  // ---------------------------------------------------------------- solids from what stands here
  const solids = makeSolids({ ground }), trunkR = scene.forest.forms.map(trunkRadius);
  let plansSeen = 0;
  solids.sources.push((x0, z0, x1, z1, emit) => {
    for (const s of scene.built.sites) {
      if (!s.plan || Math.abs(s.x - (x0 + x1) / 2) > s.reach + 40 || Math.abs(s.z - (z0 + z1) / 2) > s.reach + 40) continue;
      if (s.plan.houses) for (const h of s.plan.houses) { if (h.x < x0 - 12 || h.x > x1 + 12 || h.z < z0 - 12 || h.z > z1 + 12) continue; for (const q of (h.solids ||= houseSolids(h))) emit(q); }
      if (s.plan.lamps) for (const l of s.plan.lamps) if (l.x >= x0 - 1 && l.x <= x1 + 1 && l.z >= z0 - 1 && l.z <= z1 + 1) emit(l.solid ||= { kind: "cyl", x: l.x, z: l.z, r: 0.14, y0: ground(l.x, l.z) - 0.5, y1: ground(l.x, l.z) + 5.6 });
      if (s.plan.marks) for (const m of s.plan.marks) {
        // the works' vessels and the coast's stacks; the marsh's reed halls are entered, so they are not solid
        const r = m.kind === "furnace" ? m.size_m * 0.16 : ["stack", "coolingtower", "tank", "seastack"].includes(m.kind) ? m.size_m * 0.5 : 0;
        if (r > 0 && m.wx + r >= x0 && m.wx - r <= x1 && m.wz + r >= z0 && m.wz - r <= z1) emit(m.solid ||= { kind: "cyl", x: m.wx, z: m.wz, r, y0: ground(m.wx, m.wz) - 2, y1: ground(m.wx, m.wz) + m.tall_m });
      }
    }
  });
  solids.sources.push((x0, z0, x1, z1, emit) => {
    // the forest's own cells are 32 m, as these are: one cell of trees for one cell of solids
    const t = scene.forest.cellOf(Math.floor(x0 / 32), Math.floor(z0 / 32)).t;
    for (let i = 0; i < t.length; i += 8) if (t[i + 4] > 0.3) emit({ kind: "cyl", x: t[i], z: t[i + 2], r: trunkR[t[i + 6]] * t[i + 4], y0: t[i + 1] - 1, y1: t[i + 1] + t[i + 7] * 0.55 });
  });

  // the drawn triangles of a town, the coast's stacks and the marsh's halls, for the camera: a town's signs, clutter, cables and people are in the mesh and
  // not in the walls and roofs above. Lamps and icicles are left out (a camera may pass a glow). The
  // works are not fed (millions of triangles); the camera keeps off their vessels as cylinders.
  const mesh = makeTriangleGrid(), fed = new Set(); solids.meshes.push(mesh);
  function feed() {
    for (const s of scene.built.sites) {
      const works = s.plan && s.plan.marks && s.plan.marks.some((m) => m.kind === "furnace");
      if (!s.mesh || fed.has(s) || !s.plan || works) continue;
      fed.add(s); const d = s.mesh.data, O = s.mesh.origin;
      for (let i = 0; i + 35 < d.length; i += 36) if (d[i + 8] !== 16 && d[i + 8] !== 17) mesh.add([d[i] + O[0], d[i + 1] + O[1], d[i + 2] + O[2]], [d[i + 12] + O[0], d[i + 13] + O[1], d[i + 14] + O[2]], [d[i + 24] + O[0], d[i + 25] + O[1], d[i + 26] + O[2]]);
    }
  }

  // the bark of the trees round the walker, for the camera: trunks are cylinders above, but the bare
  // lower branches are not; rebuilt when the walker has gone 12 m (about 25 ms for a dense stand)
  let barkAt = null; const barkSlot = solids.meshes.length; solids.meshes.push(makeTriangleGrid());
  function bark(x, z) {
    if (barkAt && Math.hypot(x - barkAt[0], z - barkAt[1]) < 12) return;
    barkAt = [x, z]; const G = makeTriangleGrid(), forms = scene.forest.forms, R = 24;
    for (let cz = Math.floor((z - R) / 32); cz <= Math.floor((z + R) / 32); cz++) for (let cx = Math.floor((x - R) / 32); cx <= Math.floor((x + R) / 32); cx++) {
      const t = scene.forest.cellOf(cx, cz).t;
      for (let i = 0; i < t.length; i += 8) {
        if (t[i + 4] <= 0.3 || Math.abs(t[i] - x) > R + 6 || Math.abs(t[i + 2] - z) > R + 6) continue;
        const m = forms[t[i + 6]].near, sz = t[i + 4], c = Math.cos(t[i + 3]), sn = Math.sin(t[i + 3]);
        const P = (k) => { const a = m[k] * sz, b = m[k + 1] * sz, d = m[k + 2] * sz; return [a * c + d * sn + t[i], b + t[i + 1], -a * sn + d * c + t[i + 2]]; };
        for (let k = 0; k + 35 < m.length; k += 36) if (m[k + 8] < 0.5 && m[k + 1] * sz < 8) G.add(P(k), P(k + 12), P(k + 24));
      }
    }
    G.cameraOnly = true; solids.meshes[barkSlot] = G;
  }

  // ---------------------------------------------------------------- the body, its animation, the camera
  const body = makeBody({ x: at.x, z: at.z, face: at.yaw ?? 0, y: ground(at.x, at.z) }), anim = makeAnimator({ lib, P: LAMB, coat: LAMB_INFO.coat });
  const cam = makeCamera({ solids, ground, mode, yaw: at.yaw ?? 0 });
  const lantern = lights.carry({ x: at.x, y: 0, z: at.z, col: HUE.paraffin, power: 7, reach: 7, flicker: 0.25 });

  // ---------------------------------------------------------------- the figure's mesh on the GPU
  // static per vertex: material and colour; per frame: place and normal, turned onto the map
  const mats = new Float32Array(nv * 4), headish = new Uint8Array(nv);
  // the forge paints hair on the head sheet at close range only; from behind, at play distance, the skull
  // read as a bare face, so the back of the head above the nape takes the hair's colour
  const hc = fig.B[INDEX.head].p, hairC = MATS.hair.c.map(lin);
  for (let v = 0; v < nv; v++) {
    const m = BY_ID[M.mat[v]] || BY_ID[1];
    let c = m.c.map((x, k) => lin(x) * (M.col[v * 3 + k] ?? 1));
    if (m.name === "skin" && M.pos[v * 3 + 2] < hc[2] - 0.02 && M.pos[v * 3 + 1] > hc[1] + 0.02) c = hairC;
    if (m.emit) mats.set([16, 1.0, 0.72, 0.42], v * 4); else mats.set([19, c[0] * 0.9, c[1] * 0.9, c[2] * 0.9], v * 4);
    // the head and the hat are not drawn from inside them
    let w = 0; for (let k = 0; k < 4; k++) { const j = M.wj[v * 4 + k]; if (j === INDEX.head || j === INDEX.neck) w += M.ww[v * 4 + k]; }
    headish[v] = w > 0.4 ? 1 : 0;
  }
  // the hands hold the rod and the lantern: the closed hands are drawn, the open ones not (rig/solvefig.mjs hiddenOf)
  const hidden = new Set(["handL.open", "handR.open"].map((n) => M.parts.indexOf(n)).filter((i) => i >= 0)), shownTri = [];
  for (let i = 0; i < M.tri.length; i += 3) if (!hidden.has(M.part[M.tri[i]])) shownTri.push(M.tri[i], M.tri[i + 1], M.tri[i + 2]);
  const all = Uint32Array.from(shownTri), fpTri = [];
  for (let i = 0; i < shownTri.length; i += 3) if (!headish[shownTri[i]] && !headish[shownTri[i + 1]] && !headish[shownTri[i + 2]]) fpTri.push(shownTri[i], shownTri[i + 1], shownTri[i + 2]);
  const idx = (a) => { const b = dev.createBuffer({ size: a.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST }); dev.queue.writeBuffer(b, 0, a); return { b, n: a.length }; };
  const full = idx(all), fp = idx(Uint32Array.from(fpTri));
  const verts = new Float32Array(nv * 12), vbuf = dev.createBuffer({ size: verts.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  const inst = new Float32Array(4), ibuf = dev.createBuffer({ size: 16, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  const mod = await stage.module("materials.wgsl", "built.wgsl");
  const layout = [{ arrayStride: 48, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }, { shaderLocation: 1, offset: 12, format: "float32x3" }, { shaderLocation: 2, offset: 24, format: "float32x2" }, { shaderLocation: 3, offset: 32, format: "float32x4" }] },
    { arrayStride: 16, stepMode: "instance", attributes: [{ shaderLocation: 4, offset: 0, format: "float32x4" }] }];
  const pipe = stage.pipe(mod, "vsBuilt", "fsBuilt", layout);

  let out = null, view = null; const last = { anim: null };
  function update(dt, raw, extra = {}) {
    // plans made since the last frame bring their houses into the solids
    const n = scene.built.sites.filter((s) => s.plan).length; if (n !== plansSeen) { plansSeen = n; solids.forget(); }
    feed(); bark(body.state.x, body.state.z);
    const C = cam.state, I = readIntent(raw, dt, C.mode);
    if (I.ui) cam.setMode(I.ui); else if (I.cycle) cam.cycle(); else if (I.nav) cam.setMode(C.mode === "nav" ? "follow" : "nav");
    const onFoot = C.mode !== "nav", moveYaw = view ? view.moveYaw : body.state.face;
    const intent = extra.intent || { move: onFoot ? mapMove(I.move, moveYaw) : [0, 0], run: I.run, face: C.mode === "first" && view ? C.first.yaw : null };
    body.step(dt, intent, { ground, water, solids });
    last.anim = anim.step(dt, body.state, { ground, fp: C.mode === "first" && !C.from ? 1 : C.mode === "first" ? C.w : 0, look: C.first.pitch, reach: I.reach, wind: [WIND[0] * (extra.wind ?? 0.3) * 8, WIND[1] * (extra.wind ?? 0.3) * 8], lock: extra.lock });
    const a = last.anim, neck = toWorld(a.root, a.S[INDEX.neck].p);
    view = cam.update(dt, onFoot ? { ...I, move: [0, 0] } : I, body.state, { ...a, neck });
    // the lantern burns in the left hand
    const lp = toWorld(a.root, a.S[INDEX.hangL].p); Object.assign(lantern, { x: lp[0], y: lp[1] - 0.13, z: lp[2] });
    out = a;
    return view;
  }
  function upload() {
    if (!out) return;
    const sk = skin(M, fig.B, out.S), r = out.root, c = Math.cos(r.face), s = Math.sin(r.face);
    for (let v = 0; v < nv; v++) {
      const px = sk.pos[v * 3], py = sk.pos[v * 3 + 1], pz = sk.pos[v * 3 + 2], nx = sk.nrm[v * 3], ny = sk.nrm[v * 3 + 1], nz = sk.nrm[v * 3 + 2], o = v * 12;
      verts[o] = -c * px + s * pz; verts[o + 1] = py; verts[o + 2] = -s * px - c * pz;
      verts[o + 3] = -c * nx + s * nz; verts[o + 4] = ny; verts[o + 5] = -s * nx - c * nz;
      verts[o + 6] = px; verts[o + 7] = py;
      verts[o + 8] = mats[v * 4]; verts[o + 9] = mats[v * 4 + 1]; verts[o + 10] = mats[v * 4 + 2]; verts[o + 11] = mats[v * 4 + 3];
    }
    inst[0] = r.x; inst[1] = r.y; inst[2] = r.z;
    dev.queue.writeBuffer(vbuf, 0, verts); dev.queue.writeBuffer(ibuf, 0, inst);
  }
  function draw(pass, which) {
    if (!out || which === "shadow") return;
    const I = cam.state.mode === "first" || (cam.state.from && cam.state.from.dist < 0.3 && cam.state.mode !== "nav") ? fp : full;
    pass.setPipeline(pipe); pass.setVertexBuffer(0, vbuf); pass.setVertexBuffer(1, ibuf); pass.setIndexBuffer(I.b, "uint32"); pass.drawIndexed(I.n);
  }
  return { body, anim, cam, solids, update, upload, draw, get view() { return view; }, get pose() { return out; }, figure: { M, B: fig.B, vertices: nv, triangles: M.tri.length / 3 } };
}

// a trunk's radius at breast height, from its own mesh: the widest bark vertex 1 to 2 m up
function trunkRadius(f) {
  let r = 0.15; const a = f.near;
  for (let i = 0; i < a.length; i += 12) if (a[i + 8] < 0.5 && a[i + 1] > 0.8 && a[i + 1] < 2.0) r = Math.max(r, Math.hypot(a[i], a[i + 2]));
  return Math.min(r, 1.2);
}

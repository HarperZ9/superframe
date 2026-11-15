// A sitter for the portrait painter: one cast member posed, framed head and shoulders and rasterised into a
// G-buffer, with what a painter needs to know about the head (where the face is, how big, where the eyes
// are). The bridge between the character rig (characters/) and the painter (painter.mjs), which stays free
// of the rig's imports.
//
// Framing (portrait, not gameplay): the eyes 40 percent down the canvas, the view 0.60 m tall, so the head
// fills about two fifths of the height. Neck correction: a neck longer than 0.55 of the head's length is
// shortened in the picture (the rows between the collar and the jaw are compressed, everything above them
// moves down), the way a portrait painter shortens a neck the camera would show too long. The correction
// is reported (neck.shiftPx) so a sheet can say where it was used.
//
//   sit({ C, who, expr, w, h, rig, yaw, elev, height }) -> { G, A, maps, face, eyes, neck }
import { createCast } from "../../../../characters/runtime/actor.mjs";
import { solveFigure, hiddenOf } from "../../../../characters/rig/solvefig.mjs";
import { skin as skinMesh, groundShift } from "../../../../characters/rig/body.mjs";
import { spriteView, rasterize, makeG, placeFn, castShadow } from "../../../../characters/render/raster.mjs";
import { albedo, shadowDir } from "../../../../characters/render/shade.mjs";
import { PROP_IDS, lying } from "../../../../characters/render/figure.mjs";
import { setExpression } from "../../../../characters/cast/parts.mjs";
import { INDEX } from "../../../../characters/rig/skeleton.mjs";
import { vertexMaps } from "../../../../characters/forge/heads.mjs";

const G_ARRS = [["id", 1], ["N", 3], ["loc", 3], ["depth", 1], ["back", 1], ["wp", 3], ["col", 3], ["shadow", 1], ["mc", 3], ["eyeId", 1]];

export function sit({ C, who, expr = null, timing, w = 640, h = 800, rig, yaw = 34, elev = 6, height = 0.66, neckCap = 0.32, tool = "none" }) {
  setExpression(expr);
  try {
    const Cx = { ...C }, facing = yaw - 32;
    const a = createCast({ timing, members: { [who]: Cx } }).actor(who, { facing }); a.play("idle", { force: true, fade: 1 }); a.update(1 / 60);
    const pose = a.pose(), sk = a.skeleton(pose), W = (j) => a.toWorld(sk[INDEX[j]].p);
    const P = C.P || {}, headLen = P.head || 0.25, hw = W("head");
    const eyeW = [hw[0], hw[1] + headLen * 0.48, hw[2]];
    // a tall canvas first (room above for the neck correction to pull the head down into), the eyes at E0
    const ppm = h / height, E0 = Math.round(1.1 * h), H = Math.round(2.2 * h), bottomY = eyeW[1] - (H - E0) / ppm;
    const view = { yawDeg: yaw, elevDeg: elev, height: H / ppm, centre: [hw[0], bottomY + (H / ppm) / 2, hw[2]] };
    const V = spriteView(view, { w, h: H, height: view.height, centre: view.centre });
    // the G-buffer as characters/render/figure.mjs gbuffer makes it, keeping the mesh for the head's maps
    const G = makeG(w, H), key = `mesh_near_${tool}`, mesh = Cx[key] || (Cx[key] = Cx.build({ lod: "near", tool }));
    const Sk = skinMesh(mesh.M, mesh.B, solveFigure(Cx, mesh, pose)), dy = groundShift(mesh.M, Sk, PROP_IDS, lying(pose));
    const pl = placeFn(facing, [0, dy, 0], 1), hid = hiddenOf(pose, mesh);
    rasterize(V, mesh.M, Sk, G, pl, hid);
    if (rig) castShadow(G, mesh.M, Sk, pl, shadowDir(rig, [0, 1.5, 0]), { hidden: hid, res: 512, size: 1.2 });
    // the eyes even where a lid or a brow covers them (the Quota heads' lid shelf hides the eyeball from the
    // portrait camera): the eye's own triangles rasterised alone, so the painter knows where to open the eye
    { const T = mesh.M.tri, keep = []; for (let t = 0; t < T.length; t += 3) { const m = mesh.M.mat[T[t]]; if (m === 15 || m === 28) keep.push(T[t], T[t + 1], T[t + 2]); }
      if (keep.length) { const G3 = makeG(w, H), tri = mesh.M.tri; mesh.M.tri = keep; try { rasterize(V, mesh.M, Sk, G3, pl, hid); } finally { mesh.M.tri = tri; } G.eyeId = G3.id; } }
    // the sculptor's per-vertex curvature and cavity (sculpted heads only), carried by a second pass as colour
    const vm = vertexMaps(mesh.M), hasMaps = !!mesh.M.headMaps;
    if (hasMaps) {
      const G2 = makeG(w, H), col = mesh.M.col, mc = new Array(vm.n * 3);
      for (let v = 0; v < vm.n; v++) { mc[v * 3] = vm.curv[v] / 255; mc[v * 3 + 1] = vm.cav[v] / 255; mc[v * 3 + 2] = 0; }
      mesh.M.col = mc; try { rasterize(V, mesh.M, Sk, G2, pl, hid); } finally { mesh.M.col = col; }
      G.mc = G2.col;
    }
    // the neck as the picture shows it (measured in the image: chin to collar), shortened past the cap
    const nk = measureNeck(G, E0, headLen * ppm), target = Math.min(nk.visible, neckCap * headLen * ppm), S = Math.max(0, Math.round(nk.visible - target));
    const out = S > 0 ? warpRows(G, nk.chin, nk.collar, S) : G;
    const Gc = crop(out, E0 + S - Math.round(0.4 * h), h);
    Gc.palette = Cx.palette || {}; Gc.view = G.view;
    const A = albedo(Gc, Cx.palette || {});
    // the head's frame in bind space (for the skin's zones): its centre and radius, from the head joint
    const hb = mesh.B[INDEX.head].p, face = { c: [hb[0], hb[1] + headLen * 0.45, hb[2]], R: headLen * 0.5, eyeRow: Math.round(0.4 * h), headPx: headLen * ppm };
    // which way the face turns on screen (its forward, bind +z, through the facing and the view)
    const fw = [Math.sin(facing * Math.PI / 180), 0, Math.cos(facing * Math.PI / 180)]; face.turn = Math.sign(fw[0] * V.right[0] + fw[2] * V.right[2]) || -1;
    const anchors = mesh.M.headAnchors || null;
    return { G: Gc, A, face, anchors, sculpted: hasMaps, neck: { visiblePx: nk.visible, targetPx: Math.round(target), shiftPx: S, cap: neckCap, chin: nk.chin, collar: nk.collar }, ppm, V };
  } finally { setExpression(null); }
}

// chin and collar rows, measured in the picture: the first run of rows below the jaw where the skin narrows
// to a neck (under 0.62 of the face's width), ending where clothing closes round it
const SKIN_IDS = new Set([4, 29, 39]);
function measureNeck(G, eyeRow, headPx) {
  const { w, h } = G, skinN = (y) => { let k = 0; for (let x = 0; x < w; x++) if (SKIN_IDS.has(G.id[y * w + x])) k++; return k; };
  let face = 0; for (let y = Math.max(0, eyeRow - Math.round(headPx * 0.2)); y < Math.min(h, eyeRow + Math.round(headPx * 0.2)); y++) face = Math.max(face, skinN(y));
  // neck rows: skin in the row narrower than 0.62 of the face (straps or a stole beside it do not end it);
  // the longest run of them below the jaw, gaps of a few rows bridged, within two head lengths of the eyes
  let best = [0, 0], run = -1, last = -1;
  for (let y = eyeRow + Math.round(headPx * 0.25); y < Math.min(h, eyeRow + Math.round(headPx * 2)); y++) {
    const sk = skinN(y), neck = sk > 0 && sk < 0.62 * face;
    if (neck) { if (run < 0) run = y; last = y; }
    else if (run >= 0 && y - last > 6) { if (last + 1 - run > best[1] - best[0]) best = [run, last + 1]; run = -1; }
  }
  if (run >= 0 && last + 1 - run > best[1] - best[0]) best = [run, last + 1];
  const [chin, collar] = best;
  return { visible: collar - chin, chin, collar };
}
// rows above the band move down by S; the band [a, b) (a above b on screen) shrinks by S; rows below stay
function warpRows(G, a, b, S) {
  const { w, h } = G, ra = Math.max(0, Math.floor(a)), rb = Math.min(h, Math.ceil(b)), len = rb - ra, nlen = Math.max(1, len - S), O = makeG(w, h);
  O.shadow = G.shadow ? new Float32Array(w * h).fill(1) : undefined; if (G.mc) O.mc = new Float32Array(w * h * 3); if (G.eyeId) O.eyeId = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let src;
    if (y >= rb) src = y; else if (y >= rb - nlen) src = ra + Math.floor(((y - (rb - nlen)) / nlen) * len); else src = y - S;
    if (src < 0) continue;
    for (const [k, c] of G_ARRS) if (G[k] && O[k]) O[k].set(G[k].subarray(src * w * c, (src + 1) * w * c), y * w * c);
  }
  O.view = G.view; return O;
}
function crop(G, y0, h) {
  const w = G.w, O = { w, h };
  for (const [k, c] of G_ARRS) if (G[k]) O[k] = G[k].slice(y0 * w * c, (y0 + h) * w * c);
  return O;
}

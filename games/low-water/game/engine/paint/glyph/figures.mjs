// Glyph-native figures, from each figure's posed skeleton (the shared simulation's pose, recorded by the
// figure drawer in Glyph mode). A figure is capsules (glyph/figcover.mjs); each cell it covers takes its
// part's glyph lit by the light model's key, fill and rim at the figure (glyph/figlight.mjs); a head big
// enough is set as a face with the speaker's mood (glyph/face.mjs), a smaller one as one face letter by
// facing. The glyphs follow the bones, so the figure never swims. A figure behind a nearer surface of the
// world is hidden there. Fight tells are drawn as a ring of type round the feet in the view's hot colour.
// Original code.   drawFigures(figs, grid, out, atlas, o, scene, model)
import { projectPlate } from "../../world/camera.mjs";
import { setBg, tintFg, PALETTES } from "./compose.mjs";
import { makeShaper } from "./shape.mjs";
import { SHAPE_N } from "./atlas.mjs";
import { J, partsOf, boxOf, coverOf, ringLum, contactShadow, segFoot } from "./figcover.mjs";
import { screenLights, lightCell, shadeCell, separate, quietBand, MAT } from "./figlight.mjs";
import { faceCells, faceFits } from "./face.mjs";
const shapers = new WeakMap(), occF = new Float32Array(SHAPE_N);
const HATS = { lamb: "brim", keel: "cap", fewell: "cap", strand: "cap", gorm: "cap", hobb: "cap", bright: "cap", coe: "cap", warden: "cap", salvor: "cap", ned: "brim", will: "cap", holt: "cap", abel: "cap" };
const lineGlyph = (dx, dy) => { const a = ((Math.atan2(dy, dx) + Math.PI * 2) % Math.PI) / (Math.PI / 4); return ["-", "\\", "|", "/"][Math.round(a) % 4]; };
const shaperOf = (atlas, set = "") => { const k = `s${set}`; let m = shapers.get(atlas); if (!m) shapers.set(atlas, (m = {})); return m[k] || (m[k] = makeShaper(atlas, set || undefined)); };

function facingOf(F, pj, toCam) {
  const fx = Math.cos(F.face || 0), fz = Math.sin(F.face || 0), tl = Math.hypot(...toCam) || 1, front = (fx * toCam[0] + fz * toCam[1]) / tl;
  const yaw = (pj.camera.yawDeg * Math.PI) / 180, side = fx * Math.cos(yaw) + fz * -Math.sin(yaw);
  return front > 0.45 ? "front" : front < -0.45 ? "back" : side > 0 ? "right" : "left";
}
// one covered cell's glyph and colour (not the head)
function paintCell(oi, cell, ctx) {
  const { out, atlas, o, L, col, rims, shaper } = ctx, s = cell.best;
  if (s.k === "line") { const g = atlas.index(lineGlyph(s.b[0] - s.a[0], s.b[1] - s.a[1])); out.G[oi] = g; for (let c = 0; c < 3; c++) { out.FG[oi * 3 + c] = 200 * MAT.tool[c] + 40; out.BG[oi * 3 + c] = Math.round(out.BG[oi * 3 + c] * 0.6); } return; }
  const lc = lightCell(cell, segFoot(cell.cx, cell.cy, s), L), sh = shadeCell(cell, lc, L, s.m === "coat" ? col : MAT[s.m] || MAT.coat);
  let gi = sh.rim || cell.bcov < 0.6 ? atlas.index(lineGlyph(s.b[0] - s.a[0], s.b[1] - s.a[1])) : atlas.index(sh.ch);
  if (sh.rim) rims.add(oi);
  if (shaper && cell.on >= 2 && cell.on <= SHAPE_N - 2) { for (let r = 0; r < SHAPE_N; r++) occF[r] = cell.occ[r]; gi = shaper.pick(occF, Math.max(atlas.cov[gi], 0.18)); }
  if (o.weight !== false && sh.bold) gi = atlas.cut(gi, "bold");
  out.G[oi] = gi; out.EM[oi] = 0;
  for (let c = 0; c < 3; c++) { out.FG[oi * 3 + c] = sh.fg[c]; out.BG[oi * 3 + c] = sh.rim ? Math.round(out.BG[oi * 3 + c] * 0.5) : sh.bg[c]; }
}
const skinOf = (L, k = 0.8) => MAT.skin.map((v, c) => Math.round(255 * (1 - Math.exp(-2.2 * v * (L.amb[c] * 1.4 + L.key.c[c] * k + L.fill.c[c] * 0.3) * 1.6))));
// the head: a face where it fits (glyph/face.mjs); the cells keep their face letter otherwise
function paintHead(F, S, ctx, scene) {
  const { out, atlas, grid, L, cover, facing } = ctx, head = S.find((s) => s.k === "head"); if (!head || !faceFits(head.r, grid.cw, grid.ch)) return;
  const skin = skinOf(L), talk = scene.talkFace && scene.talkFace.who === (F.who || F.id) ? scene.talkFace.face : null;
  const cells = faceCells({ cx: head.a[0], cy: head.a[1], r: head.r }, { facing, mood: talk || F.mood || "neutral", gaze: F.gaze || 0, hat: HATS[F.who] }, grid, atlas);
  for (const [oi, { g, role }] of cells) {
    if (!cover.has(oi) || cover.get(oi).best !== head) continue;
    const back = role === "hat" || role === "hair" || role === "edge" ? 0.16 : 0.62, ink = role === "skin" ? 0.8 : role === "feature" ? 0.12 : role === "edge" ? 0.75 : 0.45;
    out.G[oi] = g; for (let c = 0; c < 3; c++) { out.BG[oi * 3 + c] = Math.round(skin[c] * back); out.FG[oi * 3 + c] = Math.round(skin[c] * ink); }
    ctx.faced.add(oi);
  }
}
// a small head: one face letter by facing (o front, < > side, @ the back of the head), a hat's brim above
function headLetter(oi, cell, ctx, F) {
  const { out, atlas, facing } = ctx, up = (cell.cy - cell.best.a[1]) / cell.best.r, skin = skinOf(ctx.L);
  const g = up < -0.35 && HATS[F.who] ? (HATS[F.who] === "brim" ? "=" : "_") : facing === "front" ? "o" : facing === "back" ? "@" : facing === "right" ? ">" : "<";
  out.G[oi] = atlas.index(g);
  for (let c = 0; c < 3; c++) { out.FG[oi * 3 + c] = g === "@" ? Math.round(skin[c] * 0.3) : skin[c]; out.BG[oi * 3 + c] = Math.round(skin[c] * 0.3); }
}
function tellRing(F, feet, ctx) {
  const { out, atlas, grid, cover, ppm } = ctx, { ox, oy, cw, ch, cols, rows, C } = grid;
  const k = Math.max(0, Math.min(1, F.tell.k || 0)), R0 = 0.6 * (1.3 - 0.3 * k) * ppm, sE = Math.sin((C.pj.camera.elevDeg * Math.PI) / 180), g = atlas.index(F.tell.kind === "grab" ? "x" : F.tell.unstoppable ? "#" : "o");
  for (const R of F.tell.unstoppable ? [R0, R0 + 0.14 * ppm] : [R0]) for (let a = 0; a < 32; a++) {
    const t = (a / 32) * Math.PI * 2, x = Math.floor((feet[0] + Math.cos(t) * R - ox) / cw), y = Math.floor((feet[1] + Math.sin(t) * R * sE - oy) / ch); if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
    const oi = y * cols + x; if (cover.has(oi)) continue; out.G[oi] = atlas.cut(g, "bold"); out.EM[oi] = Math.round(120 + 120 * k); out.HOT[oi] = 1; out.FG[oi * 3] = 255; out.FG[oi * 3 + 1] = Math.round(120 + 60 * k); out.FG[oi * 3 + 2] = 60; out.BG[oi * 3] = 40; out.BG[oi * 3 + 1] = 14; out.BG[oi * 3 + 2] = 10;
  }
}
function lanternAt(F, ctx) {
  const { out, atlas, grid, toS } = ctx, j = F.joints, L = toS(j[J.hangL] || j[J.handL]), x = Math.floor((L[0] - grid.ox) / grid.cw), y = Math.floor((L[1] + grid.ch * 0.6 - grid.oy) / grid.ch);
  if (x >= 0 && y >= 0 && x < grid.cols && y < grid.rows) { const oi = y * grid.cols + x; out.G[oi] = atlas.cut(atlas.index("*"), "bold"); out.EM[oi] = 220; out.FG[oi * 3] = 255; out.FG[oi * 3 + 1] = 205; out.FG[oi * 3 + 2] = 120; }
}
function paintCells(F, fi, ctx) {
  const { out, owner } = ctx;
  for (const [oi, cell] of ctx.cover) {
    if (cell.best.k === "head") headLetter(oi, cell, ctx, F); else paintCell(oi, cell, ctx);
    owner[oi] = fi; if (out.figPart) out.figPart.set(oi, `${F.id || F.who}|${cell.best.k === "head" ? "head" : cell.best.m}`);   // for the parts measure
    if (out.figOcc && cell.on >= 2 && cell.on <= SHAPE_N - 2) out.figOcc.set(oi, cell.occ);   // for the outline measure
  }
}
function drawOne(F, fi, base, scene, model) {
  const { grid, out, atlas, o, toS, dep, ppm, toCam } = base, pj = grid.C.pj, j = F.joints;
  const S = partsOf(F, toS, dep, ppm), box = boxOf(S, grid), cover = coverOf(S, grid, box, o);
  const feetW = [(j[J.footL][0] + j[J.footR][0]) / 2, (j[J.footL][1] + j[J.footR][1]) / 2, (j[J.footL][2] + j[J.footR][2]) / 2], feet = toS(feetW);
  const L = screenLights(model.figure(feetW, F.face || 0), pj.camera), col = (F.palette && F.palette.coat && F.palette.coat.c) || MAT.coat;
  const ctx = { ...base, L, col, cover, rims: new Set(), faced: new Set(), facing: facingOf(F, pj, toCam), shaper: o.shape !== false ? shaperOf(atlas) : null };
  if (o.shadow !== false && o.palette !== "paper") contactShadow(out, atlas, grid, feet, cover, ppm, [L.key.v[0], L.key.v[1]]);
  const ring = ringLum(out, atlas, grid, box, cover);
  paintCells(F, fi, ctx); paintHead(F, S, ctx, scene);
  const paper = o.palette === "paper", sep = paper ? { dark: true, figure: 0, k: 1 } : separate(out, atlas, cover, ring, ctx.rims);
  if (paper) for (const oi of cover.keys()) { setBg(out.BG, oi, { paper: [233, 227, 212] }, 0, 0, 0); for (let c = 0; c < 3; c++) out.FG[oi * 3 + c] = 30; }
  if (o.quiet !== false && !paper) quietBand(out, atlas, grid, box, cover, sep.dark);
  if (o.palette === "green" || o.palette === "amber") for (const oi of cover.keys()) { tintFg(out.FG, oi, PALETTES[o.palette]); for (let c = 0; c < 3; c++) out.BG[oi * 3 + c] = Math.round(out.FG[oi * 3 + c] * 0.3); }   // a phosphor screen has one colour
  (globalThis.__lwGlyphSep ||= {})[F.id || F.who] = { ring: +ring.toFixed(1), figure: +sep.figure.toFixed(1), dark: sep.dark, rim: ctx.rims.size, face: ctx.faced.size };
  if (F.offhand === "lantern" || (F.info && F.info.offhand === "lantern")) lanternAt(F, ctx);
  if (F.tell && F.team !== "lamb") tellRing(F, feet, ctx);
}
// a crowd (the night brawl): where two figures overlap, the farther one's cells along the nearer one's edge drop to
// a dark line, so bodies in a press stay separate shapes instead of one mass of type
function crowdEdges(owner, out, grid) {
  const { cols, rows } = grid;
  for (let v = 0; v < cols * rows; v++) {
    const a = owner[v]; if (a < 0) continue; const x = v % cols, y = (v / cols) | 0;
    let edge = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= cols || Y >= rows) continue; if (owner[Y * cols + X] > a) { edge = true; break; } }
    if (edge) for (let c = 0; c < 3; c++) { out.FG[v * 3 + c] = Math.round(out.FG[v * 3 + c] * 0.3); out.BG[v * 3 + c] = Math.round(out.BG[v * 3 + c] * 0.25); }
  }
}
export function drawFigures(figs, grid, out, atlas, o, scene, model) {
  const { C, z, left, top } = grid, pj = C.pj, f = C.fwd, cp = C.camPos;
  const toS = (p) => { const s = projectPlate(pj.camera, pj.width, pj.height, p); return [(s[0] - left) * z, (s[1] - top) * z]; };
  const dep = (p) => (p[0] - cp[0]) * f[0] + (p[1] - cp[1]) * f[1] + (p[2] - cp[2]) * f[2];
  const base = { grid, out, atlas, o, toS, dep, ppm: (pj.pxPerMetre || 80) * z, owner: new Int16Array(grid.cols * grid.rows).fill(-1), toCam: [-f[0], -f[2]] };
  const pelvis = (F) => (F.joints && F.joints[J.pelvis] ? dep(F.joints[J.pelvis]) : 0);
  const list = [...figs].filter((F) => F.joints && F.joints.length).sort((a, b) => pelvis(b) - pelvis(a));   // far figures first, so a nearer one is drawn over
  list.forEach((F, fi) => drawOne(F, fi, base, scene, model));
  if (o.crowdEdge !== false && list.length > 1) crowdEdges(base.owner, out, grid);
}

// The paint language's specimen swatches (design/art/PAINT-LANGUAGE.md; the regression image for the painted style and
// a design tool for the author, after the inspiration batch's specimen sheets). One small synthetic object per swatch
// (a block on a ground: a lit face, a lit top, a shadow face, and the ground), painted three ways:
//   strokes: each stroke type alone (knife, rigger, dry broken, loaded wet, scumble, glaze, stroke light)
//   materials: each material under stroke light with its own stroke (stone, timber, plaster, brick, wool, felt,
//              skin, frost, bread)
//   eras: one street corner (plaster, a window lit at dusk) through each era's palette, and decay
// Writes <out>/<row>-<name>.png and <out>/swatches.json; render/tools/specimen_sheet.py lays them out with labels.
//   node render/tools/specimen.mjs [--out game/capture/paint/specimen]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { strokeLight } from "../v2/strokelight.mjs";
import { language } from "../v2/language.mjs";
import { rn } from "../rn.mjs";
const { writePng } = await import(rn("tools/shaders/png.mjs"));
const argv = process.argv.slice(2), out = argv[argv.indexOf("--out") + 1] && argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : "game/capture/paint/specimen";
mkdirSync(out, { recursive: true });
const W = 360, H = 300, clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
function hash(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
// material: base colour and a texture function of the face's own (u, v) in pixels
const MAT = {
  stone: { c: [0.62, 0.6, 0.55], tex: (u, v) => 0.92 + 0.12 * hash(u >> 3, v >> 3, 1) - (Math.abs((v % 22) - 11) < 0.8 ? 0.2 : 0) },
  timber: { c: [0.46, 0.32, 0.2], tex: (u, v) => 0.85 + 0.2 * (0.5 + 0.5 * Math.sin(u * 0.9 + Math.sin(v * 0.07) * 4)) },
  plaster: { c: [0.82, 0.78, 0.68], tex: (u, v) => 0.94 + 0.08 * hash(u >> 4, v >> 4, 3) },
  brick: { c: [0.58, 0.28, 0.2], tex: (u, v) => { const row = Math.floor(v / 8), x = (u + (row % 2) * 10) % 20; return (v % 8 < 1.2 || x < 1.2) ? 0.6 : 0.9 + 0.15 * hash(Math.floor((u + (row % 2) * 10) / 20), row, 4); } },
  wool: { c: [0.42, 0.16, 0.13], tex: (u, v) => 0.85 + 0.25 * hash(u >> 1, v >> 1, 5) },
  felt: { c: [0.3, 0.33, 0.3], tex: (u, v) => 0.92 + 0.1 * hash(u >> 2, v >> 2, 6) },
  skin: { c: [0.84, 0.62, 0.5], tex: (u, v) => 0.96 + 0.06 * hash(u >> 3, v >> 3, 7) },
  frost: { c: [0.82, 0.85, 0.9], tex: (u, v) => 0.95 + 0.08 * hash(u >> 1, v >> 2, 8) },
  bread: { c: [0.36, 0.24, 0.14], tex: (u, v) => 0.8 + 0.3 * hash(u >> 2, v >> 2, 9) },
  paper: { c: [0.88, 0.84, 0.74], tex: (u, v) => (v % 9 < 1 && u > 20 && u < 70 ? 0.3 : 1) },
};
const NAMES = ["", "ground", "window", ...Object.keys(MAT)], ID = Object.fromEntries(NAMES.map((n, i) => [n, i]));
// the block: corners in screen space (an isometric box), faces lit from the upper left
function scene(mat, { window = false, light = [1.0, 0.86, 0.66] } = {}) {
  const n = W * H, rgba = new Uint8ClampedArray(n * 4), id = new Uint8Array(n), nrm = new Float32Array(n * 3), depth = new Float32Array(n);
  const cx = W / 2, top = 40, w = 92, h = 120, d = 46, M = MAT[mat], gy = top + 2 * d + h - 30;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let col, N, k, idv;
    const u = (x - cx) / w, v = (y - (top + d)) / d, lx = x - (cx - w), rx = x - cx;
    const leftTop = top + d + lx * (d / w), rightTop = top + 2 * d - rx * (d / w);
    if (Math.abs(u) + Math.abs(v) <= 1) { N = [0, 1, 0]; k = 0.95; idv = ID[mat]; col = M.c.map((c) => c * M.tex(x, y * 2)); }
    else if (lx >= 0 && x < cx && y >= leftTop && y < leftTop + h) { const fy = y - leftTop; N = [-0.7, 0, 0.7]; k = 0.85; idv = ID[mat]; col = M.c.map((c) => c * M.tex(lx, fy));
      if (window && lx > 30 && lx < 60 && fy > 30 && fy < 72) { idv = ID.window; col = [1.0, 0.82, 0.5]; k = 1.2; } }
    else if (rx >= 0 && x < cx + w && y >= rightTop && y < rightTop + h) { N = [0.7, 0, 0.7]; k = 0.3; idv = ID[mat]; col = M.c.map((c) => c * M.tex(rx, y - rightTop)); }
    else if (y > gy - 40 + (x - cx) * 0.3 * 0 && y > top + 2 * d + 10) { const sh = x > cx && y < rightTop + h + (x - cx) * 0.5 && x < cx + w * 2.2; N = [0, 1, 0]; k = sh ? 0.32 : 0.78; idv = ID.ground; col = [0.5, 0.46, 0.4].map((c) => c * (0.9 + 0.1 * hash(x >> 2, y >> 2, 11))); }
    else { idv = 0; col = [0.2, 0.2, 0.24]; N = [0, 0, 1]; k = 1; }
    id[i] = idv; nrm.set(N, i * 3); depth[i] = idv === ID.ground ? 200 - y : 100 - y * 0.2;
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = clamp(col[c] * k * (idv && idv !== ID.window ? light[c] : 1)) * 255; rgba[i * 4 + 3] = 255;
  }
  return { rgba, id, nrm, depth };
}
const cam = { yawDeg: 34, elevDeg: 36 }, rec = [], save = (row, name, img, note) => { writePng(join(out, `${row}-${name}.png`), { width: W, height: H, data: img }); rec.push({ row, name, note }); };
// row 1: each stroke type alone
const base = scene("stone"), names = NAMES;
save("strokes", "plain", base.rgba, "the block unpainted (the reference)");
for (const [t, note] of [["knife", "palette knife: long flat planes"], ["glaze", "glaze: a transparent dark on the shadow family"], ["dry", "dry broken: the canvas through a dragged brush"], ["scumble", "scumble: thin broken light over the far planes"]])
  save("strokes", t, language(base.rgba, W, H, { id: base.id, depth: base.depth, names }, { era: 2, decay: t === "dry" ? 0.9 : 0, only: [t] }), note);
const doc = scene("paper"); save("strokes", "rigger", language(doc.rgba, W, H, { id: doc.id, depth: null, names: names.map((n) => (n === "paper" ? "paper" : n)) }, { only: ["rigger"] }), "rigger: written things kept as fine lines");
const lamp = scene("plaster", { window: true }); save("strokes", "wet", language(lamp.rgba, W, H, { id: lamp.id, depth: null, names }, { only: ["wet"] }), "loaded wet: a warm light's pool run together");
save("strokes", "light", strokeLight(base.rgba, W, H, { id: base.id, nrm: base.nrm, names, cam }, { scale: 1.5, strength: 1 }), "stroke light: loaded strokes on the lit planes, the shadow glazed");
// row 2: each material under stroke light, with its own stroke
for (const m of ["stone", "timber", "plaster", "brick", "wool", "felt", "skin", "frost", "bread"]) { const s = scene(m); save("materials", m, strokeLight(s.rgba, W, H, { id: s.id, nrm: s.nrm, names, cam }, { scale: 1.5, strength: 1.2 }), m); }
{ const s = scene("brick"); save("materials", "frost-on-brick", strokeLight(s.rgba, W, H, { id: s.id, nrm: s.nrm, names, cam }, { scale: 1.5, strength: 1.2, frost: 1 }), "frost on a red object: the wind's streaks"); }
// row 3: the eras (and decay) on one street corner with a lit window
const corner = scene("plaster", { window: true }), lit = strokeLight(corner.rgba, W, H, { id: corner.id, nrm: corner.nrm, names, cam }, { scale: 1.5 });
for (const e of [1, 2, 3, 4, 5]) save("eras", `era${e}`, language(lit, W, H, { id: corner.id, depth: corner.depth, names }, { era: e }), `era ${e}`);
save("eras", "decay", language(lit, W, H, { id: corner.id, depth: corner.depth, names }, { era: 2, decay: 0.9 }), "era 2, the street's stock fallen (decay 0.9)");
writeFileSync(join(out, "swatches.json"), JSON.stringify(rec, null, 1));
console.log(`specimen: ${rec.length} swatches in ${out}`);

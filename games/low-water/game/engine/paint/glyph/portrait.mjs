// Glyph portraits in the dialogue box (design/art/GLYPH-LANGUAGE.md section 2). The bake
// (glyph/tools/portraits.mjs) keeps, per cell of a 60 x 50 grid, the lit tone, the part shown, the part's
// 3 x 4 cover and the rim; here that is set as type for the frame's own grid of cells:
//   skin     its value in the ground, a sparse mark by tone over it
//   eyes     the mark whose ink lies where the eye's cover is (the lids and the gaze come from the geometry)
//   brows    a line mark matched to the brow's cover, slanted by the mood where the mood asks for it
//   lips     a line mark matched to the mouth's cover, or the mood's mouth
//   hair, hat, wool, felt, cloth: their own languages; the Hesh blue thread stays blue
//   rim      an edge cell facing away from the viewer, brighter and in the bold cut
// The eight moods ride on the four sculpted expressions (MOOD_BASE) with the brows and mouth set by the mood.
// Original code.   const P = await glyphPortrait(set, who)   portraitCells(P, { mood, light, cols, rows }, atlas, look) -> cells
import { makeShaper } from "./shape.mjs";
import { SHAPE_N } from "./atlas.mjs";
import { gradeCell } from "./eras.mjs";

const cache = new Map(), shapers = new WeakMap();
export const MOOD_BASE = { neutral: "neutral", wary: "wary", startled: "startled", set: "set", warm: "neutral", anxious: "wary", angry: "set", grieving: "wary", afraid: "startled", contempt: "set", lying: "wary" };
const BROW = { angry: ["\\", "/"], anxious: ["/", "\\"], grieving: ["/", "\\"], afraid: ["/", "\\"] }, MOUTH = { warm: "u", grieving: "^", contempt: "/", lying: "~", afraid: "o" };
const LANGS = { skin: ".:;=+*#", hair: "~%%&", hat: "=##", wool: "%&&#", felt: "=HH#", clothLight: " .:;", clothDark: ":;%%", hatline: "--=", thread: "~~" };
const INK = { skin: [0.8, 0.6, 0.48], hair: [0.25, 0.2, 0.17], hat: [0.12, 0.11, 0.12], wool: [0.24, 0.22, 0.21], felt: [0.5, 0.42, 0.3], clothLight: [0.86, 0.83, 0.76], clothDark: [0.22, 0.22, 0.25], hatline: [0.95, 0.85, 0.75], thread: [0.25, 0.42, 0.9] };

export function glyphPortrait(set, who) {
  const k = `${set}/${who}`; if (cache.has(k)) return cache.get(k);
  const p = fetch(`/characters/glyph-${set}/${who}.json`).then((r) => (r.ok ? r.json() : null)).then((P) => { if (P) P.grids = {}; cache.set(k, P); return P; }).catch((e) => { console.warn(`glyph portrait ${k}: ${e.message}`); cache.set(k, null); return null; });
  cache.set(k, p); return p;
}
// the baked cells of one expression and light: { tone, part, bits, rim } arrays
function decode(P, expr, light) {
  const key = `${expr}|${light}`; if (P.grids[key]) return P.grids[key];
  const m = P.moods[expr] || P.moods.neutral, s = (m && (m[light] || m.paraffin)) || ""; const b = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)), n = P.cols * P.rows;
  const S = P.stride || 4, g = { tone: new Uint8Array(n), part: new Uint8Array(n), bits: new Uint16Array(n), rim: new Uint8Array(n), alb: new Uint8Array(n * 3) };
  for (let i = 0; i < n; i++) { g.tone[i] = b[i * S]; g.part[i] = b[i * S + 1]; g.bits[i] = b[i * S + 2] | ((b[i * S + 3] & 15) << 8); g.rim[i] = b[i * S + 3] >> 4; if (S >= 7) for (let c = 0; c < 3; c++) g.alb[i * 3 + c] = b[i * S + 4 + c]; }
  return (P.grids[key] = g);
}
// the frame's cell (x, y) from the bake's grid: the bake cells under it, the expressive parts first
function sample(P, g, x, y, cols, rows) {
  const sx = P.cols / cols, sy = P.rows / rows, x0 = Math.floor(x * sx), y0 = Math.floor(y * sy), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx)), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
  let best = -1, bw = -1, tone = 0, n = 0, rim = 0;
  for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
    const k = j * P.cols + i, p = P.parts[g.part[k]], w = p === "eye" ? 9 : p === "mark" ? 7 : p === "brow" || p === "lip" ? 6 : p === "bg" ? 0 : 1; tone += g.tone[k]; rim = Math.max(rim, g.rim[k]); n++;
    if (w > bw) { bw = w; best = k; }
  }
  const alb = g.alb[best * 3] || g.alb[best * 3 + 1] ? [g.alb[best * 3] / 255, g.alb[best * 3 + 1] / 255, g.alb[best * 3 + 2] / 255] : null;
  return { part: P.parts[g.part[best]], bits: g.bits[best], tone: Math.round(tone / n), rim, k: best, alb };
}
const shaperOf = (atlas, set) => { let m = shapers.get(atlas); if (!m) shapers.set(atlas, (m = {})); return m[set] || (m[set] = makeShaper(atlas, set)); };
function featureGlyph(s, mood, side, atlas) {
  const occ = new Float32Array(SHAPE_N); for (let r = 0; r < SHAPE_N; r++) occ[r] = (s.bits >> r) & 1;
  if (s.part === "brow" && BROW[mood]) return atlas.index(BROW[mood][side < 0 ? 0 : 1]);
  if (s.part === "lip" && MOUTH[mood]) return atlas.index(MOUTH[mood]);
  const set = s.part === "eye" || s.part === "mark" ? "o0O.,'`-_=()" : "-_~/\\^=`',.";
  return shaperOf(atlas, set).pick(occ, s.part === "eye" || s.part === "mark" ? 0.24 : 0.14);
}
const enc = (v) => Math.round(255 * Math.max(0, Math.min(1, v)));
// one frame cell: glyph, ink and ground
function setCell(s, ctx, x) {
  const { atlas, mood, cols, look } = ctx, t = s.tone / 15, side = x < cols / 2 ? -1 : 1;
  if (s.part === "bg") return { g: atlas.index(" "), fg: look.ground, bg: look.ground };
  if (s.part === "white") return { g: atlas.index(" "), fg: [0, 0, 0], bg: [enc(0.75 * t + 0.1), enc(0.72 * t + 0.1), enc(0.68 * t + 0.1)] };
  if (s.part === "eye" || s.part === "brow" || s.part === "lip" || s.part === "mark") { const sk = (s.alb && s.part !== "mark" ? s.alb : INK.skin).map((v) => enc(v * (0.25 + 0.75 * t) * 0.6)); return { g: featureGlyph(s, mood, side, atlas), fg: s.part === "lip" ? sk.map((v) => Math.round(v * 0.45)) : [16, 12, 12], bg: sk }; }
  const L = LANGS[s.part] || LANGS.clothDark, c = s.alb && s.part !== "thread" ? s.alb.map((v) => Math.min(1, v * 1.15)) : INK[s.part] || INK.clothDark, ch0 = L[Math.min(L.length - 1, Math.floor(t * L.length))];
  const fg = c.map((v) => enc(v * (0.35 + 0.95 * t))), bg = s.part === "skin" || s.part === "clothLight" || s.part === "hatline" ? c.map((v) => enc(v * (0.08 + 0.42 * t))) : fg.map((v) => Math.round(v * 0.3));
  const rimmed = s.rim >= 2 && t > 0.2;
  let g = atlas.index(ch0); if (t > 0.72 || rimmed) g = atlas.cut(g, "bold");
  return { g, fg: rimmed ? fg.map((v) => Math.min(255, v + 60)) : fg, bg };
}
// the portrait as cells for a frame cols x rows: [{ g, fg, bg }] row by row; the era's palette over it
export function portraitCells(P, { mood = "neutral", light = "paraffin", cols, rows }, atlas, look) {
  const g = decode(P, MOOD_BASE[mood] || "neutral", light), out = [], FG = new Uint8ClampedArray(3), BG = new Uint8ClampedArray(3), ctx = { atlas, mood, cols, look };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const sm = sample(P, g, x, y, cols, rows), c = setCell(sm, ctx, x); c.part = sm.part;
    if (look && look.grade > 0) { FG.set(c.fg); BG.set(c.bg); gradeCell(FG, BG, 0, look, c.part === "thread" ? 1 : 0.35); c.fg = [...FG]; c.bg = [...BG]; }
    out.push(c);
  }
  return out;
}

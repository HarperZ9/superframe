// Glyph's atlas: every character the renderer sets (printable ASCII, box drawing, the materials'
// extra glyphs), drawn once at the cell size in three cuts, with its measured ink coverage, its ink as
// offsets for the raster, and a soft copy (the glyph blurred) for glyph-shaped bloom. A character the
// font draws nothing for falls back to an ASCII stand-in. Original code.
//   const A = buildAtlas({ cw, ch, font, extra })   A.index(char) -> glyph number (the regular cut)
//   A.cut(g, "bold" | "small" | "regular") -> the same character in that cut; A.ink[g] -> { off, al }
//   A.soft[g] -> { w, h, al: Float32Array } (three cells wide and tall, centred on the glyph)
// The cuts (design/art/GLYPH-LANGUAGE.md section 3): regular; bold, the same letter struck twice a
// little apart (key light and nearness: weight); small, the letter at three quarters size (distance:
// size). The house mono (LW Conso) is a proportional face: a letter wider than the cell is drawn
// narrowed to fit it, so every character keeps one cell.
import { ASCII, EXTRA, SUBST, STANDIN, glyphOf } from "./charset.mjs";
export const SHAPE_COLS = 3, SHAPE_ROWS = 4, SHAPE_N = SHAPE_COLS * SHAPE_ROWS;
export const CUTS = ["regular", "bold", "small"];
const SHADES = { "█": 1, "▓": 0.36, "▒": 0.22, "░": 0.1 };

// one glyph's alpha in a cw x ch cell: centred, narrowed to fit, struck twice for bold, shrunk for small
function drawGlyph(g, ch0, { cw, ch, font, cut }) {
  g.clearRect(0, 0, cw, ch); g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  const size = cut === "small" ? 0.75 : 1;
  g.font = size === 1 ? font : font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${(+n * size).toFixed(1)}px`);
  const w = g.measureText(ch0).width, fit = w > cw * 0.93 * size ? (cw * 0.93 * size) / w : 1;
  g.save(); g.translate(cw / 2, ch / 2 + 0.5 + (size < 1 ? ch * 0.08 : 0)); g.scale(fit, 1);
  g.fillText(ch0, 0, 0); if (cut === "bold") g.fillText(ch0, Math.max(0.55, cw / 14) / fit, 0);
  g.restore();
  return g.getImageData(0, 0, cw, ch).data;
}
// block and shade characters are made, not drawn: a font's are rarely the cell's size
function shadeAlpha(shade, cw, ch, cut) {
  const a = new Uint8Array(cw * ch), s = cut === "small" ? shade * 0.6 : cut === "bold" ? Math.min(1, shade * 1.4) : shade;
  for (let i = 0; i < cw * ch; i++) a[i] = shade === 1 || ((i % cw) + Math.floor(i / cw)) % 2 === 0 ? Math.round(255 * Math.min(1, s * 2)) : 0;
  return a;
}
function measure(chars, { cw, ch, font }) {
  const c = document.createElement("canvas"); c.width = cw; c.height = ch;
  const g = c.getContext("2d", { willReadFrequently: true }), n0 = chars.length, alpha = [], cov = new Float32Array(n0 * CUTS.length);
  CUTS.forEach((cut, ci) => chars.forEach((x, k) => {
    const shade = SHADES[x]; let a;
    if (shade != null) a = shadeAlpha(shade, cw, ch, cut);
    else { const d = drawGlyph(g, x, { cw, ch, font, cut }); a = new Uint8Array(cw * ch); for (let i = 0; i < cw * ch; i++) a[i] = d[i * 4 + 3]; }
    let s = 0; for (let i = 0; i < cw * ch; i++) s += a[i];
    alpha.push(a); cov[ci * n0 + k] = s / (255 * cw * ch);
  }));
  return { alpha, cov };
}
// soft copies for bloom: a glyph enlarged into a 3 x 3 cell field and blurred (a separable box blur, twice)
function softOf(a, cw, ch) {
  const w = cw * 3, h = ch * 3, f = new Float32Array(w * h);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const v = a[y * cw + x] / 255; if (!v) continue; for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) { const X = Math.floor(cw + (x - cw / 2) * 1.5 + cw / 2 + dx - 1), Y = Math.floor(ch + (y - ch / 2) * 1.5 + ch / 2 + dy - 1); if (X >= 0 && Y >= 0 && X < w && Y < h) f[Y * w + X] = Math.max(f[Y * w + X], v); } }
  const blur = (r) => {
    const t = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, m = 0; for (let k = -r; k <= r; k++) { const X = x + k; if (X >= 0 && X < w) { s += f[y * w + X]; m++; } } t[y * w + x] = s / m; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, m = 0; for (let k = -r; k <= r; k++) { const Y = y + k; if (Y >= 0 && Y < h) { s += t[Y * w + x]; m++; } } f[y * w + x] = s / m; }
  };
  blur(2); blur(3);
  return { w, h, al: f };
}
// each glyph's shape: its ink in a 3 x 4 grid of the cell (glyph/shape.mjs matches it against what lies under the cell)
function describe(alpha, cw, ch) {
  const n = alpha.length, desc = new Float32Array(n * SHAPE_N);
  for (let k = 0; k < n; k++) {
    const a = alpha[k];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const r = Math.min(SHAPE_ROWS - 1, Math.floor((y * SHAPE_ROWS) / ch)) * SHAPE_COLS + Math.min(SHAPE_COLS - 1, Math.floor((x * SHAPE_COLS) / cw)); desc[k * SHAPE_N + r] += a[y * cw + x] / 255; }
    for (let r = 0; r < SHAPE_N; r++) desc[k * SHAPE_N + r] /= (cw * ch) / SHAPE_N;
  }
  return desc;
}

export function buildAtlas({ cw = 8, ch = 12, font = '12px "LW Conso", Consolas, monospace', extra = "" } = {}) {
  const base = [...new Set([...ASCII, ...EXTRA, ...extra])], n0 = base.length, extraSet = new Set([...extra]);
  const { alpha, cov } = measure(base, { cw, ch, font }), n = alpha.length, chars = CUTS.flatMap(() => base);
  const at = new Map(base.map((x, k) => [x, k]));
  // any character: itself if the set has it (and the font drew it), else its substitute, else the stand-in; never "?"
  const index = (x) => {
    let c = glyphOf(x, extraSet), k = at.get(c);
    if (k == null || (cov[k] < 0.005 && c !== " ")) { const sub = SUBST[c]; k = at.get(sub != null && sub !== "" ? sub : STANDIN); }
    if (k == null || (cov[k] < 0.005 && c !== " ")) k = at.get(".");
    return k;
  };
  const cut = (g, name) => { const ci = CUTS.indexOf(name); return ci < 0 ? g : (g % n0) + ci * n0; };
  let inkW = 0, ink = null;
  const inkFor = (W) => { if (W === inkW && ink) return ink; inkW = W; ink = alpha.map((a) => { const off = [], al = []; for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (a[y * cw + x] > 20) { off.push(y * W + x); al.push(a[y * cw + x] / 255); } return { off: Int32Array.from(off), al: Float32Array.from(al) }; }); return ink; };
  const softCache = new Map(), soft = (k) => { let s = softCache.get(k); if (!s) softCache.set(k, (s = softOf(alpha[k], cw, ch))); return s; };
  return { chars, cov, cw, ch, index, cut, n0, inkFor, soft, n, alpha, desc: describe(alpha, cw, ch), font };
}

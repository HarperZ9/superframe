// Lettering for authored props: a full 5x7 set of capitals, figures and the common marks, laid on any plane as a surface
// kind (a notice, a handbill, a headline, a label, a slip, a stitched sampler, a carving). Game-agnostic: the text, the plane
// and the inks are data. Each call registers one surface kind in kit/ids.mjs's tables, appended after the kinds already
// there, so no other place's ids move. Original code (world-layers pass, 2026-10-23); the era 4 kit's lettering
// (render/props/e4_kinds.mjs) carries 29 of these glyphs and is left as it is so its plates' recipes do not change.
//
//   textKind(name, lines, { o, u, v, cell, ink, ground, rough, gap, hand, sevenBar, stitch })
//     o       the top-left corner of the first glyph, in world metres
//     u, v    unit vectors along the line (rightward) and down the page
//     cell    metres per dot (a glyph is 5 x 7 dots, 6 x (7 + gap) with its spacing)
//     ink     [material, tone] for the letters; ground [material, tone] for the page, or null to let the surface show
//             (the kind then returns the ground tone of the page; use it on a thin panel)
//     rough   0..1, breaks dot edges (paint, chalk, a knife point)
//     hand    0..1, a wandering baseline and uneven glyph widths, for writing by hand
//     sevenBar  true crosses the 7 (a continental hand); the default 7 has no bar
//     stitch  true draws each dot as a cross, for a sampler
import { KIND, ID, BY_ID } from "../kit/ids.mjs";
import { n3, hash } from "./noise.mjs";

const S = (mat, scale) => ({ mat, scale, wet: 0, emit: null });
export function kindL(name, mat, scale, tone, detail) {
  if (ID[name] != null) return ID[name];
  const k = { id: BY_ID.length, name, mat, scale, wet: 0, tone, cls: 2, flags: "", emit: null, detail };
  KIND[name] = k; ID[name] = k.id; BY_ID[k.id] = k; return k.id;
}
// 5x7 glyphs, a row string per glyph, top row first
export const GLYPHS = {
  A: "01110100011000111111100011000110001", B: "11110100011000111110100011000111110", C: "01110100011000010000100001000101110",
  D: "11110100011000110001100011000111110", E: "11111100001000011110100001000011111", F: "11111100001000011110100001000010000",
  G: "01110100011000010111100011000101111", H: "10001100011000111111100011000110001", I: "01110001000010000100001000010001110",
  J: "00111000100001000010000101001001100", K: "10001100101010011000101001001010001", L: "10000100001000010000100001000011111",
  M: "10001110111010110101100011000110001", N: "10001100011100110101100111000110001", O: "01110100011000110001100011000101110",
  P: "11110100011000111110100001000010000", Q: "01110100011000110001101011001001101", R: "11110100011000111110101001001010001",
  S: "01111100001000001110000010000111110", T: "11111001000010000100001000010000100", U: "10001100011000110001100011000101110",
  V: "10001100011000110001100010101000100", W: "10001100011000110101101011010101010", X: "10001100010101000100010101000110001",
  Y: "10001100010101000100001000010000100", Z: "11111000010001000100010001000011111",
  0: "01110100011001110101110011000101110", 1: "00100011000010000100001000010001110", 2: "01110100010000100010001000100011111",
  3: "11111000100010000010000011000101110", 4: "00010001100101010010111110001000010", 5: "11111100001111000001000011000101110",
  6: "00110010001000011110100011000101110", 7: "11111000010001000100010000100001000", 8: "01110100011000101110100011000101110",
  9: "01110100011000101111000010001001100",
  "&": "01100100101010001000101011001001101", "-": "00000000000000011111000000000000000", ".": "00000000000000000000000000110001100",
  ",": "00000000000000000000011000010001000", "'": "01100001000100000000000000000000000", "?": "01110100010000100010001000000000100",
  "!": "00100001000010000100001000000000100", ":": "00000011000110000000011000110000000", "/": "00001000100001000100010000100010000",
  "(": "00010001000100001000010000010000010", ")": "01000001000001000010000100010001000", '"': "01010010100101000000000000000000000",
};
const SEVEN_BAR = "11111000010001011111010000100001000";

// textKind: see the header. Returns the surface id.
export function textKind(name, lines, { o, u, v, cell = 0.02, ink = ["lw tar", 0.25], ground = ["lw paper", 0.7], rough = 0, gap = 1.6, hand = 0, sevenBar = false, stitch = false }) {
  return kindL(name, (ground || ink)[0], 1, 0.6, (P) => {
    const d = [P[0] - o[0], P[1] - o[1], P[2] - o[2]];
    let a = (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / cell, b = (d[0] * v[0] + d[1] * v[1] + d[2] * v[2]) / cell;
    const line = Math.floor(b / (7 + gap));
    if (hand) { b -= hand * 1.4 * Math.sin(a * 0.11 + line * 1.7); a *= 1 + hand * 0.08 * Math.sin(line * 2.3); }
    const j = rough ? n3(P[0] * 40, P[1] * 40, P[2] * 40) * rough * 0.9 : 0;
    const row = Math.floor(b - line * (7 + gap) + j), t = lines[line] || "", ci = Math.floor(a / 6), col = Math.floor(a - ci * 6 + j);
    const ch = t[ci], g = ch === "7" && sevenBar ? SEVEN_BAR : GLYPHS[ch];
    let on = a >= 0 && line >= 0 && g && col >= 0 && col < 5 && row >= 0 && row < 7 && g[row * 5 + col] === "1";
    if (on && stitch) { const fu = a - ci * 6 - col, fv = b - line * (7 + gap) - row; on = Math.min(Math.abs(fu - fv), Math.abs(fu + fv - 1)) < 0.22; }
    if (on && rough && hash(Math.floor(a * 3), Math.floor(b * 3), 7) < 0.12 * rough) on = false;
    if (on) return S(ink[0], ink[1] * (0.9 + 0.2 * hash(ci, line, 3)));
    const gr = ground || ink;
    return S(gr[0], (ground ? gr[1] : 0.5) * (0.88 + 0.22 * n3(P[0] * 9, P[1] * 9, P[2] * 9)));
  });
}
// A page of text on a wall plane: the frame for textKind when the page faces +z (back wall) or +x (left wall).
// Returns { kind, o, u, v } ready for a panel: o is the top-left of the text inside a margin.
export function pagePlane(x, y, z, w, h, face = "z", margin = 0.08) {
  return face === "z" ? { o: [x - w / 2 + margin * w, y + h / 2 - margin * h, z], u: [1, 0, 0], v: [0, -1, 0] } : { o: [x, y + h / 2 - margin * h, z + w / 2 - margin * w], u: [0, 0, -1], v: [0, -1, 0] };
}
// The cell that fits the longest line of `lines` across `w` metres with a margin.
export const fitCell = (lines, w, margin = 0.08) => (w * (1 - 2 * margin)) / (6 * Math.max(1, ...lines.map((l) => l.length)));
export { ID };

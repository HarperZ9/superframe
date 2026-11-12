// Surface kinds shared by every Low Water place: one id per kind (the world buffer's geo-id), its
// spectral material for the sodium pass, its dither tone for blackouts, its palette class for the
// Gut, and how weather changes it. Original code (Low Water look work, 2026-10-17).
//
// Weather and time live in a variant V:
//   { wet: 0..1 (rain on everything outdoors), frost: 0..1 (rime on cold tops), day: bool,
//     emit: { [group]: factor } (lamps switched or dimmed by group), indoor: bool }
import { fbm, vnoise, sat } from "../sdf.mjs";

// Spectral materials (the engine's form: a sigmoid of a quadratic in wavelength, times a peak).
export const MATERIALS = [
  { name: "lw oxblood", q: [0, 10, -6.0], peak: 0.55 }, { name: "lw mustard", q: [0, 13, -5.2], peak: 0.62 }, { name: "lw teal", q: [-50, 27.5, -2.58], peak: 0.5 },
  { name: "lw bone", q: [0, 2, -0.1], peak: 0.72 }, { name: "lw slate", q: [0, -6, 1.2], peak: 0.16 }, { name: "lw mud", q: [0, 3, -1.2], peak: 0.2 },
  { name: "lw weed", q: [-60, 45, -6.94], peak: 0.22 }, { name: "lw water", flat: 0.03 }, { name: "lw tar", flat: 0.035 }, { name: "lw hull", q: [0, -12, 3.6], peak: 0.42 },
  { name: "lw bottle", q: [-60, 45, -6.94], peak: 0.45 }, { name: "lw flesh", q: [0, 6, -2.2], peak: 0.55 }, { name: "lw oilskin", q: [0, 14, -4.6], peak: 0.72 },
  { name: "lw navy", q: [0, -12, 3.6], peak: 0.22 }, { name: "lw violet", q: [40, -36, 6.9], peak: 0.45 }, { name: "lw wood", q: [0, 6, -3.2], peak: 0.35 },
  { name: "lw brass", q: [0, 10, -4.4], peak: 0.7 }, { name: "lw rust", q: [0, 11, -5.0], peak: 0.4 }, { name: "lw rope", q: [0, 7, -2.6], peak: 0.5 },
  { name: "lw canvas", q: [0, 4, -1.4], peak: 0.62 }, { name: "lw rime", q: [0, -2.4, 1.6], peak: 0.86 }, { name: "lw paper", q: [0, 2.6, -0.6], peak: 0.8 },
  { name: "lw sand", q: [0, 5, -1.8], peak: 0.45 }, { name: "lw coal", flat: 0.025 }, { name: "lw green paint", q: [-60, 45, -6.94], peak: 0.6 },
  { name: "lw cobalt", q: [0, -14, 4.2], peak: 0.5 }, { name: "lw limewash", q: [0, 1.4, 0.4], peak: 0.78 }, { name: "lw pink", q: [30, -14, 0.6], peak: 0.6 }, { name: "lw kelp", q: [-20, 16, -4.2], peak: 0.2 }, { name: "lw prism", flat: 0.85 },
];

// kind: [material, scale, wet (indoor 0), tone (dither, 0..1), palette class (Gut), flags]
// flags: o outdoor (rain wets it), f frost takes on tops, r reflects when wet, e emitter
const K = {};
let next = 1;
const def = (name, mat, scale, wet, tone, cls, flags = "", emit = null) => { K[name] = { id: next++, name, mat, scale, wet, tone, cls, flags, emit }; };
// ground and masonry
def("quay", "stone", 0.9, 0.15, 0.42, 1, "ofr"); def("cobble", "stone", 0.75, 0.2, 0.38, 1, "ofr"); def("slab", "stone", 0.7, 0.4, 0.36, 1, "ofr");
def("wall", "stone", 0.6, 0.1, 0.3, 1, "o"); def("weedwall", "lw kelp", 0.9, 0.7, 0.15, 3, "or"); def("mud", "lw mud", 0.8, 0.6, 0.28, 0, "ofr");
def("pool", "lw water", 1, 1, 0.08, 4, "r"); def("sand", "lw sand", 0.9, 0.3, 0.45, 0, "ofr"); def("shingle", "stone", 0.85, 0.25, 0.4, 1, "ofr");
def("weed", "lw kelp", 0.8, 0.8, 0.15, 3, "or"); def("steps", "stone", 0.75, 0.5, 0.36, 1, "ofr"); def("mole", "stone", 0.7, 0.45, 0.36, 1, "ofr");
def("brick", "brick", 0.85, 0.05, 0.38, 2, "o"); def("brickdark", "brick", 0.55, 0.05, 0.28, 2, "o"); def("plaster", "plaster", 0.8, 0.02, 0.6, 2, "o");
// house paints (the town's colours, true only by day)
def("oxblood", "lw oxblood", 0.9, 0.05, 0.5, 2, "o"); def("mustard", "lw mustard", 0.9, 0.05, 0.6, 2, "o"); def("teal", "lw teal", 0.9, 0.05, 0.45, 2, "o");
def("bone", "lw bone", 0.85, 0.05, 0.72, 2, "o"); def("limewash", "lw limewash", 0.85, 0.05, 0.78, 2, "o"); def("pink", "lw pink", 0.8, 0.05, 0.6, 2, "o");
def("cobalt", "lw cobalt", 0.8, 0.05, 0.45, 2, "o");
def("roof", "lw slate", 1.1, 0.25, 0.15, 1, "ofr"); def("tile", "brick", 0.6, 0.2, 0.25, 2, "of"); def("chimney", "brick", 0.8, 0.05, 0.3, 2, "o");
// wood, iron, rope, cloth
def("boards", "lw wood", 0.85, 0.0, 0.45, 2, ""); def("deck", "lw wood", 0.75, 0.3, 0.4, 2, "ofr"); def("timber", "lw wood", 1.0, 0.1, 0.42, 2, "of");
def("plank", "lw wood", 0.8, 0.5, 0.38, 2, "ofr"); def("tar", "lw tar", 1.3, 0.2, 0.1, 1, "o"); def("iron", "metal", 1.0, 0.2, 0.25, 1, "o");
def("rust", "lw rust", 0.9, 0.2, 0.3, 2, "o"); def("brass", "lw brass", 0.8, 0.0, 0.6, 2, ""); def("rope", "lw rope", 0.9, 0.2, 0.5, 2, "o");
def("net", "lw rope", 0.6, 0.4, 0.35, 2, "o"); def("canvas", "lw canvas", 0.85, 0.2, 0.62, 2, "of"); def("sack", "lw canvas", 0.6, 0.1, 0.45, 2, "o");
def("barrel", "lw wood", 0.8, 0.15, 0.38, 2, "of"); def("crate", "lw mustard", 0.55, 0.15, 0.45, 2, "of"); def("fishbox", "lw wood", 0.7, 0.4, 0.4, 2, "o");
def("hull", "lw tar", 1.1, 0.2, 0.12, 1, "o"); def("boat", "lw hull", 0.9, 0.3, 0.3, 2, "of"); def("boatred", "lw oxblood", 0.9, 0.3, 0.4, 2, "of");
def("glass", "glass", 1, 0.5, 0.1, 1, "or"); def("bottle", "lw bottle", 1.2, 0.6, 0.4, 3, ""); def("jar", "lw mustard", 1.1, 0.6, 0.5, 2, "");
def("fish", "grey", 0.5, 0.85, 0.62, 1, "or"); def("oilskin", "lw oilskin", 0.85, 0.4, 0.6, 2, "o"); def("paper", "lw paper", 0.9, 0, 0.8, 2, "");
def("rug", "lw oxblood", 0.8, 0, 0.35, 2, ""); def("red", "red paint", 1.0, 0.1, 0.4, 2, "o"); def("blue", "blue van", 0.9, 0.1, 0.3, 1, "o");
def("green", "lw green paint", 0.8, 0.1, 0.35, 3, "o"); def("navy", "lw navy", 1.0, 0.2, 0.15, 1, "o"); def("coal", "lw coal", 1, 0, 0.05, 1, "");
def("straw", "lw rope", 1.1, 0, 0.55, 2, ""); def("flesh", "lw flesh", 1, 0.2, 0.6, 2, ""); def("bonecloth", "lw bone", 1.1, 0, 0.75, 2, "");
def("tower", "lw bone", 0.65, 0.2, 0.62, 2, "of"); def("lens", "lw bottle", 0.9, 0.9, 0.25, 3, "r"); def("dome", "lw teal", 0.8, 0.2, 0.3, 3, "of");
def("chalk", "lw bone", 1.2, 0, 0.8, 2, ""); def("slate", "lw tar", 2.4, 0, 0.12, 1, ""); def("stove", "lw tar", 3, 0, 0.1, 1, "");
def("weedrock", "lw kelp", 0.6, 0.85, 0.12, 3, "or"); def("ice", "lw rime", 0.7, 0.8, 0.7, 4, "r"); def("wax", "lw bone", 1.1, 0, 0.8, 2, "");
def("prism", "lw prism", 1.2, 0.6, 0.85, 4, "r"); def("sign", "lw mustard", 1.2, 0.1, 0.55, 2, "o"); def("violet", "lw violet", 0.9, 0.1, 0.4, 3, "o"); def("darkwood", "lw wood", 0.5, 0.05, 0.25, 1, "");
// emitters: [type, intensity, group]
def("sodium", "grey", 0, 0, 0.95, 5, "e", ["sodium", 120, "sodium"]); def("window", "lw bone", 0, 0, 0.85, 5, "e", ["window", 2.6, "window"]);
def("windowdim", "lw bone", 0, 0, 0.6, 5, "e", ["window", 1.1, "window"]); def("flame", "grey", 0, 0, 1, 6, "e", ["window", 30, "flame"]);
def("lantern", "lw bone", 0, 0, 1, 6, "e", ["window", 16, "lantern"]); def("porthole", "lw bone", 0, 0, 0.9, 5, "e", ["window", 3.2, "window"]);
def("stovefire", "grey", 0, 0, 0.9, 6, "e", ["window", 14, "fire"]); def("whitelamp", "grey", 0, 0, 1, 7, "e", ["led", 60, "white"]);
def("candle", "grey", 0, 0, 1, 6, "e", ["window", 9, "candle"]); def("arc", "grey", 0, 0, 1, 7, "e", ["led", 80, "arc"]);
def("beacon", "grey", 0, 0, 1, 7, "e", ["led", 20, "beacon"]); def("gutter", "lw violet", 0, 0, 0.7, 4, "e", ["led", 2.2, "gutter"]);
def("sky", "grey", 0, 0, 0.9, 4, "e", ["sky", 1, "sky"]);

export const KIND = K;
export const ID = Object.fromEntries(Object.values(K).map((k) => [k.name, k.id]));
export const BY_ID = []; for (const k of Object.values(K)) BY_ID[k.id] = k;

const S = (mat, scale, wet, emit) => ({ mat, scale, wet, emit });

// The surface of kind id at P with normal N under variant V. The noise keeps big flats from
// reading as plastic; the painter turns it into brush texture.
export function surfOf(id, P, N, V = {}) {
  const k = BY_ID[id], name = k ? k.name : ""; if (!k) return S("grey", 1, 0, null);
  const n = fbm(P[0] * 1.7 + P[1] * 0.3, P[2] * 1.7 + P[1]);
  if (k.emit) {
    const [type, I, group] = k.emit, f = V.emit && group in V.emit ? V.emit[group] : 1;
    if (f <= 0) return S(k.name === "sodium" ? "grey" : "glass", k.name === "sodium" ? 0.25 : 1, 0.3, null);
    return S(k.mat, 0, 0, { type, I: I * f * (0.85 + 0.3 * vnoise(P[0] * 3, P[1] * 3 + P[2])) });
  }
  let mat = k.mat, scale = k.scale * (0.78 + 0.44 * n) * pattern(k.name, P, N), wet = k.wet;
  const out = k.flags.includes("o") && !V.indoor;
  if (out && V.wet) { wet = Math.max(wet, V.wet * (k.flags.includes("r") ? 0.95 : 0.5)); scale *= 1 - 0.35 * V.wet; }
  // rain pools on flat ground: noise-shaped puddles that mirror the lamps
  if (out && V.wet && k.flags.includes("r") && N[1] > 0.9 && fbm(P[0] * 0.55 + 3, P[2] * 0.55 - 7) < 0.36 + 0.12 * V.wet) { mat = "lw water"; scale = 1; wet = 1; }
  // rime on cold tops: thin where wet stone drains, thick on wood and rails
  if (out && V.frost && k.flags.includes("f") && N[1] > 0.55) {
    // a fine film that lifts the value everywhere, with sparse full rime where it gathers
    const thin = k.mat === "stone" ? 0.6 : 1, r = sat((V.frost * thin * (0.45 + 0.6 * fbm(P[0] * 9 + P[1], P[2] * 9 + 5)) - 0.62) * 4);
    if (r > 0.55) { mat = "lw rime"; scale = 0.55 + 0.35 * r; wet = 0.35; } else { scale *= 1 + 0.8 * V.frost * thin; wet = Math.max(wet, 0.25 * V.frost); }
  }
  if (V.indoor && name !== "pool") wet = 0;
  if (V.day) wet *= 0.4;
  return S(mat, scale, wet, null);
}
// Masonry, setts, planks and slates as albedo patterns: joints dark, units tinted one by one, so
// the painter has courses to follow at the close camera (80 px a metre and more).
const H2 = (a, b) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function units(u, v, w, h, j) { const row = Math.floor(v / h), uu = u / w + (row & 1) * 0.5, col = Math.floor(uu), fu = uu - col, fv = v / h - row; const edge = Math.min(fu, 1 - fu) * w, edgeV = Math.min(fv, 1 - fv) * h; return (Math.min(edge, edgeV) < j ? 0.45 : 0.86 + 0.28 * H2(col, row)); }
const SETT = new Set(["cobble"]), SLAB = new Set(["slab", "quay"]), ASHLAR = new Set(["wall", "weedwall", "mole", "steps", "tower"]), BRICK = new Set(["brick", "brickdark", "chimney"]), PLANK = new Set(["boards", "deck", "plank", "timber", "darkwood"]), PAINT = new Set(["oxblood", "mustard", "teal", "bone", "limewash", "pink", "cobalt", "plaster"]);
export function pattern(name, P, N) {
  const up = Math.abs(N[1]) > 0.7, side = Math.abs(N[0]) > Math.abs(N[2]) ? P[2] : P[0];
  if (SETT.has(name) && up) return units(P[0], P[2], 0.24, 0.15, 0.018);
  if (SLAB.has(name) && up) return units(P[0], P[2], 0.95, 0.62, 0.02);
  if (ASHLAR.has(name)) return up ? units(P[0], P[2], 0.6, 0.45, 0.02) : units(side, P[1], 0.85, 0.42, 0.022);
  if (BRICK.has(name) && !up) return units(side, P[1], 0.23, 0.075, 0.009);
  if (PLANK.has(name)) { const v = (up ? P[2] : P[1]) / 0.17, f = v - Math.floor(v); return f < 0.08 ? 0.55 : 0.88 + 0.24 * H2(Math.floor(v), Math.floor((up ? P[0] : side) / 2.3)); }
  if (name === "roof") { const v = P[1] / 0.21, f = v - Math.floor(v); return f < 0.12 ? 0.6 : 0.85 + 0.3 * H2(Math.floor(v), Math.floor((Math.abs(N[0]) > 0.3 ? P[2] : P[0]) / 0.3)); }
  if (PAINT.has(name) && !up) return 0.82 + 0.3 * fbm(side * 1.6, P[1] * 0.25) - (P[1] < 0.7 ? 0.12 : 0);
  return 1;
}
// Dither tone (0..1) for blackouts.
export function toneOf(id, P) { const k = BY_ID[id]; return k ? k.tone * (0.8 + 0.4 * fbm(P[0] * 1.3, P[2] * 1.3 + P[1])) : 0.4; }
export const isEmitter = (id) => !!(BY_ID[id] && BY_ID[id].emit);

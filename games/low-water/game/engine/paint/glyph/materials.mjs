// Glyph's materials: every surface kind (kinds.json, from the bake's kit) speaks its own glyph
// language. A language has
//   ramp    glyphs from unlit to fully lit (the light picks the step: density and weight)
//   edge    glyphs where the surface breaks or a thin thing crosses it: [| / - \]
//   motif   a glyph laid by world position where the surface is lit enough to show its make
//           (brick courses, plank grain, cobbles, slates, ripples, weed fronds)
//   fg      the surface's own colour (linear), lit by the cell's light
//   bg      how much of the lit colour tints the cell's ground (0 none)
//   emit    an emitter's glyph and its light colour
// Original code; the colours are an art choice, close to the plates' paint by day.
export const LANG = {
  stone:   { ramp: " .,:;=+*#", motif: (P, n) => (n.up && (Math.floor(P[0] * 3.2) + Math.floor(P[2] * 3.2)) % 2 === 0 ? "o" : null), fg: [0.46, 0.42, 0.38], bg: 0.06 },
  brick:   { ramp: " .:;=+#%@", motif: (P, n) => (!n.up && Math.abs(((P[1] * 4.2) % 1) - 0.5) < 0.12 ? "_" : null), fg: [0.55, 0.26, 0.18], bg: 0.08 },
  plaster: { ramp: " .':;+=*#", motif: null, fg: [0.72, 0.68, 0.6], bg: 0.07 },
  wood:    { ramp: " .-~=+#%@", motif: (P, n) => (Math.abs(((P[0] * 5 + P[2] * 1.3) % 1) - 0.5) < 0.12 ? "=" : null), fg: [0.45, 0.3, 0.17], bg: 0.07 },
  water:   { ramp: "  .-~~=≈≈", motif: (P) => (Math.sin(P[0] * 3.1 + Math.sin(P[2] * 1.7) * 2) > 0.7 ? "~" : null), fg: [0.18, 0.26, 0.34], bg: 0.1 },
  mud:     { ramp: " .,;:~=%#", motif: null, fg: [0.34, 0.27, 0.19], bg: 0.05 },
  sand:    { ramp: " .':;=+%#", motif: null, fg: [0.62, 0.53, 0.38], bg: 0.05 },
  weed:    { ramp: " ,;\"}{%&#", motif: (P) => ((Math.floor(P[0] * 6) * 7 + Math.floor(P[2] * 6) * 3) % 5 === 0 ? "{" : null), fg: [0.22, 0.3, 0.16], bg: 0.06 },
  slate:   { ramp: " .,/^^AM#", motif: (P, n) => (Math.abs(((P[0] * 3 + P[1] * 4) % 1) - 0.5) < 0.1 ? "^" : null), fg: [0.24, 0.26, 0.3], bg: 0.06 },
  metal:   { ramp: " .:|!I+H#", motif: null, fg: [0.4, 0.42, 0.45], bg: 0.05 },
  cloth:   { ramp: " .:;%&#%@", motif: null, fg: [0.6, 0.55, 0.42], bg: 0.06 },
  rope:    { ramp: " ,~:%&#8@", motif: null, fg: [0.55, 0.45, 0.28], bg: 0.05 },
  glass:   { ramp: " .:=+#HH#", motif: null, fg: [0.6, 0.72, 0.7], bg: 0.1 },
  tar:     { ramp: " .,:;=+##", motif: null, fg: [0.1, 0.1, 0.11], bg: 0.03 },
  paint:   { ramp: " .:;=+#%@", motif: null, fg: [0.5, 0.45, 0.4], bg: 0.08 },
  skin:    { ramp: " .:oOO0@@", motif: null, fg: [0.8, 0.6, 0.48], bg: 0.05 },
  sky:     { ramp: "         ", motif: (P) => ((Math.floor(P[0] * 2) * 13 + Math.floor(P[2] * 2) * 7) % 41 === 0 ? "." : null), fg: [0.3, 0.32, 0.45], bg: 0 },
};
export const EDGES = ["|", "/", "-", "\\"];
// snow and frost (the famine winter, era 2): a light field of sparse type on a pale ground. Snow reads by
// its ground (bg), not by dense letters; its shadows go blue and empty. Wool, felt and bread are the
// figures' and props' languages (figures.mjs PART_RAMP, GLYPH-LANGUAGE.md section 1).
export const SNOW = { ramp: "  ..,,:'", motif: null, fg: [0.8, 0.88, 1.0], bg: 0.5 };
// emitters: their glyph and their light (linear colour)
export const EMIT = {
  sodium: { glyph: "*", c: [1.0, 0.58, 0.18] }, window: { glyph: "#", c: [1.0, 0.78, 0.45] }, windowdim: { glyph: "=", c: [0.9, 0.66, 0.38] },
  flame: { glyph: "^", c: [1.0, 0.7, 0.3] }, lantern: { glyph: "*", c: [1.0, 0.72, 0.4] }, porthole: { glyph: "o", c: [1.0, 0.78, 0.45] },
  stovefire: { glyph: "#", c: [1.0, 0.5, 0.15] }, whitelamp: { glyph: "*", c: [0.9, 0.95, 1.0] }, candle: { glyph: "i", c: [1.0, 0.75, 0.4] },
  arc: { glyph: "*", c: [0.85, 0.95, 1.0] }, beacon: { glyph: "*", c: [0.9, 1.0, 0.85] }, gutter: { glyph: "~", c: [0.7, 0.4, 1.0] }, sky: { glyph: " ", c: [0.3, 0.35, 0.5] },
};

// the language for a kind (kinds.json entry)
const BY_MAT = { "lw water": "water", "lw mud": "mud", "lw sand": "sand", "lw kelp": "weed", "lw slate": "slate", "lw wood": "wood", "lw tar": "tar", "lw hull": "wood",
  "lw rope": "rope", "lw canvas": "cloth", "lw bone": "plaster", "lw limewash": "plaster", "lw flesh": "skin", "lw brass": "metal", "lw rust": "metal", "lw coal": "tar",
  "lw rime": "plaster", "lw paper": "plaster", "lw oilskin": "cloth", "lw navy": "cloth", "lw bottle": "glass", "lw prism": "glass" };
const PAINT = { "lw oxblood": [0.5, 0.12, 0.1], "lw mustard": [0.72, 0.56, 0.16], "lw teal": [0.12, 0.42, 0.42], "lw pink": [0.75, 0.42, 0.45], "lw cobalt": [0.14, 0.24, 0.55],
  "lw violet": [0.42, 0.24, 0.6], "lw green paint": [0.2, 0.42, 0.22], "red paint": [0.6, 0.12, 0.1], "blue van": [0.16, 0.24, 0.42], "lw bone": [0.75, 0.7, 0.6], "lw limewash": [0.82, 0.8, 0.74] };
export function langOf(kind) {
  if (!kind) return { name: "void", ...LANG.sky };
  if (kind.emit) return { name: kind.name, ...LANG.glass, emit: EMIT[kind.name] || EMIT.window };
  const fam = kind.name === "pool" ? "water" : kind.name === "roof" ? "slate" : kind.name === "glass" ? "glass" : BY_MAT[kind.mat] || (kind.mat === "stone" ? "stone" : kind.mat === "brick" ? "brick" : kind.mat === "plaster" ? "plaster" : kind.mat === "metal" ? "metal" : PAINT[kind.mat] ? "paint" : "stone");
  const L = LANG[fam], fg = PAINT[kind.mat] || L.fg;
  return { name: fam, ...L, fg: fg.map((v) => v * (0.6 + 0.8 * (kind.tone || 0.4))), tone: kind.tone ?? 0.4, reflects: (kind.flags || "").includes("r"), outdoor: (kind.flags || "").includes("o") };
}

// Letters as materials (the author's typed-sprite reference, 2026-10-22, techniques only;
// design/art/GLYPH-LANGUAGE.md section 2): a small figure or prop is written as rows where each letter names
// a material, not a colour. The era and the people choose each material's dye (Tarn dark wool, Hesh felt and
// the blue thread at the wrist, era 5's bright scarves); the light is done in code from the neighbours: a
// cell whose neighbour toward the key light is empty is an edge facing the key and takes the material's light
// end, a cell whose neighbour away from the key is empty takes its dark end, the rest the middle. Then each
// set cell gets the material's own glyph at that step. Used by the crowd tier's near people (glyph/crowd.mjs).
// Original code.
//   litCard(card, keyScreen [x, y], dyes) -> [{ dx, dy, mat, step (0 dark, 1 mid, 2 light) }]
//   CARDS: the people's cards by facing, rows of material letters ('.' empty)
//   W wool coat, F felt coat, s skin, h hair, c cap, t the blue thread, b boots, S scarf, B bread (a loaf carried)
export const CARDS = {
  front: [".h.", ".s.", "WWW", "WWW", "W.W", "b.b"],
  side: [".h", ".s", "WW", "WW", "W.", "bb"],
  heshFront: [".h.", ".s.", "FFF", "tFt", "F.F", "b.b"],
  loaf: [".h.", ".s.", "WBW", "WWW", "W.W", "b.b"],
};
// each material: its glyph at dark, middle and light, and its dye by era (linear rgb)
export const MATERIALS = {
  W: { g: ["%", "&", "M"], dye: { 0: [0.2, 0.2, 0.23], 2: [0.17, 0.15, 0.14], 5: [0.2, 0.2, 0.22] } },
  F: { g: ["=", "H", "#"], dye: { 0: [0.46, 0.38, 0.28], 2: [0.46, 0.38, 0.28] } },
  s: { g: [".", "o", "O"], dye: { 0: [0.84, 0.64, 0.52] } },
  h: { g: ["~", "~", "^"], dye: { 0: [0.2, 0.15, 0.12] } },
  c: { g: ["_", "=", "="], dye: { 0: [0.1, 0.09, 0.1] } },
  t: { g: ["~", "~", "~"], dye: { 0: [0.16, 0.32, 0.72] } },
  b: { g: ["m", "m", "@"], dye: { 0: [0.13, 0.1, 0.09] } },
  S: { g: ["%", "&", "&"], dye: { 0: [0.7, 0.25, 0.3], 5: [0.85, 0.35, 0.2] } },
  B: { g: ["o", "O", "@"], dye: { 0: [0.6, 0.42, 0.22] } },
};
export const dyeOf = (mat, era) => { const d = MATERIALS[mat] && MATERIALS[mat].dye; return d ? d[era] || d[0] : [0.5, 0.5, 0.5]; };
// the card lit from its neighbours toward the key (screen x right, y down): each set cell with its step
export function litCard(card, key) {
  const H = card.length, W = card[0].length, at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? "." : card[y][x]);
  const kx = Math.sign(Math.round(key[0] * 2)), ky = Math.sign(Math.round(key[1] * 2)), out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = card[y][x]; if (m === ".") continue;
    const toward = (kx || ky) && at(x + kx, y + ky) === ".", away = (kx || ky) && at(x - kx, y - ky) === ".";
    out.push({ dx: x, dy: y, mat: m, step: toward && !away ? 2 : away && !toward ? 0 : 1 });
  }
  return out;
}

// The glyph form of the effects: each primitive becomes a mark in the character grid, a glyph chosen by its kind and
// size, its colour from the primitive's light; one mark a cell, the strongest wins. The glyph renderer can write these
// marks into its own cells (glyph/renderer.mjs out.G and out.FG); until it does, drawMarks() sets them in type on a
// canvas over the grid. Only ASCII, so every face in the game has them. Original code.
//   glyphMarks(prims, grid)  grid: { left, top, z, ox, oy, cw, ch, cols, rows } (the glyph renderer's state.grid with
//                            left, top and z from its camera) -> [{ c, r, ch, rgb, a }]
//   drawMarks(ctx2d, marks, grid, font)
const CH = {
  flake: (p) => (p.r > 1.4 ? "*" : "."), lie: () => "=", print: (p) => (p.ahead ? "?" : ","), smear: () => "/", glint: () => "*", ring: () => "o", drop: () => ".", puff: (p) => (p.r > 6 ? "o" : "~"), frost: () => "+", mote: () => ".",
  haze: () => "~", notice: () => "#", rut: () => "-", grain: () => ",", peel: () => ";", board: () => "#", sootstreak: () => "|", weed: () => "\"", shard: () => "'", flame: (p) => (p.len > 6 ? "A" : "^"), ember: () => "*", spark: () => "'", smoke: () => ":", steam: (p) => (p.r > 10 ? "@" : "o"), soot: () => "%",
};
export function glyphMarks(prims, grid) {
  const best = new Map();
  for (const p of prims) {
    if (p.k === "layer") { if (p.ch !== null) layerMarks(p, grid, best); continue; }
    const sx = (p.x - grid.left) * grid.z, sy = (p.y - grid.top) * grid.z, c = Math.floor((sx - grid.ox) / grid.cw), r = Math.floor((sy - grid.oy) / grid.ch);
    if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
    const key = r * grid.cols + c, w = p.a * (p.glow ? 1.5 : 1) * (0.5 + 0.5 * Math.min(1, p.r * grid.z / grid.cw)), cur = best.get(key);
    if (!cur || w > cur.w) best.set(key, { c, r, ch: (CH[p.k] || (() => "."))(p), rgb: p.rgb, a: Math.min(1, p.a * (p.glow ? 1.3 : 1)), w, k: p.k });
  }
  return [...best.values()];
}
// a plate-anchored layer in type: a cell whose centre the layer covers by half or more takes its mark
function layerMarks(L, grid, best) {
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    const px = grid.left + (grid.ox + (c + 0.5) * grid.cw) / grid.z, py = grid.top + (grid.oy + (r + 0.5) * grid.ch) / grid.z, lx = Math.floor(px * L.scale), ly = Math.floor(py * L.scale);
    if (lx < 0 || ly < 0 || lx >= L.w || ly >= L.h) continue; const q = (ly * L.w + lx) * 4, a = L.rgba[q + 3] / 255; if (a < 0.5) continue;
    const key = r * grid.cols + c; if (best.has(key)) continue;
    best.set(key, { c, r, ch: L.ch || "=", rgb: [0, 1, 2].map((k) => (L.rgba[q + k] / 255) ** 2.2), a, w: a * 0.6, k: "lie" });
  }
}
const enc = (x) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, x)), 1 / 2.2));
export function drawMarks(g, marks, grid, font = "bold 11px Consolas, monospace") {
  g.save(); g.font = font; g.textBaseline = "top";
  for (const m of marks) {
    const x = grid.ox + m.c * grid.cw, y = grid.oy + m.r * grid.ch;
    if (m.k === "print" || m.k === "soot" || m.k === "smoke") { g.globalAlpha = m.a; g.fillStyle = `rgb(${enc(m.rgb[0])},${enc(m.rgb[1])},${enc(m.rgb[2])})`; }
    else { g.globalAlpha = 1; g.fillStyle = "rgba(8,6,9,0.85)"; g.fillRect(x, y, grid.cw, grid.ch); g.globalAlpha = Math.max(0.35, m.a); g.fillStyle = `rgb(${enc(m.rgb[0])},${enc(m.rgb[1])},${enc(m.rgb[2])})`; }
    g.fillText(m.ch, x + 1, y);
  }
  g.restore();
}

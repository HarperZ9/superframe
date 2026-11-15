// Marks on the ground drawn in type: a fight's ways out (ui/fightways.mjs hands the outline and the arrow
// in screen pixels each frame). The outline is a dashed border of edge glyphs (- | / \ by the edge's slope,
// two cells on and one off), the arrow a line of edge glyphs ending in an arrow glyph; both in chalk, hot
// while Lamb stands in the exit. Drawn over the world and the figures, under the panels. Original code.
//   drawMarks(ways, grid, out, atlas)
const CHALK = [236, 228, 208], HOT = [255, 212, 140];
export function drawMarks(ways, grid, out, atlas) {
  if (!ways || !ways.length || globalThis.__lwGlyphNoWays) return 0;   // __lwGlyphNoWays: the visual check's control
  const { cols, rows, ox, oy, cw, ch } = grid, ink = (x, y, g, c, ground) => {
    const X = Math.floor((x - ox) / cw), Y = Math.floor((y - oy) / ch); if (X < 0 || Y < 0 || X >= cols || Y >= rows) return;
    const i = Y * cols + X; if (out.HOT && c === HOT) out.HOT[i] = 1; out.G[i] = atlas.index(g); out.FG[i * 3] = c[0]; out.FG[i * 3 + 1] = c[1]; out.FG[i * 3 + 2] = c[2]; out.EM[i] = Math.max(out.EM[i], 90);
    if (ground) { out.BG[i * 3] = Math.min(out.BG[i * 3], 18); out.BG[i * 3 + 1] = Math.min(out.BG[i * 3 + 1], 14); out.BG[i * 3 + 2] = Math.min(out.BG[i * 3 + 2], 16); }
  };
  const slopeGlyph = (dx, dy) => { const a = Math.atan2(dy * cw / ch, dx), t = ((a % Math.PI) + Math.PI) % Math.PI; return t < Math.PI / 8 || t > (7 * Math.PI) / 8 ? "-" : t < (3 * Math.PI) / 8 ? "\\" : t < (5 * Math.PI) / 8 ? "|" : "/"; };
  let n = 0;
  for (const w of ways) {
    const col = w.hot ? HOT : CHALK, C = w.corners;
    for (let e = 0; e < C.length; e++) {
      const [x0, y0] = C[e], [x1, y1] = C[(e + 1) % C.length], len = Math.hypot((x1 - x0) / cw, (y1 - y0) / ch), steps = Math.max(1, Math.ceil(len * 1.4)), g = slopeGlyph(x1 - x0, y1 - y0);
      for (let k = 0; k <= steps; k++) { if (Math.floor(k / 1.4) % 3 === 2) continue; ink(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps, g, col, true); n++; }
    }
    if (w.arrow) {
      const [[ax, ay], [bx, by]] = w.arrow, len = Math.hypot((bx - ax) / cw, (by - ay) / ch), steps = Math.max(1, Math.ceil(len * 1.4)), g = slopeGlyph(bx - ax, by - ay);
      for (let k = 0; k < steps; k++) ink(ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps, g, col, true);
      const a = Math.atan2(by - ay, bx - ax), head = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) * (cw / ch) * 1.2 ? (Math.cos(a) > 0 ? "→" : "←") : Math.sin(a) > 0 ? "↓" : "↑";
      ink(bx, by, head, col, true); n += steps + 1;
    }
  }
  return n;
}

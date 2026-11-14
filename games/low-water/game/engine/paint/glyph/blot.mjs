// The ink-blot transition in type (paint/inkblot.mjs is the painted one: a blot of the Daybook's ink
// spreading over the view between places). In glyph mode the blot's mask (its own canvas, the shape only,
// no painting) is read per cell: covered cells are struck solid in the era's ground ink, the ragged coast
// is set in bright shade glyphs (the wet edge catching the light), so the blot spreads as type. The
// painted blot canvas is hidden while glyph mode shows (paint/renderer.mjs). Original code.
//   drawBlot(maskCanvas | null, grid, out, atlas) -> cells covered
const COAST = ["▓", "▒", "░"], INK = [10, 7, 9], WET = [200, 194, 182];   // the coast: the wet edge catches the light, densest at the open side
function maskOf(cv) {
  if (!cv || cv.hidden || !cv.width) return null;
  const d = cv.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data;
  let any = false; for (let i = 3; i < d.length; i += 64) if (d[i] > 8) { any = true; break; }
  return any ? { d, w: cv.width, h: cv.height } : null;
}
// the share of a cell the ink covers: the mask sampled at 3 x 3 points in the cell
function cover(m, x0, y0, cw, ch, sx, sy) {
  let a = 0;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const X = Math.min(m.w - 1, Math.max(0, Math.floor((x0 + ((i + 0.5) * cw) / 3) * sx))), Y = Math.min(m.h - 1, Math.max(0, Math.floor((y0 + ((j + 0.5) * ch) / 3) * sy)));
    a += m.d[(Y * m.w + X) * 4 + 3] / 255;
  }
  return a / 9;
}
export function drawBlot(cv, grid, out, atlas) {
  const m = maskOf(cv); if (!m) return 0;
  const { cols, rows, ox, oy, cw, ch, W, H } = grid, sx = m.w / W, sy = m.h / H, solid = atlas.index(" ");
  let n = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const a = cover(m, ox + x * cw, oy + y * ch, cw, ch, sx, sy); if (a < 0.08) continue;
    const i = y * cols + x; n++; out.EM[i] = 0; out.HOT[i] = 1;
    if (a > 0.92) { out.G[i] = solid; for (let c = 0; c < 3; c++) out.BG[i * 3 + c] = INK[c]; continue; }
    out.G[i] = atlas.index(COAST[Math.min(2, Math.floor(a * 3))]); for (let c = 0; c < 3; c++) { out.FG[i * 3 + c] = WET[c]; out.BG[i * 3 + c] = Math.round(out.BG[i * 3 + c] * (1 - a) + INK[c] * a); }
  }
  return n;
}

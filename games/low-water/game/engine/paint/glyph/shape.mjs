// Shape-aware glyph choice (the author's reference videos, 2026-10-21: pick the glyph whose shape matches the
// cell, not its brightness alone). Each glyph's ink is measured in a 3 x 4 grid of its cell (atlas.desc);
// under a cell the scene gives the same grid: how much of each part is covered by the surface the cell shows
// (a silhouette, a break, a thin thing) or by a figure. The glyph chosen is the one whose ink pattern is
// nearest the coverage pattern scaled to the ink the tone asks for, among line-like candidates, so a
// half-covered cell gets ink on its covered side and an edge's glyph runs along the edge. Original code.
//   const S = makeShaper(atlas); S.pick(occ (12 values 0..1), ink (wanted mean coverage 0..1)) -> glyph index
import { SHAPE_N, SHAPE_COLS, SHAPE_ROWS } from "./atlas.mjs";
// candidates: glyphs with a clear shape in the font (lines, corners, halves, dots), and the solid ones for full cells
export const TONE_W = 2.5;
// for outlines only line marks (a letter matching a corner reads as noise, not as an edge)
export const LINE_CHARS = "-_|/\()[]`',.~^─│╱╲┌┐└┘";
export const SHAPE_CHARS = "|/\-_()[]<>^.,'`:;!\"=+#%&@MW";   // marks with a clear side or slope, and the dense ones; no letters (a j or a v at an edge reads as a letter)
export function makeShaper(atlas, chars = SHAPE_CHARS) {
  const pool = (cs) => [...new Set([...cs].map((c) => atlas.index(c)))].filter((g) => atlas.cov[g] > 0.01);
  const cand = pool(chars), lines = pool(LINE_CHARS), D = atlas.desc;
  const cache = new Map();
  return {
    cand,
    pick(occ, ink, line = false) {
      const set = line ? lines : cand;
      // occ quantised to tenths, ink to hundredths: neighbouring cells share a choice, and the search runs once each
      let key = Math.round(ink * 100) * 2 + (line ? 1 : 0); for (let r = 0; r < SHAPE_N; r++) key = key * 11 + Math.round(occ[r] * 10);
      const hit = cache.get(key); if (hit !== undefined) return hit;
      // the score: how closely the glyph's ink follows the pattern (correlation, shape) less how far its ink is
      // from what the tone wants (TONE_W per unit of coverage, so a faint mark never wins on shape by being faint)
      let best = set[0], bd = -Infinity;
      for (const g of set) { const a = shapeAgreement(D, g, occ); if (a == null) continue; const sc = a - TONE_W * Math.abs(atlas.cov[g] - ink); if (sc > bd) { bd = sc; best = g; } }
      if (cache.size > 50000) cache.clear(); cache.set(key, best); return best;
    },
  };
}
// the boundary in a cover pattern: the parts next to a part of the other kind (an outline is drawn there, not
// over the covered side); written into out
export function edgeOf(occ, out) {
  for (let r = 0; r < SHAPE_N; r++) {
    const x = r % SHAPE_COLS, y = Math.floor(r / SHAPE_COLS), v = occ[r] > 0.5; let e = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= SHAPE_COLS || Y >= SHAPE_ROWS) continue; if ((occ[Y * SHAPE_COLS + X] > 0.5) !== v) { e = 1; break; } }
    out[r] = e;
  }
  return out;
}
// how well a glyph's ink follows a coverage pattern: the correlation of the two 12-part grids (1 when the ink
// lies exactly where the cover is, 0 when it ignores it); null for a flat pattern (nothing to follow)
export function shapeAgreement(desc, g, occ) {
  let mo = 0, md = 0; for (let r = 0; r < SHAPE_N; r++) { mo += occ[r]; md += desc[g * SHAPE_N + r]; } mo /= SHAPE_N; md /= SHAPE_N;
  let so = 0, sd = 0, c = 0; for (let r = 0; r < SHAPE_N; r++) { const a = occ[r] - mo, b = desc[g * SHAPE_N + r] - md; so += a * a; sd += b * b; c += a * b; }
  return so < 1e-4 ? null : sd < 1e-6 ? 0 : c / Math.sqrt(so * sd);
}

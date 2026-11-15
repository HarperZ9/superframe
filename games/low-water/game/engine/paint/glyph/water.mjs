// Glyph water reflections (the author's reference videos, 2026-10-21: "the scene reflected and flipped, broken
// by ripples, darker tint, lamps and moon reflected"). In an orthographic view a vertical world line stays a
// vertical screen column, so a cell of water shows, per column, the cell as far above the water's edge as it
// lies below it: the scene mirrored about each column's shoreline. Ripples shift the source a cell sideways by
// the water's own world position and the time, and the odd row breaks; slopes flip (/ and \); the mirrored type
// is dimmed and cooled, a lamp's or a window's less so. Drawn after the figures (they reflect too), before the
// panels. Original code.
//   reflect(grid, out, atlas, scene, t) -> cells written
const FLIP = { "/": "\\", "\\": "/", "╱": "╲", "╲": "╱" };
export function reflect(grid, out, atlas, scene, t) {
  const { C, cols, rows, I0, J0 } = grid, kinds = scene.kinds || [];
  const water = new Uint8Array(cols * rows); let any = false;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const I = I0 + x, J = J0 + y; if (I < 0 || J < 0 || I >= C.nI || J >= C.nJ) continue;
    const o = J * C.nI + I, k = kinds[C.k1[o]], py = C.P[o * 3 + 1];
    // the plate's own water, and the tide over whatever lies under its level (the harbour floor at high water)
    if ((k && k.mat === "lw water" && C.N[o * 3 + 1] > 0.8) || (scene.waterY != null && py < scene.waterY)) { water[y * cols + x] = 1; any = true; }
  }
  if (!any) return 0;
  if (scene.waterY != null) for (let v = 0; v < cols * rows; v++) {
    if (!water[v]) continue; const x = v % cols, y = (v / cols) | 0, o = (J0 + y) * C.nI + I0 + x, k = kinds[C.k1[o]]; if (k && k.mat === "lw water") continue;
    const P0 = C.P[o * 3], P2 = C.P[o * 3 + 2], depth = scene.waterY - C.P[o * 3 + 1], r = Math.sin(P0 * 3.1 + Math.sin(P2 * 1.7 + t * 0.6) * 2 + t * 0.9);
    out.G[v] = atlas.index(r > 0.75 ? "~" : r > 0.2 ? "-" : " "); const a = Math.max(0.25, 1 - depth * 2);
    out.FG[v * 3] = 20 * a; out.FG[v * 3 + 1] = 34 * a; out.FG[v * 3 + 2] = 52 * a; out.BG[v * 3] = 8; out.BG[v * 3 + 1] = 11; out.BG[v * 3 + 2] = 18; out.EM[v] = 0;
  }
  const flipG = new Map(Object.entries(FLIP).map(([a, b]) => [atlas.index(a), atlas.index(b)]));
  const src = { G: out.G.slice(), FG: out.FG.slice(), EM: out.EM.slice() };   // mirror the frame as it was, not as it is being written
  let n = 0;
  for (let x = 0; x < cols; x++) {
    let start = -1;
    for (let y = 0; y < rows; y++) {
      if (!water[y * cols + x]) { start = -1; continue; }
      if (start < 0) start = y;
      const d = y - start, I = I0 + x, J = J0 + y, o = J * C.nI + I, P = [C.P[o * 3], C.P[o * 3 + 2]];
      // ripples: a sideways shift of the source by the water's own place and the time; every third row of
      // a far reflection broken to a ripple glyph
      const wob = Math.sin(P[0] * 2.3 + P[1] * 1.7 + t * 1.4) + 0.6 * Math.sin(P[0] * 5.1 - t * 2.2);
      const sx = x + (wob > 0.9 ? 1 : wob < -0.9 ? -1 : 0), sy = start - 1 - d;
      if (sx < 0 || sx >= cols || sy < 0 || water[sy * cols + sx]) continue;
      const s = sy * cols + sx, v = y * cols + x; if (!src.G[s] || (atlas.cov[src.G[s]] || 0) < 0.01) continue;
      const lamp = src.EM[s] > 0, k = (lamp ? 0.7 : 0.38) * Math.max(0.35, 1 - d / 40);   // fades with depth below the edge
      if (!lamp && d > 2 && (y + Math.floor(t * 3)) % 3 === 0) { out.G[v] = atlas.index("~"); }
      else out.G[v] = flipG.get(src.G[s]) ?? src.G[s];
      out.FG[v * 3] = Math.min(255, src.FG[s * 3] * k * 0.8); out.FG[v * 3 + 1] = Math.min(255, src.FG[s * 3 + 1] * k * 0.9); out.FG[v * 3 + 2] = Math.min(255, src.FG[s * 3 + 2] * k * 1.15 + 6);
      if (lamp) out.EM[v] = Math.max(out.EM[v], 60);
      n++;
    }
  }
  return n;
}

// Does the plate's structure read in the glyph frame? The measure behind the night legibility work and
// the visual check's dark-plate gate (design/GLYPH-PIPELINE.md). Over the world cells on screen (figures
// and panels left out when the masks are on):
//   structure  the share of structural cells that read. A structural cell sits on a change of surface
//              kind, a depth jump of 0.6 m or more, a break or a thin thing. It reads when a neighbour
//              across the change differs from it by 6 display levels or more in cell value, or one side
//              shows type and the other none, or both show type in different glyphs (texture). A break or
//              thin-thing cell reads when it shows type.
//   coverage   the share of world cells that show type (a glyph whose ink stands 16 levels over its ground)
//   median, p90  the cells' value (display levels 0 to 255): how dark the night stays
//   follows    rank correlation between the cell's light and its value: brightness still follows light
// Original code.
import { shapeAgreement } from "./shape.mjs";
import { SHAPE_N } from "./atlas.mjs";
const lum = (a, i) => 0.2126 * a[i * 3] + 0.7152 * a[i * 3 + 1] + 0.0722 * a[i * 3 + 2];
export const SHOW = 16, STEP = 6, DEPTH = 0.6;

export function measureLegibility(S, atlas) {
  const C = S.C, out = S.buf, g = S.grid; if (!C || !out || !g) return null;
  const { I0, J0, cols, rows } = g, n = cols * rows, mask = S.figMask, E = S.E;
  const world = new Int32Array(n).fill(-1), Y = new Float32Array(n), shown = new Uint8Array(n);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const v = y * cols + x, I = I0 + x, J = J0 + y; if (I < 0 || J < 0 || I >= C.nI || J >= C.nJ) continue;
    const o = J * C.nI + I; if (mask && mask[v]) continue; world[v] = o;
    const fg = lum(out.FG, v), bg = lum(out.BG, v), cv = atlas.cov[out.G[v]] || 0;
    Y[v] = bg + Math.min(1, cv * 2.5) * Math.max(0, fg - bg);   // the cell's value as an eye takes it at a glance
    shown[v] = cv > 0.01 && fg - bg >= SHOW ? 1 : 0;
  }
  let structural = 0, reads = 0, finite = 0, show = 0; const vals = [], pairs = [];
  const fin = (o) => o >= 0 && Number.isFinite(C.P[o * 3 + 1]);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const v = y * cols + x, o = world[v]; if (!fin(o)) continue;
    finite++; show += shown[v]; vals.push(Y[v]); if (pairs.length < 6000 && (v % 3 === 0)) pairs.push([E[o * 3] * 0.2126 + E[o * 3 + 1] * 0.7152 + E[o * 3 + 2] * 0.0722, Y[v]]);
    let isS = C.thin[o] >= 0 || C.step[o] >= 0, ok = isS && shown[v] === 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Yy = y + dy; if (X < 0 || Yy < 0 || X >= cols || Yy >= rows) continue;
      const w = Yy * cols + X, q = world[w]; if (q < 0 || (mask && mask[w])) continue;
      const across = !fin(q) || C.k1[q] !== C.k1[o] || Math.abs(C.depth[q] - C.depth[o]) >= DEPTH; if (!across) continue;
      isS = true;
      if (Math.abs(Y[v] - Y[w]) >= STEP || shown[v] !== shown[w] || (shown[v] && shown[w] && out.G[v] !== out.G[w])) ok = true;
    }
    if (isS) { structural++; if (ok) reads++; }
  }
  // outline: how well the type follows the shapes under it, where a surface or a figure only partly covers a cell:
  // the correlation of the glyph's ink pattern (3 x 4) with the cover pattern, averaged (world cells and figure cells apart)
  const occF = new Float32Array(SHAPE_N); let wa = 0, wn = 0, fa = 0, fn = 0;
  for (let v = 0; v < n; v++) {
    const o = world[v];
    if (out.figOcc && out.figOcc.has(v)) { const oc = out.figOcc.get(v); for (let r = 0; r < SHAPE_N; r++) occF[r] = oc[r]; const a = shapeAgreement(atlas.desc, out.G[v], occF); if (a != null) { fa += a; fn++; } continue; }
    if (!fin(o) || !C.occ || (mask && mask[v])) continue;
    let on = 0; for (let r = 0; r < SHAPE_N; r++) { const q = C.occ[o * SHAPE_N + r]; occF[r] = C.thin[o] >= 0 ? 1 - q / 255 : q / 255; if (q) on++; }
    if (on < 2 || on > SHAPE_N - 2 || (atlas.cov[out.G[v]] || 0) <= 0.01 || C.thin[o] >= 0 || C.step[o] >= 0) continue;   // fills only: outlines keep their slope glyphs
    const a = shapeAgreement(atlas.desc, out.G[v], occF); if (a != null) { wa += a; wn++; }
  }
  // parts: where two parts of one figure meet (coat and trousers, coat and hand), does the type tell them apart,
  // by glyph (texture) or by 16 levels of value?
  let pm = 0, pr = 0;
  if (out.figPart) for (const [v, part] of out.figPart) {
    const x = v % cols, y = (v / cols) | 0, who = part.split("|")[0];
    for (const [dx, dy] of [[1, 0], [0, 1]]) { const w = (y + dy) * cols + x + dx, q = x + dx < cols && y + dy < rows ? out.figPart.get(w) : null; if (!q || q === part || q.split("|")[0] !== who) continue; pm++; if (out.G[v] !== out.G[w] || Math.abs(lum(out.FG, v) - lum(out.FG, w)) >= 16) pr++; }
  }
  vals.sort((a, b) => a - b);
  return { structure: structural ? +(reads / structural).toFixed(3) : null, structural, coverage: finite ? +(show / finite).toFixed(3) : null, median: vals.length ? +vals[vals.length >> 1].toFixed(1) : null, p90: vals.length ? +vals[Math.floor(vals.length * 0.9)].toFixed(1) : null, follows: spearman(pairs), cells: finite, outlineWorld: wn ? +(wa / wn).toFixed(3) : null, outlineFigure: fn ? +(fa / fn).toFixed(3) : null, outlineCells: [wn, fn], partsRead: pm ? +(pr / pm).toFixed(3) : null, partMeets: pm };
}
function rank(a) { const ix = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Float64Array(a.length); for (let i = 0; i < ix.length;) { let j = i; while (j + 1 < ix.length && ix[j + 1][0] === ix[i][0]) j++; for (let k = i; k <= j; k++) r[ix[k][1]] = (i + j) / 2; i = j + 1; } return r; }
function spearman(p) {
  if (p.length < 20) return null;
  const a = rank(p.map((x) => x[0])), b = rank(p.map((x) => x[1])), n = p.length, ma = (n - 1) / 2;
  let s = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { s += (a[i] - ma) * (b[i] - ma); sa += (a[i] - ma) ** 2; sb += (b[i] - ma) ** 2; }
  return sa && sb ? +(s / Math.sqrt(sa * sb)).toFixed(3) : null;
}

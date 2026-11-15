// A figure's geometry in the grid (figures.mjs uses it): its parts as screen capsules from the posed
// skeleton, which cells it covers (the nearest part, not hidden by the world, with each cell's 3 x 4
// cover pattern for the shape-aware glyphs), how bright the ground round it reads, and its contact
// shadow in type. Original code (moved out of figures.mjs and split so no function passes 50 lines).
import { SHAPE_COLS, SHAPE_ROWS, SHAPE_N } from "./atlas.mjs";

// joint numbers (characters/rig/skeleton.mjs JOINTS order)
export const J = { pelvis: 1, chest: 3, neck: 4, head: 5, armL: 7, foreL: 8, handL: 9, armR: 11, foreR: 12, handR: 13, thighL: 14, shinL: 15, footL: 16, thighR: 17, shinR: 18, footR: 19, hangL: 20 };
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
export function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return [Math.hypot(px - ax - t * dx, py - ay - t * dy), t]; }
// the nearest point on a part's axis to a screen point: [distance, t, x, y]
export function segFoot(px, py, s) { const ax = s.a[0], ay = s.a[1], dx = s.b[0] - ax, dy = s.b[1] - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)), x = ax + t * dx, y = ay + t * dy; return [Math.hypot(px - x, py - y), t, x, y]; }

// parts: [a, b, radius m, material, kind] -> screen capsules { a, b, r, m, k, d }
export function partsOf(F, toS, dep, ppm) {
  const j = F.joints, P = F.P || { head: 0.27, shoulder: 0.19, hip: 0.12 }, knee = mid(j[J.shinL], j[J.shinR]);
  const headC = [j[J.head][0], j[J.head][1] + P.head * 0.42, j[J.head][2]];
  const parts = [
    [j[J.thighL], j[J.shinL], 0.075, "trouser"], [j[J.shinL], j[J.footL], 0.065, "boot"], [j[J.thighR], j[J.shinR], 0.075, "trouser"], [j[J.shinR], j[J.footR], 0.065, "boot"],
    [j[J.pelvis], knee, P.hip * 1.7, "coat"], [j[J.pelvis], j[J.neck], P.shoulder * 0.9, "coat"],
    [j[J.armL], j[J.foreL], 0.062, "coat"], [j[J.foreL], j[J.handL], 0.058, "coat"], [j[J.armR], j[J.foreR], 0.062, "coat"], [j[J.foreR], j[J.handR], 0.058, "coat"],
    [j[J.handL], j[J.handL], 0.05, "skin"], [j[J.handR], j[J.handR], 0.05, "skin"], [j[J.neck], j[J.head], 0.05, "skin"], [headC, headC, P.head * 0.5, "skin", "head"],
  ];
  if (F.weapon && F.weapon.butt && F.weapon.tip) parts.push([F.weapon.butt, F.weapon.tip, 0.02, "tool", "line"]);
  return parts.map(([a, b, r, m, k]) => ({ a: toS(a), b: toS(b), r: Math.max(2.5, r * ppm), m, k, d: dep(mid(a, b)) }));
}
export function boxOf(S, grid) {
  const { ox, oy, cw, ch, cols, rows } = grid;
  const xs = S.flatMap((s) => [s.a[0] - s.r, s.b[0] + s.r, s.a[0] + s.r, s.b[0] - s.r]), ys = S.flatMap((s) => [s.a[1] - s.r, s.b[1] + s.r, s.a[1] + s.r, s.b[1] - s.r]);
  return { x0: Math.max(0, Math.floor((Math.min(...xs) - ox) / cw)), x1: Math.min(cols - 1, Math.ceil((Math.max(...xs) - ox) / cw)), y0: Math.max(0, Math.floor((Math.min(...ys) - oy) / ch)), y1: Math.min(rows - 1, Math.ceil((Math.max(...ys) - oy) / ch)) };
}
// one cell: the nearest part covering its centre, and its 3 x 4 cover by any part
function coverCell(S, grid, x, y, shape) {
  const { ox, oy, cw, ch } = grid, cx = ox + x * cw + cw / 2, cy = oy + y * ch + ch / 2;
  let best = null, bd = Infinity, bcov = 0, bt = 0;
  for (const s of S) { const [d, t] = segDist(cx, cy, s.a[0], s.a[1], s.b[0], s.b[1]), cov = Math.min(1, Math.max(0, (s.r - d) / (cw * 0.55) + 0.5)); if (cov <= 0.2) continue; if (s.d < bd) { bd = s.d; best = s; bcov = cov; bt = t; } }
  let on = 0; const occ = new Uint8Array(SHAPE_N);
  for (let r = 0; r < SHAPE_N; r++) { const px = ox + x * cw + ((r % SHAPE_COLS) + 0.5) * (cw / SHAPE_COLS), py = oy + y * ch + (Math.floor(r / SHAPE_COLS) + 0.5) * (ch / SHAPE_ROWS); for (const s of S) { if (segDist(px, py, s.a[0], s.a[1], s.b[0], s.b[1])[0] < s.r) { occ[r] = 1; on++; break; } } }
  // a cell whose centre misses the figure but whose edge it crosses is drawn too, by the nearest part
  if (!best && shape && on >= 3) { let nd = Infinity; for (const s of S) { const [d, t] = segDist(cx, cy, s.a[0], s.a[1], s.b[0], s.b[1]); if (d - s.r < nd) { nd = d - s.r; best = s; bt = t; bd = s.d; } } bcov = on / SHAPE_N; }
  return best ? { best, bcov, bt, bd, cx, cy, occ, on } : null;
}
// which cells the figure covers (not hidden by the world): Map(cell -> { best, bcov, bt, cx, cy, occ, on })
export function coverOf(S, grid, box, o) {
  const { C, cols } = grid, cover = new Map();
  for (let y = box.y0; y <= box.y1; y++) for (let x = box.x0; x <= box.x1; x++) {
    const c = coverCell(S, grid, x, y, o.shape !== false); if (!c) continue;
    const I = grid.I0 + x, Jc = grid.J0 + y; if (I >= 0 && Jc >= 0 && I < C.nI && Jc < C.nJ && C.depth[Jc * C.nI + I] < c.bd - 0.35) continue;
    cover.set(y * cols + x, c);
  }
  return cover;
}
// a cell's brightness as it will show (ground mixed with ink by the glyph's coverage), 0..255
export const shownLum = (out, atlas, q) => { const cv = atlas.cov[out.G[q]] || 0; let s = 0; for (const [c, w] of [[0, 0.2126], [1, 0.7152], [2, 0.0722]]) s += w * (out.BG[q * 3 + c] + cv * (out.FG[q * 3 + c] - out.BG[q * 3 + c])); return s; };
// how bright the ground round the figure reads (the cells two out from its box)
export function ringLum(out, atlas, grid, box, cover) {
  let rl = 0, rn = 0;
  for (let y = Math.max(0, box.y0 - 2); y <= Math.min(grid.rows - 1, box.y1 + 2); y++) for (let x = Math.max(0, box.x0 - 2); x <= Math.min(grid.cols - 1, box.x1 + 2); x++) {
    const q = y * grid.cols + x; if (cover.has(q)) continue; rl += shownLum(out, atlas, q); rn++;
  }
  return rn ? rl / rn : 0;
}
// a contact shadow in type: an ellipse under the feet, cast away from the key light on screen, where the
// ground's glyph thins to a sparse mark and its ink drops to half (?glyph=noshadow is the before)
export function contactShadow(out, atlas, grid, feet, cover, ppm, keyScreen) {
  const { ox, oy, cw, ch, cols, rows, C } = grid, sE = Math.sin((C.pj.camera.elevDeg * Math.PI) / 180), R = 0.42 * ppm;
  const away = keyScreen ? [-keyScreen[0], -keyScreen[1]] : [0.6, 0.2], al = Math.hypot(...away) || 1, cxs = feet[0] + (0.2 * ppm * away[0]) / al, cys = feet[1] + (0.07 * ppm * Math.max(0, away[1])) / al + 0.03 * ppm;
  for (let y = Math.max(0, Math.floor((cys - R * sE - oy) / ch)); y <= Math.min(rows - 1, Math.ceil((cys + R * sE - oy) / ch)); y++) for (let x = Math.max(0, Math.floor((cxs - R - ox) / cw)); x <= Math.min(cols - 1, Math.ceil((cxs + R - ox) / cw)); x++) {
    const q = y * cols + x; if (cover.has(q) || out.EM[q]) continue;
    const dx = (ox + x * cw + cw / 2 - cxs) / R, dy = (oy + y * ch + ch / 2 - cys) / (R * sE), e = dx * dx + dy * dy; if (e > 1) continue;
    const k = 0.45 + 0.35 * e; if ((atlas.cov[out.G[q]] || 0) > 0.06) out.G[q] = atlas.index(e < 0.5 ? "." : ","); for (let c = 0; c < 3; c++) { out.FG[q * 3 + c] *= k; out.BG[q * 3 + c] *= 0.6 + 0.4 * e; }
  }
}

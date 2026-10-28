// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// lines.mjs: the elements as drawn line. Marching squares cuts the lines-weighted field at evenly spaced levels
// (more levels with more detail); segments are chained into polylines and scaled to the output frame. Higher levels
// draw heavier, so the line weight is a reading of the field's height, the way a contour map's index lines are.
// The vector is the superframe's own 'vector' port shape, written as SVG by lib/export.mjs svgOf. The raster uses
// an exact-distance stroke kept as the maximum coverage per pixel: order-independent, so re-chaining a contour
// that crosses an edited region cannot move a single pixel outside it.
import { hexLin } from '../../../creation/lib/core/layer.mjs';
import { svgOf } from '../export.mjs';
import { fieldFor } from './common.mjs';
import { hatch } from './hatch.mjs';

const lerpT = (a, b, l) => (l - a) / (b - a || 1e-9);

export function isolines(F, w, h, level) {
  const segs = [], H0 = w * h;
  // edge ids: horizontal edge (i,j)-(i+1,j) is j*w+i; vertical edge (i,j)-(i,j+1) is H0 + j*w+i
  const pt = (id) => { if (id < H0) { const j = (id / w) | 0, i = id - j * w; return [i + lerpT(F[j * w + i], F[j * w + i + 1], level), j]; } const q = id - H0, j = (q / w) | 0, i = q - j * w; return [i, j + lerpT(F[j * w + i], F[(j + 1) * w + i], level)]; };
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const a = F[j * w + i] > level, b = F[j * w + i + 1] > level, c = F[(j + 1) * w + i + 1] > level, d = F[(j + 1) * w + i] > level;
    const code = a | (b << 1) | (c << 2) | (d << 3); if (code === 0 || code === 15) continue;
    const top = j * w + i, bot = (j + 1) * w + i, left = H0 + j * w + i, right = H0 + j * w + i + 1;
    const E = { 1: [[left, top]], 2: [[top, right]], 3: [[left, right]], 4: [[right, bot]], 5: [[left, top], [right, bot]], 6: [[top, bot]], 7: [[left, bot]], 8: [[bot, left]], 9: [[bot, top]], 10: [[top, right], [bot, left]], 11: [[bot, right]], 12: [[right, left]], 13: [[right, top]], 14: [[top, left]] }[code];
    for (const s of E) segs.push(s);
  }
  // chain by shared edge ids
  const at = new Map(); segs.forEach((s, k) => { for (const e of s) { const l = at.get(e); l ? l.push(k) : at.set(e, [k]); } });
  const used = new Uint8Array(segs.length), out = [];
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue; used[k] = 1; const ids = [segs[k][0], segs[k][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const end = dir ? ids[ids.length - 1] : ids[0], nx = (at.get(end) ?? []).find(m => !used[m]); if (nx === undefined) break;
        used[nx] = 1; const o = segs[nx][0] === end ? segs[nx][1] : segs[nx][0]; dir ? ids.push(o) : ids.unshift(o);
      }
    }
    out.push({ pts: ids.map(pt), closed: ids[0] === ids[ids.length - 1] });
  }
  return out;
}

export function lines(r, layers) {
  const [w, h] = r.sim, [W, H] = r.size, F = fieldFor(r, layers, 'lines'), n = 4 + Math.round(10 * r.detail), sx = W / w, sy = H / h, unit = W / 3840;
  const paths = [];
  for (let q = 0; q < n; q++) {
    const level = 0.04 + 0.9 * (q + 0.5) / n, width = (1.2 + 2.6 * q / Math.max(1, n - 1)) * unit * (0.5 + r.media.lines);
    for (const p of isolines(F, w, h, level)) if (p.pts.length > 1) paths.push({ pts: p.pts.map(([x, y]) => [(x + 0.5) * sx, (y + 0.5) * sy]), closed: p.closed, width, level: +level.toFixed(4) });
  }
  // tone as hatching along the form (hatch.mjs); r.lines.hatch: 'curvature' (default), 'flat' (the control) or 'none'
  const hm = r.lines?.hatch ?? 'curvature', hd = 3.2;
  let hatchCount = 0;
  if (hm !== 'none') {
    const { strokes } = hatch(F, w, h, { mode: hm, angle: r.lines?.angle ?? 45, seed: `${r.seed}/hatch`, d: hd });
    for (const s of strokes) if (s.pts.length > 1) paths.push({ pts: s.pts.map(([x, y]) => [(x + 0.5) * sx, (y + 0.5) * sy]), closed: false, width: (0.45 + 0.75 * s.tone) * sx, hatch: true });
    hatchCount = strokes.length;
  }
  const V = { w: W, h: H, paths }, cover = rasterMax(V, W, H), paper = hexLin(r.palette.paper), ink = hexLin(r.palette.ink), rgb = new Float32Array(3 * W * H);
  for (let k = 0; k < W * H; k++) for (let c = 0; c < 3; c++) rgb[3 * k + c] = paper[c] + (ink[c] - paper[c]) * cover[k];
  return { W, H, V, rgb, cover, levels: n, hatch: { mode: hm, strokes: hatchCount, d: hd, cover: () => rasterMax({ w: W, h: H, paths: paths.filter(p => p.hatch) }, W, H) }, svg: () => svgOf(V, { ground: r.palette.paper, ink: r.palette.ink, title: 'lines' }) };
}

// exact distance to each segment, coverage = clamp(halfwidth + 0.5 - d), kept as the max over all segments
export function rasterMax(V, W, H) {
  const C = new Float32Array(W * H);
  for (const p of V.paths) {
    const P = p.pts, hw = p.width / 2, m = p.closed ? P.length : P.length - 1;
    for (let s = 0; s < m; s++) {
      const [ax, ay] = P[s], [bx, by] = P[(s + 1) % P.length], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-12;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - hw - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + hw + 1)), y0 = Math.max(0, Math.floor(Math.min(ay, by) - hw - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + hw + 1));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)), d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
        const c = Math.min(1, Math.max(0, hw + 0.5 - d)), k = y * W + x; if (c > C[k]) C[k] = c;
      }
    }
  }
  return C;
}

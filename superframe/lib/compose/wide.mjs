// wide.mjs: the wide-angle checker. Segments that point at the main vanishing point are grouped into lines by their
// polar angle around it (pieces of one line broken by crossings share that angle). For each line:
//   reach = (its furthest point from the vanishing point) / (distance from the vanishing point to the frame edge
//           along the same ray). A line "reaches the edge" when it ends within 2% of that ray's length.
//   depth ratio = r_max / r_min. Along any straight 3D line, image distance from its vanishing point is
//           proportional to 1 / depth, so this ratio is the ratio of the far and near depths the line spans (physics).
// The edge score is the fraction of lines that reach the edge; it reads framing. The depth ratio reads how deep a
// space the frame takes in, which is what a short lens close to a subject changes.
import { mainVP } from './vp.mjs';
import { median } from './stats.mjs';

// Distance from v to the frame boundary along unit direction (c, s): the exit point of the ray through the frame.
export function edgeDistance(v, c, s, w, h) {
  let tExit = Infinity, tEnter = 0;
  for (const [o, d, lo, hi] of [[v[0], c, 0, w], [v[1], s, 0, h]]) {
    if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) return null; continue; }
    let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a];
    tEnter = Math.max(tEnter, a); tExit = Math.min(tExit, b);
  }
  return tExit > tEnter ? tExit : null;
}

export function groupLines(vp, segs, { tolDeg = 1.5 } = {}) {
  const items = segs.map(s => ({ s, phi: Math.atan2(s.my - vp[1], s.mx - vp[0]) })).sort((a, b) => a.phi - b.phi), groups = [];
  for (const it of items) {
    const g = groups.at(-1);
    if (g && Math.abs(it.phi - g.last) <= tolDeg * Math.PI / 180) { g.items.push(it); g.last = it.phi; } else groups.push({ items: [it], last: it.phi });
  }
  if (groups.length > 1) {   // wrap around at +-pi
    const a = groups[0], z = groups.at(-1);
    if (a.items[0].phi + 2 * Math.PI - z.last <= tolDeg * Math.PI / 180) { a.items.unshift(...z.items); groups.pop(); }
  }
  return groups.map(g => g.items.map(i => i.s));
}

function lineReading(vp, segs, w, h, edgeTol) {
  let rmin = Infinity, rmax = 0, len = 0, cx = 0, cy = 0;
  for (const s of segs) {
    for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) { const r = Math.hypot(x - vp[0], y - vp[1]); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); }
    len += s.len; cx += s.len * (s.mx - vp[0]); cy += s.len * (s.my - vp[1]);
  }
  const n = Math.hypot(cx, cy) || 1, rEdge = edgeDistance(vp, cx / n, cy / n, w, h);
  const reach = rEdge ? Math.min(1, rmax / rEdge) : 0;
  return { phi: Math.atan2(cy, cx) * 180 / Math.PI, rmin, rmax, rEdge, len, pieces: segs.length, reach, reachesEdge: rEdge !== null && rEdge - rmax <= edgeTol * rEdge, depthRatio: rmax / Math.max(rmin, 1) };
}

// Full reading of one image's segments. Lines shorter than minFrac of W are dropped as noise.
// minLines (added 2026-10-28, after the rainbow plate, post-hoc): a vanishing point needs at least 3 distinct
// converging lines; chords of one curved edge passed the shuffle null on our rainbow render with 2.
export function wideAngle(segs, w, h, { edgeTol = 0.02, minFrac = 0.03, minLines = 3, vpOpts = {} } = {}) {
  const { main, all } = mainVP(segs, w, h, vpOpts);
  const grouped = main ? groupLines(main.vp, main.inliers).map(g => lineReading(main.vp, g, w, h, edgeTol)).filter(l => l.len >= minFrac * w) : [];
  if (!main || grouped.length < minLines) return { vp: null, significant: false, rejected: main ? `${grouped.length} lines, need ${minLines}` : null, lines: [], edgeScore: null, meanReach: null, depthRatio: null, vps: all };
  const lines = grouped;
  const n = lines.length;
  return {
    vp: main.vp, support: main.support, p: main.p, significant: main.significant, inliers: main.inliers, vps: all.map(r => ({ vp: r.vp, support: r.support })), lines,
    edgeScore: n ? lines.filter(l => l.reachesEdge).length / n : null,
    meanReach: n ? lines.reduce((a, l) => a + l.reach, 0) / n : null,
    depthRatio: median(lines.map(l => l.depthRatio)),
  };
}

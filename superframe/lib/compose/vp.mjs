// vp.mjs: the dominant vanishing point of a set of segments. Candidates are the intersections of the longest
// segments taken in pairs; each candidate is scored by the length of segments whose line points at it (a Gaussian in
// the angle between the segment and the ray from its midpoint to the candidate); the best is refined by weighted
// least squares in angle. Significance comes from the segments themselves: the same midpoints and lengths with
// directions shuffled R times. A vanishing point counts only when the real support beats every shuffled support.
import { rng } from './stats.mjs';

const D2R = Math.PI / 180;

const dirOf = s => { const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1; return [(s.x2 - s.x1) / L, (s.y2 - s.y1) / L]; };

// Angle (radians) between segment s's line and the ray from its midpoint to v.
export function pointing(s, v, d = dirOf(s)) {
  const rx = v[0] - s.mx, ry = v[1] - s.my, r = Math.hypot(rx, ry);
  if (r < 1e-9) return 0;
  return Math.asin(Math.min(1, Math.abs(d[0] * ry - d[1] * rx) / r));
}

function score(segs, dirs, v, sig) {
  let s = 0;
  for (let i = 0; i < segs.length; i++) { const t = pointing(segs[i], v, dirs[i]); if (t < 3 * sig) s += segs[i].len * Math.exp(-t * t / (2 * sig * sig)); }
  return s;
}

function intersect(a, b, da, db) {
  const den = da[0] * db[1] - da[1] * db[0];
  if (Math.abs(den) < 1e-6) return null;
  const t = ((b.mx - a.mx) * db[1] - (b.my - a.my) * db[0]) / den;
  return [a.mx + t * da[0], a.my + t * da[1]];
}

function bestCandidate(segs, dirs, sig, topN) {
  const idx = segs.map((s, i) => i).sort((i, j) => segs[j].len - segs[i].len).slice(0, topN);
  let best = null, bs = -1;
  for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
    const v = intersect(segs[idx[a]], segs[idx[b]], dirs[idx[a]], dirs[idx[b]]);
    if (!v) continue;
    const s = score(segs, dirs, v, sig); if (s > bs) { bs = s; best = v; }
  }
  return { v: best, s: bs };
}

// Weighted least squares on the inliers: minimise sum w (n_i . (v - m_i))^2 / |v - m_i|^2, iterated.
function refine(segs, dirs, v0, sig, iters = 12) {
  let v = v0;
  for (let it = 0; it < iters; it++) {
    let A = 0, B = 0, C = 0, D = 0, E = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i], t = pointing(s, v, dirs[i]); if (t >= 3 * sig) continue;
      const r2 = (v[0] - s.mx) ** 2 + (v[1] - s.my) ** 2 || 1, w = s.len * Math.exp(-t * t / (2 * sig * sig)) / r2;
      const nx = -dirs[i][1], ny = dirs[i][0], c = nx * s.mx + ny * s.my;
      A += w * nx * nx; B += w * nx * ny; C += w * ny * ny; D += w * nx * c; E += w * ny * c;
    }
    const det = A * C - B * B; if (Math.abs(det) < 1e-18) break;
    const nv = [(C * D - B * E) / det, (A * E - B * D) / det];
    if (Math.hypot(nv[0] - v[0], nv[1] - v[1]) < 1e-4) { v = nv; break; }
    v = nv;
  }
  return v;
}

export function shuffleDirections(segs, seed) {
  const r = rng(seed);
  return segs.map(s => { const a = r() * Math.PI, h = s.len / 2, c = Math.cos(a), n = Math.sin(a);
    return { ...s, x1: s.mx - h * c, y1: s.my - h * n, x2: s.mx + h * c, y2: s.my + h * n, angle: a * 180 / Math.PI, shuffled: true }; });
}

// Find the dominant vanishing point. Returns { vp, support, total, inliers, p, significant, nulls }. The significance
// test compares unrefined candidate scores on both sides, so refinement gives the real set no advantage.
export function findVP(segs, { tolDeg = 1.5, topN = 60, R = 19, seed = 'vp-null', minLen = 0 } = {}) {
  const S = segs.filter(s => s.len >= minLen), sig = tolDeg * D2R, total = S.reduce((a, s) => a + s.len, 0);
  if (S.length < 2) return { vp: null, support: 0, total, inliers: [], p: 1, significant: false, nulls: [] };
  const dirs = S.map(dirOf), c = bestCandidate(S, dirs, sig, topN);
  if (!c.v) return { vp: null, support: 0, total, inliers: [], p: 1, significant: false, nulls: [] };
  const vp = refine(S, dirs, c.v, sig), sc = score(S, dirs, vp, sig);
  const inliers = S.filter((s, i) => pointing(s, vp, dirs[i]) < 3 * sig);
  const nulls = [];
  for (let k = 0; k < R; k++) { const T = shuffleDirections(S, `${seed}/${k}`), d = T.map(dirOf); nulls.push(bestCandidate(T, d, sig, topN).s / total); }
  const support = sc / total, raw = c.s / total, beat = nulls.filter(x => x >= raw).length, p = (1 + beat) / (R + 1);
  return { vp, support, total, inliers, p, significant: R > 0 && beat === 0, nulls };
}

// Up to k vanishing points found in turn, each from the segments the earlier ones did not explain; stops at the
// first one that is not significant. A Manhattan scene has three (two often at infinity).
export function findVPs(segs, { k = 4, ...o } = {}) {
  const out = []; let rest = segs;
  for (let i = 0; i < k && rest.length >= 2; i++) {
    const r = findVP(rest, { ...o, seed: `${o.seed ?? 'vp-null'}/${i}` });
    if (!r.significant) break;
    out.push(r); const inl = new Set(r.inliers); rest = rest.filter(s => !inl.has(s));
  }
  return out;
}

// The convergence point the eye follows: the strongest significant vanishing point within `reach` frame widths of
// the frame centre. Points further out (parallel families, near-infinite cross lines) are listed but not chosen.
export function mainVP(segs, w, h, { reach = 1.5, ...o } = {}) {
  const all = findVPs(segs, o), near = all.filter(r => Math.hypot(r.vp[0] - w / 2, r.vp[1] - h / 2) <= reach * w);
  const main = near.sort((a, b) => b.support * b.total - a.support * a.total)[0] ?? null;
  return { main, all };
}

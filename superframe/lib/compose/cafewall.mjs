// cafewall.mjs: the café wall control and the line-angle instrument it checks. The strip is rows of black and white
// tiles separated by thin grey mortar; each row is shifted along the zigzag 0, 1/4, 1/2, 1/4 of a tile, which makes
// exactly horizontal mortar lines look tilted to the eye. The strip is drawn by exact geometry with 4 x 4 samples per
// pixel, rotated by `angleDeg` (counterclockwise on screen) about the frame centre, so the planted angle is exact.
import { poolMoments } from './lines.mjs';

const SHIFT = [0, 0.25, 0.5, 0.25];

export function cafeWall(w, h, { angleDeg = 0, rows = 7, tile = null, mortar = null, ss = 4 } = {}) {
  const T = tile ?? h / (rows + 2), M = mortar ?? T / 10, H = rows * T, a = angleDeg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const cx = w / 2, cy = h / 2, L = 0.9 * w, rgba = new Uint8ClampedArray(w * h * 4);
  const tone = (xs, ys) => {                 // strip coordinates, origin at the strip centre, y down
    const X = xs + L / 2, Y = ys + H / 2;
    if (X < 0 || X > L || Y < 0 || Y > H) return 0.62;
    const row = Math.min(rows - 1, Math.floor(Y / T)), y0 = Y - row * T;
    if (y0 < M / 2 || y0 > T - M / 2) return 0.5;
    const col = Math.floor(X / T + SHIFT[row % 4]);
    return col % 2 === 0 ? 0.04 : 0.96;
  };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let v = 0;
    for (let q = 0; q < ss * ss; q++) {
      const dx = i + ((q % ss) + 0.5) / ss - cx, dyUp = cy - (j + (Math.floor(q / ss) + 0.5) / ss);
      v += tone(dx * c + dyUp * s, -(-dx * s + dyUp * c));
    }
    const g = Math.round(255 * v / (ss * ss)), p = 4 * (j * w + i);
    rgba[p] = rgba[p + 1] = rgba[p + 2] = g; rgba[p + 3] = 255;
  }
  return { w, h, rgba, truth: { angleDeg, rows, mortarLines: rows - 1, tile: T, mortar: M } };
}

// Centred scatter of a moment set: [a, b, c] = [var x, cov xy, var y] times the weight.
const scatter = m => { const cx = m.x / m.s, cy = m.y / m.s; return [m.xx - m.s * cx * cx, m.xy - m.s * cx * cy, m.yy - m.s * cy * cy]; };
const angleOf = ([a, b, c]) => { let t = -0.5 * Math.atan2(2 * b, a - c) * 180 / Math.PI; if (t <= -90) t += 180; if (t > 90) t -= 180; return t; };

function groupByOffset(segs, angleDeg, gap) {
  const t = angleDeg * Math.PI / 180, rho = s => s.mx * Math.sin(t) + s.my * Math.cos(t), groups = [];
  for (const it of segs.map(s => ({ s, r: rho(s) })).sort((a, b) => a.r - b.r)) {
    const g = groups.at(-1); if (g && it.r - g.last <= gap) { g.segs.push(it.s); g.last = it.r; } else groups.push({ segs: [it.s], last: it.r });
  }
  return groups.map(g => { const sc = scatter(poolMoments(g.segs.map(s => s.m))); return { angle: angleOf(sc), offset: g.last, len: g.segs.reduce((a, s) => a + s.len, 0), pieces: g.segs.length, sc }; });
}

// The angle of a family of parallel lines. Segments within `band` degrees of the length-weighted mode are grouped into
// lines by perpendicular offset (gap > `gap` px starts a new line); each line's angle is the total-least-squares fit
// of its pooled pixels; the family angle pools the within-line scatter, so separate lines do not bias each other.
export function lineAngles(segs, { band = 15, gap = 3, minLen = 0 } = {}) {
  const S = segs.filter(s => s.len >= minLen);
  if (!S.length) return { angle: null, lines: [], segments: 0 };
  const hist = new Float64Array(180); for (const s of S) hist[(Math.round(s.angle) + 180) % 180] += s.len;
  let mode = 0; for (let i = 1; i < 180; i++) if (hist[i] > hist[mode]) mode = i;
  const near = S.filter(s => { const d = Math.abs(((s.angle - mode) % 180 + 270) % 180 - 90); return d <= band; });
  let est = mode > 90 ? mode - 180 : mode, lines = [];
  for (let pass = 0; pass < 2; pass++) {            // group by offset across the estimated angle, refit, regroup once
    lines = groupByOffset(near, est, gap);
    est = angleOf(lines.reduce((a, l) => [a[0] + l.sc[0], a[1] + l.sc[1], a[2] + l.sc[2]], [0, 0, 0]));
  }
  return { angle: est, mode: mode > 90 ? mode - 180 : mode, segments: near.length, lines: lines.map(({ sc, ...l }) => l) };
}

// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// bacteria.mjs: bacterial cells shaped by the laws measured from DeepBacs (StarDist MIXED instance masks, CC BY 4.0,
// MMBU slice 3), measured by library/lib/tools/bactlaws.py into measures/bactlaws-deepbacs.json.
// Each cell is a stadium (rectangle with round caps), length L and width w, in dataset pixels.
//
// The law: rods lengthen at a near-constant width. The slope of log w on log L is 0.038 for E. coli (2611 cells,
// 95% CI 0.009 to 0.072) and 0.018 for B. subtilis (4129 cells, 0.009 to 0.026). S. aureus cocci, through the same
// pipeline, give 0.62 (0.58 to 0.66): their width follows their size. Width varies far less than length in rods
// (CV ratio 0.36 and 0.25) and as much in cocci (1.03).
//
// The generator samples L lognormal from the measured median and spread, and sets w = w0 (L / L0)^slope times a small
// lognormal noise, slope the species' measured value. law 'isotropic' is the control: slope 1, so cells are scaled
// copies of one shape.
//
// Measuring near-round cells couples w to L by itself: L is the long side and w the short, so a coccus whose width
// ignores its length still reads a slope of about 0.37. slopeIn is the generating slope that reads back as the
// measured one (calibrated: 0.355 gives 0.62 for S. aureus). For rods (L several times w) the two coincide.
export const SPECIES = {
  'e-coli': { name: 'E. coli', L: 55.8, Lspan: [37.0, 87.4], w: 12.4, cvW: 0.102, aspect: 4.49, slope: 0.038 },
  'b-subtilis': { name: 'B. subtilis', L: 70.1, Lspan: [43.3, 123.9], w: 12.2, cvW: 0.087, aspect: 6.04, slope: 0.018 },
  's-aureus': { name: 'S. aureus', L: 14.0, Lspan: [12.0, 17.0], w: 12.7, cvW: 0.118, aspect: 1.13, slope: 0.622, slopeIn: 0.355 },
};
export const SOURCE = 'DeepBacs StarDist MIXED, CC BY 4.0; measures/bactlaws-deepbacs.json';

// a normal deviate from two uniforms (Box-Muller)
const gauss = rng => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

export function shapes(sp, n, rng, law = 'measured') {
  const s = SPECIES[sp], sL = Math.log(s.Lspan[1] / s.Lspan[0]) / 3.29, out = [];
  for (let i = 0; i < n; i++) {
    const L = s.L * Math.exp(sL * gauss(rng)), noise = Math.exp(s.cvW * gauss(rng));
    const w = s.w * Math.pow(L / s.L, law === 'isotropic' ? 1 : (s.slopeIn ?? s.slope)) * noise;
    // the measurement takes L as the long side and w as the short; do the same (a clamp would couple w to L)
    out.push({ L: Math.max(L, w), w: Math.min(L, w) });
  }
  return out;
}

// distance between segments ab and cd
function segDist(ax, ay, bx, by, cx, cy, dx, dy) {
  const pt = (px, py, x0, y0, x1, y1) => { const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / l2)) : 0; return Math.hypot(px - x0 - t * vx, py - y0 - t * vy); };
  const cross = (x0, y0, x1, y1, x2, y2) => (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  const d1 = cross(ax, ay, bx, by, cx, cy), d2 = cross(ax, ay, bx, by, dx, dy), d3 = cross(cx, cy, dx, dy, ax, ay), d4 = cross(cx, cy, dx, dy, bx, by);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(pt(ax, ay, cx, cy, dx, dy), pt(bx, by, cx, cy, dx, dy), pt(cx, cy, ax, ay, bx, by), pt(dx, dy, ax, ay, bx, by));
}

// place cells without overlap: each is { x, y, a (angle), L, w } with its spine from (x, y) +- (L - w) / 2 along a
export function place({ w, h, species = 'e-coli', count = 120, law = 'measured', scale = 1, rng, gap = 1.5, tries = 80, align = 0 }) {
  const cells = [], segs = [];
  for (const c of shapes(species, count, rng, law)) {
    const L = c.L * scale, W = c.w * scale, half = (L - W) / 2;
    for (let t = 0; t < tries; t++) {
      const x = W / 2 + rng() * (w - W), y = W / 2 + rng() * (h - W), a = align ? (Math.sin(x / w * 3) * 1.2 + (rng() - 0.5) * (1 - align) * Math.PI) : rng() * Math.PI;
      const ux = Math.cos(a) * half, uy = Math.sin(a) * half, s = [x - ux, y - uy, x + ux, y + uy, W];
      if (s[0] < W / 2 || s[2] < W / 2 || s[1] < W / 2 || s[3] < W / 2 || s[0] > w - W / 2 || s[2] > w - W / 2 || s[1] > h - W / 2 || s[3] > h - W / 2) continue;
      if (segs.some(o => segDist(s[0], s[1], s[2], s[3], o[0], o[1], o[2], o[3]) < (W + o[4]) / 2 + gap)) continue;
      segs.push(s); cells.push({ x, y, a, L, w: W, Ld: c.L, wd: c.w }); break;
    }
  }
  return cells;
}

// a cell's outline as a closed polygon (two straight sides and two half circles)
export function outline(c, n = 10) {
  const half = (c.L - c.w) / 2, r = c.w / 2, ux = Math.cos(c.a), uy = Math.sin(c.a), pts = [];
  for (const end of [1, -1]) {
    const cx = c.x + ux * half * end, cy = c.y + uy * half * end;
    for (let i = 0; i <= n; i++) { const t = c.a + (end === 1 ? -Math.PI / 2 : Math.PI / 2) + Math.PI * i / n; pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
  }
  return pts;
}

// the law as the measurement reads it: slope of log w on log L (least squares)
export function slope(cells) {
  const X = cells.map(c => Math.log(c.Ld ?? c.L)), Y = cells.map(c => Math.log(c.wd ?? c.w)), n = X.length;
  const mx = X.reduce((a, b) => a + b, 0) / n, my = Y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (X[i] - mx) * (Y[i] - my); sxx += (X[i] - mx) ** 2; }
  return sxy / sxx;
}

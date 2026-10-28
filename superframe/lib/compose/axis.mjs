// axis.mjs: the composition-axis scorer. Two maps on a grid over the frame:
//   lines(p)    = sum over segments of length x exp(-theta^2 / 2 sigma^2), theta the angle between a segment and the
//                 ray from its midpoint to p: how much line length points at p (geometry).
//   contrast(p) = the largest centre-surround difference in CIE L* at p over three scales (a box of half-size r
//                 against the ring out to 2r, r = 1%, 2%, 4% of W), divided by 100 (photometry).
// The anchor is the argmax of lines / max(lines) x contrast / max(contrast). Multiplying the two is an authored
// convention taken from the intake (B1 row 27: "the axis that ties lines and vectors together", with contrast
// attracting gaze); it is not physics, and the ablations report each map alone.
import { pointing } from './vp.mjs';

const lstar = Y => (Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : Y * 24389 / 27);
const lin = c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };

function integralL(rgba, w, h) {
  const lut = new Float64Array(256); for (let v = 0; v < 256; v++) lut[v] = lin(v);
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0;
    for (let x = 0; x < w; x++) { const p = 4 * (y * w + x); row += lstar(0.2126 * lut[rgba[p]] + 0.7152 * lut[rgba[p + 1]] + 0.0722 * lut[rgba[p + 2]]); I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
  return I;
}
function boxSum(I, w, h, x0, y0, x1, y1) {
  x0 = Math.max(0, Math.min(w, Math.round(x0))); x1 = Math.max(0, Math.min(w, Math.round(x1))); y0 = Math.max(0, Math.min(h, Math.round(y0))); y1 = Math.max(0, Math.min(h, Math.round(y1)));
  const W = w + 1; return { s: I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0], a: (x1 - x0) * (y1 - y0) };
}

export function grid(w, h, cells = 160) {
  const g = w / cells, nx = cells, ny = Math.round(h / g), pts = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push([(i + 0.5) * w / nx, (j + 0.5) * h / ny]);
  return { nx, ny, pts };
}

export function contrastMap(rgba, w, h, G, scales = [0.01, 0.02, 0.04]) {
  const I = integralL(rgba, w, h), out = new Float64Array(G.pts.length);
  G.pts.forEach(([x, y], k) => {
    let best = 0;
    for (const f of scales) {
      const r = f * w, a = boxSum(I, w, h, x - r, y - r, x + r, y + r), b = boxSum(I, w, h, x - 2 * r, y - 2 * r, x + 2 * r, y + 2 * r);
      if (a.a < 1 || b.a - a.a < 1) continue;
      best = Math.max(best, Math.abs(a.s / a.a - (b.s - a.s) / (b.a - a.a)) / 100);
    }
    out[k] = best;
  });
  return out;
}

export function lineMap(segs, G, { sigmaDeg = 3 } = {}) {
  const sig = sigmaDeg * Math.PI / 180, out = new Float64Array(G.pts.length);
  const dirs = segs.map(s => { const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1; return [(s.x2 - s.x1) / L, (s.y2 - s.y1) / L]; });
  G.pts.forEach((p, k) => { let v = 0; for (let i = 0; i < segs.length; i++) { const t = pointing(segs[i], p, dirs[i]); if (t < 3 * sig) v += segs[i].len * Math.exp(-t * t / (2 * sig * sig)); } out[k] = v; });
  return out;
}

const norm = a => { let m = 0; for (const v of a) m = Math.max(m, v); return m > 0 ? a.map(v => v / m) : a.map(() => 0); };
const argmax = a => { let b = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i; return b; };

// The anchor and the ablations. Returns points in pixels and the three maps (normalised) for plates.
export function compositionAxis(rgba, w, h, segs, { cells = 160, sigmaDeg = 3, contrast = null } = {}) {
  const G = grid(w, h, cells), C = norm(contrast ?? contrastMap(rgba, w, h, G)), L = norm(lineMap(segs, G, { sigmaDeg }));
  // With no line length at all (no segments), the product is zero everywhere; the anchor then falls back to contrast
  // alone and says so, instead of returning the first grid cell.
  const noLines = !L.some(v => v > 0), P = noLines ? C : L.map((v, i) => v * C[i]), k = argmax(P);
  return {
    anchor: G.pts[k], score: P[k], basis: noLines ? 'contrast alone' : 'lines x contrast', lineOnly: noLines ? null : G.pts[argmax(L)], contrastOnly: G.pts[argmax(C)],
    maps: { nx: G.nx, ny: G.ny, lines: L, contrast: C, product: norm(P) }, grid: G,
    convention: 'anchor = argmax of normalised line convergence x normalised local L* contrast (authored)',
  };
}

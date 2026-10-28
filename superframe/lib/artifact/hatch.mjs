// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// hatch.mjs: tone as hatching, the way an engraver or a sketch artist lays it. The idea comes from the author's
// reference save of Krbn (u/valeriupalos, 2026-07-12), which sets curvature hatching beside flat hatching on the
// same shapes; nothing of Krbn's code or pictures is used, only the comparison.
//
// The field is read as a height surface. Its Hessian (second derivatives, after a Gaussian of SIGMA sim px) gives the
// two principal curvature directions at every point. A stroke runs along the direction of LEAST curvature, which is
// the direction an engraver's line wraps around a form (latitude lines on a dome, rings round a ridge). Where the
// two curvatures are nearly equal the Hessian has no preferred direction, and the stroke follows the contour (the
// tangent of the isoline) instead; where the field is flat it takes the sheet angle. Darker tone gets more strokes,
// longer strokes, heavier strokes and, past CROSS, a second layer along the other principal direction.
//
// mode 'flat' is the control: the same seeds, the same tone-to-density law, the same lengths and widths, every
// stroke at the sheet angle. Only the direction differs, so any difference in a measure is the direction's doing.
//
// Locality: strokes are short and seeded on a fixed grid whose jitter comes from the pixel hash of the grid cell,
// never from a weight, and there is no global spacing pass. A stroke reads the field only within its own length, so
// an edit moves strokes only within REACH sim px of the edited region.
import { pixelHash01 } from '../../../substrate/lib/vendor/superstack.mjs';

export const SIGMA = 2, CROSS = 0.55;
const STEP = 0.5;

// separable Gaussian, direct window sums (no running sum, so no rounding carried along a row)
function gauss(F, w, h, s) {
  const r = Math.ceil(3 * s), k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * s * s))), n = k.reduce((a, b) => a + b, 0);
  const T = new Float32Array(w * h), O = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * F[y * w + Math.min(w - 1, Math.max(0, x + i))]; T[y * w + x] = a / n; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * T[Math.min(h - 1, Math.max(0, y + i)) * w + x]; O[y * w + x] = a / n; }
  return O;
}

// per cell: the stroke direction (dx, dy) and the cross direction, plus which rule chose it (for the study)
export function directionField(F, w, h, { mode = 'curvature', angle = 45 } = {}) {
  const n = w * h, D = new Float32Array(2 * n), rule = new Uint8Array(n), a0 = angle * Math.PI / 180, fx = Math.cos(a0), fy = Math.sin(a0);
  if (mode === 'flat') { for (let k = 0; k < n; k++) { D[2 * k] = fx; D[2 * k + 1] = fy; } return { D, rule }; }
  const S = gauss(F, w, h, SIGMA), at = (x, y) => S[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, c = at(x, y), gx = (at(x + 1, y) - at(x - 1, y)) / 2, gy = (at(x, y + 1) - at(x, y - 1)) / 2;
    const hxx = at(x + 1, y) - 2 * c + at(x - 1, y), hyy = at(x, y + 1) - 2 * c + at(x, y - 1), hxy = (at(x + 1, y + 1) - at(x - 1, y + 1) - at(x + 1, y - 1) + at(x - 1, y - 1)) / 4;
    const m = (hxx + hyy) / 2, d = Math.hypot((hxx - hyy) / 2, hxy), l1 = m + d, l2 = m - d;
    const small = Math.abs(l1) < Math.abs(l2) ? l1 : l2, aniso = (2 * d) / (Math.abs(l1) + Math.abs(l2) + 1e-6), g = Math.hypot(gx, gy);
    let ux, uy;
    if (aniso > 0.35 && d > 2e-5) {          // the least-curvature principal direction
      ux = hxy; uy = small - hxx; if (Math.hypot(ux, uy) < 1e-9) { ux = small - hyy; uy = hxy; } rule[k] = 1;
    } else if (g > 1e-4) { ux = -gy; uy = gx; rule[k] = 2; }   // along the contour
    else { ux = fx; uy = fy; rule[k] = 3; }                     // flat: the sheet angle
    const l = Math.hypot(ux, uy) || 1; D[2 * k] = ux / l; D[2 * k + 1] = uy / l;
  }
  return { D, rule };
}

const dirAt = (D, w, h, x, y) => { const i = Math.min(w - 1, Math.max(0, Math.round(x))), j = Math.min(h - 1, Math.max(0, Math.round(y))), k = j * w + i; return [D[2 * k], D[2 * k + 1]]; };

// one stroke from (x, y) along the field (cross: turned 90 degrees), both ways, at most len sim px, stopping where tone
// falls under stop; directions are a line field, so each step keeps the sign of the step before
function trace(F, D, w, h, x, y, len, cross, stop) {
  const half = [];
  for (const sgn of [1, -1]) {
    let px = x, py = y, pdx = 0, pdy = 0, run = 0; const pts = [];
    while (run < len / 2) {
      let [dx, dy] = dirAt(D, w, h, px, py); if (cross) [dx, dy] = [-dy, dx];
      if (run === 0) { dx *= sgn; dy *= sgn; } else if (dx * pdx + dy * pdy < 0) { dx = -dx; dy = -dy; }
      const nx = px + dx * STEP, ny = py + dy * STEP;
      if (nx < 0 || ny < 0 || nx > w - 1 || ny > h - 1 || F[Math.round(ny) * w + Math.round(nx)] < stop) break;
      px = nx; py = ny; pdx = dx; pdy = dy; run += STEP; pts.push([px, py]);
    }
    half.push(pts);
  }
  return [...half[1].reverse(), [x, y], ...half[0]];
}

// the strokes for a tone field F (0..1, sim px): spacing d sim px; returns sim-space polylines with their tone
export function hatch(F, w, h, { mode = 'curvature', angle = 45, seed = 'hatch', d = 2.2, stop = 0.05 } = {}) {
  const { D, rule } = directionField(F, w, h, { mode, angle }), strokes = [];
  for (let j = 0; j * d < h; j++) for (let i = 0; i * d < w; i++) {
    const x = (i + pixelHash01(i, j, `${seed}/x`)) * d, y = (j + pixelHash01(i, j, `${seed}/y`)) * d;
    if (x > w - 1 || y > h - 1) continue;
    const tone = F[Math.round(y) * w + Math.round(x)]; if (tone < stop) continue;
    const dens = Math.min(1, Math.max(0, (tone - 0.04) / 0.7));
    if (pixelHash01(i, j, `${seed}/keep`) > dens) continue;
    const len = d * (2.5 + 5 * tone);
    strokes.push({ pts: trace(F, D, w, h, x, y, len, false, stop), tone });
    if (tone > CROSS && pixelHash01(i, j, `${seed}/cross`) < (tone - CROSS) / (1 - CROSS)) strokes.push({ pts: trace(F, D, w, h, x, y, len * 0.8, true, stop), tone });
  }
  return { strokes, rule, D };
}

// the largest distance, in sim px, from an edited cell to a stroke point that can change: smoothing reach, the
// derivative stencil, and the longest stroke's half length (d * 7.5 / 2) both from a seed outside and back in
export const reach = (d = 2.2) => Math.ceil(3 * SIGMA + 1 + d * 7.5 + 2);

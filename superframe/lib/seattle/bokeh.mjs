// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// bokeh.mjs: the child's eye is focused on the raindrops on the glass, so everything beyond the glass is out of focus.
// Geometric defocus for an eye focused at distance s looking at an object at distance o: a point spreads into a blur
// disc of angular diameter  b = p |1/s - 1/o|  radians, with p the pupil diameter (same length units as 1/s).
// At night the pupil is wide (about 6 to 7 mm in a child; it shrinks with age), so with the eye on glass 0.2 m away a
// streetlight 15 m off spreads over about 7 mm x (5 - 0.067) / m = 0.035 rad, two degrees. Every object beyond a few
// metres blurs by nearly the same amount, because 1/o is small next to 1/s.
//
// The blur disc is the shape of the aperture: the pupil, cut by the eyelids when squinting. A squint narrows the
// vertical opening, so the discs turn into wide, flat ovals.
//
//   blurAngle(pupil m, focus m, object m)      angular diameter of the blur disc, rad
//   aperture(diameterPx, open)                 normalised kernel: disc cut to |y| <= open * r (open = 1: no squint)
//   defocus(F, diameterPx, open, { split })    scatters every pixel brighter than split through the exact aperture,
//                                              and blurs the dim rest with a box cascade of matching width. Point
//                                              lights get the true aperture shape; the dim sky only needs the spread.
import { frame, boxBlur } from './raster.mjs';

export const blurAngle = (pupil, focus, object) => pupil * Math.abs(1 / focus - 1 / object);

export function aperture(D, open = 1) {
  const r = D / 2, n = Math.ceil(r) * 2 + 1, c = (n - 1) / 2, k = new Float32Array(n * n);
  let s = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    // 4 x 4 subsamples for an area-true edge
    let cov = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const dx = x - c + (sx + 0.5) / 4 - 0.5, dy = y - c + (sy + 0.5) / 4 - 0.5;
      if (dx * dx + dy * dy <= r * r && Math.abs(dy) <= open * r) cov++;
    }
    k[y * n + x] = cov / 16; s += cov / 16;
  }
  for (let i = 0; i < k.length; i++) k[i] /= s || 1;
  return { n, k };
}

const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

export function defocus(F, D, open = 1, { split = 0.5 } = {}) {
  const { w, h } = F, out = frame(w, h), dim = frame(w, h), A = aperture(D, open), half = (A.n - 1) / 2;
  for (let i = 0; i < w * h; i++) {
    const j = 3 * i;
    if (lum(F.d, j) <= split) { dim.d[j] = F.d[j]; dim.d[j + 1] = F.d[j + 1]; dim.d[j + 2] = F.d[j + 2]; continue; }
    scatter(out, i % w, (i / w) | 0, F.d, j, A, half);
  }
  // box of radius r passed twice has a spread close to a disc of diameter D when r ~ D / 4 (matched second moment)
  boxBlur(dim, Math.max(1, Math.round(D / 4)), 2);
  for (let i = 0; i < out.d.length; i++) out.d[i] += dim.d[i];
  return out;
}
function scatter(out, x, y, src, j, A, half) {
  const { w, h } = out;
  for (let ky = 0; ky < A.n; ky++) {
    const Y = y + ky - half; if (Y < 0 || Y >= h) continue;
    for (let kx = 0; kx < A.n; kx++) {
      const wgt = A.k[ky * A.n + kx]; if (!wgt) continue;
      const X = x + kx - half; if (X < 0 || X >= w) continue;
      const o = 3 * (Y * w + X); out.d[o] += src[j] * wgt; out.d[o + 1] += src[j + 1] * wgt; out.d[o + 2] += src[j + 2] * wgt;
    }
  }
}

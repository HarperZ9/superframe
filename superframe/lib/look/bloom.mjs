// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// bloom.mjs: lens and film scatter as an energy-conserving, multi-scale point spread.
// The light above `threshold` (0 = all light, the physical case) is split off. A share `strength` of it is taken out of
// the picture and put back spread by a sum of Gaussians whose widths double from `radius` / 2^(levels-1) up to `radius`,
// weighted by `tail` per octave (0.5 to 0.8: a long tail reads as glass and haze, a short one as a clean lens). The
// weights sum to one, so total light is unchanged (less what leaves the frame edge); a halo is light moved, not added.
// The old bloom added two box blurs on top, which brightened the frame and drew a rectangle around every hot spot.
import { gauss, half, upTo } from './blur.mjs';

export function bloom(I, { threshold = 0, strength = 0.06, radius = 64, tail = 0.65, levels = 0, tint = [1, 1, 1] } = {}) {
  const { w, h, px } = I, n = w * h;
  const L = levels || Math.max(2, Math.min(9, Math.round(Math.log2(Math.max(2, radius))) + 1));
  const src = new Float32Array(px.length);
  for (let i = 0; i < px.length; i++) src[i] = Math.max(0, px[i] - threshold);
  // weights per octave, finest first, normalised
  const wts = Array.from({ length: L }, (_, k) => tail ** (L - 1 - k)), sw = wts.reduce((a, b) => a + b, 0);
  const acc = new Float32Array(px.length);
  // the finest level is an exact Gaussian at sigma0; coarser levels come from the pyramid (each about 2x wider)
  const sigma0 = Math.max(0.6, radius / 2 ** (L - 1));
  let cur = { px: src, w, h }, sig = 1;
  for (let k = 0; k < L; k++) {
    const want = sigma0 * 2 ** k;
    // stay fine enough that the Gaussian spans 2 or more coarse px: bilinear upsampling of a narrower peak draws a
    // diamond (measured: 23% brighter on the diagonal at 40 px with one coarse px)
    while (sig * 4 <= want && cur.w > 8 && cur.h > 8) { cur = half(cur.px, cur.w, cur.h); sig *= 2; }
    const g = gauss(cur.px, cur.w, cur.h, Math.sqrt(Math.max(0.01, (want / sig) ** 2 - (sig > 1 ? 1 : 0))));
    const up = cur.w === w ? g : upTo(g, cur.w, cur.h, w, h), q = wts[k] / sw;
    for (let i = 0; i < acc.length; i++) acc[i] += up[i] * q;
  }
  // resampling leaks a percent or so; rescale per channel so the spread light sums to exactly the light taken out
  for (let c = 0; c < 3; c++) {
    let a = 0, b = 0; for (let i = 0; i < n; i++) { a += acc[3 * i + c]; b += src[3 * i + c]; }
    const k = a > 0 ? b / a : 0; for (let i = 0; i < n; i++) { const j = 3 * i + c; px[j] += strength * (acc[j] * k * tint[c] - src[j]); }
  }
  return I;
}

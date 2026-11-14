// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// lash.mjs: squinting at a light makes rays. The eyelids close the pupil to a horizontal slit, and a straight
// aperture edge diffracts light at right angles to itself, so the lid margins throw a vertical streak through every
// bright light. Each eyelash is a thin opaque line across the opening; by Babinet's principle it diffracts like a slit
// of its own width, throwing a fainter, wider streak at right angles to the lash.
//
// Far-field (Fraunhofer) energy per unit angle from a slit of width s, averaged over its fringes, falls as
//   p(theta) = lambda / (2 pi^2 s theta^2)
// so a streak's brightness at angle theta from a source is the source energy times p(theta) times the pixel's angle.
// The streak is one pixel wide because across it the pupil's full width confines the light to lambda / 6 mm, far
// below a pixel. Red light spreads further than blue (p grows with lambda), so streak tips run warm.
// A lash blocks a share of the pupil equal to its width times its chord over the pupil area; that share is the
// energy its streak carries.
//
//   arms({ lid, lashes, rng })     the streak directions and their slit widths and energy shares
//   streaks(F, pxAngle, arms, { threshold, floor, gain })   adds the streaks of every pixel above threshold
// The tear meniscus along the lid margin also bends light into the vertical streak; `gain` stands in for it and is an
// authored factor, not derived.
export const LAMBDA_RGB = [610e-9, 550e-9, 465e-9];

export function arms({ slit = 1.6e-3, pupil = 6e-3, lashes = 5, lashWidth = 80e-6, rng = Math.random, tilt = 0 } = {}) {
  const out = [{ angle: Math.PI / 2 + tilt, s: slit, share: 1 }, { angle: -Math.PI / 2 + tilt, s: slit, share: 1 }];
  const area = Math.PI * (pupil / 2) ** 2;
  for (let i = 0; i < lashes; i++) {
    // lashes leave the lid edge within about 25 degrees of vertical, so their streaks fan about the horizontal
    const lean = (rng() - 0.5) * 50 * Math.PI / 180, chord = slit * (1.2 + rng()), share = lashWidth * chord / area;
    const dir = lean + tilt;
    out.push({ angle: dir, s: lashWidth, share }, { angle: dir + Math.PI, s: lashWidth, share });
  }
  return out;
}

// energy share per pixel at k pixels out, for one channel
export const armFalloff = (lambda, s, theta, dTheta) => Math.min(0.2, lambda / (2 * Math.PI ** 2 * s * theta * theta) * dTheta);

export function streaks(F, pxAngle, A, { threshold = 2, floor = 0.004, gain = 1, maxLen = 160 } = {}) {
  const { w, h } = F, src = F.d.slice();
  for (let i = 0; i < w * h; i++) {
    const j = 3 * i, L = 0.2126 * src[j] + 0.7152 * src[j + 1] + 0.0722 * src[j + 2];
    if (L <= threshold) continue;
    const x0 = i % w, y0 = (i / w) | 0;
    for (const arm of A) addArm(F, x0, y0, [src[j], src[j + 1], src[j + 2]], arm, pxAngle, gain * arm.share, floor, maxLen);
  }
  return F;
}
function addArm(F, x0, y0, rgb, arm, pxAngle, k, floor, maxLen) {
  const cx = Math.cos(arm.angle), cy = Math.sin(arm.angle);
  for (let n = 1; n <= maxLen; n++) {
    const x = Math.round(x0 + 0.5 + cx * n - 0.5), y = Math.round(y0 + 0.5 + cy * n - 0.5);
    if (x < 0 || y < 0 || x >= F.w || y >= F.h) return;
    const th = n * pxAngle, o = 3 * (y * F.w + x);
    let peak = 0;
    for (let c = 0; c < 3; c++) { const v = rgb[c] * k * armFalloff(LAMBDA_RGB[c], arm.s, th, pxAngle); F.d[o + c] += v; peak = Math.max(peak, v); }
    if (peak < floor) return;
  }
}

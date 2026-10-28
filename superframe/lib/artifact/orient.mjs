// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// orient.mjs: does the hatching follow the form? Measured from the rendered pixels, against a reference the hatcher
// never sees.
//   image side   the hatch-only raster is cut into B x B blocks; each block's structure tensor (summed products of
//                the pixel gradients) gives the dominant stroke orientation and its coherence (0 = no direction,
//                1 = one direction)
//   reference    the contour tangent of the tone field at the same place: perpendicular to its gradient, after a
//                Gaussian of 4 sim px (the hatcher uses the Hessian after 2 sim px, so the two are computed apart)
//   score        the coherence-weighted mean of cos^2 of the angle between them, over blocks with ink and a slope:
//                1 when every block's strokes run along the contours, 0.5 for directions unrelated to the form
// Flat hatching at one angle scores near 0.5 on any field whose contours turn; that is the control the score must
// separate from. The score cannot tell good hatching from bad drawing; it measures one property, direction.

function blur(F, w, h, s) {
  const r = Math.ceil(3 * s), k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * s * s))), n = k.reduce((a, b) => a + b, 0);
  const T = new Float32Array(w * h), O = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * F[y * w + Math.min(w - 1, Math.max(0, x + i))]; T[y * w + x] = a / n; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * T[Math.min(h - 1, Math.max(0, y + i)) * w + x]; O[y * w + x] = a / n; }
  return O;
}

export function orientationAgreement(cover, W, H, F, w, h, { B = 16, minInk = 0.04, minSlope = 2e-3 } = {}) {
  const S = blur(F, w, h, 4), sx = w / W, sy = h / H;
  let num = 0, den = 0, blocks = 0;
  for (let by = 0; by + B <= H; by += B) for (let bx = 0; bx + B <= W; bx += B) {
    let jxx = 0, jxy = 0, jyy = 0, ink = 0;
    for (let y = by + 1; y < by + B - 1; y++) for (let x = bx + 1; x < bx + B - 1; x++) {
      const k = y * W + x, gx = (cover[k + 1] - cover[k - 1]) / 2, gy = (cover[k + W] - cover[k - W]) / 2;
      jxx += gx * gx; jxy += gx * gy; jyy += gy * gy; ink += cover[k];
    }
    if (ink / ((B - 2) * (B - 2)) < minInk) continue;
    const tr = jxx + jyy; if (tr < 1e-9) continue;
    const coh = Math.hypot(jxx - jyy, 2 * jxy) / tr, phi = 0.5 * Math.atan2(2 * jxy, jxx - jyy);   // phi: across the strokes
    const cx = Math.min(w - 2, Math.max(1, Math.round((bx + B / 2) * sx))), cy = Math.min(h - 2, Math.max(1, Math.round((by + B / 2) * sy)));
    const gx = (S[cy * w + cx + 1] - S[cy * w + cx - 1]) / 2, gy = (S[(cy + 1) * w + cx] - S[(cy - 1) * w + cx]) / 2;
    if (Math.hypot(gx, gy) < minSlope) continue;
    // strokes run perpendicular to phi; contours run perpendicular to the field gradient: compare the two normals
    const c = Math.cos(phi - Math.atan2(gy, gx));
    num += coh * c * c; den += coh; blocks++;
  }
  return { score: den ? +(num / den).toFixed(4) : null, blocks };
}

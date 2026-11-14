// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// ink.mjs: a brush-and-ink line renderer for shapes given as signed distance fields (px, negative inside).
//   brushLine   the contour as a loaded brush stroke. Pressure rises on the side turned from the light (the inker's
//               weight-for-shadow habit), swells and thins along the stroke with a slow noise, and where pressure
//               drops the brush runs dry and breaks up along the paper's fibre. The line sits a little outside the
//               shape, so heavy weight eats the ground, not the fill.
//   hatch       parallel strokes in the shadow of a shape, spacing fixed, stroke width growing with darkness, each
//               stroke tapering and wavering; a second, crossing set comes in where it is darkest.
//   splatter    ink flicked from the brush: droplets with satellite specks thrown along one direction.
// All return coverage fields in 0..1 (Float32Array, w x h), antialiased by distance.
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function gradient(D, w, h) {
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    gx[i] = (D[y * w + Math.min(w - 1, x + 1)] - D[y * w + Math.max(0, x - 1)]) / 2;
    gy[i] = (D[Math.min(h - 1, y + 1) * w + x] - D[Math.max(0, y - 1) * w + x]) / 2;
  }
  return { gx, gy };
}

export function brushLine(D, w, h, { width = 8, light = [-0.6, -0.8], swell = 0.35, dry = 0.5, seed = 3, wave = 140 } = {}) {
  const { gx, gy } = gradient(D, w, h), out = new Float32Array(w * h), reach = 1.6 * width + 2;
  for (let i = 0; i < w * h; i++) {
    const d = D[i]; if (!(d > -reach && d < reach)) continue;
    const x = i % w, y = (i / w) | 0, g = Math.hypot(gx[i], gy[i]) || 1, nx = gx[i] / g, ny = gy[i] / g;
    const shadow = smooth(-0.7, 0.7, nx * light[0] * -1 + ny * light[1] * -1);
    const flow = 1 + swell * (2 * vnoise(x / wave, y / wave, seed) - 1);
    const p = clamp((0.28 + 0.72 * shadow) * flow, 0.08, 1.4), hw = 0.5 * width * p;
    // centre the stroke at +0.35 hw outside the edge
    const c = clamp(hw + 0.5 - Math.abs(d - 0.35 * hw));
    if (c <= 0) continue;
    // dry brush: low pressure lets the paper's grain through, as streaks along the stroke direction (-ny, nx)
    const along = x * -ny + y * nx, across = x * nx + y * ny;
    const fibre = vnoise(along / (width * 3), across / Math.max(1, width * 0.18), seed + 5);
    const breakup = smooth(0.15 + dry * 0.55 * (1 - p), 0.2 + dry * 0.55 * (1 - p), fibre);
    out[i] = c * (p > 0.85 ? 1 : breakup);
  }
  return out;
}

// shade(i) -> 0..1 darkness inside the shape (0 lit, 1 deep); D limits hatching to the inside.
export function hatch(D, w, h, shade, { pitch = 14, angle = 0.7, width = 0.55, cross = 0.65, seed = 9 } = {}) {
  const out = new Float32Array(w * h), sets = [[angle, 0], [angle + 1.15, cross]];
  for (let i = 0; i < w * h; i++) {
    if (!(D[i] < -1)) continue;
    const s = shade(i); if (s <= 0.05) continue;
    const x = i % w, y = (i / w) | 0;
    let cov = 0;
    for (const [a, from] of sets) {
      if (s < from) continue;
      const u = (x * Math.cos(a) + y * Math.sin(a)) / pitch + 0.25 * vnoise(x / 90, y / 90, seed), k = Math.floor(u), f = u - k - 0.5;
      // each stroke lifts off at a hashed point: a taper from the stroke's own random length
      const v = (-x * Math.sin(a) + y * Math.cos(a)) / (pitch * 9), taper = smooth(0, 0.35, 1 - Math.abs(2 * (v - Math.floor(v + hash(k, 1, seed)) - 0.5)));
      const hw = width * 0.5 * pitch * clamp((s - from) / (1 - from) * 1.6) * taper;
      cov = Math.max(cov, clamp(hw + 0.5 - Math.abs(f) * pitch));
    }
    out[i] = cov * smooth(-1, -4, D[i]);
  }
  return out;
}

export function splatter(w, h, { at = [], n = 30, size = 12, throwDir = [1, 0.2], seed = 21 } = {}) {
  const out = new Float32Array(w * h);
  const disc = (cx, cy, r) => {
    for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.min(h - 1, Math.ceil(cy + r + 1)); y++)
      for (let x = Math.max(0, Math.floor(cx - r - 1)); x <= Math.min(w - 1, Math.ceil(cx + r + 1)); x++) {
        const c = clamp(r + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy)); if (c > out[y * w + x]) out[y * w + x] = c;
      }
  };
  at.forEach(([x0, y0], j) => {
    for (let k = 0; k < n; k++) {
      const u = hash(j, k, seed), v = hash(k, j, seed + 1), dist = size * 12 * u ** 1.6, r = size * (1 - u) ** 2 * (0.25 + v);
      const jit = (hash(j, k, seed + 2) - 0.5) * 0.9, dx = throwDir[0] + jit * throwDir[1], dy = throwDir[1] + jit * throwDir[0];
      disc(x0 + dx * dist, y0 + dy * dist, Math.max(0.6, r));
      if (r > size * 0.4) for (let q = 1; q <= 3; q++) disc(x0 + dx * (dist + r * 1.6 * q), y0 + dy * (dist + r * 1.6 * q), r * 0.22 / q);
    }
  });
  return out;
}

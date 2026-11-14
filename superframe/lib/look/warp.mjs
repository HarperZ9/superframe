// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// warp.mjs: caricature warps as inverse maps (output px -> source px), so any field or SDF can be sampled through them.
//   bulge   { x, y, r, k }  k > 0 swells what lies inside r (eyes, noses, a letter's bowl); k < 0 pinches it
//   lean    { x, y, r, dx, dy }  drags a region (a drooping jaw, a melting serif)
//   wobble  amplitude and wavelength in px: a slow, hand-drawn waver over everything
// Exaggeration in caricature pushes a feature away from the norm; a bulge does that locally and keeps the rest still,
// with a smooth falloff so lines stay continuous (the map is the identity outside every r).
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy - 0.5;
}

export function caricature({ bulges = [], leans = [], wobble = 0, wavelength = 300, seed = 5 } = {}) {
  return (x, y) => {
    let X = x, Y = y;
    for (const b of bulges) {
      const dx = X - b.x, dy = Y - b.y, r = Math.hypot(dx, dy) / b.r;
      if (r >= 1) continue;
      // radial remap: s(r) = r^(1 + k) blended to the identity at the rim, so the inside swells (k > 0)
      const f = r > 1e-6 ? (r ** (1 + b.k) * (1 - r * r) + r * r * r) / r : 0;
      X = b.x + dx * f; Y = b.y + dy * f;
    }
    for (const l of leans) {
      const q = clamp(1 - Math.hypot(X - l.x, Y - l.y) / l.r), s = q * q * (3 - 2 * q);
      X -= l.dx * s; Y -= l.dy * s;
    }
    if (wobble) { X += wobble * vnoise(X / wavelength, Y / wavelength, seed); Y += wobble * vnoise(X / wavelength + 17, Y / wavelength, seed + 1); }
    return [X, Y];
  };
}

// Resample a scalar field through an inverse map (bilinear, clamp to edge).
export function warpField(F, w, h, map) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [sx, sy] = map(x + 0.5, y + 0.5), fx = clamp(sx - 0.5, 0, w - 1.001), fy = clamp(sy - 0.5, 0, h - 1.001);
    const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0, i = y0 * w + x0;
    out[y * w + x] = (F[i] * (1 - ax) + F[i + 1] * ax) * (1 - ay) + (F[i + w] * (1 - ax) + F[i + w + 1] * ax) * ay;
  }
  return out;
}
